const fs = require('fs')
const path = require('path')
const os = require('os')
const { app } = require('electron')
const { validateZip, unzipFile } = require('./archive')

function getUserPluginsDir() {
  const userData = app.getPath('userData')
  return path.join(userData, 'plugins')
}

function isValidPluginDirName(name) {
  if (!name) return false
  // 避免目录穿越与奇怪名字
  if (name.includes('/') || name.includes('\\')) return false
  if (name.includes('..')) return false
  return true
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null
  const content = fs.readFileSync(filePath, 'utf8')
  return JSON.parse(content)
}

function copyDir(srcDir, destDir) {
  // Node 16+ 支持 fs.cpSync
  fs.cpSync(srcDir, destDir, {
    recursive: true,
    force: true,
    errorOnExist: false
  })
}

function listUserInstalledPlugins() {
  const pluginsDir = getUserPluginsDir()
  if (!fs.existsSync(pluginsDir)) return []

  const entries = fs.readdirSync(pluginsDir, { withFileTypes: true })
  const result = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue
    if (entry.name === 'builtin') continue

    const pluginDir = path.join(pluginsDir, entry.name)
    const manifestPath = path.join(pluginDir, 'package.json')
    const manifest = readJsonIfExists(manifestPath)
    if (!manifest?.name || !manifest?.version || !manifest?.main) continue

    result.push({
      packageId: manifest.name,
      name: manifest.displayName || manifest.name,
      version: manifest.version,
      description: manifest.description || '',
      author: typeof manifest.author === 'string' ? manifest.author : (manifest.author?.name || ''),
      installedPath: pluginDir
    })
  }

  // 稳定排序
  result.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'zh-CN'))
  return result
}

async function installPluginPackFile(packFilePath, options = {}) {
  if (!fs.existsSync(packFilePath)) {
    throw new Error('插件包文件不存在')
  }

  const validation = await validateZip(packFilePath)
  if (!validation.valid) {
    throw new Error(`无效的插件包文件: ${validation.error}`)
  }

  const tempDir = path.join(os.tmpdir(), 'asgplugin-' + Date.now())
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    const unzipResult = await unzipFile(packFilePath, tempDir)
    if (!unzipResult.success) throw new Error('解压失败')

    const manifestPath = path.join(tempDir, 'package.json')
    const manifest = readJsonIfExists(manifestPath)
    if (!manifest) throw new Error('插件包缺少 package.json')
    if (!manifest.name || !manifest.version || !manifest.main) {
      throw new Error('插件包 package.json 缺少必要字段(name/version/main)')
    }
    if (!isValidPluginDirName(manifest.name)) {
      throw new Error('插件包 name 非法（可能包含路径字符）')
    }

    const pluginsDir = getUserPluginsDir()
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true })

    const targetDir = path.join(pluginsDir, manifest.name)

    // 先删旧版本（更新）
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }

    fs.mkdirSync(targetDir, { recursive: true })
    copyDir(tempDir, targetDir)

    return {
      pluginId: manifest.name,
      name: manifest.displayName || manifest.name,
      version: manifest.version,
      description: manifest.description || '',
      author: typeof manifest.author === 'string' ? manifest.author : (manifest.author?.name || ''),
      installedPath: targetDir
    }
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}

function uninstallUserPlugin(pluginId, options = {}) {
  if (!pluginId) throw new Error('pluginId 不能为空')
  if (!isValidPluginDirName(pluginId)) throw new Error('pluginId 非法')

  const pluginsDir = getUserPluginsDir()
  const targetDir = path.join(pluginsDir, pluginId)
  if (!fs.existsSync(targetDir)) {
    return { success: true, removed: false }
  }

  fs.rmSync(targetDir, { recursive: true, force: true })
  return { success: true, removed: true }
}

module.exports = {
  getUserPluginsDir,
  listUserInstalledPlugins,
  installPluginPackFile,
  uninstallUserPlugin
}
