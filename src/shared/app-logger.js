const fs = require('fs')
const path = require('path')
const util = require('util')

const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
}

function normalizeLevel(level, fallback = 'info') {
  const key = String(level || '').toLowerCase()
  return Object.prototype.hasOwnProperty.call(LEVEL_PRIORITY, key) ? key : fallback
}

function serializeMeta(meta) {
  if (!meta || typeof meta !== 'object') return undefined
  const out = {}
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === 'function') continue
    try {
      if (value instanceof Error) {
        out[key] = {
          name: value.name,
          message: value.message,
          stack: value.stack
        }
      } else {
        out[key] = JSON.parse(JSON.stringify(value))
      }
    } catch {
      out[key] = util.inspect(value, { depth: 3, breakLength: 120 })
    }
  }
  return out
}

function formatMessage(args) {
  return args.map((item) => {
    if (item instanceof Error) return item.stack || item.message || String(item)
    if (typeof item === 'string') return item
    try {
      return JSON.stringify(item)
    } catch {
      return util.inspect(item, { depth: 3, breakLength: 120 })
    }
  }).join(' ')
}

function createAppLogger(options = {}) {
  const userDataPath = options.userDataPath
  if (!userDataPath) throw new Error('createAppLogger requires userDataPath')

  const logDir = path.join(userDataPath, 'logs')
  const logPath = path.join(logDir, 'app.log')
  const configPath = path.join(userDataPath, 'logger-config.json')
  const maxFileSizeBytes = Number(options.maxFileSizeBytes) > 0 ? Number(options.maxFileSizeBytes) : 5 * 1024 * 1024
  const maxRotatedFiles = Number(options.maxRotatedFiles) > 0 ? Number(options.maxRotatedFiles) : 0
  const maxEntryCount = Number(options.maxEntryCount) > 0 ? Number(options.maxEntryCount) : 1500
  const maxBufferedEntries = Number(options.maxBufferedEntries) > 0 ? Number(options.maxBufferedEntries) : maxEntryCount
  const defaultLevel = normalizeLevel(options.defaultLevel, 'info')
  const originalConsole = options.originalConsole || {
    log: console.log.bind(console),
    info: typeof console.info === 'function' ? console.info.bind(console) : console.log.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: typeof console.debug === 'function' ? console.debug.bind(console) : console.log.bind(console)
  }

  let level = defaultLevel
  let buffer = []
  let isConsoleCaptured = false
  let restoreConsoleFn = null
  let writesSinceTrim = 0

  function ensureLogDir() {
    try {
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })
    } catch (e) {
      originalConsole.error('[Logger] 创建日志目录失败:', e && e.message ? e.message : e)
    }
  }

  function loadLevelFromConfig() {
    try {
      if (!fs.existsSync(configPath)) return
      const text = fs.readFileSync(configPath, 'utf8')
      const parsed = JSON.parse(text)
      level = normalizeLevel(parsed.level, defaultLevel)
    } catch {
      level = defaultLevel
    }
  }

  function saveLevelToConfig() {
    try {
      fs.writeFileSync(configPath, JSON.stringify({ level }, null, 2), 'utf8')
    } catch (e) {
      originalConsole.error('[Logger] 保存日志级别失败:', e && e.message ? e.message : e)
    }
  }

  function shouldWrite(entryLevel) {
    return LEVEL_PRIORITY[entryLevel] >= LEVEL_PRIORITY[level]
  }

  function rotateIfNeeded() {
    if (maxRotatedFiles <= 0) return
    try {
      if (!fs.existsSync(logPath)) return
      const st = fs.statSync(logPath)
      if (!st || st.size < maxFileSizeBytes) return
      for (let i = maxRotatedFiles; i >= 1; i--) {
        const src = i === 1 ? logPath : `${logPath}.${i - 1}`
        const dest = `${logPath}.${i}`
        if (fs.existsSync(dest)) fs.rmSync(dest, { force: true })
        if (fs.existsSync(src)) fs.renameSync(src, dest)
      }
    } catch (e) {
      originalConsole.error('[Logger] 日志轮转失败:', e && e.message ? e.message : e)
    }
  }

  function trimFileByEntryCount(force = false) {
    if (!force && writesSinceTrim < 20) return
    writesSinceTrim = 0
    try {
      if (!fs.existsSync(logPath)) return
      const text = fs.readFileSync(logPath, 'utf8')
      const lines = text.split(/\r?\n/).filter((line) => line && line.trim().length > 0)
      if (lines.length <= maxEntryCount) return
      const kept = lines.slice(lines.length - maxEntryCount)
      fs.writeFileSync(logPath, `${kept.join('\n')}\n`, 'utf8')
    } catch (e) {
      originalConsole.error('[Logger] 滚动删除旧日志失败:', e && e.message ? e.message : e)
    }
  }

  function appendEntry(entry) {
    ensureLogDir()
    rotateIfNeeded()
    try {
      fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8')
      writesSinceTrim += 1
      trimFileByEntryCount(false)
    } catch (e) {
      originalConsole.error('[Logger] 写入日志失败:', e && e.message ? e.message : e)
    }
  }

  function pushBuffer(entry) {
    buffer.push(entry)
    if (buffer.length > maxBufferedEntries) {
      buffer = buffer.slice(buffer.length - maxBufferedEntries)
    }
  }

  function write(levelName, message, meta) {
    const normalized = normalizeLevel(levelName, 'info')
    if (!shouldWrite(normalized)) return
    const entry = {
      ts: new Date().toISOString(),
      level: normalized,
      pid: process.pid,
      message: String(message || ''),
      meta: serializeMeta(meta)
    }
    pushBuffer(entry)
    appendEntry(entry)
  }

  function captureConsole(target = console) {
    if (isConsoleCaptured) return restoreConsoleFn
    const original = {
      log: target.log ? target.log.bind(target) : null,
      info: target.info ? target.info.bind(target) : null,
      warn: target.warn ? target.warn.bind(target) : null,
      error: target.error ? target.error.bind(target) : null,
      debug: target.debug ? target.debug.bind(target) : null
    }

    const patch = (method, levelName) => {
      if (!original[method]) return
      target[method] = (...args) => {
        try {
          write(levelName, formatMessage(args), {
            source: `console.${method}`
          })
        } catch {
          // ignore
        }
        original[method](...args)
      }
    }

    patch('log', 'info')
    patch('info', 'info')
    patch('warn', 'warn')
    patch('error', 'error')
    patch('debug', 'debug')

    isConsoleCaptured = true
    restoreConsoleFn = () => {
      if (original.log) target.log = original.log
      if (original.info) target.info = original.info
      if (original.warn) target.warn = original.warn
      if (original.error) target.error = original.error
      if (original.debug) target.debug = original.debug
      isConsoleCaptured = false
    }
    return restoreConsoleFn
  }

  function clear() {
    ensureLogDir()
    try {
      if (fs.existsSync(logPath)) fs.writeFileSync(logPath, '', 'utf8')
      for (let i = 1; i <= maxRotatedFiles; i++) {
        const rotated = `${logPath}.${i}`
        if (fs.existsSync(rotated)) fs.rmSync(rotated, { force: true })
      }
      buffer = []
      return { success: true }
    } catch (e) {
      return { success: false, error: e && e.message ? e.message : String(e) }
    }
  }

  function getFileInfo() {
    try {
      const st = fs.existsSync(logPath) ? fs.statSync(logPath) : null
      return {
        path: logPath,
        dir: logDir,
        level,
        exists: Boolean(st),
        size: st ? st.size : 0,
        updatedAt: st ? st.mtime.toISOString() : null
      }
    } catch {
      return {
        path: logPath,
        dir: logDir,
        level,
        exists: false,
        size: 0,
        updatedAt: null
      }
    }
  }

  function getRecent(limit = 300) {
    const safeLimit = Math.max(1, Math.min(maxEntryCount, Number(limit) || 300))
    return buffer.slice(-safeLimit)
  }

  function setLevel(nextLevel) {
    level = normalizeLevel(nextLevel, level)
    saveLevelToConfig()
    return level
  }

  function getLevel() {
    return level
  }

  ensureLogDir()
  trimFileByEntryCount(true)
  loadLevelFromConfig()
  write('info', `[Logger] initialized level=${level}`)

  return {
    logPath,
    logDir,
    levels: Object.keys(LEVEL_PRIORITY),
    write,
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
    getRecent,
    getFileInfo,
    getLevel,
    setLevel,
    clear,
    captureConsole,
    formatMessage
  }
}

module.exports = {
  createAppLogger,
  normalizeLevel
}
