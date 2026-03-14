const fs = require('fs')
const path = require('path')

const FIXED_FRONTEND_WIDTH = 1686
const FIXED_FRONTEND_HEIGHT = 934

function isFrontendPageUrl(url) {
  const text = String(url || '').toLowerCase()
  return text.includes('/frontend') || text.includes('frontend.html') || text.includes('custom-frontend.html')
}

function registerBasicIpcHandlers({ ipcMain, BrowserWindow }) {
  ipcMain.on('preload:loaded', (event, info) => {
    try {
      const wcId = event?.sender?.id
      console.log('[Preload] loaded:', { wcId, ...info })
    } catch {
      console.log('[Preload] loaded')
    }
  })

  ipcMain.on('renderer:log', (event, payload) => {
    try {
      const wcId = event?.sender?.id
      const level = payload?.level || 'info'
      const source = payload?.source || 'renderer'
      const url = payload?.url
      const msg = payload?.message
      const stack = payload?.stack
      const loc = payload?.filename
        ? `${payload.filename}:${payload.lineno || 0}:${payload.colno || 0}`
        : null

      const header = `[Renderer:${level}](${source}) wcId=${wcId}${url ? ` url=${url}` : ''}${loc ? ` @ ${loc}` : ''}`
      if (level === 'error') {
        console.error(header)
        if (msg) console.error(String(msg))
        if (stack) console.error(String(stack))
      } else {
        console.log(header)
        if (msg) console.log(String(msg))
      }
    } catch (e) {
      console.error('[Renderer:log] failed', e)
    }
  })

  ipcMain.handle('check-file-exists', (event, filePath) => fs.existsSync(filePath))

  ipcMain.handle('find-texture-dir', async (event, modelPath) => {
    try {
      if (!modelPath) return null
      const modelDir = path.dirname(modelPath)
      if (!fs.existsSync(modelDir)) return null

      const files = fs.readdirSync(modelDir)
      const imageExtensions = ['.tga', '.png', '.bmp', '.jpg', '.jpeg']
      const hasImages = files.some(f => imageExtensions.includes(path.extname(f).toLowerCase()))
      if (hasImages) return null

      const entries = fs.readdirSync(modelDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDir = path.join(modelDir, entry.name)
          try {
            const subFiles = fs.readdirSync(subDir)
            if (subFiles.some(f => imageExtensions.includes(path.extname(f).toLowerCase()))) {
              return subDir
            }
          } catch {
            // ignore subDir errors
          }
        }
      }
    } catch (e) {
      console.error('[Main] find-texture-dir error:', e)
    }
    return null
  })

  ipcMain.on('open-devtools', (event) => {
    const webContents = event.sender
    if (webContents) {
      webContents.openDevTools({ mode: 'detach' })
    }
  })

  ipcMain.handle('resize-window', async (event, width, height) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { success: false, error: 'Window not found' }
      if (isFrontendPageUrl(event?.sender?.getURL?.())) {
        win.setContentSize(FIXED_FRONTEND_WIDTH, FIXED_FRONTEND_HEIGHT)
        return {
          success: false,
          width: FIXED_FRONTEND_WIDTH,
          height: FIXED_FRONTEND_HEIGHT,
          error: '前台窗口尺寸已固定为 1686x934，不允许修改'
        }
      }
      const w = Number.isFinite(width) ? Math.max(100, Math.floor(width)) : null
      const h = Number.isFinite(height) ? Math.max(100, Math.floor(height)) : null
      if (!w || !h) return { success: false, error: 'Invalid size' }
      win.setContentSize(w, h)
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}

module.exports = {
  registerBasicIpcHandlers
}
