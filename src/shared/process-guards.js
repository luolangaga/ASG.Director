function isBrokenPipeError(err) {
  try {
    if (!err) return false
    const code = err.code || err.errno
    const msg = (err.message || String(err)).toLowerCase()
    return code === 'EPIPE' || code === -32 || msg.includes('epipe') || msg.includes('broken pipe')
  } catch {
    return false
  }
}

function installProcessErrorGuards(logger = console) {
  process.on('uncaughtException', (err) => {
    if (isBrokenPipeError(err)) return
    try {
      logger.error('[Main] Uncaught exception:', err && err.stack ? err.stack : err)
    } catch {
      // ignore
    }
  })

  process.on('unhandledRejection', (reason) => {
    if (isBrokenPipeError(reason)) return
    try {
      logger.error('[Main] Unhandled rejection:', reason && reason.stack ? reason.stack : reason)
    } catch {
      // ignore
    }
  })
}

module.exports = {
  isBrokenPipeError,
  installProcessErrorGuards
}
