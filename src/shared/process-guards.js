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
  const logError = (message, err, source) => {
    try {
      if (logger && typeof logger.error === 'function') {
        logger.error(message, {
          source,
          error: err && err.stack ? err.stack : err
        })
        return
      }
      if (logger && typeof logger.write === 'function') {
        logger.write('error', message, {
          source,
          error: err && err.stack ? err.stack : err
        })
        return
      }
      console.error(message, err && err.stack ? err.stack : err)
    } catch {
      // ignore
    }
  }

  process.on('uncaughtException', (err) => {
    if (isBrokenPipeError(err)) return
    logError('[Main] Uncaught exception', err, 'process.uncaughtException')
  })

  process.on('unhandledRejection', (reason) => {
    if (isBrokenPipeError(reason)) return
    logError('[Main] Unhandled rejection', reason, 'process.unhandledRejection')
  })
}

module.exports = {
  isBrokenPipeError,
  installProcessErrorGuards
}
