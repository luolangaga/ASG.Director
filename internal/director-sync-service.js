const { WebSocketServer, WebSocket } = require('ws')
const crypto = require('crypto')

const PROTOCOL = 'asg-director-sync'
const VERSION = 1
const DEFAULT_PORT = 19625
const MAX_SEEN_MESSAGE_IDS = 2048

const DEFAULT_SETTINGS = Object.freeze({
  enabled: false,
  serverEnabled: false,
  clientEnabled: false,
  listenPort: DEFAULT_PORT,
  remoteHost: '',
  remotePort: DEFAULT_PORT,
  autoConnect: true
})

function normalizePort(input, fallback) {
  const port = parseInt(input, 10)
  if (!Number.isFinite(port) || port < 1024 || port > 65535) return fallback
  return port
}

function normalizeDirectorSyncSettings(input) {
  const base = input && typeof input === 'object' ? input : {}
  const explicitServerEnabled = typeof base.serverEnabled === 'boolean' ? base.serverEnabled : null
  const explicitClientEnabled = typeof base.clientEnabled === 'boolean' ? base.clientEnabled : null
  let enabled = base.enabled === true
  let serverEnabled = explicitServerEnabled
  let clientEnabled = explicitClientEnabled

  if (serverEnabled == null) serverEnabled = enabled
  if (clientEnabled == null) clientEnabled = enabled
  if (explicitServerEnabled != null || explicitClientEnabled != null) {
    enabled = !!(serverEnabled || clientEnabled)
  } else if (!enabled) {
    serverEnabled = false
    clientEnabled = false
  }

  return {
    enabled,
    serverEnabled,
    clientEnabled,
    listenPort: normalizePort(base.listenPort, DEFAULT_SETTINGS.listenPort),
    remoteHost: typeof base.remoteHost === 'string' ? base.remoteHost.trim() : '',
    remotePort: normalizePort(base.remotePort, DEFAULT_SETTINGS.remotePort),
    autoConnect: base.autoConnect !== false
  }
}

function safeClone(value) {
  if (value == null) return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return value
  }
}

function now() {
  return Date.now()
}

class DirectorSyncService {
  constructor(options = {}) {
    this.onIncomingUpdate = typeof options.onIncomingUpdate === 'function' ? options.onIncomingUpdate : null
    this.onStatusChange = typeof options.onStatusChange === 'function' ? options.onStatusChange : null
    this.log = options.logger && typeof options.logger.log === 'function' ? options.logger.log : () => {}
    this.warn = options.logger && typeof options.logger.warn === 'function' ? options.logger.warn : () => {}

    this.instanceId = options.instanceId || `${crypto.randomBytes(6).toString('hex')}-${process.pid}`
    this.settings = { ...DEFAULT_SETTINGS }

    this.server = null
    this.serverPort = null
    this.inboundSockets = new Set()

    this.outboundSocket = null
    this.outboundKey = ''
    this.reconnectTimer = null
    this.shouldReconnect = false

    this.lastError = null
    this.lastConnectedAt = null

    this.seenMessageIds = new Set()
    this.seenMessageQueue = []

    this.latestByType = {
      state: null,
      score: null,
      postmatch: null
    }
  }

  getSettings() {
    return { ...this.settings }
  }

  getStatus() {
    return {
      enabled: this.settings.enabled,
      serverEnabled: this.settings.serverEnabled,
      clientEnabled: this.settings.clientEnabled,
      listenPort: this.settings.listenPort,
      listening: !!this.server,
      remoteHost: this.settings.remoteHost,
      remotePort: this.settings.remotePort,
      autoConnect: this.settings.autoConnect,
      outboundConnected: !!(this.outboundSocket && this.outboundSocket.readyState === WebSocket.OPEN),
      inboundConnections: this.inboundSockets.size,
      instanceId: this.instanceId,
      lastError: this.lastError,
      lastConnectedAt: this.lastConnectedAt
    }
  }

  emitStatus() {
    if (!this.onStatusChange) return
    try {
      this.onStatusChange(this.getStatus())
    } catch (e) {
      this.warn('[DirectorSync] onStatusChange failed:', e && e.message ? e.message : e)
    }
  }

  setSettings(input) {
    const next = normalizeDirectorSyncSettings(input)
    this.settings = next
    this.applySettings()
    this.emitStatus()
    return this.getSettings()
  }

  applySettings() {
    const isEnabled = !!(this.settings.enabled && (this.settings.serverEnabled || this.settings.clientEnabled))
    if (!isEnabled) {
      this.stopAllSockets()
      this.lastError = null
      return
    }

    if (this.settings.serverEnabled) {
      this.ensureServer()
    } else {
      this.stopServer()
    }

    if (this.settings.clientEnabled && this.settings.autoConnect && this.settings.remoteHost) {
      this.shouldReconnect = true
      this.ensureOutboundConnection()
    } else {
      this.shouldReconnect = false
      this.stopOutboundConnection()
    }
  }

  ensureServer() {
    if (this.server && this.serverPort === this.settings.listenPort) return
    this.stopServer()

    try {
      this.server = new WebSocketServer({
        host: '0.0.0.0',
        port: this.settings.listenPort
      })
      this.serverPort = this.settings.listenPort

      this.server.on('connection', (socket) => {
        this.attachSocket(socket, 'inbound')
      })

      this.server.on('error', (error) => {
        this.lastError = `监听失败: ${error && error.message ? error.message : String(error)}`
        this.warn('[DirectorSync] server error:', this.lastError)
        this.emitStatus()
      })
    } catch (error) {
      this.lastError = `启动监听失败: ${error && error.message ? error.message : String(error)}`
      this.warn('[DirectorSync] start server failed:', this.lastError)
    }
  }

  stopServer() {
    if (!this.server) return
    const server = this.server
    this.server = null
    this.serverPort = null
    try {
      server.close()
    } catch {}
    for (const socket of this.inboundSockets) {
      try {
        socket.close()
      } catch {}
    }
    this.inboundSockets.clear()
  }

  buildOutboundKey() {
    if (!this.settings.remoteHost) return ''
    return `${this.settings.remoteHost}:${this.settings.remotePort}`
  }

  ensureOutboundConnection() {
    if (!this.settings.enabled || !this.settings.clientEnabled || !this.settings.remoteHost) return
    const key = this.buildOutboundKey()
    if (!key) return

    if (this.outboundSocket && this.outboundKey === key) {
      const state = this.outboundSocket.readyState
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return
    }

    this.stopOutboundConnection()
    this.outboundKey = key

    const url = `ws://${this.settings.remoteHost}:${this.settings.remotePort}`
    let socket = null
    try {
      socket = new WebSocket(url)
    } catch (error) {
      this.lastError = `连接失败: ${error && error.message ? error.message : String(error)}`
      this.scheduleReconnect()
      this.emitStatus()
      return
    }

    this.outboundSocket = socket

    socket.on('open', () => {
      this.lastError = null
      this.lastConnectedAt = now()
      this.sendHelloAndSnapshot(socket)
      this.emitStatus()
    })

    socket.on('message', (raw) => {
      this.handleMessage(raw, socket, 'outbound')
    })

    socket.on('close', () => {
      if (this.outboundSocket === socket) {
        this.outboundSocket = null
      }
      this.emitStatus()
      this.scheduleReconnect()
    })

    socket.on('error', (error) => {
      this.lastError = `连接错误: ${error && error.message ? error.message : String(error)}`
      this.warn('[DirectorSync] outbound error:', this.lastError)
      this.emitStatus()
    })
  }

  reconnectOutbound() {
    if (!this.settings.enabled || !this.settings.clientEnabled) return this.getStatus()
    this.shouldReconnect = true
    this.ensureOutboundConnection()
    this.emitStatus()
    return this.getStatus()
  }

  disconnectOutbound() {
    this.shouldReconnect = false
    this.stopOutboundConnection()
    this.emitStatus()
    return this.getStatus()
  }

  stopOutboundConnection() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    const socket = this.outboundSocket
    this.outboundSocket = null
    this.outboundKey = ''
    if (socket) {
      try {
        socket.close()
      } catch {}
    }
  }

  scheduleReconnect() {
    if (!this.settings.enabled || !this.settings.clientEnabled || !this.shouldReconnect || !this.settings.remoteHost) return
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.ensureOutboundConnection()
    }, 2500)
  }

  attachSocket(socket, direction) {
    this.inboundSockets.add(socket)
    this.lastError = null
    this.lastConnectedAt = now()
    this.emitStatus()

    socket.on('message', (raw) => {
      this.handleMessage(raw, socket, direction)
    })

    socket.on('close', () => {
      this.inboundSockets.delete(socket)
      this.emitStatus()
    })

    socket.on('error', (error) => {
      this.lastError = `连接错误: ${error && error.message ? error.message : String(error)}`
      this.warn('[DirectorSync] inbound error:', this.lastError)
      this.emitStatus()
    })

    this.sendHelloAndSnapshot(socket)
  }

  sendHelloAndSnapshot(socket) {
    this.sendEnvelopeToSocket(socket, 'hello', { instanceId: this.instanceId })

    const snapshotPayloads = []
    if (this.latestByType.state) snapshotPayloads.push(this.latestByType.state)
    if (this.latestByType.score) snapshotPayloads.push(this.latestByType.score)
    if (this.latestByType.postmatch) snapshotPayloads.push(this.latestByType.postmatch)

    if (snapshotPayloads.length > 0) {
      this.sendEnvelopeToSocket(socket, 'snapshot', { updates: snapshotPayloads })
    }
  }

  rememberMessageId(id) {
    if (!id || typeof id !== 'string') return false
    if (this.seenMessageIds.has(id)) return true
    this.seenMessageIds.add(id)
    this.seenMessageQueue.push(id)
    if (this.seenMessageQueue.length > MAX_SEEN_MESSAGE_IDS) {
      const oldest = this.seenMessageQueue.shift()
      if (oldest) this.seenMessageIds.delete(oldest)
    }
    return false
  }

  handleMessage(raw, socket, direction) {
    let envelope = null
    try {
      envelope = JSON.parse(String(raw || ''))
    } catch {
      return
    }
    if (!envelope || envelope.protocol !== PROTOCOL || envelope.version !== VERSION) return
    if (envelope.origin === this.instanceId) return

    const duplicated = this.rememberMessageId(envelope.id)
    if (duplicated) return

    if (envelope.kind === 'update') {
      const updatePayload = envelope.payload && envelope.payload.data
      if (!updatePayload) return
      this.rememberLatestPayload(updatePayload)
      if (this.onIncomingUpdate) {
        try {
          this.onIncomingUpdate(safeClone(updatePayload), {
            direction,
            origin: envelope.origin || null
          })
        } catch (error) {
          this.warn('[DirectorSync] apply incoming update failed:', error && error.message ? error.message : error)
        }
      }
      return
    }

    if (envelope.kind === 'snapshot') {
      const updates = envelope.payload && Array.isArray(envelope.payload.updates) ? envelope.payload.updates : []
      for (const item of updates) {
        if (!item) continue
        this.rememberLatestPayload(item)
        if (!this.onIncomingUpdate) continue
        try {
          this.onIncomingUpdate(safeClone(item), {
            direction,
            origin: envelope.origin || null,
            snapshot: true
          })
        } catch (error) {
          this.warn('[DirectorSync] apply incoming snapshot item failed:', error && error.message ? error.message : error)
        }
      }
    }
  }

  sendEnvelopeToSocket(socket, kind, payload) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    const envelope = {
      protocol: PROTOCOL,
      version: VERSION,
      id: crypto.randomUUID(),
      kind,
      origin: this.instanceId,
      ts: now(),
      payload
    }
    try {
      socket.send(JSON.stringify(envelope))
      return true
    } catch {
      return false
    }
  }

  sendEnvelope(kind, payload) {
    const envelope = {
      protocol: PROTOCOL,
      version: VERSION,
      id: crypto.randomUUID(),
      kind,
      origin: this.instanceId,
      ts: now(),
      payload
    }
    const body = JSON.stringify(envelope)
    let sent = false

    for (const socket of this.inboundSockets) {
      if (socket.readyState !== WebSocket.OPEN) continue
      try {
        socket.send(body)
        sent = true
      } catch {}
    }

    if (this.outboundSocket && this.outboundSocket.readyState === WebSocket.OPEN) {
      try {
        this.outboundSocket.send(body)
        sent = true
      } catch {}
    }

    return sent
  }

  rememberLatestPayload(update) {
    if (!update || typeof update !== 'object') return
    if (update.type === 'state' && update.state) {
      this.latestByType.state = safeClone(update)
    } else if (update.type === 'score' && update.scoreData) {
      this.latestByType.score = safeClone(update)
    } else if (update.type === 'postmatch' && update.postMatchData) {
      this.latestByType.postmatch = safeClone(update)
    }
  }

  broadcastUpdate(update) {
    if (!this.settings.enabled || (!this.settings.serverEnabled && !this.settings.clientEnabled)) return false
    if (!update || typeof update !== 'object') return false
    this.rememberLatestPayload(update)
    return this.sendEnvelope('update', { data: safeClone(update) })
  }

  stopAllSockets() {
    this.stopOutboundConnection()
    this.stopServer()
  }

  dispose() {
    this.shouldReconnect = false
    this.stopAllSockets()
  }
}

function createDirectorSyncService(options = {}) {
  return new DirectorSyncService(options)
}

module.exports = {
  createDirectorSyncService,
  normalizeDirectorSyncSettings
}
