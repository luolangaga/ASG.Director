const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const os = require('os')
const https = require('https')
const http = require('http')
const archiver = require('archiver')
const { pinyin } = require('pinyin-pro')

// 兜底：某些环境下（例如把 stdout/stderr 通过管道截断）console.log 会触发 EPIPE，
// 进而导致主进程 Uncaught Exception 弹窗。这里仅忽略 EPIPE，不吞掉其他异常。
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

process.on('uncaughtException', (err) => {
  if (isBrokenPipeError(err)) return
  try {
    console.error('[Main] Uncaught exception:', err && err.stack ? err.stack : err)
  } catch {
    // ignore
  }
})

process.on('unhandledRejection', (reason) => {
  if (isBrokenPipeError(reason)) return
  try {
    console.error('[Main] Unhandled rejection:', reason && reason.stack ? reason.stack : reason)
  } catch {
    // ignore
  }
})

// 引入重构的模块
const { zipDirectory, unzipFile, validateZip } = require('./utils/archive')
const { httpGet, httpPost, downloadFile, formatSize } = require('./utils/downloader')
const packManager = require('./utils/packManager')
const pluginPackManager = require('./utils/pluginPackManager')

// 插件系统
const { bootstrapPluginSystem, waitPluginSystemReady, setPluginWindow, setPluginRoomData, shutdownPlugins, pluginManager } = require('./plugins/bootstrap')

// preload 心跳：用于确认 preload 是否注入成功
ipcMain.on('preload:loaded', (event, info) => {
  try {
    const wcId = event?.sender?.id
    console.log('[Preload] loaded:', { wcId, ...info })
  } catch (e) {
    console.log('[Preload] loaded')
  }
})

// 渲染进程全局错误桥：把 renderer 的报错统一打印到终端（npm start 输出）
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

ipcMain.handle('check-file-exists', (event, filePath) => {
  return fs.existsSync(filePath)
})

ipcMain.handle('find-texture-dir', async (event, modelPath) => {
  try {
    if (!modelPath) return null
    const modelDir = path.dirname(modelPath)
    if (!fs.existsSync(modelDir)) return null

    // 1. 检查当前目录是否有图片
    const files = fs.readdirSync(modelDir)
    const imageExtensions = ['.tga', '.png', '.bmp', '.jpg', '.jpeg']
    const hasImages = files.some(f => imageExtensions.includes(path.extname(f).toLowerCase()))
    if (hasImages) return null // 默认当前目录

    // 2. 检查子目录
    const entries = fs.readdirSync(modelDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = path.join(modelDir, entry.name)
        try {
          const subFiles = fs.readdirSync(subDir)
          if (subFiles.some(f => imageExtensions.includes(path.extname(f).toLowerCase()))) {
            return subDir
          }
        } catch {}
      }
    }
  } catch (e) {
    console.error('[Main] find-texture-dir error:', e)
  }
  return null
})

let officialModelMapCache = null
let officialModelMapMtime = 0
let officialModelDownloadPromise = null

function sanitizeFileSegment(name) {
  if (!name) return 'role'
  const normalized = String(name)
    .replace(/["'“”‘’]/g, '')
    .trim()
  return normalized.replace(/[\\/:*?<>|]/g, '_').trim() || 'role'
}

function getOfficialModelCacheDir() {
  return path.join(userDataPath, 'official-models')
}

function buildOfficialModelEntries() {
  const candidates = [
    path.join(__dirname, 'extracted_roles.json'),
    path.join(__dirname, '..', 'ASG.Api', 'extracted_roles.json')
  ]
  let filePath = null
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      filePath = p
      break
    }
  }
  if (!filePath) return []
  const data = readJsonFileSafe(filePath, {})
  const list = [
    ...(Array.isArray(data.survivors) ? data.survivors : []),
    ...(Array.isArray(data.hunters) ? data.hunters : [])
  ]
  const entries = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const nameRaw = item.zy || item.name
    const modelUrl = item.model
    if (!nameRaw || !modelUrl) continue
    
    // 统一去除引号，确保匹配准确
    const name = nameRaw.replace(/["'“”‘’]/g, '')
    
    try {
      const urlObj = new URL(modelUrl)
      const baseName = path.basename(urlObj.pathname)
      const safeName = sanitizeFileSegment(name)
      const localDir = path.join(getOfficialModelCacheDir(), safeName)
      const localPath = path.join(localDir, baseName)
      entries.push({ name, rawName: nameRaw, modelUrl, localPath })
    } catch {
      continue
    }
  }
  return entries
}

function getOfficialModelDownloadStatus() {
  const entries = buildOfficialModelEntries()
  let downloaded = 0
  for (const item of entries) {
    if (item.localPath && fs.existsSync(item.localPath)) downloaded++
  }
  return {
    total: entries.length,
    downloaded,
    complete: entries.length > 0 && downloaded === entries.length
  }
}

function loadOfficialModelMap() {
  const candidates = [
    path.join(__dirname, 'extracted_roles.json'),
    path.join(__dirname, '..', 'ASG.Api', 'extracted_roles.json')
  ]
  let filePath = null
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      filePath = p
      break
    }
  }
  if (!filePath) return {}
  try {
    const stat = fs.statSync(filePath)
    if (officialModelMapCache && officialModelMapMtime === stat.mtimeMs) {
      return officialModelMapCache
    }
    const map = {}
    const entries = buildOfficialModelEntries()
    for (const item of entries) {
      if (!item || !item.name) continue
      const target = (item.localPath && fs.existsSync(item.localPath)) ? item.localPath : item.modelUrl
      
      map[item.name] = target
      // 同时也映射原始名称（带引号的），防止前端查找失败
      if (item.rawName && item.rawName !== item.name) {
        map[item.rawName] = target
      }
    }
    officialModelMapCache = map
    officialModelMapMtime = stat.mtimeMs
    return map
  } catch (e) {
    return {}
  }
}

ipcMain.handle('get-official-model-map', () => {
  return loadOfficialModelMap()
})

ipcMain.handle('get-official-model-download-status', () => {
  return getOfficialModelDownloadStatus()
})

ipcMain.handle('prepare-official-models', async (event) => {
  if (officialModelDownloadPromise) return officialModelDownloadPromise
  officialModelDownloadPromise = (async () => {
    const entries = buildOfficialModelEntries()
    const total = entries.length
    let downloaded = 0
    let skipped = 0
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i]
      if (!item || !item.modelUrl || !item.localPath) continue

      // 1. 确保主文件存在
      if (!fs.existsSync(item.localPath)) {
        await downloadFile(item.modelUrl, item.localPath, {
          maxRetries: 3,
          onProgress: (progress) => {
            const overall = Math.round(((i + (progress / 100)) / Math.max(1, total)) * 100)
            event.sender.send('official-models-download-progress', {
              current: i + 1,
              total,
              roleName: item.name,
              progress,
              overall
            })
          }
        })
      } else {
        skipped++
      }

      // 2. 如果是 GLTF，解析并下载依赖资源（bin, textures）
      if (item.localPath.toLowerCase().endsWith('.gltf')) {
        await ensureGltfDependencies(item.modelUrl, item.localPath)
      }

      downloaded++
      event.sender.send('official-models-download-progress', {
        current: i + 1,
        total,
        roleName: item.name,
        progress: 100,
        overall: Math.round((downloaded / Math.max(1, total)) * 100)
      })
    }
    officialModelMapCache = null
    return { success: true, total, downloaded, skipped }
  })().finally(() => {
    officialModelDownloadPromise = null
  })
  return officialModelDownloadPromise
})

ipcMain.handle('list-map-assets', async () => {
  try {
    // 使用 app.getAppPath() 确保路径正确，兼容开发和打包环境
    const appPath = app.getAppPath()
    const mapDir = path.join(appPath, 'assets', 'map')
    
    // 再次检查，如果 appPath 指向 asar，可能需要特殊处理（但 fs 模块通常支持）
    if (!fs.existsSync(mapDir)) {
      console.warn('[Main] Map dir not found at:', mapDir)
      return { success: true, maps: [] }
    }
    const files = fs.readdirSync(mapDir)
    const names = files
      .filter(f => typeof f === 'string')
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .map(f => path.parse(f).name)
      .filter(n => n && typeof n === 'string')

    const unique = Array.from(new Set(names))
    unique.sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'))
    return { success: true, maps: unique }
  } catch (error) {
    console.error('[Main] Failed to list map assets:', error)
    return { success: false, error: error.message }
  }
})

async function ensureGltfDependencies(modelUrl, localPath) {
  try {
    const content = fs.readFileSync(localPath, 'utf8')
    const gltf = JSON.parse(content)
    const dependencies = []

    // 收集 buffer 依赖
    if (gltf.buffers) {
      for (const buffer of gltf.buffers) {
        if (buffer.uri && !buffer.uri.startsWith('data:')) {
          dependencies.push(buffer.uri)
        }
      }
    }

    // 收集图片依赖
    if (gltf.images) {
      for (const image of gltf.images) {
        if (image.uri && !image.uri.startsWith('data:')) {
          dependencies.push(image.uri)
        }
      }
    }

    // 下载依赖
    for (const uri of dependencies) {
      // 处理相对路径
      const depUrl = new URL(uri, modelUrl).toString()
      const localDir = path.dirname(localPath)
      const depLocalPath = path.join(localDir, uri) // 简单拼接，假设 uri 是相对文件名

      if (!fs.existsSync(depLocalPath)) {
        console.log(`[Main] Downloading dependency for ${path.basename(localPath)}: ${uri}`)
        await downloadFile(depUrl, depLocalPath, { maxRetries: 3 })
      }
    }
  } catch (e) {
    console.warn(`[Main] Failed to process GLTF dependencies for ${localPath}:`, e.message)
  }
}

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
    const w = Number.isFinite(width) ? Math.max(100, Math.floor(width)) : null
    const h = Number.isFinite(height) ? Math.max(100, Math.floor(height)) : null
    if (!w || !h) return { success: false, error: 'Invalid size' }
    win.setContentSize(w, h)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 存储窗口引用
let mainWindow = null
let frontendWindow = null
let backendWindow = null
let mapDisplayWindow = null
let scoreboardWindowA = null
let scoreboardWindowB = null
let scoreboardOverviewWindow = null
let storeWindow = null
let pluginStoreWindow = null
let postMatchWindow = null
let pluginManagerWindow = null
let localBpWindow = null
let localBpGuideWindow = null
let characterDisplayWindow = null
let welcomeWindow = null

function broadcastToAllWindows(channel, ...args) {
  const targets = [
    frontendWindow,
    backendWindow,
    scoreboardWindowA,
    scoreboardWindowB,
    scoreboardOverviewWindow,
    postMatchWindow,
    storeWindow,
    pluginStoreWindow,
    pluginManagerWindow,
    mapDisplayWindow,
    mainWindow,
    localBpWindow,
    localBpGuideWindow,
    characterDisplayWindow
  ].filter(w => w && !w.isDestroyed())

  for (const win of targets) {
    try {
      win.webContents.send(channel, ...args)
    } catch (e) {
      // ignore
    }
  }
}

// 广播动画控制
ipcMain.on('broadcast-animation', (event, payload) => {
  broadcastToAllWindows('broadcast-animation', payload)
})

// 存储路径
const userDataPath = app.getPath('userData')
const layoutPath = path.join(userDataPath, 'layout.json')
const bgImagePath = path.join(userDataPath, 'background')
const installedPacksPath = path.join(userDataPath, 'installed-packs.json')
const configPath = path.join(userDataPath, 'config.json')
const localPagesBaseDir = path.join(app.getAppPath(), 'assets', 'local-pages')
const localPagesConfigPath = path.join(localPagesBaseDir, 'pages.json')

function readJsonFileSafe(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback
    const content = fs.readFileSync(filePath, 'utf8')
    if (!content || !content.trim()) return fallback
    return JSON.parse(content)
  } catch (e) {
    console.warn('[Main] 读取 JSON 失败:', filePath, e.message)
    return fallback
  }
}

function writeJsonFileSafe(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    return true
  } catch (e) {
    console.error('[Main] 写入 JSON 失败:', filePath, e)
    return false
  }
}

function normalizeLocalPagesConfig(input) {
  const base = input && typeof input === 'object' ? input : {}
  let port = parseInt(base.port, 10)
  if (!Number.isFinite(port) || port < 1024 || port > 65535) port = 9528
  const pages = Array.isArray(base.pages) ? base.pages.filter(p => p && typeof p === 'object') : []
  return { port, pages }
}

function normalizeLocalBpAutoOpenSettings(input) {
  const base = input && typeof input === 'object' ? input : {}
  return {
    frontend: base.frontend !== false,
    localBp: base.localBp !== false,
    characterDisplay: !!base.characterDisplay,
    scoreboardA: !!base.scoreboardA,
    scoreboardB: !!base.scoreboardB,
    scoreboardOverview: !!base.scoreboardOverview,
    postMatch: !!base.postMatch
  }
}

function normalizeFrontendResizeLockSetting(input) {
  return !!input
}

function ensureLocalPagesStorage() {
  const config = normalizeLocalPagesConfig(readJsonFileSafe(localPagesConfigPath, {}))
  if (!fs.existsSync(localPagesBaseDir)) {
    fs.mkdirSync(localPagesBaseDir, { recursive: true })
  }
  const pagesDir = path.join(localPagesBaseDir, 'pages')
  if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(pagesDir, { recursive: true })
  }
  return { config, dir: pagesDir }
}

function readLocalPagesConfig() {
  return normalizeLocalPagesConfig(readJsonFileSafe(localPagesConfigPath, {}))
}

function listLocalPages() {
  const storage = ensureLocalPagesStorage()
  const config = storage.config
  const baseDir = storage.dir
  const configPages = Array.isArray(config.pages) ? config.pages.slice() : []
  const pages = configPages
    .filter(p => p && p.fileName)
    .map(p => {
      const fileName = String(p.fileName)
      return {
        fileName,
        title: p.title || path.parse(fileName).name,
        enabled: p.enabled !== false,
        order: Number.isFinite(Number(p.order)) ? Number(p.order) : 0
      }
    })
    .filter(p => {
      const filePath = path.join(baseDir, p.fileName)
      return fs.existsSync(filePath)
    })
  pages.sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order
    return String(a.fileName).localeCompare(String(b.fileName), 'zh-CN')
  })
  return { config, pages, dir: baseDir }
}

function getLocalPagesBaseUrl(port) {
  return `http://localhost:${port}`
}

function getLocalPagesMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.js') return 'application/javascript; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.ico') return 'image/x-icon'
  if (ext === '.woff') return 'font/woff'
  if (ext === '.woff2') return 'font/woff2'
  if (ext === '.ttf') return 'font/ttf'
  if (ext === '.otf') return 'font/otf'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.pmx') return 'application/octet-stream'
  if (ext === '.vmd') return 'application/octet-stream'
  if (ext === '.gltf') return 'model/gltf+json'
  if (ext === '.glb') return 'model/gltf-binary'
  if (ext === '.bin') return 'application/octet-stream'
  if (ext === '.bmp') return 'image/bmp'
  if (ext === '.tga') return 'image/x-tga'
  if (ext === '.dds') return 'image/vnd-ms.dds'
  return 'application/octet-stream'
}

function buildLocalPagesIndexHtml(pages, baseUrl, baseDir) {
  const items = pages
    .filter(p => p.enabled)
    .map(p => {
      const fileName = String(p.fileName)
      const url = `${baseUrl}/pages/${encodeURIComponent(fileName)}`
      const title = p.title || fileName
      if (fileName.toLowerCase() === 'scoreboard.html') {
        const urlA = `${url}?team=teamA`
        const urlB = `${url}?team=teamB`
        return `<li style="margin:8px 0; display:flex; justify-content:space-between; gap:12px; align-items:center;">
        <span style="font-size:14px;">${title} A队</span>
        <a href="${urlA}" style="color:#4ea1ff; text-decoration:none; font-size:13px;" target="_blank">${urlA}</a>
      </li>
      <li style="margin:8px 0; display:flex; justify-content:space-between; gap:12px; align-items:center;">
        <span style="font-size:14px;">${title} B队</span>
        <a href="${urlB}" style="color:#4ea1ff; text-decoration:none; font-size:13px;" target="_blank">${urlB}</a>
      </li>`
      }
      return `<li style="margin:8px 0; display:flex; justify-content:space-between; gap:12px; align-items:center;">
        <span style="font-size:14px;">${title}</span>
        <a href="${url}" style="color:#4ea1ff; text-decoration:none; font-size:13px;" target="_blank">${url}</a>
      </li>`
    })
    .join('')
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>ASG Local Pages</title></head><body style="font-family:Arial, sans-serif; background:#0e0e0e; color:#e6e6e6; padding:24px;"><h2 style="margin:0 0 12px 0;">本地页面列表</h2><div style="font-size:13px; margin-bottom:16px; color:#aaa;">HTML 目录: ${baseDir}</div><ul style="list-style:none; padding:0; margin:0;">${items || '<li style="color:#aaa;">暂无页面</li>'}</ul></body></html>`
}

function isPathInside(baseDir, targetPath) {
  const base = path.resolve(baseDir)
  const target = path.resolve(targetPath)
  const baseLower = base.toLowerCase()
  const targetLower = target.toLowerCase()
  const prefix = baseLower.endsWith(path.sep) ? baseLower : baseLower + path.sep
  return targetLower === baseLower || targetLower.startsWith(prefix)
}

function resolveLocalPagesPath(baseDir, requestPath) {
  const clean = decodeURIComponent(requestPath || '').replace(/^\/+/, '')
  const full = path.resolve(baseDir, clean)
  if (!isPathInside(baseDir, full)) return null
  return full
}

let localPagesCurrentState = null
let localPagesCurrentRoomData = null
let localPagesCurrentScoreData = null
let localPagesCurrentPostMatchData = null
const localPagesSseClients = new Set()

function localPagesBroadcastSse(eventType, data) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of localPagesSseClients) {
    try {
      client.write(message)
    } catch (e) {
      localPagesSseClients.delete(client)
    }
  }
}

function localPagesBroadcastSseMessage(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`
  for (const client of localPagesSseClients) {
    try {
      client.write(message)
    } catch (e) {
      localPagesSseClients.delete(client)
    }
  }
}

function localPagesReadJsonBody(req, maxSize = 1024 * 1024) {
  return new Promise(resolve => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > maxSize) {
        try { req.destroy() } catch {}
      }
    })
    req.on('end', () => {
      if (!body) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

function localPagesGenerateInjectedScript(pageType) {
  return `
<script>
(function() {
  window.__ASG_OBS_MODE__ = true;
  window.__ASG_PAGE_TYPE__ = '${pageType}';
  let eventSource = null;
  let reconnectTimer = null;
  function connectSSE() {
    if (eventSource) {
      eventSource.close();
    }
    eventSource = new EventSource('/api/sse');
    eventSource.onopen = function() {
      fetch('/api/current-state').then(r => r.json()).then(data => {
        if (data && data.state) {
          handleStateUpdate(data);
        }
      }).catch(() => {});
    };
    eventSource.addEventListener('state-update', function(e) {
      try {
        const data = JSON.parse(e.data);
        handleStateUpdate(data);
      } catch (err) {}
    });
    eventSource.addEventListener('room-data', function(e) {
      try {
        const data = JSON.parse(e.data);
        handleRoomData(data);
      } catch (err) {}
    });
    eventSource.addEventListener('local-bp-blink', function(e) {
      try {
        const data = JSON.parse(e.data);
        if (typeof handleLocalBpBlink === 'function') {
          handleLocalBpBlink(data.index);
        }
      } catch (err) {}
    });
    eventSource.onerror = function() {
      try { eventSource.close(); } catch {}
      reconnectTimer = setTimeout(connectSSE, 3000);
    };
  }
  function handleStateUpdate(data) {
    if (window.onUpdateData) {
      window.onUpdateData(data);
    }
    window.dispatchEvent(new CustomEvent('asg-state-update', { detail: data }));
    var payload = (data && data.state) ? data.state : data;
    if (payload) {
      window.dispatchEvent(new CustomEvent('asg-local-bp-update', { detail: payload }));
    }
  }
  function handleRoomData(data) {
    if (window.onRoomData) {
      window.onRoomData(data);
    }
    window.dispatchEvent(new CustomEvent('asg-room-data', { detail: data }));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', connectSSE);
  } else {
    connectSSE();
  }
  window.addEventListener('beforeunload', function() {
    if (eventSource) eventSource.close();
    if (reconnectTimer) clearTimeout(reconnectTimer);
  });
})();
</script>
`
}

function localPagesHandleStaticFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('404 Not Found')
      return
    }
    res.writeHead(200, {
      'Content-Type': getLocalPagesMimeType(filePath),
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    })
    res.end(data)
  })
}

function localPagesHandleHtmlPage(req, res, filePath, pageType) {
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('404 Not Found')
      return
    }
    const injectedScript = localPagesGenerateInjectedScript(pageType)
    let modifiedHtml = html
    if (html.includes('</head>')) {
      modifiedHtml = html.replace('</head>', injectedScript + '</head>')
    } else if (html.includes('<body')) {
      modifiedHtml = html.replace('<body', injectedScript + '<body')
    } else {
      modifiedHtml = injectedScript + html
    }
    modifiedHtml = modifiedHtml.replace(/(['"])\.\/(js\/)/g, '$1/$2')
    modifiedHtml = modifiedHtml.replace(/(['"])\.\/(css\/)/g, '$1/$2')
    modifiedHtml = modifiedHtml.replace(/(['"])\.\.\/assets\//g, '$1/assets/')
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    })
    res.end(modifiedHtml)
  })
}

function localPagesHandleSse(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  })
  res.write('event: connected\ndata: {"status":"ok"}\n\n')
  if (localPagesCurrentState) {
    res.write(`event: state-update\ndata: ${JSON.stringify(localPagesCurrentState)}\n\n`)
    const payload = localPagesCurrentState.state || localPagesCurrentState
    res.write(`data: ${JSON.stringify({ type: 'local-bp-update', payload })}\n\n`)
  }
  if (localPagesCurrentScoreData) {
    res.write(`event: state-update\ndata: ${JSON.stringify({ type: 'score', scoreData: localPagesCurrentScoreData })}\n\n`)
  }
  if (localPagesCurrentPostMatchData) {
    res.write(`event: state-update\ndata: ${JSON.stringify({ type: 'postmatch', postMatchData: localPagesCurrentPostMatchData })}\n\n`)
  }
  if (localPagesCurrentRoomData) {
    res.write(`event: room-data\ndata: ${JSON.stringify(localPagesCurrentRoomData)}\n\n`)
  }
  localPagesSseClients.add(res)
  req.on('close', () => {
    localPagesSseClients.delete(res)
  })
}

function localPagesHandleApi(req, res, pathname) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (pathname === '/api/current-state') {
    res.writeHead(200)
    res.end(JSON.stringify({
      state: localPagesCurrentState ? (localPagesCurrentState.state || localPagesCurrentState) : null,
      roomData: localPagesCurrentRoomData,
      scoreData: localPagesCurrentScoreData || localBpScoreData || null,
      postMatchData: localPagesCurrentPostMatchData
    }))
    return
  }

  if (pathname === '/api/frontend-layout') {
    try {
      const root = __readLayoutJsonSafe__()
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, layout: root || null }))
      return
    } catch {
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, layout: null }))
      return
    }
  }

  if (pathname === '/api/scoreboard-layout' && req.method === 'GET') {
    const url = new URL(req.url, `http://localhost:${localPagesServerPort || 9528}`)
    const team = url.searchParams.get('team') || 'teamA'
    try {
      const root = __readLayoutJsonSafe__()
      if (root.scoreboardLayouts && root.scoreboardLayouts[team]) {
        res.writeHead(200)
        res.end(JSON.stringify({ success: true, layout: root.scoreboardLayouts[team] }))
        return
      }
    } catch {}
    res.writeHead(200)
    res.end(JSON.stringify({ success: true, layout: null }))
    return
  }

  if (pathname === '/api/scoreboard-layout' && req.method === 'POST') {
    const url = new URL(req.url, `http://localhost:${localPagesServerPort || 9528}`)
    const team = url.searchParams.get('team') || 'teamA'
    if (team !== 'teamA' && team !== 'teamB') {
      res.writeHead(200)
      res.end(JSON.stringify({ success: false, error: 'Invalid team' }))
      return
    }
    localPagesReadJsonBody(req).then(payload => {
      try {
        const layout = (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'layout')) ? payload.layout : payload
        const root = __readLayoutJsonSafe__()
        if (!root.scoreboardLayouts || typeof root.scoreboardLayouts !== 'object') root.scoreboardLayouts = {}
        root.scoreboardLayouts[team] = layout || null
        __writeLayoutJsonSafe__(root)
        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))
      } catch (e) {
        res.writeHead(200)
        res.end(JSON.stringify({ success: false, error: e.message }))
      }
    })
    return
  }

  if (pathname === '/api/local-bp-state') {
    res.writeHead(200)
    res.end(JSON.stringify({ success: true, data: localBpState || null }))
    return
  }

  if (pathname === '/api/local-bp-characters') {
    try {
      const idx = loadCharacterIndex()
      const survivors = Array.isArray(idx.survivors)
        ? idx.survivors.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean)
        : []
      const hunters = Array.isArray(idx.hunters)
        ? idx.hunters.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean)
        : []
      const pinyinMap = buildPinyinMap([...survivors, ...hunters])
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, data: { survivors, hunters, pinyinMap } }))
      return
    } catch (e) {
      res.writeHead(200)
      res.end(JSON.stringify({ success: false, error: e?.message || String(e) }))
      return
    }
  }

  if (pathname === '/api/local-bp-action' && req.method === 'POST') {
    localPagesReadJsonBody(req).then(payload => {
      try {
        const action = typeof payload?.action === 'string' ? payload.action : ''
        const data = payload?.data || {}
        if (!localBpState || typeof localBpState !== 'object') localBpState = {}
        if (!Array.isArray(localBpState.survivors)) localBpState.survivors = [null, null, null, null]
        if (!Array.isArray(localBpState.hunterBannedSurvivors)) localBpState.hunterBannedSurvivors = []
        if (!Array.isArray(localBpState.survivorBannedHunters)) localBpState.survivorBannedHunters = []
        if (!Array.isArray(localBpState.globalBannedSurvivors)) localBpState.globalBannedSurvivors = []
        if (!Array.isArray(localBpState.globalBannedHunters)) localBpState.globalBannedHunters = []
        if (!Array.isArray(localBpState.playerNames)) localBpState.playerNames = ['', '', '', '', '']
        if (!Array.isArray(localBpState.survivorTalents)) localBpState.survivorTalents = [[], [], [], []]
        if (!Array.isArray(localBpState.hunterTalents)) localBpState.hunterTalents = []
        if (!Array.isArray(localBpState.hunterSkills)) localBpState.hunterSkills = []

        const normalizeName = (name) => typeof name === 'string' ? __normalizeLocalBpName__(name) : null
        const pushUnique = (list, name) => {
          if (!name) return
          if (!list.includes(name)) list.push(name)
        }
        const removeItem = (list, name) => list.filter(n => n !== name)

        if (action === 'set-survivor') {
          const index = Number(data?.index)
          if (Number.isFinite(index) && index >= 0 && index < 4) {
            localBpState.survivors[index] = normalizeName(data?.character) || null
          }
        } else if (action === 'set-hunter') {
          localBpState.hunter = normalizeName(data?.character) || null
        } else if (action === 'add-ban-survivor') {
          const name = normalizeName(data?.character)
          pushUnique(localBpState.hunterBannedSurvivors, name)
        } else if (action === 'remove-ban-survivor') {
          const name = normalizeName(data?.character)
          localBpState.hunterBannedSurvivors = removeItem(localBpState.hunterBannedSurvivors, name)
        } else if (action === 'add-ban-hunter') {
          const name = normalizeName(data?.character)
          pushUnique(localBpState.survivorBannedHunters, name)
        } else if (action === 'remove-ban-hunter') {
          const name = normalizeName(data?.character)
          localBpState.survivorBannedHunters = removeItem(localBpState.survivorBannedHunters, name)
        } else if (action === 'add-global-ban-survivor') {
          const name = normalizeName(data?.character)
          pushUnique(localBpState.globalBannedSurvivors, name)
        } else if (action === 'remove-global-ban-survivor') {
          const name = normalizeName(data?.character)
          localBpState.globalBannedSurvivors = removeItem(localBpState.globalBannedSurvivors, name)
        } else if (action === 'add-global-ban-hunter') {
          const name = normalizeName(data?.character)
          pushUnique(localBpState.globalBannedHunters, name)
        } else if (action === 'remove-global-ban-hunter') {
          const name = normalizeName(data?.character)
          localBpState.globalBannedHunters = removeItem(localBpState.globalBannedHunters, name)
        } else if (action === 'set-map-name') {
          const mapName = typeof data?.mapName === 'string' ? data.mapName : ''
          localBpState.mapName = mapName
        } else if (action === 'set-player-name') {
          const index = Number(data?.index)
          if (Number.isFinite(index) && index >= 0 && index < localBpState.playerNames.length) {
            localBpState.playerNames[index] = typeof data?.name === 'string' ? data.name : ''
          }
        } else if (action === 'set-survivor-talents') {
          const index = Number(data?.index)
          if (Number.isFinite(index) && index >= 0 && index < 4) {
            localBpState.survivorTalents[index] = __normalizeLocalBpArray__(data?.talents)
          }
        } else if (action === 'set-hunter-talents') {
          localBpState.hunterTalents = __normalizeLocalBpArray__(data?.talents)
        } else if (action === 'set-hunter-skills') {
          localBpState.hunterSkills = __normalizeLocalBpArray__(data?.skills)
        } else if (action === 'reset') {
          const preservedLayout = localBpState.characterDisplayLayout
          localBpState = {
            enabled: true,
            survivors: [null, null, null, null],
            hunter: null,
            hunterBannedSurvivors: [],
            survivorBannedHunters: [],
            globalBannedSurvivors: [],
            globalBannedHunters: [],
            survivorTalents: [[], [], [], []],
            hunterTalents: [],
            hunterSkills: [],
            playerNames: ['', '', '', '', ''],
            teamA: localBpState?.teamA || { name: '求生者队', logo: '', meta: '' },
            teamB: localBpState?.teamB || { name: '监管者队', logo: '', meta: '' },
            mapName: '',
            characterDisplayLayout: preservedLayout || { positions: {} }
          }
        }

        broadcastLocalBpState()
        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))
      } catch (e) {
        res.writeHead(200)
        res.end(JSON.stringify({ success: false, error: e?.message || String(e) }))
      }
    })
    return
  }

  if (pathname === '/api/open-local-backend') {
    try {
      ensureLocalBackendWindow()
      if (backendWindow && !backendWindow.isDestroyed()) {
        backendWindow.show()
        backendWindow.focus()
      }
      res.writeHead(200)
      res.end(JSON.stringify({ success: true }))
      return
    } catch (e) {
      res.writeHead(200)
      res.end(JSON.stringify({ success: false, error: e?.message || String(e) }))
      return
    }
  }

  if (pathname === '/api/local-bp-character-display-layout' && req.method === 'POST') {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 1024 * 1024) {
        try { req.destroy() } catch {}
      }
    })
    req.on('end', () => {
      let payload = {}
      try { payload = body ? JSON.parse(body) : {} } catch { payload = {} }
      const positions = (payload && typeof payload === 'object' && payload.positions && typeof payload.positions === 'object') ? payload.positions : payload
      if (!localBpState.characterDisplayLayout) {
        localBpState.characterDisplayLayout = { backgroundImage: null, positions: {}, transparentBackground: false }
      }
      if (!localBpState.characterDisplayLayout.positions) localBpState.characterDisplayLayout.positions = {}
      Object.assign(localBpState.characterDisplayLayout.positions, positions || {})
      __persistCharacterDisplayLayoutToDisk__()
      res.writeHead(200)
      res.end(JSON.stringify({ success: true }))
    })
    return
  }

  if (pathname === '/api/score-state' && req.method === 'POST') {
    localPagesReadJsonBody(req).then(payload => {
      try {
        if (payload && typeof payload === 'object') {
          localPagesCurrentScoreData = payload
          localPagesBroadcastSse('state-update', { type: 'score', scoreData: localPagesCurrentScoreData })
        }
        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))
      } catch {
        res.writeHead(200)
        res.end(JSON.stringify({ success: false }))
      }
    })
    return
  }

  if (pathname === '/api/score-state') {
    res.writeHead(200)
    res.end(JSON.stringify({ success: true, data: localPagesCurrentScoreData || localBpScoreData || null }))
    return
  }

  if (pathname === '/api/postmatch-state' && req.method === 'POST') {
    localPagesReadJsonBody(req).then(payload => {
      try {
        if (payload && typeof payload === 'object') {
          localPagesCurrentPostMatchData = payload
          localPagesBroadcastSse('state-update', { type: 'postmatch', postMatchData: localPagesCurrentPostMatchData })
        }
        res.writeHead(200)
        res.end(JSON.stringify({ success: true }))
      } catch {
        res.writeHead(200)
        res.end(JSON.stringify({ success: false }))
      }
    })
    return
  }

  if (pathname === '/api/postmatch-state') {
    res.writeHead(200)
    res.end(JSON.stringify({ success: true, data: localPagesCurrentPostMatchData }))
    return
  }

  if (pathname === '/api/character-index') {
    try {
      const index = loadCharacterIndex()
      const data = index && index.fullData ? index.fullData : { survivors: [], hunters: [] }
      res.writeHead(200)
      res.end(JSON.stringify({
        success: true,
        data: {
          survivors: index ? index.survivors : [],
          hunters: index ? index.hunters : [],
          survivorTalents: Array.isArray(data.survivorTalents) ? data.survivorTalents : [],
          hunterTalents: Array.isArray(data.hunterTalents) ? data.hunterTalents : [],
          hunterSkills: Array.isArray(data.hunterSkills) ? data.hunterSkills : []
        }
      }))
      return
    } catch {}
    res.writeHead(200)
    res.end(JSON.stringify({ success: false, data: null }))
    return
  }

  if (pathname === '/api/maps') {
    try {
      const assetsPath = path.join(app.getAppPath(), 'assets')
      const mapDir = path.join(assetsPath, 'map')
      let names = []
      if (fs.existsSync(mapDir)) {
        const files = fs.readdirSync(mapDir)
        names = files
          .filter(f => typeof f === 'string')
          .filter(f => /(.png|.jpg|.jpeg|.webp)$/i.test(f))
          .map(f => path.parse(f).name)
          .filter(n => n && typeof n === 'string')
      }
      const unique = Array.from(new Set(names)).sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'))
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, maps: unique }))
      return
    } catch (e) {
      res.writeHead(200)
      res.end(JSON.stringify({ success: false, error: e && e.message ? e.message : String(e), maps: [] }))
      return
    }
  }

  if (pathname === '/api/official-model-map') {
    try {
      const modelsDir = path.join(userDataPath, 'official-models')
      const map = {}
      if (fs.existsSync(modelsDir)) {
        const files = fs.readdirSync(modelsDir)
        for (const file of files) {
          const fullPath = path.join(modelsDir, file)
          let stat = null
          try { stat = fs.statSync(fullPath) } catch { continue }
          if (stat.isDirectory()) {
            const potentialFiles = [file + '.gltf', file + '.glb', file + '.pmx']
            for (const p of potentialFiles) {
              if (fs.existsSync(path.join(fullPath, p))) {
                map[file] = `/official-models/${file}/${p}`
                break
              }
            }
          } else if (/(.gltf|.glb|.pmx)$/i.test(file)) {
            const name = path.basename(file, path.extname(file))
            map[name] = `/official-models/${file}`
          }
        }
      }
      res.writeHead(200)
      res.end(JSON.stringify(map))
    } catch {
      res.writeHead(200)
      res.end('{}')
    }
    return
  }

  res.writeHead(404)
  res.end(JSON.stringify({ error: 'Not Found' }))
}

function handleLocalPagesRequest(req, res) {
  const { config, pages, dir } = listLocalPages()
  const baseUrl = getLocalPagesBaseUrl(config.port)
  const urlObj = new URL(req.url || '/', baseUrl)
  const pathname = decodeURIComponent(urlObj.pathname)
  if (pathname === '/sse' || pathname === '/api/sse') {
    localPagesHandleSse(req, res)
    return
  }
  if (pathname.startsWith('/api/')) {
    localPagesHandleApi(req, res, pathname)
    return
  }
  if (urlObj.pathname === '/' || urlObj.pathname === '/index.html') {
    const html = buildLocalPagesIndexHtml(pages, baseUrl, dir)
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(html)
    return
  }
  if (pathname === '/frontend' || pathname === '/frontend.html') {
    const filePath = path.join(dir, 'frontend.html')
    localPagesHandleHtmlPage(req, res, filePath, 'frontend')
    return
  }
  if (pathname === '/scoreboard' || pathname === '/scoreboard.html') {
    const filePath = path.join(dir, 'scoreboard.html')
    localPagesHandleHtmlPage(req, res, filePath, 'scoreboard')
    return
  }
  if (pathname === '/character-display' || pathname === '/character-display.html') {
    const filePath = path.join(dir, 'character-display.html')
    localPagesHandleHtmlPage(req, res, filePath, 'character-display')
    return
  }
  if (urlObj.pathname === '/api/pages') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ success: true, pages, baseUrl }))
    return
  }
  if (urlObj.pathname.startsWith('/pages/')) {
    const relativePath = decodeURIComponent(urlObj.pathname.slice('/pages/'.length))
    const filePath = resolveLocalPagesPath(dir, relativePath)
    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404)
      res.end('Not Found')
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.html') {
      const page = pages.find(p => p.fileName === relativePath && p.enabled)
      if (!page) {
        res.writeHead(404)
        res.end('Not Found')
        return
      }
      const pageType = path.parse(filePath).name
      localPagesHandleHtmlPage(req, res, filePath, pageType)
      return
    }
    res.writeHead(200, { 'Content-Type': getLocalPagesMimeType(filePath) })
    fs.createReadStream(filePath).pipe(res)
    return
  }
  if (pathname.startsWith('/official-models/')) {
    const modelPath = pathname.replace('/official-models/', '')
    const filePath = path.join(userDataPath, 'official-models', decodeURIComponent(modelPath))
    if (fs.existsSync(filePath)) {
      localPagesHandleStaticFile(res, filePath)
      return
    }
  }
  if (pathname.startsWith('/js/') || pathname.startsWith('/pages/js/')) {
    const cleanPath = pathname.split('?')[0]
    const jsPath = cleanPath.replace('/pages/', '/').replace(/^\/js\//, '')
    const filePath = path.join(dir, 'js', jsPath)
    if (fs.existsSync(filePath)) {
      localPagesHandleStaticFile(res, filePath)
      return
    }
  }
  if (pathname.startsWith('/css/') || pathname.startsWith('/pages/css/')) {
    const cleanPath = pathname.split('?')[0]
    const cssPath = cleanPath.replace('/pages/', '/').replace(/^\/css\//, '')
    const filePath = path.join(dir, 'css', cssPath)
    if (fs.existsSync(filePath)) {
      localPagesHandleStaticFile(res, filePath)
      return
    }
  }
  if (pathname.startsWith('/assets/')) {
    const assetPath = pathname.replace('/assets/', '')
    const filePath = path.join(app.getAppPath(), 'assets', assetPath)
    if (fs.existsSync(filePath)) {
      localPagesHandleStaticFile(res, filePath)
      return
    }
  }
  if (pathname.startsWith('/background/')) {
    const bgPath = pathname.replace('/background/', '')
    const filePath = path.join(userDataPath, 'background', bgPath)
    if (fs.existsSync(filePath)) {
      localPagesHandleStaticFile(res, filePath)
      return
    }
  }
  if (pathname.startsWith('/userdata/')) {
    const relativePath = pathname.replace('/userdata/', '')
    const filePath = path.join(userDataPath, relativePath)
    if (fs.existsSync(filePath)) {
      localPagesHandleStaticFile(res, filePath)
      return
    }
  }
  const assetPath = resolveLocalPagesPath(dir, urlObj.pathname)
  if (assetPath && fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
    res.writeHead(200, { 'Content-Type': getLocalPagesMimeType(assetPath) })
    fs.createReadStream(assetPath).pipe(res)
    return
  }
  res.writeHead(404)
  res.end('Not Found')
}

let localPagesServer = null
let localPagesServerPort = null

function startLocalPagesServer() {
  ensureLocalPagesStorage()
  const config = readLocalPagesConfig()
  const port = config.port
  if (localPagesServer && localPagesServerPort === port) {
    return Promise.resolve({ success: true, port, running: true })
  }
  if (localPagesServer) {
    return stopLocalPagesServer().then(() => startLocalPagesServer())
  }
  return new Promise(resolve => {
    const server = http.createServer(handleLocalPagesRequest)
    server.on('error', err => {
      resolve({ success: false, error: err.message })
    })
    server.listen(port, '127.0.0.1', () => {
      localPagesServer = server
      localPagesServerPort = port
      try {
        const baseState = (typeof buildLocalBpFrontendState === 'function') ? buildLocalBpFrontendState() : localBpState
        if (baseState) {
          localPagesCurrentState = { type: 'state', state: baseState }
          localPagesCurrentRoomData = localPagesCurrentState
        }
        if (localBpScoreData) {
          localPagesCurrentScoreData = localBpScoreData
        }
      } catch {}
      if (!global.__localPageServerHooks) {
        global.__localPageServerHooks = {}
      }
      global.__localPageServerHooks.onDataUpdate = data => {
        if (data) {
          if (data.type === 'score' && data.scoreData) {
            localPagesCurrentScoreData = data.scoreData
          }
          if (data.type === 'state' || data.state) {
            localPagesCurrentState = data
          }
          localPagesCurrentRoomData = data
          localPagesBroadcastSse('state-update', data)
          if (data.type === 'state' || data.state) {
            const payload = data.state || data
            localPagesBroadcastSseMessage({ type: 'local-bp-update', payload })
          }
        }
      }
      global.__localPageServerHooks.onLocalBpBlink = index => {
        localPagesBroadcastSse('local-bp-blink', { index })
      }
      resolve({ success: true, port, running: true })
    })
  })
}

function stopLocalPagesServer() {
  if (!localPagesServer) return Promise.resolve({ success: true, running: false })
  return new Promise(resolve => {
    localPagesServer.close(() => {
      localPagesServer = null
      localPagesServerPort = null
      if (global.__localPageServerHooks) {
        delete global.__localPageServerHooks
      }
      resolve({ success: true, running: false })
    })
  })
}

function getLocalPagesStatus() {
  return {
    running: !!localPagesServer,
    port: localPagesServerPort
  }
}

function normalizeResolution(input) {
  const width = Number(input?.width)
  const height = Number(input?.height)
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null
  const w = Math.round(width)
  const h = Math.round(height)
  // 合理范围：避免误输入导致窗口失控
  if (w < 320 || h < 240 || w > 7680 || h > 4320) return null
  return { width: w, height: h }
}

// 环境检测
const isDevelopment = !app.isPackaged || process.env.NODE_ENV === 'development' || process.argv.includes('--dev')

// API地址配置
const API_CONFIG = {
  development: {
    api: 'http://localhost:5250',
    frontend: 'http://localhost:5173'
  },
  production: {
    api: 'https://api.idvevent.cn',
    frontend: 'https://bp.idvevent.cn'
  }
}

let currentEnv = isDevelopment ? 'development' : 'production'

console.log('[App] Environment detection:')
console.log('  app.isPackaged:', app.isPackaged)
console.log('  NODE_ENV:', process.env.NODE_ENV)
console.log('  --dev flag:', process.argv.includes('--dev'))
console.log('  isDevelopment:', isDevelopment)
console.log('  currentEnv:', currentEnv)

// 获取当前环境配置
function getEnvConfig() {
  return API_CONFIG[currentEnv]
}

// 获取 Store API 基础 URL
function getStoreApiBase() {
  return `${API_CONFIG[currentEnv].api}/api/layout-packs`
}

function getPluginStoreApiBase() {
  return `${API_CONFIG[currentEnv].api}/api/plugin-packs`
}

// 切换环境
function switchEnvironment(env) {
  if (API_CONFIG[env]) {
    currentEnv = env
    return true
  }
  return false
}

// 确保目录存在
function ensureDirectories() {
  if (!fs.existsSync(bgImagePath)) {
    fs.mkdirSync(bgImagePath, { recursive: true })
  }
  ensureLocalPagesStorage()
}

ipcMain.handle('local-pages:get-pages', () => {
  const { config, pages, dir } = listLocalPages()
  const baseUrl = getLocalPagesBaseUrl(config.port)
  return { success: true, config, pages, dir, baseUrl }
})

ipcMain.handle('local-pages:get-status', () => {
  return { success: true, status: getLocalPagesStatus() }
})

ipcMain.handle('local-bp:auto-open:get', () => {
  const config = readJsonFileSafe(configPath, {})
  const settings = normalizeLocalBpAutoOpenSettings(config.localBpAutoOpen)
  return { success: true, settings }
})

ipcMain.handle('local-bp:auto-open:set', (event, settings) => {
  const config = readJsonFileSafe(configPath, {})
  const next = normalizeLocalBpAutoOpenSettings({ ...(config.localBpAutoOpen || {}), ...(settings || {}) })
  config.localBpAutoOpen = next
  writeJsonFileSafe(configPath, config)
  return { success: true, settings: next }
})

ipcMain.handle('frontend-resize-lock:get', () => {
  const config = readJsonFileSafe(configPath, {})
  const locked = normalizeFrontendResizeLockSetting(config.frontendResizeLock)
  return { success: true, locked }
})

ipcMain.handle('frontend-resize-lock:set', (event, locked) => {
  const config = readJsonFileSafe(configPath, {})
  const next = normalizeFrontendResizeLockSetting(locked)
  config.frontendResizeLock = next
  writeJsonFileSafe(configPath, config)
  if (frontendWindow && !frontendWindow.isDestroyed()) {
    try {
      frontendWindow.setResizable(!next)
    } catch (e) {
      console.warn('[Frontend] setResizable failed:', e.message)
    }
  }
  return { success: true, locked: next }
})

// 获取当前环境信息
ipcMain.handle('get-environment', () => {
  return {
    isDevelopment,
    currentEnv,
    config: API_CONFIG[currentEnv]
  }
})

// 环境切换 IPC 处理器
ipcMain.handle('switch-environment', (event, env) => {
  const success = switchEnvironment(env)
  return {
    success,
    env: currentEnv,
    config: API_CONFIG[currentEnv]
  }
})

// 创建主窗口（链接展示）
function createMainWindow() {
  // 确保首次运行标志被设置，防止欢迎页面重复弹出
  try {
    const config = readJsonFileSafe(configPath, {})
    if (!config.hasRunBefore) {
      config.hasRunBefore = true
      writeJsonFileSafe(configPath, config)
    }
  } catch (e) {
    console.error('[Main] Failed to ensure hasRunBefore flag:', e)
  }

  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    title: '导播端',
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  mainWindow.loadFile('pages/main.html')
  mainWindow.setMenu(null)

  try {
    setPluginWindow('main', mainWindow)
  } catch (e) {
    // 插件系统可能尚未初始化，忽略
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    // 关闭主窗口时关闭所有窗口
    if (frontendWindow) frontendWindow.close()
    if (backendWindow) backendWindow.close()
    app.quit()
  })
}

// 创建插件管理窗口
function createPluginManagerWindow() {
  if (pluginManagerWindow && !pluginManagerWindow.isDestroyed()) {
    pluginManagerWindow.focus()
    return pluginManagerWindow
  }

  pluginManagerWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    title: '导播 - 插件管理',
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  pluginManagerWindow.loadFile('pages/plugins.html')
  pluginManagerWindow.setMenu(null)

  try {
    setPluginWindow('plugin-manager', pluginManagerWindow)
  } catch (e) {
    // ignore
  }

  pluginManagerWindow.on('closed', () => {
    pluginManagerWindow = null
  })

  return pluginManagerWindow
}

// 创建插件商店窗口
function createPluginStoreWindow() {
  if (pluginStoreWindow && !pluginStoreWindow.isDestroyed()) {
    pluginStoreWindow.focus()
    return pluginStoreWindow
  }

  pluginStoreWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    title: '插件商店',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  pluginStoreWindow.loadFile('pages/plugin-store.html')
  pluginStoreWindow.setMenu(null)

  try {
    setPluginWindow('plugin-store', pluginStoreWindow)
  } catch {
    // ignore
  }

  pluginStoreWindow.on('closed', () => {
    pluginStoreWindow = null
  })

  return pluginStoreWindow
}

ipcMain.handle('open-plugin-store', async () => {
  createPluginStoreWindow()
  return { success: true }
})

// 创建前台窗口（可自定义布局的观战页面）
function createFrontendWindow(roomData) {
  // 读取保存的窗口大小配置
  let windowBounds = { width: 1280, height: 720 }
  let contentSize = null
  try {
    if (fs.existsSync(layoutPath)) {
      const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'))
      if (layout.windowBounds && layout.windowBounds.frontendBounds) {
        windowBounds = layout.windowBounds.frontendBounds
      }
      if (layout.windowBounds && layout.windowBounds.frontendContentSize) {
        contentSize = normalizeResolution(layout.windowBounds.frontendContentSize)
      }
    }
  } catch (e) {
    console.error('[Frontend] Failed to load window bounds:', e)
  }

  // 🔧 Windows 不可见边框修复方案：
  // 问题：Windows 在无边框窗口周围添加不可见调整边框，导致 getBounds() 比实际可见区域大
  // 解决：使用 ContentSize（可见内容区域）而不是 Bounds（包含边框）

  const savedContentSize = contentSize || { width: 1280, height: 720 }
  const finalWidth = Number(savedContentSize.width) || 1280
  const finalHeight = Number(savedContentSize.height) || 720
  const finalX = windowBounds.x
  const finalY = windowBounds.y
  const resizeLocked = normalizeFrontendResizeLockSetting(readJsonFileSafe(configPath, {}).frontendResizeLock)

  console.log('[Frontend] 恢复内容尺寸:', { width: finalWidth, height: finalHeight }, '位置:', { x: finalX, y: finalY })

  frontendWindow = new BrowserWindow({
    ...(typeof finalX === 'number' ? { x: finalX } : {}),
    ...(typeof finalY === 'number' ? { y: finalY } : {}),
    width: finalWidth,
    height: finalHeight,
    useContentSize: true, // ✅ 使用内容尺寸（不含边框）
    title: '导播 - 前台',
    frame: false,
    transparent: true,
    titleBarStyle: 'hidden',
    resizable: !resizeLocked,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true,
      webSecurity: false,
      backgroundThrottling: false
    }
  })

  // 双保险：创建后再次精确设置内容尺寸
  frontendWindow.setContentSize(finalWidth, finalHeight)

  // 开发环境下或调试需要时自动打开开发者工具
  // frontendWindow.webContents.openDevTools({ mode: 'detach' })

  frontendWindow.loadFile('pages/frontend.html')

  // 禁用缓存，确保每次都加载最新内容
  frontendWindow.webContents.session.clearCache()

  // 窗口加载完成后发送房间数据
  frontendWindow.webContents.on('did-finish-load', () => {
    frontendWindow.webContents.send('room-data', roomData)
  })

  // 🔧 监听窗口大小变化，自动保存（防抖 500ms）
  let resizeTimer = null
  frontendWindow.on('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (!frontendWindow || frontendWindow.isDestroyed()) return
      const resizeLocked = normalizeFrontendResizeLockSetting(readJsonFileSafe(configPath, {}).frontendResizeLock)
      if (resizeLocked) return

      try {
        const bounds = frontendWindow.getBounds()
        const [cw, ch] = frontendWindow.getContentSize()

        // 读取现有布局
        let layout = {}
        try {
          if (fs.existsSync(layoutPath)) {
            const content = fs.readFileSync(layoutPath, 'utf8')
            layout = content ? JSON.parse(content) : {}
          }
        } catch (e) {
          console.warn('[Frontend] 读取布局失败:', e.message)
        }

        // 更新窗口尺寸
        if (!layout.windowBounds) layout.windowBounds = {}
        layout.windowBounds.frontendBounds = bounds
        layout.windowBounds.frontendContentSize = { width: cw, height: ch }

        // 保存
        fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2))
        console.log('[Frontend] 窗口尺寸已自动保存:', { bounds, contentSize: { width: cw, height: ch } })
      } catch (e) {
        console.error('[Frontend] 自动保存窗口尺寸失败:', e)
      }
    }, 500) // 防抖 500ms
  })

  frontendWindow.on('closed', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    frontendWindow = null
  })
}

// 创建后台窗口（管理页面）
function createBackendWindow(roomData) {
  backendWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: '导播 - 后台管理',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false
    }
  })

  backendWindow.loadFile('pages/backend.html')
  backendWindow.setMenu(null)

  // 窗口加载完成后发送房间数据
  backendWindow.webContents.on('did-finish-load', () => {
    backendWindow.webContents.send('room-data', roomData)
  })

  backendWindow.on('closed', () => {
    backendWindow = null
  })
}

// 创建地图展示窗口（弹窗显示地图ban/pick，几秒后自动关闭）
function createMapDisplayWindow(action, mapName, team) {
  // 保持单实例窗口，避免 OBS 捕获源丢失
  if (!mapDisplayWindow || mapDisplayWindow.isDestroyed()) {
    mapDisplayWindow = new BrowserWindow({
      width: 600,
      height: 400,
      title: '地图展示',
      frame: false,
      transparent: true,
      resizable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false
      }
    })

    mapDisplayWindow.on('closed', () => {
      mapDisplayWindow = null
    })
  }

  // 加载页面并传递参数
  const params = new URLSearchParams({
    action: action,
    map: mapName,
    team: team
  })
  mapDisplayWindow.loadFile('pages/map-display.html', { search: params.toString() })

  // 确保窗口可见但内容可按需透明
  mapDisplayWindow.show()

  return mapDisplayWindow
}

// 创建比分展示窗口
function createScoreboardWindow(roomId, team) {
  const targetWindow = team === 'teamA' ? 'scoreboardWindowA' : 'scoreboardWindowB'

  // 如果已有窗口，聚焦
  if ((team === 'teamA' && scoreboardWindowA && !scoreboardWindowA.isDestroyed()) ||
    (team === 'teamB' && scoreboardWindowB && !scoreboardWindowB.isDestroyed())) {
    const win = team === 'teamA' ? scoreboardWindowA : scoreboardWindowB
    win.focus()
    return win
  }

  // 读取保存的窗口大小配置
  let windowBounds = { width: 1280, height: 720 }
  try {
    if (fs.existsSync(layoutPath)) {
      const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'))
      const boundsKey = team === 'teamA' ? 'scoreboardABounds' : 'scoreboardBBounds'
      if (layout.windowBounds && layout.windowBounds[boundsKey]) {
        windowBounds = layout.windowBounds[boundsKey]
      }
    }
  } catch (e) {
    console.error('[Scoreboard] Failed to load window bounds:', e)
  }

  const windowTitle = `导播 - ${team === 'teamA' ? 'A队' : 'B队'}比分板`
  const newWindow = new BrowserWindow({
    ...windowBounds,
    title: windowTitle,
    frame: true,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false
    }
  })

  newWindow.setTitle(windowTitle)
  newWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    newWindow.setTitle(windowTitle)
  })

  // 传递 roomId 和 team 参数
  const params = new URLSearchParams({ roomId: roomId || '', team: team })
  newWindow.loadFile('pages/scoreboard.html', { search: params.toString() })

  let resizeTimer = null
  newWindow.on('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (!newWindow || newWindow.isDestroyed()) return
      try {
        const bounds = newWindow.getBounds()
        let layout = {}
        try {
          if (fs.existsSync(layoutPath)) {
            const content = fs.readFileSync(layoutPath, 'utf8')
            layout = content ? JSON.parse(content) : {}
          }
        } catch {
          layout = {}
        }
        if (!layout.windowBounds) layout.windowBounds = {}
        const boundsKey = team === 'teamA' ? 'scoreboardABounds' : 'scoreboardBBounds'
        layout.windowBounds[boundsKey] = bounds
        fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2))
      } catch {}
    }, 500)
  })

  newWindow.on('closed', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    if (team === 'teamA') scoreboardWindowA = null
    else scoreboardWindowB = null
  })

  if (team === 'teamA') scoreboardWindowA = newWindow
  else scoreboardWindowB = newWindow

  return newWindow
}

// 创建总览比分板窗口
function createScoreboardOverviewWindow(roomId, boCount) {
  if (scoreboardOverviewWindow && !scoreboardOverviewWindow.isDestroyed()) {
    scoreboardOverviewWindow.focus()
    return scoreboardOverviewWindow
  }

  let windowBounds = { width: 1280, height: 200 }
  try {
    if (fs.existsSync(layoutPath)) {
      const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'))
      if (layout.windowBounds && layout.windowBounds.scoreboardOverviewBounds) {
        windowBounds = layout.windowBounds.scoreboardOverviewBounds
      }
    }
  } catch (e) {
    console.error('[ScoreboardOverview] Failed to load window bounds:', e)
  }

  scoreboardOverviewWindow = new BrowserWindow({
    ...windowBounds,
    title: '导播 - 总览比分板',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false
    }
  })

  const params = new URLSearchParams({
    roomId: roomId || '',
    bo: boCount || 5
  })
  scoreboardOverviewWindow.loadFile('pages/scoreboard-overview.html', { search: params.toString() })

  scoreboardOverviewWindow.on('closed', () => {
    scoreboardOverviewWindow = null
  })

  return scoreboardOverviewWindow
}

// 创建赛后数据窗口
function createPostMatchWindow(roomId) {
  // 如果已有窗口，聚焦
  if (postMatchWindow && !postMatchWindow.isDestroyed()) {
    postMatchWindow.focus()
    return postMatchWindow
  }

  // 读取保存的窗口大小配置
  let windowBounds = { width: 1280, height: 720 }
  try {
    if (fs.existsSync(layoutPath)) {
      const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'))
      if (layout.windowBounds && layout.windowBounds.postMatchBounds) {
        windowBounds = layout.windowBounds.postMatchBounds
      }
    }
  } catch (e) {
    console.error('[PostMatch] Failed to load window bounds:', e)
  }

  postMatchWindow = new BrowserWindow({
    ...windowBounds,
    title: '导播 - 赛后数据',
    frame: false,
    transparent: true,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      devTools: true,
      backgroundThrottling: false
    }
  })

  const params = new URLSearchParams({ roomId: roomId || '' })
  postMatchWindow.loadFile('pages/postmatch.html', { search: params.toString() })

  postMatchWindow.on('closed', () => {
    postMatchWindow = null
  })

  return postMatchWindow
}

// IPC 处理器

// 创建房间并打开前台后台窗口
ipcMain.handle('create-room', async (event, roomData) => {
  createFrontendWindow(roomData)
  createBackendWindow(roomData)
  // 预创建地图展示窗口（初始透明，不显示内容），以便 OBS 持续捕获
  try {
    // 使用空参数创建窗口但不显示内容（map-display.html 默认 body.hidden）
    createMapDisplayWindow('', '', '')
  } catch (e) {
    console.warn('[MapDisplay] Precreate failed:', e.message)
  }
  return true
})

// 打开BP窗口（用于历史房间）
ipcMain.handle('open-bp-windows', async (event, roomData) => {
  createFrontendWindow(roomData)
  createBackendWindow(roomData)
  try {
    createMapDisplayWindow('', '', '')
  } catch (e) {
    console.warn('[MapDisplay] Precreate failed:', e.message)
  }
  return true
})

// 关闭BP窗口
ipcMain.handle('close-bp-windows', async (event) => {
  try {
    if (frontendWindow && !frontendWindow.isDestroyed()) {
      frontendWindow.close()
      frontendWindow = null
    }
    if (backendWindow && !backendWindow.isDestroyed()) {
      backendWindow.close()
      backendWindow = null
    }
    if (mapDisplayWindow && !mapDisplayWindow.isDestroyed()) {
      mapDisplayWindow.close()
      mapDisplayWindow = null
    }
    if (scoreboardWindowA && !scoreboardWindowA.isDestroyed()) {
      scoreboardWindowA.close()
      scoreboardWindowA = null
    }
    if (scoreboardWindowB && !scoreboardWindowB.isDestroyed()) {
      scoreboardWindowB.close()
      scoreboardWindowB = null
    }
    return { success: true }
  } catch (e) {
    console.error('[Main] 关闭窗口失败:', e)
    return { success: false, error: e.message }
  }
})

// 保存布局
ipcMain.handle('save-layout', async (event, layout) => {
  try {
    console.log('[Main] 保存布局被调用')
    console.log('[Main] 收到的布局键数量:', Object.keys(layout).length)

    // 读取旧布局，避免覆盖掉其他模块写入的字段（例如 scoreboardLayouts）
    let existingLayout = {}
    try {
      if (fs.existsSync(layoutPath)) {
        const existingContent = fs.readFileSync(layoutPath, 'utf8')
        existingLayout = existingContent ? JSON.parse(existingContent) : {}
      }
    } catch (e) {
      console.warn('[Main] 读取旧布局失败，将覆盖写入:', e.message)
      existingLayout = {}
    }

    // 保存窗口大小配置（合并旧值，避免窗口未打开时丢失上次尺寸）
    const windowBounds = { ...(existingLayout.windowBounds || {}) }
    const resizeLocked = normalizeFrontendResizeLockSetting(readJsonFileSafe(configPath, {}).frontendResizeLock)
    if (!resizeLocked && frontendWindow && !frontendWindow.isDestroyed()) {
      windowBounds.frontendBounds = frontendWindow.getBounds()
      const [cw, ch] = frontendWindow.getContentSize()
      windowBounds.frontendContentSize = { width: cw, height: ch }
      console.log('[Main] 保存前台窗口 - Bounds:', windowBounds.frontendBounds, 'ContentSize:', windowBounds.frontendContentSize)
    }
    if (scoreboardWindowA && !scoreboardWindowA.isDestroyed()) {
      windowBounds.scoreboardABounds = scoreboardWindowA.getBounds()
      console.log('[Main] 保存比分板A窗口大小:', windowBounds.scoreboardABounds)
    }
    if (scoreboardWindowB && !scoreboardWindowB.isDestroyed()) {
      windowBounds.scoreboardBBounds = scoreboardWindowB.getBounds()
      console.log('[Main] 保存比分板B窗口大小:', windowBounds.scoreboardBBounds)
    }
    if (scoreboardOverviewWindow && !scoreboardOverviewWindow.isDestroyed()) {
      windowBounds.scoreboardOverviewBounds = scoreboardOverviewWindow.getBounds()
      console.log('[Main] 保存总览比分板窗口大小:', windowBounds.scoreboardOverviewBounds)
    }
    if (postMatchWindow && !postMatchWindow.isDestroyed()) {
      windowBounds.postMatchBounds = postMatchWindow.getBounds()
      console.log('[Main] 保存赛后数据窗口大小:', windowBounds.postMatchBounds)
    }

    // 合并布局和窗口大小配置（保留旧字段）
    const fullLayout = {
      ...existingLayout,
      ...layout,
      windowBounds
    }

    console.log('[Main] 最终布局键数量:', Object.keys(fullLayout).length)
    console.log('[Main] 保存到:', layoutPath)

    fs.writeFileSync(layoutPath, JSON.stringify(fullLayout, null, 2))

    // 验证保存
    const savedContent = fs.readFileSync(layoutPath, 'utf8')
    const savedLayout = JSON.parse(savedContent)
    console.log('[Main] 验证：已保存的布局键数量:', Object.keys(savedLayout).length)

    return { success: true }
  } catch (error) {
    console.error('[Main] 保存布局失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取比分板布局（teamA/teamB）
ipcMain.handle('get-scoreboard-layout', async (event, team) => {
  try {
    if (team !== 'teamA' && team !== 'teamB') {
      return { success: false, error: 'Invalid team' }
    }

    if (!fs.existsSync(layoutPath)) {
      return { success: true, layout: null }
    }

    const raw = fs.readFileSync(layoutPath, 'utf8')
    const root = raw ? JSON.parse(raw) : {}
    const scoreboardLayouts = root.scoreboardLayouts || {}
    return { success: true, layout: scoreboardLayouts[team] || null }
  } catch (error) {
    console.error('[Main] 获取比分板布局失败:', error)
    return { success: false, error: error.message }
  }
})

// 保存比分板布局（teamA/teamB）
ipcMain.handle('save-scoreboard-layout', async (event, team, scoreboardLayout) => {
  try {
    if (team !== 'teamA' && team !== 'teamB') {
      return { success: false, error: 'Invalid team' }
    }

    let root = {}
    try {
      if (fs.existsSync(layoutPath)) {
        const raw = fs.readFileSync(layoutPath, 'utf8')
        root = raw ? JSON.parse(raw) : {}
      }
    } catch (e) {
      console.warn('[Main] 读取布局失败，将重建布局文件:', e.message)
      root = {}
    }

    if (!root.scoreboardLayouts || typeof root.scoreboardLayouts !== 'object') {
      root.scoreboardLayouts = {}
    }
    root.scoreboardLayouts[team] = scoreboardLayout || null
    root.updatedAt = new Date().toISOString()

    fs.writeFileSync(layoutPath, JSON.stringify(root, null, 2))
    return { success: true }
  } catch (error) {
    console.error('[Main] 保存比分板布局失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取总览比分板布局
ipcMain.handle('get-scoreboard-overview-layout', async () => {
  try {
    if (!fs.existsSync(layoutPath)) {
      return { success: true, layout: null }
    }
    const raw = fs.readFileSync(layoutPath, 'utf8')
    const root = raw ? JSON.parse(raw) : {}
    return { success: true, layout: root.scoreboardOverviewLayout || null }
  } catch (error) {
    console.error('[Main] 获取总览比分板布局失败:', error)
    return { success: false, error: error.message }
  }
})

// 保存总览比分板布局
ipcMain.handle('save-scoreboard-overview-layout', async (event, overviewLayout) => {
  try {
    let root = {}
    try {
      if (fs.existsSync(layoutPath)) {
        const raw = fs.readFileSync(layoutPath, 'utf8')
        root = raw ? JSON.parse(raw) : {}
      }
    } catch (e) {
      console.warn('[Main] 读取布局失败，将重建布局文件:', e.message)
      root = {}
    }
    root.scoreboardOverviewLayout = overviewLayout || null
    root.updatedAt = new Date().toISOString()
    fs.writeFileSync(layoutPath, JSON.stringify(root, null, 2))
    return { success: true }
  } catch (error) {
    console.error('[Main] 保存总览比分板布局失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取赛后数据布局
ipcMain.handle('get-postmatch-layout', async () => {
  try {
    if (!fs.existsSync(layoutPath)) {
      return { success: true, layout: null }
    }

    const raw = fs.readFileSync(layoutPath, 'utf8')
    const root = raw ? JSON.parse(raw) : {}
    return { success: true, layout: root.postMatchLayout || null }
  } catch (error) {
    console.error('[Main] 获取赛后数据布局失败:', error)
    return { success: false, error: error.message }
  }
})

// 保存赛后数据布局
ipcMain.handle('save-postmatch-layout', async (event, postMatchLayout) => {
  try {
    let root = {}
    try {
      if (fs.existsSync(layoutPath)) {
        const raw = fs.readFileSync(layoutPath, 'utf8')
        root = raw ? JSON.parse(raw) : {}
      }
    } catch (e) {
      console.warn('[Main] 读取布局失败，将重建布局文件:', e.message)
      root = {}
    }

    root.postMatchLayout = postMatchLayout || null
    root.updatedAt = new Date().toISOString()

    fs.writeFileSync(layoutPath, JSON.stringify(root, null, 2))
    return { success: true }
  } catch (error) {
    console.error('[Main] 保存赛后数据布局失败:', error)
    return { success: false, error: error.message }
  }
})

// 加载布局
ipcMain.handle('load-layout', async () => {
  console.log('[Main] load-layout 被调用')
  console.log('[Main] layoutPath:', layoutPath)
  try {
    if (fs.existsSync(layoutPath)) {
      const data = fs.readFileSync(layoutPath, 'utf8')
      const layout = JSON.parse(data)
      console.log('[Main] 布局文件已读取，键数量:', Object.keys(layout).length)
      console.log('[Main] 布局内容预览:', JSON.stringify(layout).substring(0, 200))
      return { success: true, layout: layout }
    }
    console.log('[Main] 布局文件不存在')
    return { success: true, layout: null }
  } catch (error) {
    console.error('[Main] 加载布局失败:', error.message)
    return { success: false, error: error.message }
  }
})

// 获取透明背景设置
ipcMain.handle('get-transparent-background', async () => {
  try {
    if (!fs.existsSync(layoutPath)) {
      return { success: true, transparentBackground: false }
    }
    const raw = fs.readFileSync(layoutPath, 'utf8')
    const root = raw ? JSON.parse(raw) : {}
    return { success: true, transparentBackground: !!root.transparentBackground }
  } catch (error) {
    console.error('[Main] 获取透明背景设置失败:', error)
    return { success: false, error: error.message }
  }
})

// 设置透明背景
ipcMain.handle('set-transparent-background', async (event, enabled) => {
  try {
    let root = {}
    try {
      if (fs.existsSync(layoutPath)) {
        const raw = fs.readFileSync(layoutPath, 'utf8')
        root = raw ? JSON.parse(raw) : {}
      }
    } catch (e) {
      console.warn('[Main] 读取布局失败，将重建布局文件:', e.message)
      root = {}
    }

    root.transparentBackground = !!enabled
    root.updatedAt = new Date().toISOString()

    fs.writeFileSync(layoutPath, JSON.stringify(root, null, 2))
    console.log('[Main] 透明背景设置已保存:', enabled)

    // 通知所有前台窗口刷新
    if (frontendWindow && !frontendWindow.isDestroyed()) {
      frontendWindow.webContents.send('update-data', { type: 'layout-updated' })
    }
    if (scoreboardWindowA && !scoreboardWindowA.isDestroyed()) {
      scoreboardWindowA.webContents.reload()
    }
    if (scoreboardWindowB && !scoreboardWindowB.isDestroyed()) {
      scoreboardWindowB.webContents.reload()
    }
    if (postMatchWindow && !postMatchWindow.isDestroyed()) {
      postMatchWindow.webContents.reload()
    }

    return { success: true }
  } catch (error) {
    console.error('[Main] 设置透明背景失败:', error)
    return { success: false, error: error.message }
  }
})

// 导出布局
ipcMain.handle('export-layout', async (event, layout) => {
  try {
    const result = await dialog.showSaveDialog({
      title: '导出布局',
      defaultPath: 'asg-layout.json',
      filters: [{ name: 'JSON文件', extensions: ['json'] }]
    })

    if (!result.canceled && result.filePath) {
      // 如果有背景图片，一起打包
      const exportData = { ...layout }
      if (layout.backgroundImage && fs.existsSync(layout.backgroundImage)) {
        const imageBuffer = fs.readFileSync(layout.backgroundImage)
        exportData.backgroundImageData = imageBuffer.toString('base64')
        exportData.backgroundImageExt = path.extname(layout.backgroundImage)
      }
      fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2))
      return { success: true }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 选择默认位置图像（用于未选择角色时显示）
ipcMain.handle('select-image-for-slot', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: '选择默认图像',
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      ensureDirectories()
      const srcPath = result.filePaths[0]
      const ext = path.extname(srcPath)
      // 使用时间戳避免文件名冲突
      const destPath = path.join(bgImagePath, `default-slot-${Date.now()}${ext}`)
      fs.copyFileSync(srcPath, destPath)
      return { success: true, path: destPath }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 导入布局
ipcMain.handle('import-layout', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: '导入布局',
      filters: [{ name: 'JSON文件', extensions: ['json'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const data = fs.readFileSync(result.filePaths[0], 'utf8')
      const layout = JSON.parse(data)

      // 如果包含背景图片数据，保存到本地
      if (layout.backgroundImageData) {
        const imagePath = path.join(bgImagePath, `imported${layout.backgroundImageExt || '.png'}`)
        const imageBuffer = Buffer.from(layout.backgroundImageData, 'base64')
        fs.writeFileSync(imagePath, imageBuffer)
        layout.backgroundImage = imagePath
        delete layout.backgroundImageData
        delete layout.backgroundImageExt
      }

      // 保存到本地
      fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2))
      return { success: true, layout }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 选择背景图片
ipcMain.handle('select-background', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: '选择背景图片',
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      // 复制到用户数据目录
      const srcPath = result.filePaths[0]
      const ext = path.extname(srcPath)
      const destPath = path.join(bgImagePath, `background${ext}`)
      fs.copyFileSync(srcPath, destPath)
      return { success: true, path: destPath }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 选择总览比分板贴图
ipcMain.handle('select-overview-texture', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: '选择总览比分板贴图',
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      ensureDirectories()
      const srcPath = result.filePaths[0]
      const ext = path.extname(srcPath)
      const destPath = path.join(bgImagePath, `scoreboard-overview-texture-${Date.now()}${ext}`)
      fs.copyFileSync(srcPath, destPath)
      return { success: true, path: destPath }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 为角色展示窗口选择单独的背景图片
ipcMain.handle('select-character-display-background', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: '选择角色展示背景图片',
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      ensureDirectories()
      const srcPath = result.filePaths[0]
      const ext = path.extname(srcPath)
      const destPath = path.join(bgImagePath, `character-display-background${ext}`)
      fs.copyFileSync(srcPath, destPath)

      if (!localBpState.characterDisplayLayout || typeof localBpState.characterDisplayLayout !== 'object') {
        localBpState.characterDisplayLayout = { positions: {}, transparentBackground: false }
      }
      localBpState.characterDisplayLayout.backgroundImage = destPath
      __persistCharacterDisplayLayoutToDisk__()
      broadcastLocalBpState()
      return { success: true, path: destPath }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ========= 自定义字体相关 =========
const { fontsPath, FONT_EXTENSIONS, isFontFile } = packManager

// 确保字体目录存在
function ensureFontsDir() {
  if (!fs.existsSync(fontsPath)) {
    fs.mkdirSync(fontsPath, { recursive: true })
  }
}

// 选择并导入自定义字体
ipcMain.handle('select-custom-font', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: '选择字体文件',
      filters: [{ name: '字体文件', extensions: ['ttf', 'otf', 'woff', 'woff2'] }],
      properties: ['openFile', 'multiSelections']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      ensureFontsDir()
      const importedFonts = []

      for (const srcPath of result.filePaths) {
        const fileName = path.basename(srcPath)
        const destPath = path.join(fontsPath, fileName)
        fs.copyFileSync(srcPath, destPath)

        // 从文件名生成字体家族名（去掉扩展名）
        const fontFamily = path.basename(fileName, path.extname(fileName))
        importedFonts.push({
          fileName,
          fontFamily,
          path: destPath
        })
        console.log('[Main] 导入字体:', fileName)
      }

      // 通知所有窗口：字体文件列表发生变化（用于热重载）
      broadcastToAllWindows('custom-fonts-changed', { ts: Date.now(), reason: 'import' })

      return { success: true, fonts: importedFonts }
    }
    return { success: false, canceled: true }
  } catch (error) {
    console.error('[Main] 导入字体失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取已安装的自定义字体列表
ipcMain.handle('get-custom-fonts', async () => {
  try {
    ensureFontsDir()
    const files = fs.readdirSync(fontsPath)
    const fonts = []

    for (const file of files) {
      if (isFontFile(file)) {
        const fontPath = path.join(fontsPath, file)
        const fontFamily = path.basename(file, path.extname(file))
        fonts.push({
          fileName: file,
          fontFamily,
          path: fontPath
        })
      }
    }

    return { success: true, fonts }
  } catch (error) {
    console.error('[Main] 获取字体列表失败:', error)
    return { success: false, error: error.message }
  }
})

// 删除自定义字体
ipcMain.handle('delete-custom-font', async (event, fileName) => {
  try {
    const fontPath = path.join(fontsPath, fileName)
    if (fs.existsSync(fontPath)) {
      fs.unlinkSync(fontPath)
      console.log('[Main] 删除字体:', fileName)

      // 通知所有窗口：字体文件列表发生变化（用于热重载）
      broadcastToAllWindows('custom-fonts-changed', { ts: Date.now(), reason: 'delete', fileName })

      return { success: true }
    }
    return { success: false, error: '字体文件不存在' }
  } catch (error) {
    console.error('[Main] 删除字体失败:', error)
    return { success: false, error: error.message }
  }
})

// 保存字体配置（哪些字体应用到哪些元素）
ipcMain.handle('save-font-config', async (event, config) => {
  try {
    // 将字体配置保存到 layout.json 中
    let layout = {}
    try {
      if (fs.existsSync(layoutPath)) {
        const content = fs.readFileSync(layoutPath, 'utf8')
        layout = content ? JSON.parse(content) : {}
      }
    } catch (e) {
      layout = {}
    }

    layout.fontConfig = config
    layout.updatedAt = new Date().toISOString()

    fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2))
    console.log('[Main] 保存字体配置成功')

    // 通知前台窗口更新字体
    if (frontendWindow && !frontendWindow.isDestroyed()) {
      frontendWindow.webContents.send('font-config-updated', config)
    }
    if (scoreboardWindowA && !scoreboardWindowA.isDestroyed()) {
      scoreboardWindowA.webContents.send('font-config-updated', config)
    }
    if (scoreboardWindowB && !scoreboardWindowB.isDestroyed()) {
      scoreboardWindowB.webContents.send('font-config-updated', config)
    }
    if (postMatchWindow && !postMatchWindow.isDestroyed()) {
      postMatchWindow.webContents.send('font-config-updated', config)
    }

    return { success: true }
  } catch (error) {
    console.error('[Main] 保存字体配置失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取字体配置
ipcMain.handle('get-font-config', async () => {
  try {
    if (!fs.existsSync(layoutPath)) {
      return { success: true, config: null }
    }

    const content = fs.readFileSync(layoutPath, 'utf8')
    const layout = content ? JSON.parse(content) : {}

    return { success: true, config: layout.fontConfig || null }
  } catch (error) {
    console.error('[Main] 获取字体配置失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取字体文件的 file:// URL（用于在渲染进程中加载）
ipcMain.handle('get-font-url', async (event, fileName) => {
  try {
    const fontPath = path.join(fontsPath, fileName)
    if (fs.existsSync(fontPath)) {
      // 返回 file:// URL
      return { success: true, url: `file://${fontPath.replace(/\\/g, '/')}` }
    }
    return { success: false, error: '字体文件不存在' }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 选择队伍logo
ipcMain.handle('select-team-logo', async (event, team) => {
  try {
    const result = await dialog.showOpenDialog({
      title: `选择${team === 'teamA' ? 'A' : 'B'}队Logo`,
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      ensureDirectories()
      const srcPath = result.filePaths[0]
      const ext = path.extname(srcPath)
      const destPath = path.join(bgImagePath, `${team}-logo${ext}`)
      fs.copyFileSync(srcPath, destPath)
      return { success: true, path: destPath }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 选择比分板背景图片（每队独立，便于打包）
ipcMain.handle('select-scoreboard-background', async (event, team) => {
  try {
    if (team !== 'teamA' && team !== 'teamB') {
      return { success: false, error: 'Invalid team' }
    }

    const result = await dialog.showOpenDialog({
      title: `选择${team === 'teamA' ? 'A队' : 'B队'}比分板背景`,
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      ensureDirectories()
      const srcPath = result.filePaths[0]
      const ext = path.extname(srcPath)
      const destPath = path.join(bgImagePath, `${team}-scoreboard-background${ext}`)
      fs.copyFileSync(srcPath, destPath)
      return { success: true, path: destPath }
    }

    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 选择赛后数据背景图片
ipcMain.handle('select-postmatch-background', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: '选择赛后数据背景',
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      ensureDirectories()
      const srcPath = result.filePaths[0]
      const ext = path.extname(srcPath)
      const destPath = path.join(bgImagePath, `postmatch-background${ext}`)
      fs.copyFileSync(srcPath, destPath)
      return { success: true, path: destPath }
    }

    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 导出BP布局包 - 使用新的 packManager 模块
ipcMain.handle('export-bp-pack', async () => {
  try {
    console.log('[ExportPack] 开始导出布局包 (使用新模块)')

    const windowRefs = {
      frontendWindow,
      scoreboardWindowA,
      scoreboardWindowB,
      postMatchWindow
    }

    const result = await packManager.exportPack({ windowRefs })

    if (result.success) {
      console.log('[ExportPack] 导出成功:', result.filePath)
    }

    return result
  } catch (error) {
    console.error('[ExportPack] 导出失败:', error)
    return { success: false, error: error.message }
  }
})

// 导入BP布局包 - 使用新的跨平台解压模块
ipcMain.handle('import-bp-pack', async () => {
  try {
    // 获取窗口引用
    const windowRefs = {
      frontendWindow,
      scoreboardWindowA,
      scoreboardWindowB,
      postMatchWindow
    }

    // 使用 packManager 进行导入
    const result = await packManager.importPack({ windowRefs })

    if (result.success) {
      console.log('[ImportPack] 导入成功')

      // 布局包会写入 layout.json：把角色展示布局回填到本地BP状态并广播
      __loadCharacterDisplayLayoutFromDiskIntoState__()
      __normalizeLocalBpStateInPlace__()
      broadcastLocalBpState()

      // 导入包可能包含 fonts/，通知窗口热加载字体
      broadcastToAllWindows('custom-fonts-changed', { ts: Date.now(), reason: 'import-pack' })
    }

    return result
  } catch (error) {
    console.error('[ImportPack] 导入失败:', error)
    return { success: false, error: error.message }
  }
})

// 恢复默认布局 - 使用 packManager 模块
ipcMain.handle('reset-layout', async () => {
  try {
    const windowRefs = {
      frontendWindow,
      scoreboardWindowA,
      scoreboardWindowB,
      postMatchWindow
    }
    return await packManager.resetLayout(windowRefs)
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 获取背景图片路径
ipcMain.handle('get-background-path', async () => {
  try {
    // 优先从布局文件读取
    if (fs.existsSync(layoutPath)) {
      const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'))
      if (layout.backgroundImage && fs.existsSync(layout.backgroundImage)) {
        return { success: true, path: layout.backgroundImage }
      }
    }
    // 如果布局中没有，查找默认背景图片
    const files = fs.readdirSync(bgImagePath)
    const bgFile = files.find(f => f.startsWith('background'))
    if (bgFile) {
      return { success: true, path: path.join(bgImagePath, bgFile) }
    }
    return { success: true, path: null }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 向前台窗口发送数据
ipcMain.handle('send-to-frontend', async (event, data) => {
  const targets = [
    frontendWindow,
    backendWindow,
    scoreboardWindowA,
    scoreboardWindowB,
    postMatchWindow,
    storeWindow,
    mapDisplayWindow,
    predictionWindow,
    mainWindow
  ].filter(w => w && !w.isDestroyed())

  if (targets.length === 0) {
    // 即使没有窗口，也要通知本地页面服务器
    try {
      if (global.__localPageServerHooks && typeof global.__localPageServerHooks.onDataUpdate === 'function') {
        global.__localPageServerHooks.onDataUpdate(data)
      }
    } catch (e) {
      // ignore
    }
    return false
  }

  for (const win of targets) {
    try {
      win.webContents.send('update-data', data)
    } catch (e) {
      console.warn('[Main] send-to-frontend broadcast failed:', e.message)
    }
  }

  // 通知本地页面服务器（如果已启动）
  try {
    if (global.__localPageServerHooks && typeof global.__localPageServerHooks.onDataUpdate === 'function') {
      global.__localPageServerHooks.onDataUpdate(data)
    }
  } catch (e) {
    // ignore - 本地页面服务器可能未启动
  }

  // 同时更新插件系统的房间数据，触发 room-data-changed 事件
  // 注意：不同入口传入的 data 形状不一致，这里做宽松判断
  const shouldSyncRoomDataToPlugins = !!data && (
    data.type === 'state' ||
    data.type === 'score' ||
    !!data.state ||
    !!data.scoreData ||
    !!data.currentRoundData ||
    !!data.state?.currentRoundData ||
    !!data.data?.currentRoundData ||
    !!data.data?.state?.currentRoundData ||
    !!data.data?.scoreData
  )

  if (shouldSyncRoomDataToPlugins) {
    try {
      setPluginRoomData(data)
    } catch (e) {
      console.warn('[Main] setPluginRoomData failed:', e.message)
    }
  }

  return true
})

// 前台窗口控制
ipcMain.handle('toggle-frontend-frame', async (event, show) => {
  if (frontendWindow) {
    // Electron不支持动态切换frame，这里通过设置透明度来模拟
    frontendWindow.setOpacity(show ? 0.8 : 1)
    return true
  }
  return false
})

// 前台窗口置顶
ipcMain.handle('set-frontend-always-on-top', async (event, alwaysOnTop) => {
  if (frontendWindow) {
    frontendWindow.setAlwaysOnTop(alwaysOnTop)
    return true
  }
  return false
})

// 前台窗口全屏
ipcMain.handle('set-frontend-fullscreen', async (event, fullscreen) => {
  if (frontendWindow) {
    frontendWindow.setFullScreen(fullscreen)
    return true
  }
  return false
})

// 获取/设置前台渲染分辨率（内容尺寸）
ipcMain.handle('get-frontend-render-resolution', async () => {
  const layout = readJsonFileSafe(layoutPath, {})
  const saved = normalizeResolution(layout?.windowBounds?.frontendContentSize)
  const fallback = normalizeResolution(layout?.windowBounds?.frontendBounds) || { width: 1280, height: 720 }
  const current = (frontendWindow && !frontendWindow.isDestroyed())
    ? (() => {
      const [cw, ch] = frontendWindow.getContentSize()
      return { width: cw, height: ch }
    })()
    : null

  return {
    success: true,
    saved: saved || fallback,
    current
  }
})

ipcMain.handle('set-frontend-render-resolution', async (event, input) => {
  const resolution = normalizeResolution(input)
  if (!resolution) {
    return { success: false, error: '分辨率不合法（范围 320×240 ~ 7680×4320）' }
  }

  const root = readJsonFileSafe(layoutPath, {})
  const windowBounds = { ...(root.windowBounds || {}) }
  windowBounds.frontendContentSize = resolution

  // 同时更新 frontendBounds 的宽高，兼容旧逻辑 & 布局包
  const existingBounds = windowBounds.frontendBounds || {}
  const x = typeof existingBounds.x === 'number' ? existingBounds.x : undefined
  const y = typeof existingBounds.y === 'number' ? existingBounds.y : undefined
  windowBounds.frontendBounds = {
    ...(typeof x === 'number' ? { x } : {}),
    ...(typeof y === 'number' ? { y } : {}),
    width: resolution.width,
    height: resolution.height
  }

  root.windowBounds = windowBounds
  const ok = writeJsonFileSafe(layoutPath, root)
  if (!ok) {
    return { success: false, error: '保存失败（无法写入 layout.json）' }
  }

  // 立即应用到已打开的前台窗口
  if (frontendWindow && !frontendWindow.isDestroyed()) {
    try {
      frontendWindow.setContentSize(resolution.width, resolution.height)
    } catch (e) {
      console.warn('[Main] setContentSize failed:', e.message)
      try {
        const bounds = frontendWindow.getBounds()
        frontendWindow.setBounds({ ...bounds, width: resolution.width, height: resolution.height })
      } catch (e2) {
        return { success: false, error: e2.message }
      }
    }
  }

  const current = (frontendWindow && !frontendWindow.isDestroyed())
    ? (() => {
      const [cw, ch] = frontendWindow.getContentSize()
      return { width: cw, height: ch }
    })()
    : null

  return { success: true, saved: resolution, current }
})

// 打开比分窗口
ipcMain.handle('open-scoreboard', async (event, roomId, team) => {
  try {
    createScoreboardWindow(roomId, team)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 打开总览比分板窗口
ipcMain.handle('open-scoreboard-overview', async (event, roomId, boCount) => {
  try {
    createScoreboardOverviewWindow(roomId, boCount)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 打开赛后数据窗口
ipcMain.handle('open-postmatch', async (event, roomId) => {
  try {
    createPostMatchWindow(roomId)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// OCR：识别对局图片（需要已登录的 Bearer token）
ipcMain.handle('ai-parse-game-record-image', async (event, imageBase64) => {
  try {
    if (!authToken) {
      return { success: false, error: '未登录账号，请先在主界面登录后再进行识别' }
    }

    const apiBase = getEnvConfig().api
    const base64 = typeof imageBase64 === 'string'
      ? imageBase64.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
      : ''

    if (!base64) {
      return { success: false, error: '图片数据为空' }
    }

    const response = await httpPost(`${apiBase}/api/Ai/parse-game-record-image`, {
      imageBase64: base64
    }, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      },
      timeout: 60000
    })

    if (response.status !== 200) {
      return { success: false, error: `HTTP ${response.status}`, data: response.data }
    }

    return { success: true, data: response.data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 切换前台编辑模式
ipcMain.handle('toggle-frontend-edit-mode', async () => {
  if (frontendWindow) {
    frontendWindow.webContents.send('toggle-edit-mode')
    return true
  }
  return false
})

// 显示地图展示窗口
ipcMain.handle('show-map-display', async (event, data) => {
  createMapDisplayWindow(data.action, data.map, data.team)
  return true
})

// ========== 布局包商店功能 ==========

// 创建商店窗口
function createStoreWindow() {
  if (storeWindow && !storeWindow.isDestroyed()) {
    storeWindow.focus()
    return storeWindow
  }

  storeWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    title: '布局包商店',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  storeWindow.loadFile('pages/store.html')
  storeWindow.setMenu(null)

  storeWindow.on('closed', () => {
    storeWindow = null
  })

  return storeWindow
}

// 创建欢迎窗口
function createWelcomeWindow() {
  if (welcomeWindow && !welcomeWindow.isDestroyed()) {
    welcomeWindow.focus()
    return welcomeWindow
  }

  welcomeWindow = new BrowserWindow({
    width: 900,
    height: 700,
    title: '欢迎 - ASG Director',
    resizable: false,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  welcomeWindow.loadFile('pages/welcome.html')
  welcomeWindow.setMenu(null)

  welcomeWindow.on('closed', () => {
    welcomeWindow = null
    // 欢迎窗口关闭后，如果主窗口未打开，则打开主窗口
    if (!mainWindow || mainWindow.isDestroyed()) {
      createMainWindow()
    }
  })

  return welcomeWindow
}

// 打开商店窗口
ipcMain.handle('open-store', async () => {
  createStoreWindow()
  return { success: true }
})

// 应用重启（用于插件安装/更新后生效）
ipcMain.handle('app-restart', async () => {
  try {
    setTimeout(async () => {
      try {
        await shutdownPlugins()
      } catch {
        // ignore
      }
      try {
        app.relaunch()
      } finally {
        app.exit(0)
      }
    }, 100)

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// HTTP请求辅助函数
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const protocol = urlObj.protocol === 'https:' ? https : http

    const headers = options.headers || {}
    const authHeader = headers.Authorization || headers.authorization
    const usedBearer = typeof authHeader === 'string' && /\bBearer\b/i.test(authHeader)

    const req = protocol.request(url, {
      method: options.method || 'GET',
      headers
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          const status = res.statusCode

          if (usedBearer && (status === 401 || status === 403)) {
            clearAuthState('unauthorized', { status, url, data: parsed })
          }

          resolve({ status, data: parsed })
        } catch {
          const status = res.statusCode
          if (usedBearer && (status === 401 || status === 403)) {
            clearAuthState('unauthorized', { status, url, data })
          }

          resolve({ status, data })
        }
      })
    })

    req.on('error', reject)

    if (options.body) {
      req.write(options.body)
    }
    req.end()
  })
}

// 获取商店列表 - 使用新的 httpGet 模块
ipcMain.handle('store-get-packs', async (event, params) => {
  try {
    const query = new URLSearchParams(params).toString()
    const url = `${getStoreApiBase()}?${query}`
    console.log('[Store] Getting packs from:', url)
    const data = await httpGet(url)
    console.log('[Store] Response data:', data)
    return { success: true, data }
  } catch (error) {
    console.error('[Store] Error getting packs:', error.message)
    return { success: false, error: error.message }
  }
})

// 获取布局包详情
ipcMain.handle('store-get-pack-detail', async (event, id) => {
  try {
    const data = await httpGet(`${getStoreApiBase()}/${id}`)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 下载布局包 - 使用新的跨平台下载和解压模块
ipcMain.handle('store-download-pack', async (event, id) => {
  let tempDir = null

  try {
    console.log('[Store] 开始下载布局包 id:', id)

    // 创建临时目录
    tempDir = path.join(os.tmpdir(), 'bppack-download-' + Date.now())
    fs.mkdirSync(tempDir, { recursive: true })

    // 获取包信息
    const infoData = await httpGet(`${getStoreApiBase()}/${id}/download`)
    if (!infoData) {
      throw new Error('获取包信息失败')
    }
    const { name, version } = infoData
    console.log('[Store] 包信息:', name, 'v' + version)

    // 下载文件
    const fileUrl = `${getStoreApiBase()}/${id}/file`
    const tempFile = path.join(tempDir, `${name}_v${version}.bppack`)

    console.log('[Store] 下载文件:', fileUrl)

    const downloadResult = await downloadFile(fileUrl, tempFile, {
      onProgress: (progress, downloaded, total) => {
        console.log(`[Store] 下载进度: ${progress}% (${formatSize(downloaded)} / ${formatSize(total)})`)
        if (event && event.sender && !event.sender.isDestroyed()) {
          event.sender.send('download-progress', progress)
        }
      },
      maxRetries: 3
    })

    console.log('[Store] 下载完成:', downloadResult.size, '字节')

    // 验证 ZIP 文件
    const validation = await validateZip(tempFile)
    if (!validation.valid) {
      throw new Error(`无效的布局包文件: ${validation.error}`)
    }

    // 解压文件
    const extractDir = path.join(tempDir, 'extracted')
    fs.mkdirSync(extractDir, { recursive: true })

    console.log('[Store] 解压到:', extractDir)

    const unzipResult = await unzipFile(tempFile, extractDir)
    if (!unzipResult.success) {
      throw new Error('解压失败')
    }

    console.log('[Store] 解压完成，文件数:', unzipResult.files.length)

    // 使用 packManager 安装
    const windowRefs = {
      frontendWindow,
      scoreboardWindowA,
      scoreboardWindowB
    }

    const installResult = await packManager.installFromStore(tempFile, { id, name, version }, { windowRefs })

    // 清理临时目录
    fs.rmSync(tempDir, { recursive: true, force: true })
    tempDir = null

    // 检查是否有窗口打开
    const hasWindows = (frontendWindow && !frontendWindow.isDestroyed()) ||
      (scoreboardWindowA && !scoreboardWindowA.isDestroyed()) ||
      (scoreboardWindowB && !scoreboardWindowB.isDestroyed())

    return {
      success: true,
      layout: installResult.layout,
      packData: installResult.packData,
      hasWindows,
      message: hasWindows ? '布局包已应用！' : '布局包已安装！请打开前台窗口或比分板查看效果。'
    }
  } catch (error) {
    console.error('[Store] 下载错误:', error)
    // 清理临时目录
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (e) {
        console.error('[Store] 清理临时目录失败:', e.message)
      }
    }
    return { success: false, error: error.message }
  }
})

// 获取已安装的包列表 - 使用 packManager 模块
ipcMain.handle('store-get-installed', async () => {
  try {
    const data = packManager.getInstalledPacks()
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 获取我上传的布局包（需要登录）
ipcMain.handle('store-get-my-packs', async () => {
  try {
    if (!authToken) return { success: false, error: '未登录' }
    const url = `${getStoreApiBase()}/my-packs`
    const res = await httpRequest(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    if (res.status >= 200 && res.status < 300) return { success: true, data: res.data }
    return { success: false, error: res.data?.message || '获取失败' }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 删除布局包（需要登录且作者/管理员）
ipcMain.handle('store-delete-pack', async (event, id) => {
  try {
    if (!authToken) return { success: false, error: '未登录' }
    const url = `${getStoreApiBase()}/${id}`
    const res = await httpRequest(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    if (res.status >= 200 && res.status < 300) return { success: true, data: res.data }
    return { success: false, error: res.data?.message || '删除失败' }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ========== 插件商店功能 ==========

ipcMain.handle('plugin-store-get-packs', async (event, params) => {
  try {
    const query = new URLSearchParams(params || {}).toString()
    const url = query ? `${getPluginStoreApiBase()}?${query}` : `${getPluginStoreApiBase()}`
    console.log('[PluginStore] Getting packs from:', url)
    const data = await httpGet(url)
    return { success: true, data }
  } catch (error) {
    console.error('[PluginStore] Error getting packs:', error.message)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('plugin-store-get-pack-detail', async (event, id) => {
  try {
    const data = await httpGet(`${getPluginStoreApiBase()}/${id}`)
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 获取我上传的插件包（需要登录）
ipcMain.handle('plugin-store-get-my-packs', async () => {
  try {
    if (!authToken) return { success: false, error: '未登录' }
    const url = `${getPluginStoreApiBase()}/my-packs`
    const res = await httpRequest(url, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    if (res.status >= 200 && res.status < 300) return { success: true, data: res.data }
    return { success: false, error: res.data?.message || '获取失败' }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 删除插件包（需要登录且作者/管理员）
ipcMain.handle('plugin-store-delete-pack', async (event, id) => {
  try {
    if (!authToken) return { success: false, error: '未登录' }
    const url = `${getPluginStoreApiBase()}/${id}`
    const res = await httpRequest(url, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    if (res.status >= 200 && res.status < 300) return { success: true, data: res.data }
    return { success: false, error: res.data?.message || '删除失败' }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 设置插件包公开状态（需要登录且作者/管理员）
ipcMain.handle('plugin-store-set-visibility', async (event, id, isPublic) => {
  try {
    if (!authToken) return { success: false, error: '未登录' }
    const url = `${getPluginStoreApiBase()}/${id}/visibility`
    const res = await httpRequest(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ isPublic: !!isPublic })
    })
    if (res.status >= 200 && res.status < 300) return { success: true, data: res.data }
    return { success: false, error: res.data?.message || '更新失败' }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('plugin-store-get-installed', async () => {
  try {
    const data = pluginPackManager.listUserInstalledPlugins()
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('plugin-store-uninstall', async (event, pluginId) => {
  try {
    const res = pluginPackManager.uninstallUserPlugin(pluginId)
    return { success: true, ...res, requiresRestart: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 导出已安装插件为 .asgplugin
ipcMain.handle('plugin-store-export-plugin', async (event, pluginId) => {
  try {
    if (!pluginId) return { success: false, error: 'pluginId 不能为空' }

    const userPluginsDir = pluginPackManager.getUserPluginsDir()

    let sourceDir = path.join(userPluginsDir, pluginId)
    if (!fs.existsSync(sourceDir)) {
      return { success: false, error: '未找到已安装插件目录' }
    }

    let version = '1.0.0'
    try {
      const manifestPath = path.join(sourceDir, 'package.json')
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        if (manifest?.version) version = String(manifest.version)
      }
    } catch {
      // ignore
    }

    const safeId = String(pluginId).replace(/[^a-zA-Z0-9._-]/g, '_')
    const safeVersion = String(version).replace(/[^0-9a-zA-Z._-]/g, '_')
    const defaultPath = path.join(app.getPath('downloads'), `${safeId}_v${safeVersion}.asgplugin`)

    const result = await dialog.showSaveDialog({
      title: '导出插件包',
      defaultPath,
      filters: [{ name: ' 插件包', extensions: ['asgplugin'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: true, canceled: true }
    }

    let outPath = result.filePath
    if (!outPath.toLowerCase().endsWith('.asgplugin')) {
      outPath += '.asgplugin'
    }

    const zipRes = await zipDirectory(sourceDir, outPath)
    if (!zipRes?.success) {
      return { success: false, error: zipRes?.error || '导出失败' }
    }

    return { success: true, canceled: false, filePath: outPath, size: zipRes.size }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('plugin-store-download-pack', async (event, id) => {
  let tempDir = null

  try {
    console.log('[PluginStore] 开始下载插件包 id:', id)

    tempDir = path.join(os.tmpdir(), 'asgplugin-download-' + Date.now())
    fs.mkdirSync(tempDir, { recursive: true })

    const infoData = await httpGet(`${getPluginStoreApiBase()}/${id}/download`)
    if (!infoData) throw new Error('获取插件包信息失败')

    const { name, version } = infoData
    const fileUrl = `${getPluginStoreApiBase()}/${id}/file`
    const safeName = String(name || 'plugin').replace(/[^a-zA-Z0-9_.\-\u4e00-\u9fa5]+/g, '_')
    const tempFile = path.join(tempDir, `${safeName}_v${version}.asgplugin`)

    await downloadFile(fileUrl, tempFile, { maxRetries: 3 })

    const validation = await validateZip(tempFile)
    if (!validation.valid) {
      throw new Error(`无效的插件包文件: ${validation.error}`)
    }

    const installed = await pluginPackManager.installPluginPackFile(tempFile)

    fs.rmSync(tempDir, { recursive: true, force: true })
    tempDir = null

    return {
      success: true,
      installed,
      requiresRestart: true,
      message: '插件已安装/更新完成，需重启后生效'
    }
  } catch (error) {
    console.error('[PluginStore] 下载/安装错误:', error)
    if (tempDir && fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch {
        // ignore
      }
    }
    return { success: false, error: error.message }
  }
})

// 选择插件包文件（.asgplugin）
ipcMain.handle('plugin-store-select-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: '选择插件包文件',
      filters: [{ name: ' 插件包', extensions: ['asgplugin'] }],
      properties: ['openFile']
    })

    if (result.canceled || !result.filePaths?.length) {
      return { success: true, canceled: true }
    }

    const filePath = result.filePaths[0]
    return {
      success: true,
      canceled: false,
      filePath,
      fileName: path.basename(filePath)
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 上传插件包到商店（.asgplugin）
ipcMain.handle('plugin-store-upload-pack', async (event, metadata) => {
  try {
    if (!authToken) {
      return { success: false, error: '请先登录账号再上传' }
    }

    const filePath = metadata?.filePath
    if (!filePath || !fs.existsSync(filePath)) {
      return { success: false, error: '请选择要上传的 .asgplugin 文件' }
    }

    const ext = path.extname(filePath).toLowerCase()
    if (ext !== '.asgplugin') {
      return { success: false, error: '仅支持 .asgplugin 插件包文件' }
    }

    // 使用multipart/form-data上传（与布局包商店一致）
    const FormData = require('form-data')
    const form = new FormData()

    form.append('file', fs.createReadStream(filePath))
    form.append('name', String(metadata?.name || '').trim())
    form.append('version', String(metadata?.version || '').trim())
    form.append('author', String(metadata?.author || '').trim())
    form.append('description', String(metadata?.description || ''))
    if (metadata?.packageId) {
      form.append('packageId', String(metadata.packageId).trim())
    }
    form.append('isPublic', String(metadata?.isPublic !== false))

    // 自动版本号递增开关：如果启用，后端会自动从现有版本递增
    if (metadata?.autoIncrementVersion) {
      form.append('autoIncrementVersion', 'true')
    }

    // 基本校验（避免后端 400 信息不明显）
    if (!String(metadata?.name || '').trim()) return { success: false, error: '请填写插件名称' }
    if (!String(metadata?.version || '').trim()) return { success: false, error: '请填写版本号' }
    if (!String(metadata?.author || '').trim()) return { success: false, error: '请填写作者' }

    const uploadResult = await new Promise((resolve, reject) => {
      const urlObj = new URL(`${getPluginStoreApiBase()}/upload`)
      const protocol = urlObj.protocol === 'https:' ? https : http

      const req = protocol.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${authToken}`
        }
      }, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode, data })
          }
        })
      })

      req.on('error', reject)
      form.pipe(req)
    })

    if (uploadResult.status >= 200 && uploadResult.status < 300) {
      return { success: true, data: uploadResult.data }
    }

    const message = (uploadResult?.data && typeof uploadResult.data === 'object')
      ? (uploadResult.data.message || uploadResult.data.error || '上传失败')
      : '上传失败'

    return { success: false, error: message }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 上传布局包到商店
ipcMain.handle('store-upload-pack', async (event, metadata) => {
  try {
    if (!authToken) {
      return { success: false, error: '请先登录账号再上传' }
    }

    console.log('[Store] Starting upload for:', metadata.name)
    // 先导出当前布局包到临时文件
    const tempDir = path.join(os.tmpdir(), 'bppack-upload-' + Date.now())
    fs.mkdirSync(tempDir, { recursive: true })
    console.log('[Store] Temp dir created:', tempDir)

    // 创建临时布局包
    if (fs.existsSync(layoutPath)) {
      console.log('[Store] 复制布局文件:', layoutPath)
      fs.copyFileSync(layoutPath, path.join(tempDir, 'layout.json'))

      // 验证复制
      const copiedLayoutPath = path.join(tempDir, 'layout.json')
      if (fs.existsSync(copiedLayoutPath)) {
        const content = fs.readFileSync(copiedLayoutPath, 'utf8')
        console.log('[Store] 布局文件已复制，大小:', content.length, '字节')
      } else {
        console.error('[Store] 布局文件复制失败!')
      }
    } else {
      console.warn('[Store] 布局文件不存在:', layoutPath)
    }

    // 收集窗口配置数据
    const packData = {}
    if (frontendWindow && !frontendWindow.isDestroyed()) {
      packData.frontendBounds = frontendWindow.getBounds()
    }
    if (scoreboardWindowA && !scoreboardWindowA.isDestroyed()) {
      packData.scoreboardABounds = scoreboardWindowA.getBounds()
    }
    if (scoreboardWindowB && !scoreboardWindowB.isDestroyed()) {
      packData.scoreboardBBounds = scoreboardWindowB.getBounds()
    }

    if (Object.keys(packData).length > 0) {
      fs.writeFileSync(
        path.join(tempDir, 'pack-config.json'),
        JSON.stringify(packData, null, 2)
      )
    }

    // 复制所有图片文件
    if (fs.existsSync(bgImagePath)) {
      const files = fs.readdirSync(bgImagePath)
      console.log('[Store] 背景图片目录文件数:', files.length)
      files.forEach(file => {
        const srcPath = path.join(bgImagePath, file)
        const destPath = path.join(tempDir, file)
        if (fs.statSync(srcPath).isFile()) {
          fs.copyFileSync(srcPath, destPath)
          console.log('[Store] 复制图片:', file)
        }
      })
    } else {
      console.warn('[Store] 背景图片目录不存在:', bgImagePath)
    }

    // 列出临时目录中的所有文件
    const tempFiles = fs.readdirSync(tempDir)
    console.log('[Store] 临时目录文件列表:', tempFiles)
    console.log('[Store] 临时目录文件数:', tempFiles.length)

    // 打包成zip
    const packFileName = `${metadata.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}_v${metadata.version}.bppack`
    const packFilePath = path.join(os.tmpdir(), packFileName)

    console.log('[Store] Packing files from:', tempDir, 'to:', packFilePath)

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(packFilePath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', () => {
        console.log(`[Store] 打包完成: ${archive.pointer()} bytes`)
        resolve()
      })

      archive.on('error', (err) => {
        console.error('[Store] 打包错误:', err)
        reject(err)
      })

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('[Store] 打包警告:', err)
        } else {
          reject(err)
        }
      })

      archive.pipe(output)
      archive.directory(tempDir, false)
      archive.finalize()
    })

    // 使用multipart/form-data上传
    const FormData = require('form-data')
    const form = new FormData()
    form.append('file', fs.createReadStream(packFilePath))
    form.append('name', metadata.name)
    form.append('version', metadata.version)
    form.append('author', metadata.author)
    form.append('description', metadata.description || '')
    if (metadata.tags) {
      form.append('tags', JSON.stringify(metadata.tags))
    }
    if (metadata.packageId) {
      form.append('packageId', metadata.packageId)
    }
    form.append('isPublic', String(metadata.isPublic !== false))

    // 自动版本号递增开关：如果启用，后端会自动从现有版本递增
    if (metadata.autoIncrementVersion) {
      form.append('autoIncrementVersion', 'true')
    }

    // 如果有预览图
    if (metadata.previewPath && fs.existsSync(metadata.previewPath)) {
      form.append('preview', fs.createReadStream(metadata.previewPath))
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const urlObj = new URL(`${getStoreApiBase()}/upload`)
      const protocol = urlObj.protocol === 'https:' ? https : http

      const req = protocol.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${authToken}`
        }
      }, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) })
          } catch {
            resolve({ status: res.statusCode, data })
          }
        })
      })

      req.on('error', reject)
      form.pipe(req)
    })

    // 清理临时文件
    fs.rmSync(tempDir, { recursive: true, force: true })
    fs.unlinkSync(packFilePath)

    if (uploadResult.status >= 200 && uploadResult.status < 300) {
      return { success: true, data: uploadResult.data }
    } else {
      return { success: false, error: uploadResult.data.message || '上传失败' }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 检查更新
ipcMain.handle('store-check-updates', async () => {
  try {
    if (!fs.existsSync(installedPacksPath)) {
      return { success: true, data: { updates: [] } }
    }

    const installed = JSON.parse(fs.readFileSync(installedPacksPath, 'utf8'))
    if (!installed.length) {
      return { success: true, data: { updates: [] } }
    }

    // 这里简化处理，实际应该调用批量检查更新API
    const updates = []
    for (const pack of installed) {
      try {
        const res = await httpRequest(`${getStoreApiBase()}/${pack.id}`)
        if (res.data && res.data.version && res.data.version !== pack.version) {
          updates.push({
            id: pack.id,
            name: pack.name,
            currentVersion: pack.version,
            latestVersion: res.data.version
          })
        }
      } catch (e) {
        // 忽略单个包的检查错误
      }
    }

    return { success: true, data: { updates } }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 评分
ipcMain.handle('store-rate-pack', async (event, id, rating) => {
  try {
    const response = await httpRequest(`${getStoreApiBase()}/${id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating })
    })
    return { success: true, data: response.data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 选择预览图片
ipcMain.handle('store-select-preview', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: '选择预览图片',
      filters: [{ name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ==================== 登录与竞猜功能 ====================

// 存储登录状态
let authToken = null
let currentUser = null
const authPath = path.join(userDataPath, 'auth.json')

// 加载保存的登录状态
function loadAuthState() {
  try {
    if (fs.existsSync(authPath)) {
      const data = JSON.parse(fs.readFileSync(authPath, 'utf8'))
      authToken = data.token
      currentUser = data.user
      console.log('[Auth] 已加载登录状态:', currentUser?.email)
    }
  } catch (e) {
    console.error('[Auth] 加载登录状态失败:', e.message)
  }
}

// 保存登录状态
function saveAuthState() {
  try {
    fs.writeFileSync(authPath, JSON.stringify({ token: authToken, user: currentUser }, null, 2))
  } catch (e) {
    console.error('[Auth] 保存登录状态失败:', e.message)
  }
}

function clearAuthState(reason = 'expired', details = {}) {
  const hadToken = !!authToken
  authToken = null
  currentUser = null
  try {
    fs.unlinkSync(authPath)
  } catch (e) { }

  if (hadToken) {
    try {
      broadcastToAllWindows('auth-expired', {
        reason,
        ...details,
        ts: Date.now()
      })
    } catch (e) {
      // ignore
    }
  }
}

// 登录
ipcMain.handle('asg-login', async (event, email, password) => {
  try {
    const apiBase = getEnvConfig().api
    const response = await httpRequest(`${apiBase}/api/Auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })

    if (response.data && response.data.token) {
      authToken = response.data.token
      currentUser = response.data.user || { email }
      saveAuthState()
      console.log('[Auth] 登录成功:', email)
      return { success: true, user: currentUser }
    }
    return { success: false, error: '登录失败' }
  } catch (error) {
    console.error('[Auth] 登录失败:', error.message)
    return { success: false, error: error.message }
  }
})

// 登出
ipcMain.handle('asg-logout', async () => {
  clearAuthState('logout')
  return { success: true }
})

// 获取登录状态
ipcMain.handle('asg-get-auth-status', async () => {
  return {
    isLoggedIn: !!authToken,
    user: currentUser,
    token: authToken
  }
})

// 获取我的赛事（创建的或管理的）
ipcMain.handle('asg-get-my-events', async () => {
  if (!authToken) {
    return { success: false, error: '未登录' }
  }

  try {
    const apiBase = getEnvConfig().api
    const response = await httpRequest(`${apiBase}/api/Events/my-events`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })
    if (response.status >= 200 && response.status < 300) return { success: true, data: response.data }
    return { success: false, error: response.data?.message || '获取失败' }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 获取赛事的赛程
ipcMain.handle('asg-get-event-matches', async (event, eventId) => {
  try {
    const apiBase = getEnvConfig().api
    const response = await httpRequest(`${apiBase}/api/Matches?eventId=${eventId}&pageSize=100`)
    return { success: true, data: response.data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 获取赛程竞猜详情
ipcMain.handle('asg-get-match-predictions', async (event, matchId) => {
  try {
    const apiBase = getEnvConfig().api
    const response = await httpRequest(`${apiBase}/api/Predictions/match/${matchId}/detail`)
    return { success: true, data: response.data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 创建B站弹幕竞猜
ipcMain.handle('asg-create-bilibili-prediction', async (event, dto) => {
  try {
    const apiBase = getEnvConfig().api
    const response = await httpRequest(`${apiBase}/api/Predictions/bilibili`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto)
    })
    return { success: true, data: response.data }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ==================== 竞猜结果窗口 ====================
let predictionWindow = null

function createPredictionWindow(matchId) {
  if (predictionWindow && !predictionWindow.isDestroyed()) {
    predictionWindow.focus()
    predictionWindow.webContents.send('load-match', matchId)
    return predictionWindow
  }

  predictionWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: '导播 - 竞猜结果',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  predictionWindow.loadFile('pages/prediction.html')
  predictionWindow.setMenu(null)

  predictionWindow.webContents.on('did-finish-load', () => {
    predictionWindow.webContents.send('load-match', matchId)
  })

  predictionWindow.on('closed', () => {
    predictionWindow = null
  })

  return predictionWindow
}

ipcMain.handle('open-prediction-window', async (event, matchId) => {
  createPredictionWindow(matchId)
  return { success: true }
})

// ==================== B站弹幕WebSocket ====================
const { LiveWS } = require('bilibili-live-ws')

let bilibiliLive = null
let currentBilibiliRoomId = null
let currentMatchId = null
let currentMatchTeams = null // { homeTeamId, homeTeamName, awayTeamId, awayTeamName }

// 检查竞猜弹幕
async function checkPredictionDanmaku(text, uid, username) {
  const trimmed = text.trim()
  // 匹配 "竞猜XXX赢" 格式
  const match = trimmed.match(/^竞猜(.+?)赢$/i)
  if (!match) return

  const teamName = match[1].trim()
  if (!teamName) return

  // 检查是否匹配任一战队
  let predictedTeamId = null
  const homeName = currentMatchTeams.homeTeamName || ''
  const awayName = currentMatchTeams.awayTeamName || ''

  if (homeName.includes(teamName) || teamName.includes(homeName)) {
    predictedTeamId = currentMatchTeams.homeTeamId
  } else if (awayName.includes(teamName) || teamName.includes(awayName)) {
    predictedTeamId = currentMatchTeams.awayTeamId
  }

  if (!predictedTeamId) {
    console.log(`[Bilibili] 竞猜队伍名不匹配: ${teamName}`)
    return
  }

  console.log(`[Bilibili] 检测到竞猜: ${username} 选择 ${teamName}`)

  // 调用API创建竞猜
  try {
    const apiBase = getEnvConfig().api
    const response = await httpRequest(`${apiBase}/api/Predictions/bilibili`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchId: currentMatchId,
        predictedTeamId: predictedTeamId,
        bilibiliUid: uid.toString(),
        bilibiliUsername: username
      })
    })

    console.log(`[Bilibili] 竞猜创建成功: ${username} -> ${teamName}`)

    // 广播竞猜事件
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('bilibili-prediction', {
        uid,
        username,
        teamId: predictedTeamId,
        teamName: teamName,
        success: true
      })
    })
  } catch (e) {
    console.error(`[Bilibili] 竞猜创建失败:`, e.message)
  }
}

// 启动B站弹幕监听
ipcMain.handle('start-bilibili-danmaku', async (event, roomId, matchId) => {
  // 停止现有连接
  if (bilibiliLive) {
    try {
      bilibiliLive.close()
    } catch (e) {
      console.error('[Bilibili] 关闭旧连接失败:', e)
    }
    bilibiliLive = null
  }

  try {
    console.log(`[Bilibili] 准备连接房间: ${roomId}`)

    currentBilibiliRoomId = roomId
    currentMatchId = matchId

    // 如果有matchId，获取比赛信息
    if (matchId) {
      try {
        const apiBase = getEnvConfig().api
        const matchResponse = await httpRequest(`${apiBase}/api/Matches/${matchId}`)
        if (matchResponse.data) {
          currentMatchTeams = {
            homeTeamId: matchResponse.data.homeTeamId,
            homeTeamName: matchResponse.data.homeTeamName,
            awayTeamId: matchResponse.data.awayTeamId,
            awayTeamName: matchResponse.data.awayTeamName
          }
          console.log(`[Bilibili] 比赛信息: ${currentMatchTeams.homeTeamName} vs ${currentMatchTeams.awayTeamName}`)
        }
      } catch (e) {
        console.error('[Bilibili] 获取比赛信息失败:', e.message)
      }
    }

    // 创建新连接
    bilibiliLive = new LiveWS(parseInt(roomId))

    // 监听连接事件
    bilibiliLive.on('open', () => {
      console.log('[Bilibili] 连接成功')
    })

    // 监听心跳
    bilibiliLive.on('heartbeat', (online) => {
      console.log(`[Bilibili] 在线人数: ${online}`)
    })

    // 监听弹幕消息
    bilibiliLive.on('DANMU_MSG', (data) => {
      try {
        const info = data.info || []
        const text = info[1] || ''
        const userInfo = info[2] || []
        const uid = userInfo[0] || 0
        const username = userInfo[1] || '未知用户'

        console.log(`[Bilibili] 弹幕: ${username}(${uid}): ${text}`)

        // 广播到所有窗口
        BrowserWindow.getAllWindows().forEach(win => {
          win.webContents.send('bilibili-danmaku', { uid, username, text })
        })

        // 检查是否是竞猜弹幕
        if (currentMatchId && currentMatchTeams) {
          checkPredictionDanmaku(text, uid, username)
        }
      } catch (e) {
        console.error('[Bilibili] 处理弹幕失败:', e)
      }
    })

    // 监听错误
    bilibiliLive.on('error', (error) => {
      console.error('[Bilibili] 错误:', error)
    })

    // 监听关闭
    bilibiliLive.on('close', () => {
      console.log('[Bilibili] 连接已关闭')
    })

    return { success: true, roomId: roomId }
  } catch (error) {
    console.error('[Bilibili] 启动失败:', error.message)
    return { success: false, error: error.message }
  }
})

// 停止B站弹幕监听
ipcMain.handle('stop-bilibili-danmaku', async () => {
  if (bilibiliLive) {
    try {
      bilibiliLive.close()
    } catch (e) {
      console.error('[Bilibili] 关闭连接失败:', e)
    }
    bilibiliLive = null
  }
  currentBilibiliRoomId = null
  currentMatchId = null
  currentMatchTeams = null
  return { success: true }
})

// 引入更新模块
const updater = require('./updater-v2')

// 检查更新 IPC 处理器
ipcMain.handle('check-for-update', async () => {
  try {
    const result = await updater.checkForUpdate()
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 手动检查更新
ipcMain.handle('manual-check-update', async () => {
  try {
    await updater.manualCheckUpdate(mainWindow)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 获取当前版本
ipcMain.handle('get-app-version', () => {
  return updater.getCurrentVersion()
})

// 打开插件管理器窗口
ipcMain.handle('open-plugin-manager', async () => {
  try {
    console.log('[IPC] open-plugin-manager invoked')
    const isReady = await waitPluginSystemReady()
    console.log('[IPC] open-plugin-manager pluginReady =', isReady)
    if (!isReady) {
      return { success: false, error: '插件系统初始化失败，请查看控制台日志' }
    }
    createPluginManagerWindow()
    return { success: true }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

// ===== 本地BP（离线） =====

let localBpState = {
  enabled: false,
  survivors: [null, null, null, null],
  hunter: null,
  // Ban 位（单局）
  hunterBannedSurvivors: [],
  survivorBannedHunters: [],
  // 全局禁选（整场）
  globalBannedSurvivors: [],
  globalBannedHunters: [],
  // 天赋、技能、选手名字
  // 每个求生者单独的天赋数组
  survivorTalents: [[], [], [], []],
  hunterTalents: [],
  hunterSkills: [],
  playerNames: ['', '', '', '', ''],
  // 队伍和地图信息
  teamA: { name: '求生者队', logo: '', meta: '' },
  teamB: { name: '监管者队', logo: '', meta: '' },
  gameLabel: '',
  mapName: '',
  // 角色展示窗口布局
  characterDisplayLayout: {
    backgroundImage: null,
    positions: {},
    transparentBackground: false
  }
}

// 本地比分数据缓存
let localBpScoreData = null


// 本地BP：旧字段/旧命名兼容
const __LOCAL_BP_NAME_ALIASES__ = {
  '韦伯定律': '飞轮效应'
}

function __normalizeLocalBpName__(name) {
  if (!name || typeof name !== 'string') return name
  return __LOCAL_BP_NAME_ALIASES__[name] || name
}

function __normalizeLocalBpArray__(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map(__normalizeLocalBpName__).filter(Boolean)
}

function __normalizeLocalBpStateInPlace__() {
  // 天赋/技能命名兼容
  if (Array.isArray(localBpState.survivorTalents) && localBpState.survivorTalents.length === 4) {
    localBpState.survivorTalents = localBpState.survivorTalents.map(t => __normalizeLocalBpArray__(t))
  }
  if (Array.isArray(localBpState.hunterTalents)) {
    localBpState.hunterTalents = __normalizeLocalBpArray__(localBpState.hunterTalents)
  }
  if (Array.isArray(localBpState.hunterSkills)) {
    localBpState.hunterSkills = __normalizeLocalBpArray__(localBpState.hunterSkills)
  }

  // 角色展示布局结构兜底
  if (!localBpState.characterDisplayLayout || typeof localBpState.characterDisplayLayout !== 'object') {
    localBpState.characterDisplayLayout = { backgroundImage: null, positions: {}, transparentBackground: false }
  }
  if (!localBpState.characterDisplayLayout.positions || typeof localBpState.characterDisplayLayout.positions !== 'object') {
    localBpState.characterDisplayLayout.positions = {}
  }
  localBpState.characterDisplayLayout.transparentBackground = !!localBpState.characterDisplayLayout.transparentBackground
}

function __readLayoutJsonSafe__() {
  try {
    if (!fs.existsSync(layoutPath)) return {}
    const raw = fs.readFileSync(layoutPath, 'utf8')
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    console.warn('[LocalBP] 读取 layout.json 失败:', e.message)
    return {}
  }
}

function __writeLayoutJsonSafe__(root) {
  try {
    const next = (root && typeof root === 'object') ? root : {}
    next.updatedAt = new Date().toISOString()
    fs.writeFileSync(layoutPath, JSON.stringify(next, null, 2))
    return true
  } catch (e) {
    console.warn('[LocalBP] 写入 layout.json 失败:', e.message)
    return false
  }
}

function __persistCharacterDisplayLayoutToDisk__() {
  try {
    const root = __readLayoutJsonSafe__()
    root.characterDisplayLayout = localBpState.characterDisplayLayout || null
    __writeLayoutJsonSafe__(root)
  } catch (e) {
    console.warn('[LocalBP] 持久化角色展示布局失败:', e.message)
  }
}

function __loadCharacterDisplayLayoutFromDiskIntoState__() {
  try {
    const root = __readLayoutJsonSafe__()
    const fromDisk = root.characterDisplayLayout
    if (!fromDisk || typeof fromDisk !== 'object') return false

    const existing = (localBpState.characterDisplayLayout && typeof localBpState.characterDisplayLayout === 'object')
      ? localBpState.characterDisplayLayout
      : { backgroundImage: null, positions: {}, transparentBackground: false }

    localBpState.characterDisplayLayout = {
      ...existing,
      ...fromDisk,
      positions: {
        ...(existing.positions || {}),
        ...(fromDisk.positions || {})
      }
    }

    // 兼容旧数据：若背景图片不在 userData/background 下，则复制进去以便布局包导入导出
    try {
      const bg = localBpState.characterDisplayLayout.backgroundImage
      if (bg && typeof bg === 'string' && fs.existsSync(bg)) {
        const resolvedBg = path.resolve(bg)
        const resolvedBgDir = path.resolve(bgImagePath) + path.sep
        if (!resolvedBg.startsWith(resolvedBgDir)) {
          ensureDirectories()
          const ext = path.extname(bg) || '.png'
          const destPath = path.join(bgImagePath, `character-display-background${ext}`)
          fs.copyFileSync(bg, destPath)
          localBpState.characterDisplayLayout.backgroundImage = destPath
          __persistCharacterDisplayLayoutToDisk__()
        }
      }
    } catch (e) {
      console.warn('[LocalBP] 迁移角色展示背景失败:', e.message)
    }

    __normalizeLocalBpStateInPlace__()
    return true
  } catch (e) {
    console.warn('[LocalBP] 从 layout.json 回填角色展示布局失败:', e.message)
    return false
  }
}

let characterIndexCache = null

// 角色管理配置文件路径
const characterConfigPath = path.join(__dirname, 'roles.json')

function loadCharacterIndex() {
  if (characterIndexCache) return characterIndexCache

  let rolesData = { survivors: [], hunters: [] }
  try {
    if (fs.existsSync(characterConfigPath)) {
      const content = fs.readFileSync(characterConfigPath, 'utf-8')
      rolesData = JSON.parse(content)
    }
  } catch (e) {
    console.error('Error loading roles.json:', e)
  }

  // 提取单纯的名称列表，用于保持与旧逻辑兼容
  const survivors = Array.isArray(rolesData.survivors) ? rolesData.survivors.map(c => typeof c === 'string' ? c : c.name) : []
  const hunters = Array.isArray(rolesData.hunters) ? rolesData.hunters.map(c => typeof c === 'string' ? c : c.name) : []

  const assetsPath = path.join(app.getAppPath(), 'assets')
  const surBigPath = path.join(assetsPath, 'surBig')
  const hunBigPath = path.join(assetsPath, 'hunBig')

  // 检查全身图是否存在
  const survivorsBig = survivors.filter(name => fs.existsSync(path.join(surBigPath, `${name}.png`)))
  const huntersBig = hunters.filter(name => fs.existsSync(path.join(hunBigPath, `${name}.png`)))

  characterIndexCache = {
    fullData: rolesData,
    survivors,
    hunters,
    survivorSet: new Set(survivors),
    hunterSet: new Set(hunters),
    survivorsBig,
    huntersBig,
    survivorBigSet: new Set(survivorsBig),
    hunterBigSet: new Set(huntersBig)
  }

  return characterIndexCache
}

function buildPinyinMap(list) {
  const map = {}
  if (!Array.isArray(list)) return map
  list.forEach(name => {
    if (!name || map[name]) return
    try {
      const arr = pinyin(name, { toneType: 'none', type: 'array' })
      if (!Array.isArray(arr) || arr.length === 0) return
      const full = arr.join('')
      const initials = arr.map(p => (p && p[0]) ? p[0] : '').join('')
      map[name] = { full, initials }
    } catch (e) {
      return
    }
  })
  return map
}

// 刷新角色索引缓存
function refreshCharacterIndex() {
  characterIndexCache = null
  return loadCharacterIndex()
}

// 获取角色详细信息（包含半身图和全身图路径）
function getCharacterDetails() {
  const index = loadCharacterIndex()
  const assetsPath = path.join(app.getAppPath(), 'assets')

  const normalize = (c, type) => {
    const isObj = typeof c === 'object' && c !== null
    const name = isObj ? c.name : c
    const folder = type === 'survivor' ? 'sur' : 'hun'
    const hasBig = type === 'survivor' ? index.survivorBigSet.has(name) : index.hunterBigSet.has(name)

    return {
      name,
      type,
      id: isObj ? c.id : null,
      enName: isObj ? c.enName : null,
      abbr: isObj ? c.abbr : null,
      halfImage: path.join(assetsPath, `${folder}Half`, `${name}.png`),
      bigImage: hasBig ? path.join(assetsPath, `${folder}Big`, `${name}.png`) : null,
      hasHalfImage: true,
      hasBigImage: hasBig
    }
  }

  const survivorDetails = (index.fullData?.survivors || index.survivors).map(c => normalize(c, 'survivor'))
  const hunterDetails = (index.fullData?.hunters || index.hunters).map(c => normalize(c, 'hunter'))

  return { survivors: survivorDetails, hunters: hunterDetails }
}

// ==================== 角色管理 IPC ====================

// 获取所有角色
ipcMain.handle('character:get-all', async () => {
  try {
    const details = getCharacterDetails()
    return { success: true, data: details }
  } catch (error) {
    console.error('[Character] 获取角色列表失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取角色索引
ipcMain.handle('character:get-index', async () => {
  try {
    const index = loadCharacterIndex()
    return {
      success: true,
      data: {
        survivors: index.survivors,
        hunters: index.hunters,
        survivorsBig: index.survivorsBig,
        huntersBig: index.huntersBig,
        // 返回完整配置中的其他数据
        survivorTalents: index.fullData?.survivorTalents || [],
        hunterTalents: index.fullData?.hunterTalents || [],
        hunterSkills: index.fullData?.hunterSkills || []
      }
    }
  } catch (error) {
    console.error('[Character] 获取角色索引失败:', error)
    return { success: false, error: error.message }
  }
})

// 添加角色
ipcMain.handle('character:add', async (event, { name, type, halfImagePath, bigImagePath, id, enName, abbr }) => {
  try {
    if (!name || !type) {
      return { success: false, error: '角色名称和类型不能为空' }
    }

    // 更新 JSON 配置
    const index = loadCharacterIndex()
    // 确保 fullData 结构完整
    if (!index.fullData.survivors) index.fullData.survivors = []
    if (!index.fullData.hunters) index.fullData.hunters = []

    const list = type === 'survivor' ? index.fullData.survivors : index.fullData.hunters
    // 检查重名
    if (list.some(c => (typeof c === 'string' ? c : c.name) === name)) {
      return { success: false, error: '角色已存在' }
    }

    list.push({
      id: id || '',
      name,
      enName: enName || '',
      abbr: abbr || ''
    })
    try {
      fs.writeFileSync(characterConfigPath, JSON.stringify(index.fullData, null, 2))
    } catch (e) {
      console.error('Failed to write roles.json', e)
    }

    const assetsPath = path.join(app.getAppPath(), 'assets')
    const halfFolder = type === 'survivor' ? 'surHalf' : 'hunHalf'
    const bigFolder = type === 'survivor' ? 'surBig' : 'hunBig'

    // 复制半身图
    if (halfImagePath && fs.existsSync(halfImagePath)) {
      const destHalf = path.join(assetsPath, halfFolder, `${name}.png`)
      fs.copyFileSync(halfImagePath, destHalf)
    }

    // 复制全身图
    if (bigImagePath && fs.existsSync(bigImagePath)) {
      const destBig = path.join(assetsPath, bigFolder, `${name}.png`)
      fs.copyFileSync(bigImagePath, destBig)
    }

    // 刷新缓存
    refreshCharacterIndex()

    return { success: true }
  } catch (error) {
    console.error('[Character] 添加角色失败:', error)
    return { success: false, error: error.message }
  }
})

// 更新角色
ipcMain.handle('character:update', async (event, { oldName, newName, type, halfImagePath, bigImagePath, id, enName, abbr }) => {
  try {
    if (!oldName || !type) {
      return { success: false, error: '角色名称和类型不能为空' }
    }

    // 更新 JSON 配置
    const index = loadCharacterIndex()
    const list = type === 'survivor' ? index.fullData.survivors : index.fullData.hunters
    const entryIndex = list.findIndex(c => (typeof c === 'string' ? c : c.name) === oldName)

    if (entryIndex !== -1) {
      const title = newName || oldName
      const oldEntry = list[entryIndex]
      const updated = typeof oldEntry === 'string'
        ? { id: id || '', name: title, enName: enName || '', abbr: abbr || '' }
        : { ...oldEntry, name: title, id: id !== undefined ? id : oldEntry.id, enName: enName !== undefined ? enName : oldEntry.enName, abbr: abbr !== undefined ? abbr : oldEntry.abbr }

      list[entryIndex] = updated
      try {
        fs.writeFileSync(characterConfigPath, JSON.stringify(index.fullData, null, 2))
      } catch (e) {
        console.error('Failed to save roles.json', e)
      }
    }

    const assetsPath = path.join(app.getAppPath(), 'assets')
    const halfFolder = type === 'survivor' ? 'surHalf' : 'hunHalf'
    const bigFolder = type === 'survivor' ? 'surBig' : 'hunBig'

    const oldHalfPath = path.join(assetsPath, halfFolder, `${oldName}.png`)
    const oldBigPath = path.join(assetsPath, bigFolder, `${oldName}.png`)
    const newHalfPath = path.join(assetsPath, halfFolder, `${newName || oldName}.png`)
    const newBigPath = path.join(assetsPath, bigFolder, `${newName || oldName}.png`)

    // 如果改名了，先重命名现有文件
    if (newName && newName !== oldName) {
      if (fs.existsSync(oldHalfPath)) {
        fs.renameSync(oldHalfPath, newHalfPath)
      }
      if (fs.existsSync(oldBigPath)) {
        fs.renameSync(oldBigPath, newBigPath)
      }
    }

    // 如果提供了新的半身图
    if (halfImagePath && fs.existsSync(halfImagePath)) {
      fs.copyFileSync(halfImagePath, newHalfPath)
    }

    // 如果提供了新的全身图
    if (bigImagePath && fs.existsSync(bigImagePath)) {
      fs.copyFileSync(bigImagePath, newBigPath)
    }

    // 刷新缓存
    refreshCharacterIndex()

    return { success: true }
  } catch (error) {
    console.error('[Character] 更新角色失败:', error)
    return { success: false, error: error.message }
  }
})

// 删除角色
ipcMain.handle('character:delete', async (event, { name, type }) => {
  try {
    if (!name || !type) {
      return { success: false, error: '角色名称和类型不能为空' }
    }

    // 更新 JSON 配置
    const index = loadCharacterIndex()
    const list = type === 'survivor' ? index.fullData.survivors : index.fullData.hunters
    const entryIndex = list.findIndex(c => (typeof c === 'string' ? c : c.name) === name)

    if (entryIndex !== -1) {
      list.splice(entryIndex, 1)
      try {
        fs.writeFileSync(characterConfigPath, JSON.stringify(index.fullData, null, 2))
      } catch (e) {
        console.error('Failed to save roles.json', e)
      }
    }

    const assetsPath = path.join(app.getAppPath(), 'assets')
    const halfFolder = type === 'survivor' ? 'surHalf' : 'hunHalf'
    const bigFolder = type === 'survivor' ? 'surBig' : 'hunBig'

    const halfPath = path.join(assetsPath, halfFolder, `${name}.png`)
    const bigPath = path.join(assetsPath, bigFolder, `${name}.png`)

    // 删除半身图
    if (fs.existsSync(halfPath)) {
      fs.unlinkSync(halfPath)
    }

    // 删除全身图
    if (fs.existsSync(bigPath)) {
      fs.unlinkSync(bigPath)
    }

    // 刷新缓存
    refreshCharacterIndex()

    return { success: true }
  } catch (error) {
    console.error('[Character] 删除角色失败:', error)
    return { success: false, error: error.message }
  }
})

// 选择角色图片
ipcMain.handle('character:select-image', async (event, imageType) => {
  try {
    const result = await dialog.showOpenDialog({
      title: imageType === 'half' ? '选择半身图' : '选择全身图',
      filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile']
    })

    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true }
    }

    return { success: true, path: result.filePaths[0] }
  } catch (error) {
    console.error('[Character] 选择图片失败:', error)
    return { success: false, error: error.message }
  }
})

// 获取角色图片的 base64 数据
ipcMain.handle('character:get-image-base64', async (event, imagePath) => {
  try {
    if (!imagePath || !fs.existsSync(imagePath)) {
      return { success: false, error: '图片不存在' }
    }
    const data = fs.readFileSync(imagePath)
    const ext = path.extname(imagePath).toLowerCase().replace('.', '')
    const mimeType = ext === 'jpg' ? 'jpeg' : ext
    const base64 = `data:image/${mimeType};base64,${data.toString('base64')}`
    return { success: true, data: base64 }
  } catch (error) {
    console.error('[Character] 获取图片 base64 失败:', error)
    return { success: false, error: error.message }
  }
})

// 打开角色管理窗口
let characterManagerWindow = null
ipcMain.handle('open-character-manager', async () => {
  try {
    if (characterManagerWindow && !characterManagerWindow.isDestroyed()) {
      characterManagerWindow.focus()
      return { success: true }
    }

    characterManagerWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      title: '导播 - 角色管理',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    })

    characterManagerWindow.loadFile('pages/character-manager.html')
    characterManagerWindow.on('closed', () => {
      characterManagerWindow = null
    })

    return { success: true }
  } catch (error) {
    console.error('[Character] 打开角色管理窗口失败:', error)
    return { success: false, error: error.message }
  }
})

// 刷新角色索引
ipcMain.handle('character:refresh', async () => {
  try {
    refreshCharacterIndex()
    return { success: true }
  } catch (error) {
    console.error('[Character] 刷新角色索引失败:', error)
    return { success: false, error: error.message }
  }
})

function broadcastUpdateData(data) {
  const targets = [
    frontendWindow,
    backendWindow,
    scoreboardWindowA,
    scoreboardWindowB,
    scoreboardOverviewWindow,
    postMatchWindow,
    storeWindow,
    mapDisplayWindow,
    predictionWindow,
    mainWindow,
    localBpWindow,
    localBpGuideWindow,
    characterDisplayWindow
  ].filter(w => w && !w.isDestroyed())

  for (const win of targets) {
    try {
      win.webContents.send('update-data', data)
    } catch (e) {
      console.warn('[LocalBP] broadcast update-data failed:', e.message)
    }
  }

  // 通知本地页面服务器（如果已启动）
  try {
    if (global.__localPageServerHooks && typeof global.__localPageServerHooks.onDataUpdate === 'function') {
      global.__localPageServerHooks.onDataUpdate(data)
    }
    // 处理本地BP闪烁事件
    if (data && data.type === 'local-bp-blink' && global.__localPageServerHooks && typeof global.__localPageServerHooks.onLocalBpBlink === 'function') {
      global.__localPageServerHooks.onLocalBpBlink(data.index)
    }
  } catch (e) {
    // ignore - 本地页面服务器可能未启动
  }

  // 同时更新插件系统的房间数据
  const shouldSyncRoomDataToPlugins = !!data && (
    data.type === 'state' ||
    data.type === 'score' ||
    !!data.state ||
    !!data.scoreData ||
    !!data.currentRoundData ||
    !!data.state?.currentRoundData ||
    !!data.data?.currentRoundData ||
    !!data.data?.state?.currentRoundData ||
    !!data.data?.scoreData
  )

  if (shouldSyncRoomDataToPlugins) {
    try {
      setPluginRoomData(data)
    } catch (e) {
      console.warn('[LocalBP] setPluginRoomData failed:', e.message)
    }
  }
}

function buildLocalBpFrontendState() {
  return {
    phaseName: '本地BP',
    phaseAction: '',
    currentMap: localBpState.mapName || '本地模式',
    assetRev: localBpState.__assetRev || Date.now(),
    currentRoundData: {
      selectedSurvivors: localBpState.survivors || [null, null, null, null],
      selectedHunter: localBpState.hunter || null,
      hunterBannedSurvivors: localBpState.hunterBannedSurvivors || [],
      survivorBannedHunters: localBpState.survivorBannedHunters || []
    },
    globalBannedSurvivors: localBpState.globalBannedSurvivors || [],
    globalBannedHunters: localBpState.globalBannedHunters || [],
    // 每个求生者单独的天赋数组
    survivorTalents: localBpState.survivorTalents || [[], [], [], []],
    hunterTalents: localBpState.hunterTalents || [],
    hunterSkills: localBpState.hunterSkills || [],
    playerNames: localBpState.playerNames || ['', '', '', '', ''],
    teamA: localBpState.teamA || { name: '求生者队', logo: '', meta: '' },
    teamB: localBpState.teamB || { name: '监管者队', logo: '', meta: '' },
    gameLabel: localBpState.gameLabel || '',
    mapName: localBpState.mapName || '',
    characterDisplayLayout: localBpState.characterDisplayLayout || null,
    characterDisplayBackground: localBpState.characterDisplayBackground || null,
    defaultImages: localBpState.defaultImages || null
  }
}

function broadcastLocalBpState() {
  broadcastUpdateData({ type: 'state', state: buildLocalBpFrontendState() })
}

function ensureLocalFrontendWindow() {
  if (frontendWindow && !frontendWindow.isDestroyed()) return
  createFrontendWindow({
    localMode: true,
    roomId: 'local-bp',
    teamAName: 'A队',
    teamBName: 'B队'
  })
}

function ensureLocalBackendWindow() {
  if (backendWindow && !backendWindow.isDestroyed()) return
  createBackendWindow({
    localMode: true,
    roomId: 'local-bp',
    teamAName: 'A队',
    teamBName: 'B队',
    boType: 3
  })
}

function createLocalBpWindow() {
  if (localBpWindow && !localBpWindow.isDestroyed()) {
    localBpWindow.focus()
    return localBpWindow
  }

  // Reading saved window size configuration
  let windowBounds = { width: 1200, height: 800 }
  try {
    if (fs.existsSync(layoutPath)) {
      const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'))
      if (layout.windowBounds && layout.windowBounds.localBpBounds) {
        windowBounds = layout.windowBounds.localBpBounds
      }
    }
  } catch (e) {
    console.error('[LocalBP] Failed to load window bounds:', e)
  }

  localBpWindow = new BrowserWindow({
    ...windowBounds,
    title: '本地BP控制',
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false
    }
  })

  localBpWindow.loadFile('pages/local-bp.html')
  localBpWindow.setMenu(null)

  // Listen for window size changes and auto-save
  let resizeTimer = null
  const saveBounds = () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (!localBpWindow || localBpWindow.isDestroyed()) return

      try {
        const bounds = localBpWindow.getBounds()

        // Read existing layout
        let layout = {}
        try {
          if (fs.existsSync(layoutPath)) {
            const content = fs.readFileSync(layoutPath, 'utf8')
            layout = content ? JSON.parse(content) : {}
          }
        } catch (e) {
          console.warn('[LocalBP] Read layout failed:', e.message)
        }

        // Update window dimensions
        if (!layout.windowBounds) layout.windowBounds = {}
        layout.windowBounds.localBpBounds = bounds

        // Save
        fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2))
        console.log('[LocalBP] Window size auto-saved:', bounds)
      } catch (e) {
        console.error('[LocalBP] Auto-save window size failed:', e)
      }
    }, 500)
  }

  localBpWindow.on('resize', saveBounds)
  localBpWindow.on('move', saveBounds)

  localBpWindow.on('closed', () => {
    localBpWindow = null
  })

  return localBpWindow
}

function createLocalBpGuideWindow() {
  if (localBpGuideWindow && !localBpGuideWindow.isDestroyed()) {
    localBpGuideWindow.focus()
    return localBpGuideWindow
  }

  localBpGuideWindow = new BrowserWindow({
    width: 860,
    height: 760,
    title: 'BP引导',
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false
    }
  })

  localBpGuideWindow.loadFile('pages/local-bp.html', { query: { guide: '1' } })
  localBpGuideWindow.setMenu(null)

  localBpGuideWindow.on('closed', () => {
    localBpGuideWindow = null
  })

  return localBpGuideWindow
}

ipcMain.handle('open-local-bp', () => {
  try {
    localBpState.enabled = true
    __loadCharacterDisplayLayoutFromDiskIntoState__()
    __normalizeLocalBpStateInPlace__()
    const config = readJsonFileSafe(configPath, {})
    const autoOpen = normalizeLocalBpAutoOpenSettings(config.localBpAutoOpen)
    if (autoOpen.frontend) ensureLocalFrontendWindow()
    if (autoOpen.localBp) createLocalBpWindow()
    if (autoOpen.characterDisplay) openCharacterDisplayWindow()
    if (autoOpen.scoreboardA) createScoreboardWindow('local-bp', 'teamA')
    if (autoOpen.scoreboardB) createScoreboardWindow('local-bp', 'teamB')
    if (autoOpen.scoreboardOverview) {
      const boCount = Array.isArray(localBpScoreData?.bos) && localBpScoreData.bos.length
        ? localBpScoreData.bos.length
        : (Number.isFinite(Number(localBpScoreData?.boType)) ? Number(localBpScoreData.boType) : 5)
      createScoreboardOverviewWindow('local-bp', boCount)
    }
    if (autoOpen.postMatch) createPostMatchWindow('local-bp')
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('open-local-bp-guide', () => {
  try {
    localBpState.enabled = true
    __loadCharacterDisplayLayoutFromDiskIntoState__()
    __normalizeLocalBpStateInPlace__()
    createLocalBpGuideWindow()
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 仅打开本地前台窗口（用于在主页快速进入布局/3D设置）
ipcMain.handle('open-local-frontend', () => {
  try {
    ensureLocalFrontendWindow()
    if (frontendWindow && !frontendWindow.isDestroyed()) {
      frontendWindow.show()
      frontendWindow.focus()
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})



ipcMain.handle('open-local-backend', () => {
  try {
    ensureLocalBackendWindow()
    if (backendWindow && !backendWindow.isDestroyed()) {
      backendWindow.show()
      backendWindow.focus()
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('open-font-settings', () => {
  try {
    ensureLocalBackendWindow()
    if (backendWindow && !backendWindow.isDestroyed()) {
      const sendOpen = () => {
        try {
          backendWindow.webContents.send('open-font-settings')
        } catch {}
      }
      backendWindow.show()
      backendWindow.focus()
      if (backendWindow.webContents && backendWindow.webContents.isLoading()) {
        backendWindow.webContents.once('did-finish-load', sendOpen)
      } else {
        sendOpen()
      }
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:getState', () => {
  __loadCharacterDisplayLayoutFromDiskIntoState__()
  __normalizeLocalBpStateInPlace__()
  return { success: true, data: localBpState }
})

ipcMain.handle('localBp:setSurvivor', (event, { index, character }) => {
  try {
    const i = Number(index)
    if (!Number.isInteger(i) || i < 0 || i > 3) return { success: false, error: 'index 无效' }
    localBpState.survivors[i] = character || null
    broadcastLocalBpState()

    // 🔥 发送 BP 事件给插件
    if (character) {
      try {
        const { eventBus } = require('./plugins/core/EventBus')
        eventBus.publish('bp:character-picked', {
          character: character,
          type: 'survivor',
          isHunter: false,
          index: i,
          survivors: localBpState.survivors,
          hunter: localBpState.hunter,
          hunterBannedSurvivors: localBpState.hunterBannedSurvivors || [],
          survivorBannedHunters: localBpState.survivorBannedHunters || []
        })
      } catch (e) {
        console.warn('[LocalBP] 发送事件失败:', e)
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:setHunter', (event, character) => {
  try {
    localBpState.hunter = character || null
    broadcastLocalBpState()

    // 🔥 发送 BP 事件给插件
    if (character) {
      try {
        const { eventBus } = require('./plugins/core/EventBus')
        eventBus.publish('bp:character-picked', {
          character: character,
          type: 'hunter',
          isHunter: true,
          survivors: localBpState.survivors,
          hunter: localBpState.hunter,
          hunterBannedSurvivors: localBpState.hunterBannedSurvivors || [],
          survivorBannedHunters: localBpState.survivorBannedHunters || []
        })
      } catch (e) {
        console.warn('[LocalBP] 发送事件失败:', e)
      }
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:addBan', (event, character) => {
  try {
    if (!character) return { success: true }

    // 兼容旧接口：按角色类型映射到对应 Ban 位
    const idx = loadCharacterIndex()
    if (idx.survivorSet.has(character)) {
      if (!localBpState.hunterBannedSurvivors.includes(character)) localBpState.hunterBannedSurvivors.push(character)
    } else if (idx.hunterSet.has(character)) {
      if (!localBpState.survivorBannedHunters.includes(character)) localBpState.survivorBannedHunters.push(character)
    }
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:removeBan', (event, character) => {
  try {
    localBpState.hunterBannedSurvivors = (localBpState.hunterBannedSurvivors || []).filter(b => b !== character)
    localBpState.survivorBannedHunters = (localBpState.survivorBannedHunters || []).filter(b => b !== character)
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:addBanSurvivor', (event, character) => {
  try {
    if (!character) return { success: true }
    if (!localBpState.hunterBannedSurvivors.includes(character)) localBpState.hunterBannedSurvivors.push(character)
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ==================== 暴露给插件：复用程序原生本地BP ====================
// 说明：插件运行在同一主进程内，但无法直接调用 ipcMain.handle 的 handler。
// 这里将“原生本地BP”的关键操作通过 global 暴露出去，供插件直接复用。
try {
  if (!global.__asgLocalBp) global.__asgLocalBp = {}

  global.__asgLocalBp.open = () => {
    localBpState.enabled = true
    ensureLocalFrontendWindow()
    // ensureLocalBackendWindow()
    createLocalBpWindow()
    broadcastLocalBpState()
    return true
  }

  global.__asgLocalBp.disable = () => {
    localBpState.enabled = false
    broadcastLocalBpState()
    return true
  }

  global.__asgLocalBp.getState = () => {
    __loadCharacterDisplayLayoutFromDiskIntoState__()
    __normalizeLocalBpStateInPlace__()
    return localBpState
  }

  global.__asgLocalBp.setSurvivor = (index, character) => {
    const i = Number(index)
    if (!Number.isInteger(i) || i < 0 || i > 3) return false
    localBpState.survivors[i] = character || null
    broadcastLocalBpState()
    return true
  }

  global.__asgLocalBp.setHunter = (character) => {
    localBpState.hunter = character || null
    broadcastLocalBpState()
    return true
  }

  global.__asgLocalBp.addBan = (character) => {
    if (!character) return true
    const idx = loadCharacterIndex()
    if (idx.survivorSet.has(character)) {
      if (!localBpState.hunterBannedSurvivors.includes(character)) localBpState.hunterBannedSurvivors.push(character)
    } else if (idx.hunterSet.has(character)) {
      if (!localBpState.survivorBannedHunters.includes(character)) localBpState.survivorBannedHunters.push(character)
    }
    broadcastLocalBpState()
    return true
  }

  global.__asgLocalBp.removeBan = (character) => {
    localBpState.hunterBannedSurvivors = (localBpState.hunterBannedSurvivors || []).filter(b => b !== character)
    localBpState.survivorBannedHunters = (localBpState.survivorBannedHunters || []).filter(b => b !== character)
    broadcastLocalBpState()
    return true
  }

  global.__asgLocalBp.clearAll = () => {
    localBpState.survivors = [null, null, null, null]
    localBpState.hunter = null
    localBpState.hunterBannedSurvivors = []
    localBpState.survivorBannedHunters = []
    broadcastLocalBpState()
    return true
  }

  global.__asgLocalBp.saveCharacterDisplayLayout = (positions) => {
    try {
      if (!localBpState.characterDisplayLayout) {
        localBpState.characterDisplayLayout = { positions: {} }
      }
      if (!localBpState.characterDisplayLayout.positions) {
        localBpState.characterDisplayLayout.positions = {}
      }

      const incoming = (positions && typeof positions === 'object') ? positions : {}
      const normalized = {}
      for (const [id, pos] of Object.entries(incoming)) {
        if (!id || !pos || typeof pos !== 'object') continue
        const x = Number.isFinite(pos.x) ? pos.x : Number.isFinite(pos.left) ? pos.left : undefined
        const y = Number.isFinite(pos.y) ? pos.y : Number.isFinite(pos.top) ? pos.top : undefined
        const width = Number.isFinite(pos.width) ? pos.width : undefined
        const height = Number.isFinite(pos.height) ? pos.height : undefined
        const hidden = (typeof pos.hidden === 'boolean') ? pos.hidden : undefined
        const zIndex = Number.isFinite(pos.zIndex) ? pos.zIndex : (typeof pos.zIndex === 'string' && pos.zIndex.trim() !== '' && Number.isFinite(Number(pos.zIndex)) ? Number(pos.zIndex) : undefined)
        const fontSize = Number.isFinite(pos.fontSize) ? pos.fontSize : (typeof pos.fontSize === 'string' && pos.fontSize.trim() !== '' && Number.isFinite(Number(pos.fontSize)) ? Number(pos.fontSize) : undefined)
        const textColor = (typeof pos.textColor === 'string' && pos.textColor.trim() !== '') ? pos.textColor.trim() : undefined
        const fontFamily = (typeof pos.fontFamily === 'string' && pos.fontFamily.trim() !== '') ? pos.fontFamily.trim() : (pos.fontFamily === null ? null : undefined)
        const displayMode = (pos.displayMode === 'full' || pos.displayMode === 'half') ? pos.displayMode : undefined

        const item = {}
        if (Number.isFinite(x)) item.x = x
        if (Number.isFinite(y)) item.y = y
        if (Number.isFinite(width)) item.width = width
        if (Number.isFinite(height)) item.height = height
        if (typeof hidden === 'boolean') item.hidden = hidden
        if (Number.isFinite(zIndex)) item.zIndex = zIndex
        if (Number.isFinite(fontSize)) item.fontSize = fontSize
        if (typeof textColor === 'string') item.textColor = textColor
        if (fontFamily === null || typeof fontFamily === 'string') item.fontFamily = fontFamily
        if (typeof displayMode === 'string') item.displayMode = displayMode
        normalized[id] = item
      }

      for (const [id, item] of Object.entries(normalized)) {
        const prev = (localBpState.characterDisplayLayout.positions[id] && typeof localBpState.characterDisplayLayout.positions[id] === 'object')
          ? localBpState.characterDisplayLayout.positions[id]
          : {}
        localBpState.characterDisplayLayout.positions[id] = { ...prev, ...item }
      }
      __persistCharacterDisplayLayoutToDisk__()
      broadcastLocalBpState()
      return true
    } catch (e) {
      return false
    }
  }
} catch (e) {
  try {
    console.error('[LocalBP] 暴露 global.__asgLocalBp 失败:', e?.message || e)
  } catch {
    // ignore
  }
}

ipcMain.handle('localBp:removeBanSurvivor', (event, character) => {
  try {
    localBpState.hunterBannedSurvivors = (localBpState.hunterBannedSurvivors || []).filter(b => b !== character)
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:addBanHunter', (event, character) => {
  try {
    if (!character) return { success: true }
    if (!localBpState.survivorBannedHunters.includes(character)) localBpState.survivorBannedHunters.push(character)
    broadcastLocalBpState()

    // Send event
    try {
      const { eventBus } = require('./plugins/core/EventBus')
      eventBus.publish('bp:character-banned', {
        character,
        type: 'hunter',
        isHunter: true,
        isGlobal: false
      })
    } catch (e) {
      console.warn('[LocalBP] Send event failed:', e)
    }

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:removeBanHunter', (event, character) => {
  try {
    localBpState.survivorBannedHunters = (localBpState.survivorBannedHunters || []).filter(b => b !== character)
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:addGlobalBanSurvivor', (event, character) => {
  try {
    if (!character) return { success: true }
    if (!localBpState.globalBannedSurvivors.includes(character)) localBpState.globalBannedSurvivors.push(character)
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:removeGlobalBanSurvivor', (event, character) => {
  try {
    localBpState.globalBannedSurvivors = (localBpState.globalBannedSurvivors || []).filter(b => b !== character)
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:addGlobalBanHunter', (event, character) => {
  try {
    if (!character) return { success: true }
    if (!localBpState.globalBannedHunters.includes(character)) localBpState.globalBannedHunters.push(character)
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:removeGlobalBanHunter', (event, character) => {
  try {
    localBpState.globalBannedHunters = (localBpState.globalBannedHunters || []).filter(b => b !== character)
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:reset', () => {
  try {
    const preservedLayout = (() => {
      const stateLayout = (localBpState && typeof localBpState.characterDisplayLayout === 'object')
        ? localBpState.characterDisplayLayout
        : null
      if (stateLayout) return JSON.parse(JSON.stringify(stateLayout))
      try {
        const root = __readLayoutJsonSafe__()
        const diskLayout = (root && typeof root.characterDisplayLayout === 'object') ? root.characterDisplayLayout : null
        if (diskLayout) return JSON.parse(JSON.stringify(diskLayout))
      } catch {}
      return null
    })()

    localBpState = {
      enabled: true,
      survivors: [null, null, null, null],
      hunter: null,
      hunterBannedSurvivors: [],
      survivorBannedHunters: [],
      globalBannedSurvivors: [],
      globalBannedHunters: [],
      survivorTalents: [[], [], [], []],
      hunterTalents: [],
      hunterSkills: [],
      playerNames: ['', '', '', '', ''],
      teamA: { name: '求生者队', logo: '', meta: '' },
      teamB: { name: '监管者队', logo: '', meta: '' },
      gameLabel: '',
      mapName: '',
      defaultImages: null,
      characterDisplayLayout: {
        backgroundImage: null,
        positions: {},
        transparentBackground: false
      }
    }
    if (preservedLayout && typeof preservedLayout === 'object') {
      localBpState.characterDisplayLayout = preservedLayout
    }
    __persistCharacterDisplayLayoutToDisk__()
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:triggerBlink', (event, index) => {
  try {
    const i = Number(index)
    if (!Number.isInteger(i) || i < 0 || i > 4) return { success: false, error: 'index 无效' }
    broadcastUpdateData({ type: 'local-bp-blink', index: i })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 设置默认图片
ipcMain.handle('localBp:setDefaultImages', (event, images) => {
  try {
    localBpState.defaultImages = images || null
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 设置选手名字
ipcMain.handle('localBp:setPlayerName', (event, { index, name }) => {
  try {
    if (!localBpState.playerNames) localBpState.playerNames = ['', '', '', '', '']
    localBpState.playerNames[index] = name || ''
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 同步对局基础信息（地图/队伍名称/Logo）到本地BP状态，并广播到前台
ipcMain.handle('localBp:applyMatchBase', (event, payload) => {
  try {
    const p = payload && typeof payload === 'object' ? payload : {}

    if (typeof p.mapName === 'string') {
      localBpState.mapName = p.mapName
    }

    const applyTeam = (key, src) => {
      if (!src || typeof src !== 'object') return
      if (!localBpState[key] || typeof localBpState[key] !== 'object') {
        localBpState[key] = { name: key === 'teamA' ? '求生者队' : '监管者队', logo: '', meta: '' }
      }
      if (typeof src.name === 'string') localBpState[key].name = src.name
      if (typeof src.logo === 'string') localBpState[key].logo = src.logo
      if (typeof src.meta === 'string') localBpState[key].meta = src.meta
    }

    applyTeam('teamA', p.teamA)
    applyTeam('teamB', p.teamB)

    localBpState.__assetRev = Date.now()

    // 修复：同步选手名字
    if (Array.isArray(p.playerNames)) {
      if (!localBpState.playerNames) localBpState.playerNames = ['', '', '', '', '']
      for (let i = 0; i < 5; i++) {
        if (typeof p.playerNames[i] === 'string') {
          localBpState.playerNames[i] = p.playerNames[i]
        }
      }
    }

    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ✨ 修复：接收并广播比分数据，解决插件比分不同步问题
ipcMain.handle('localBp:updateScoreData', (event, payload) => {
  try {
    localBpScoreData = payload
    broadcastUpdateData({ type: 'score', scoreData: payload })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})


// 设置单个求生者的天赋（index: 0-3, talents: 天赋数组）
ipcMain.handle('localBp:setSurvivorTalents', (event, { index, talents }) => {
  try {
    const i = Number(index)
    if (!Number.isInteger(i) || i < 0 || i > 3) return { success: false, error: 'index 无效' }
    if (!localBpState.survivorTalents) localBpState.survivorTalents = [[], [], [], []]
    localBpState.survivorTalents[i] = __normalizeLocalBpArray__(talents)
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 设置监管者天赋（支持多选，传入数组）
ipcMain.handle('localBp:setHunterTalents', (event, talents) => {
  try {
    localBpState.hunterTalents = __normalizeLocalBpArray__(talents)
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 设置监管者技能（无数量限制）
ipcMain.handle('localBp:setHunterSkills', (event, skills) => {
  try {
    localBpState.hunterSkills = __normalizeLocalBpArray__(skills)
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 角色展示布局保存（为避免热重载/重复加载导致重复注册，这里先 removeHandler）
try { ipcMain.removeHandler('localBp:saveCharacterDisplayLayout') } catch { /* ignore */ }
ipcMain.handle('localBp:saveCharacterDisplayLayout', (event, positions) => {
  try {
    if (!localBpState.characterDisplayLayout) {
      localBpState.characterDisplayLayout = { positions: {} }
    }
    if (!localBpState.characterDisplayLayout.positions) {
      localBpState.characterDisplayLayout.positions = {}
    }

    const incoming = (positions && typeof positions === 'object') ? positions : {}
    const normalized = {}
    for (const [id, pos] of Object.entries(incoming)) {
      if (!id || !pos || typeof pos !== 'object') continue
      const x = Number.isFinite(pos.x) ? pos.x : Number.isFinite(pos.left) ? pos.left : undefined
      const y = Number.isFinite(pos.y) ? pos.y : Number.isFinite(pos.top) ? pos.top : undefined
      const width = Number.isFinite(pos.width) ? pos.width : undefined
      const height = Number.isFinite(pos.height) ? pos.height : undefined
      const hidden = (typeof pos.hidden === 'boolean') ? pos.hidden : undefined
      const zIndex = Number.isFinite(pos.zIndex) ? pos.zIndex : (typeof pos.zIndex === 'string' && pos.zIndex.trim() !== '' && Number.isFinite(Number(pos.zIndex)) ? Number(pos.zIndex) : undefined)
      const fontSize = Number.isFinite(pos.fontSize) ? pos.fontSize : (typeof pos.fontSize === 'string' && pos.fontSize.trim() !== '' && Number.isFinite(Number(pos.fontSize)) ? Number(pos.fontSize) : undefined)
      const textColor = (typeof pos.textColor === 'string' && pos.textColor.trim() !== '') ? pos.textColor.trim() : undefined
      const fontFamily = (typeof pos.fontFamily === 'string' && pos.fontFamily.trim() !== '') ? pos.fontFamily.trim() : (pos.fontFamily === null ? null : undefined)
      const displayMode = (pos.displayMode === 'full' || pos.displayMode === 'half') ? pos.displayMode : undefined

      const item = {}
      if (Number.isFinite(x)) item.x = x
      if (Number.isFinite(y)) item.y = y
      if (Number.isFinite(width)) item.width = width
      if (Number.isFinite(height)) item.height = height
      if (typeof hidden === 'boolean') item.hidden = hidden
      if (Number.isFinite(zIndex)) item.zIndex = zIndex
      if (Number.isFinite(fontSize)) item.fontSize = fontSize
      if (typeof textColor === 'string') item.textColor = textColor
      if (fontFamily === null || typeof fontFamily === 'string') item.fontFamily = fontFamily
      if (typeof displayMode === 'string') item.displayMode = displayMode
      normalized[id] = item
    }

    for (const [id, item] of Object.entries(normalized)) {
      const prev = (localBpState.characterDisplayLayout.positions[id] && typeof localBpState.characterDisplayLayout.positions[id] === 'object')
        ? localBpState.characterDisplayLayout.positions[id]
        : {}
      localBpState.characterDisplayLayout.positions[id] = { ...prev, ...item }
    }
    __persistCharacterDisplayLayoutToDisk__()
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 角色展示：透明背景开关（持久化）
try { ipcMain.removeHandler('localBp:setCharacterDisplayTransparentBackground') } catch { /* ignore */ }
ipcMain.handle('localBp:setCharacterDisplayTransparentBackground', (event, enabled) => {
  try {
    if (!localBpState.characterDisplayLayout) {
      localBpState.characterDisplayLayout = { positions: {} }
    }
    localBpState.characterDisplayLayout.transparentBackground = !!enabled
    __persistCharacterDisplayLayoutToDisk__()
    broadcastLocalBpState()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

function openCharacterDisplayWindow() {
  if (characterDisplayWindow && !characterDisplayWindow.isDestroyed()) {
    characterDisplayWindow.focus()
    return { success: true }
  }

  characterDisplayWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    title: '角色展示',
    resizable: true,
    transparent: true,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  characterDisplayWindow.loadFile(path.join(__dirname, 'pages', 'character-display.html'))

  characterDisplayWindow.on('closed', () => {
    characterDisplayWindow = null
  })

  return { success: true }
}

// 打开角色展示窗口
ipcMain.handle('localBp:openCharacterDisplay', () => {
  try {
    return openCharacterDisplayWindow()
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('localBp:getCharacters', () => {
  try {
    const idx = loadCharacterIndex()
    const pinyinMap = buildPinyinMap([...(idx.survivors || []), ...(idx.hunters || [])])
    return {
      success: true,
      data: {
        survivors: idx.survivors,
        hunters: idx.hunters,
        pinyinMap
      }
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

app.whenReady().then(async () => {
  ensureDirectories()
  packManager.ensureDirectories()
  loadAuthState()
  try {
    await startLocalPagesServer()
  } catch (e) {
    console.error('[App] 启动本地页面服务器失败:', e?.message || e)
  }

  // 检查是否首次运行
  const config = readJsonFileSafe(configPath, {})
  if (!config.hasRunBefore) {
    // 首次运行，打开欢迎页面
    console.log('[App] First run detected, opening welcome window')
    createWelcomeWindow()

    // 标记为已运行
    config.hasRunBefore = true
    writeJsonFileSafe(configPath, config)
  } else {
    // 非首次运行，直接打开主页面
    createMainWindow()
  }

  // 字体目录热监听：字体文件新增/删除/覆盖后自动通知各窗口
  try {
    ensureFontsDir()
    let fontWatchTimer = null
    fs.watch(fontsPath, { persistent: false }, () => {
      if (fontWatchTimer) clearTimeout(fontWatchTimer)
      fontWatchTimer = setTimeout(() => {
        broadcastToAllWindows('custom-fonts-changed', { ts: Date.now(), reason: 'fswatch' })
      }, 200)
    })
  } catch (e) {
    console.warn('[Main] fontsPath 监听失败:', e?.message || e)
  }

  // 初始化插件系统（在主窗口创建之后）
  try {
    await bootstrapPluginSystem({ app, mainWindow })
  } catch (e) {
    console.error('[App] 插件系统初始化失败:', e?.message || e)
  }

  // 延迟检查更新，确保窗口已完全加载
  setTimeout(async () => {
    try {
      await updater.checkAndPromptUpdate(mainWindow)
    } catch (e) {
      console.error('[App] 检查更新失败:', e.message)
    }
  }, 2000)
})

app.on('before-quit', async () => {
  try {
    await shutdownPlugins()
  } catch (e) {
    console.error('[App] 关闭插件系统失败:', e?.message || e)
  }
  try {
    await stopLocalPagesServer()
  } catch (e) {
    console.error('[App] 关闭本地页面服务器失败:', e?.message || e)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
  }
})

// ===== 3D 模型设置相关 IPC =====

// 打开自定义组件设计器
let componentEditorWindow = null
ipcMain.handle('open-component-editor', async () => {
  try {
    if (componentEditorWindow && !componentEditorWindow.isDestroyed()) {
      componentEditorWindow.focus()
      return { success: true }
    }

    componentEditorWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      title: '自定义组件设计器',
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    })

    componentEditorWindow.loadFile('pages/component-editor.html')
    componentEditorWindow.setMenu(null)

    componentEditorWindow.on('closed', () => {
      componentEditorWindow = null
    })

    return { success: true }
  } catch (error) {
    console.error('[Main] 打开自定义组件设计器失败:', error)
    return { success: false, error: error.message }
  }
})

// 打开动画编辑器
let animationEditorWindow = null
ipcMain.handle('open-animation-editor', async () => {
  try {
    if (animationEditorWindow && !animationEditorWindow.isDestroyed()) {
      animationEditorWindow.focus()
      return { success: true }
    }

    animationEditorWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      title: '动画编辑器',
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    })

    animationEditorWindow.loadFile('pages/animation-editor.html')
    animationEditorWindow.setMenu(null)

    animationEditorWindow.on('closed', () => {
      animationEditorWindow = null
    })

    return { success: true }
  } catch (error) {
    console.error('[Main] 打开动画编辑器失败:', error)
    return { success: false, error: error.message }
  }
})

const model3dConfigPath = path.join(app.getPath('userData'), 'model3d-config.json')

ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({
      title: '选择文件夹',
      properties: ['openDirectory']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('select-file', async (event, options = {}) => {
  try {
    const result = await dialog.showOpenDialog({
      title: '选择文件',
      filters: options.filters || [{ name: '所有文件', extensions: ['*'] }],
      properties: ['openFile']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] }
    }
    return { success: false, canceled: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('save-model-config', async (event, config) => {
  try {
    fs.writeFileSync(model3dConfigPath, JSON.stringify(config, null, 2))
    // 广播配置更新到前台窗口
    if (frontendWindow && !frontendWindow.isDestroyed()) {
      frontendWindow.webContents.send('model-config-updated', config)
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('get-model-config', async () => {
  try {
    if (fs.existsSync(model3dConfigPath)) {
      const data = fs.readFileSync(model3dConfigPath, 'utf8')
      return JSON.parse(data)
    }
    return null
  } catch (error) {
    return null
  }
})

ipcMain.handle('scan-models', async (event, dir) => {
  try {
    if (!dir || !fs.existsSync(dir)) {
      return { success: false, error: '目录不存在' }
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const models = []
    entries.forEach(entry => {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.pmx')) {
        models.push({
          name: path.basename(entry.name, '.pmx'),
          path: path.join(dir, entry.name),
          exists: true
        })
        return
      }
      if (entry.isDirectory()) {
        const pmxPath = path.join(dir, entry.name, `${entry.name}.pmx`)
        if (fs.existsSync(pmxPath)) {
          models.push({
            name: entry.name,
            path: pmxPath,
            exists: true
          })
        }
      }
    })
    return { success: true, models }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
