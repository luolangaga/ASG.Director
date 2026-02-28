const fs = require('fs')
const path = require('path')

function createOfficialModelService(options) {
  const {
    ipcMain,
    userDataPath,
    readJsonFileSafe,
    downloadFile,
    app,
    rootDir
  } = options

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
      path.join(rootDir, 'extracted_roles.json'),
      path.join(rootDir, '..', 'ASG.Api', 'extracted_roles.json')
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
      path.join(rootDir, 'extracted_roles.json'),
      path.join(rootDir, '..', 'ASG.Api', 'extracted_roles.json')
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
        if (item.rawName && item.rawName !== item.name) {
          map[item.rawName] = target
        }
      }
      officialModelMapCache = map
      officialModelMapMtime = stat.mtimeMs
      return map
    } catch {
      return {}
    }
  }

  async function ensureGltfDependencies(modelUrl, localPath) {
    try {
      const content = fs.readFileSync(localPath, 'utf8')
      const gltf = JSON.parse(content)
      const dependencies = []

      if (gltf.buffers) {
        for (const buffer of gltf.buffers) {
          if (buffer.uri && !buffer.uri.startsWith('data:')) {
            dependencies.push(buffer.uri)
          }
        }
      }

      if (gltf.images) {
        for (const image of gltf.images) {
          if (image.uri && !image.uri.startsWith('data:')) {
            dependencies.push(image.uri)
          }
        }
      }

      for (const uri of dependencies) {
        const depUrl = new URL(uri, modelUrl).toString()
        const localDir = path.dirname(localPath)
        const depLocalPath = path.join(localDir, uri)

        if (!fs.existsSync(depLocalPath)) {
          console.log(`[Main] Downloading dependency for ${path.basename(localPath)}: ${uri}`)
          await downloadFile(depUrl, depLocalPath, { maxRetries: 3 })
        }
      }
    } catch (e) {
      console.warn(`[Main] Failed to process GLTF dependencies for ${localPath}:`, e.message)
    }
  }

  function register() {
    ipcMain.handle('get-official-model-map', () => loadOfficialModelMap())

    ipcMain.handle('get-official-model-download-status', () => getOfficialModelDownloadStatus())

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
        const appPath = app.getAppPath()
        const mapDir = path.join(appPath, 'assets', 'map')
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
  }

  return {
    register,
    loadOfficialModelMap,
    getOfficialModelDownloadStatus
  }
}

module.exports = {
  createOfficialModelService
}
