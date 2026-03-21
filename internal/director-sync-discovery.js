const dgram = require('dgram')
const os = require('os')
const crypto = require('crypto')

const DISCOVERY_PROTOCOL = 'asg-director-sync-discovery'
const DISCOVERY_VERSION = 1
const DISCOVERY_PORT = 19626
const DEFAULT_SCAN_TIMEOUT = 1500

function now() {
  return Date.now()
}

function safeJsonParse(input) {
  try {
    return JSON.parse(String(input || ''))
  } catch {
    return null
  }
}

function getLocalIpv4Info() {
  const interfaces = os.networkInterfaces()
  const results = []
  const seenAddresses = new Set()

  for (const [name, entries] of Object.entries(interfaces || {})) {
    for (const entry of entries || []) {
      if (!entry || entry.internal || entry.family !== 'IPv4' || !entry.address) continue
      if (seenAddresses.has(entry.address)) continue
      seenAddresses.add(entry.address)
      results.push({
        name,
        address: entry.address,
        netmask: entry.netmask || ''
      })
    }
  }

  return results
}

function ipv4ToInt(ip) {
  const parts = String(ip || '').split('.').map((item) => parseInt(item, 10))
  if (parts.length !== 4 || parts.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return null
  return ((parts[0] << 24) >>> 0) + ((parts[1] << 16) >>> 0) + ((parts[2] << 8) >>> 0) + (parts[3] >>> 0)
}

function intToIpv4(value) {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255
  ].join('.')
}

function getBroadcastAddresses() {
  const localInfos = getLocalIpv4Info()
  const results = new Set(['255.255.255.255'])

  for (const info of localInfos) {
    const addressInt = ipv4ToInt(info.address)
    const maskInt = ipv4ToInt(info.netmask)
    if (addressInt == null || maskInt == null) continue
    const broadcastInt = (addressInt & maskInt) | (~maskInt >>> 0)
    results.add(intToIpv4(broadcastInt >>> 0))
  }

  return Array.from(results)
}

class DirectorSyncDiscoveryService {
  constructor(options = {}) {
    this.getSyncStatus = typeof options.getSyncStatus === 'function' ? options.getSyncStatus : () => ({})
    this.instanceId = options.instanceId || `${crypto.randomBytes(6).toString('hex')}-${process.pid}`
    this.log = options.logger && typeof options.logger.log === 'function' ? options.logger.log : () => {}
    this.warn = options.logger && typeof options.logger.warn === 'function' ? options.logger.warn : () => {}

    this.socket = null
    this.bindPromise = null
    this.pendingScans = new Set()
  }

  buildAnnouncementPayload() {
    const status = this.getSyncStatus() || {}
    const interfaces = getLocalIpv4Info()
    return {
      protocol: DISCOVERY_PROTOCOL,
      version: DISCOVERY_VERSION,
      type: 'discover-response',
      instanceId: this.instanceId,
      hostname: os.hostname(),
      displayName: os.hostname(),
      appName: 'ASG.Director',
      serverEnabled: !!status.serverEnabled,
      listening: !!status.listening,
      listenPort: Number(status.listenPort || 0),
      addresses: interfaces.map((item) => item.address),
      ts: now()
    }
  }

  shouldAnnounce() {
    const status = this.getSyncStatus() || {}
    return !!(status.enabled && status.serverEnabled && status.listening && status.listenPort)
  }

  ensureSocket() {
    if (this.socket) return Promise.resolve(this.socket)
    if (this.bindPromise) return this.bindPromise

    this.bindPromise = new Promise((resolve, reject) => {
      const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
      let settled = false

      const cleanup = () => {
        socket.removeAllListeners('listening')
      }

      socket.on('message', (msg, rinfo) => {
        this.handleMessage(msg, rinfo)
      })

      socket.on('error', (error) => {
        if (!settled) {
          this.bindPromise = null
          cleanup()
          settled = true
          reject(error)
          return
        }
        this.warn('[DirectorSyncDiscovery] socket error:', error && error.message ? error.message : error)
      })

      socket.once('listening', () => {
        try {
          socket.setBroadcast(true)
        } catch {}
        this.socket = socket
        this.bindPromise = null
        cleanup()
        settled = true
        resolve(socket)
      })

      try {
        socket.bind(DISCOVERY_PORT, '0.0.0.0')
      } catch (error) {
        this.bindPromise = null
        cleanup()
        reject(error)
      }
    })

    return this.bindPromise
  }

  handleMessage(msg, rinfo) {
    const payload = safeJsonParse(msg)
    if (!payload || payload.protocol !== DISCOVERY_PROTOCOL || payload.version !== DISCOVERY_VERSION) return
    if (payload.instanceId && payload.instanceId === this.instanceId) return

    if (payload.type === 'discover-request') {
      if (!this.shouldAnnounce()) return
      this.sendPacket({
        ...this.buildAnnouncementPayload(),
        requestId: payload.requestId || null
      }, rinfo.address, rinfo.port).catch((error) => {
        this.warn('[DirectorSyncDiscovery] send response failed:', error && error.message ? error.message : error)
      })
      return
    }

    if (payload.type !== 'discover-response') return
    for (const scan of this.pendingScans) {
      scan.accept(payload, rinfo)
    }
  }

  async sendPacket(payload, host, port = DISCOVERY_PORT) {
    const socket = await this.ensureSocket()
    const body = Buffer.from(JSON.stringify(payload))
    await new Promise((resolve, reject) => {
      socket.send(body, port, host, (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  normalizeDevice(payload, rinfo) {
    const addresses = Array.isArray(payload.addresses)
      ? payload.addresses.map((item) => String(item || '').trim()).filter(Boolean)
      : []
    const preferredAddress = addresses.includes(rinfo.address) ? rinfo.address : (addresses[0] || rinfo.address)
    return {
      instanceId: payload.instanceId || null,
      hostname: payload.hostname || '',
      displayName: payload.displayName || payload.hostname || rinfo.address,
      appName: payload.appName || 'ASG.Director',
      address: preferredAddress,
      remotePort: Number(payload.listenPort || 0) || 19625,
      addresses,
      serverEnabled: !!payload.serverEnabled,
      listening: !!payload.listening,
      discoveredAt: now()
    }
  }

  async scan(options = {}) {
    const timeoutMs = Math.max(500, Math.min(Number(options.timeoutMs || DEFAULT_SCAN_TIMEOUT), 5000))
    await this.ensureSocket()

    return await new Promise(async (resolve, reject) => {
      const requestId = crypto.randomUUID()
      const results = new Map()

      const scan = {
        accept: (payload, rinfo) => {
          if (payload.requestId && payload.requestId !== requestId) return
          const device = this.normalizeDevice(payload, rinfo)
          if (!device.address || !device.remotePort) return
          const key = device.instanceId || `${device.address}:${device.remotePort}`
          const previous = results.get(key)
          results.set(key, previous ? { ...previous, ...device, discoveredAt: device.discoveredAt } : device)
        }
      }

      this.pendingScans.add(scan)

      const timer = setTimeout(() => {
        this.pendingScans.delete(scan)
        resolve({
          success: true,
          devices: Array.from(results.values()).sort((a, b) => String(a.displayName || a.address).localeCompare(String(b.displayName || b.address), 'zh-CN'))
        })
      }, timeoutMs)

      const payload = {
        protocol: DISCOVERY_PROTOCOL,
        version: DISCOVERY_VERSION,
        type: 'discover-request',
        instanceId: this.instanceId,
        hostname: os.hostname(),
        requestId,
        ts: now()
      }

      try {
        const addresses = getBroadcastAddresses()
        await Promise.all(addresses.map((address) => this.sendPacket(payload, address, DISCOVERY_PORT)))
      } catch (error) {
        clearTimeout(timer)
        this.pendingScans.delete(scan)
        reject(error)
      }
    })
  }

  dispose() {
    for (const scan of this.pendingScans) {
      this.pendingScans.delete(scan)
    }
    if (!this.socket) return
    const socket = this.socket
    this.socket = null
    try {
      socket.close()
    } catch {}
  }
}

function createDirectorSyncDiscoveryService(options = {}) {
  return new DirectorSyncDiscoveryService(options)
}

module.exports = {
  createDirectorSyncDiscoveryService,
  DISCOVERY_PORT
}
