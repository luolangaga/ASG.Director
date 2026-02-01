/**
 * 布局包管理模块
 * 处理布局包的导入、导出和安装
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const { app, dialog, BrowserWindow } = require('electron')
const { zipDirectory, unzipFile, validateZip } = require('./archive')

// 路径配置
const userDataPath = app.getPath('userData')
const layoutPath = path.join(userDataPath, 'layout.json')
const layoutV2Path = path.join(userDataPath, 'layout-v2.json')
const bgImagePath = path.join(userDataPath, 'background')
const fontsPath = path.join(userDataPath, 'fonts')
const installedPacksPath = path.join(userDataPath, 'installed-packs.json')

// 支持的图片扩展名
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg']

// 支持的字体扩展名
const FONT_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2']

/**
 * 确保必要的目录存在
 */
function ensureDirectories() {
  if (!fs.existsSync(bgImagePath)) {
    fs.mkdirSync(bgImagePath, { recursive: true })
  }
  if (!fs.existsSync(fontsPath)) {
    fs.mkdirSync(fontsPath, { recursive: true })
  }
}

/**
 * 获取临时目录
 */
function getTempDir(prefix = 'bppack') {
  return path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
}

/**
 * 安全删除目录
 */
function safeRemoveDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      // Windows 下文件可能被占用，需要多次尝试
      let retries = 3
      let lastError = null

      for (let i = 0; i < retries; i++) {
        try {
          fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 })
          console.log('[PackManager] 临时目录已删除:', dir)
          return true
        } catch (e) {
          lastError = e
          if (i < retries - 1) {
            // 等待一下再重试
            const delay = (i + 1) * 200
            const start = Date.now()
            while (Date.now() - start < delay) {
              // 同步延迟
            }
          }
        }
      }

      if (lastError) {
        console.warn('[PackManager] 删除目录失败 (将在程序退出时自动清理):', dir, lastError.message)
      }
    }
    return false
  } catch (e) {
    console.error('[PackManager] 删除目录失败:', dir, e.message)
    return false
  }
}

/**
 * 判断文件是否为图片
 */
function isImageFile(filename) {
  const ext = path.extname(filename).toLowerCase()
  return IMAGE_EXTENSIONS.includes(ext)
}

/**
 * 判断文件是否为字体
 */
function isFontFile(filename) {
  const ext = path.extname(filename).toLowerCase()
  return FONT_EXTENSIONS.includes(ext)
}

function remapLayoutAssetPaths(layout) {
  if (!layout || typeof layout !== 'object') return layout

  const remapOne = (p) => {
    if (!p || typeof p !== 'string') return p
    const base = path.basename(p)
    if (!base) return p
    return path.join(bgImagePath, base)
  }

  if (layout.backgroundImage) {
    layout.backgroundImage = remapOne(layout.backgroundImage)
  }

  if (layout.postMatchLayout && typeof layout.postMatchLayout === 'object' && layout.postMatchLayout.backgroundImage) {
    layout.postMatchLayout.backgroundImage = remapOne(layout.postMatchLayout.backgroundImage)
  }

  if (layout.scoreboardLayouts && typeof layout.scoreboardLayouts === 'object') {
    for (const key of Object.keys(layout.scoreboardLayouts)) {
      const sb = layout.scoreboardLayouts[key]
      if (sb && typeof sb === 'object' && sb.backgroundImage) {
        sb.backgroundImage = remapOne(sb.backgroundImage)
      }
    }
  }

  // 角色展示窗口背景（本地BP）
  if (layout.characterDisplayLayout && typeof layout.characterDisplayLayout === 'object' && layout.characterDisplayLayout.backgroundImage) {
    layout.characterDisplayLayout.backgroundImage = remapOne(layout.characterDisplayLayout.backgroundImage)
  }

  // 总览比分板（Total Scoreboard）
  if (layout.scoreboardOverviewLayout && typeof layout.scoreboardOverviewLayout === 'object') {
    // 背景图
    if (layout.scoreboardOverviewLayout.backgroundImage) {
      layout.scoreboardOverviewLayout.backgroundImage = remapOne(layout.scoreboardOverviewLayout.backgroundImage)
    }
    // 贴图 textures
    if (layout.scoreboardOverviewLayout.textures && typeof layout.scoreboardOverviewLayout.textures === 'object') {
      for (const key of Object.keys(layout.scoreboardOverviewLayout.textures)) {
        const texPath = layout.scoreboardOverviewLayout.textures[key]
        if (texPath && typeof texPath === 'string' && !texPath.startsWith('data:')) {
          layout.scoreboardOverviewLayout.textures[key] = remapOne(texPath)
        }
      }
    }
  }

  return layout
}

/**
 * 收集当前布局包数据
 * @param {object} windowRefs - 窗口引用对象 { frontendWindow, scoreboardWindowA, scoreboardWindowB }
 * @returns {Promise<object>}
 */
async function collectPackData(windowRefs = {}) {
  const { frontendWindow, scoreboardWindowA, scoreboardWindowB, postMatchWindow } = windowRefs
  const packData = {}

  // 保存窗口大小
  if (frontendWindow && !frontendWindow.isDestroyed()) {
    packData.frontendBounds = frontendWindow.getBounds()
    try {
      const [cw, ch] = frontendWindow.getContentSize()
      packData.frontendContentSize = { width: cw, height: ch }
    } catch (e) {
      // ignore
    }
  }

  if (scoreboardWindowA && !scoreboardWindowA.isDestroyed()) {
    packData.scoreboardABounds = scoreboardWindowA.getBounds()
  }

  if (scoreboardWindowB && !scoreboardWindowB.isDestroyed()) {
    packData.scoreboardBBounds = scoreboardWindowB.getBounds()
  }

  if (postMatchWindow && !postMatchWindow.isDestroyed()) {
    packData.postMatchBounds = postMatchWindow.getBounds()
  }

  return packData
}

/**
 * 准备导出目录
 * @param {object} options - 配置选项
 * @returns {Promise<{tempDir: string, files: string[]}>}
 */
async function prepareExportDir(options = {}) {
  const { windowRefs = {} } = options
  const tempDir = getTempDir('bppack-export')
  fs.mkdirSync(tempDir, { recursive: true })

  const files = []
  let hasValidLayout = false

  // 复制布局文件
  if (fs.existsSync(layoutPath)) {
    try {
      const content = fs.readFileSync(layoutPath, 'utf8')
      if (content && content.trim().length > 0) {
        const layout = JSON.parse(content)
        if (layout && typeof layout === 'object' && Object.keys(layout).length > 0) {
          const destLayoutPath = path.join(tempDir, 'layout.json')
          fs.copyFileSync(layoutPath, destLayoutPath)
          files.push('layout.json')
          hasValidLayout = true
          console.log('[PackManager] 布局文件已复制，键数量:', Object.keys(layout).length)
        }
      }
    } catch (e) {
      console.warn('[PackManager] 布局文件无效:', e.message)
    }
  }

  // 如果存在 V2 布局文件，一并导出（用于向前/向后兼容）
  if (fs.existsSync(layoutV2Path)) {
    try {
      const content = fs.readFileSync(layoutV2Path, 'utf8')
      if (content && content.trim().length > 0) {
        JSON.parse(content)
        const destLayoutV2Path = path.join(tempDir, 'layout-v2.json')
        fs.copyFileSync(layoutV2Path, destLayoutV2Path)
        files.push('layout-v2.json')
        console.log('[PackManager] V2 布局文件已复制')
      }
    } catch (e) {
      console.warn('[PackManager] V2 布局文件无效，跳过导出:', e.message)
    }
  }

  // 如果没有有效的布局文件，创建一个默认的
  if (!hasValidLayout) {
    console.log('[PackManager] 未找到有效布局，创建默认布局')
    const defaultLayout = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      elements: [],
      settings: {
        theme: 'default'
      }
    }
    const destLayoutPath = path.join(tempDir, 'layout.json')
    fs.writeFileSync(destLayoutPath, JSON.stringify(defaultLayout, null, 2))
    files.push('layout.json')
    console.log('[PackManager] 已创建默认布局文件')
  }

  // 收集并保存 pack 配置
  const packData = await collectPackData(windowRefs)
  if (Object.keys(packData).length > 0) {
    const packConfigPath = path.join(tempDir, 'pack-config.json')
    fs.writeFileSync(packConfigPath, JSON.stringify(packData, null, 2))
    files.push('pack-config.json')
  }

  // 复制所有图片文件
  if (fs.existsSync(bgImagePath)) {
    const imageFiles = fs.readdirSync(bgImagePath)
    for (const file of imageFiles) {
      const srcPath = path.join(bgImagePath, file)
      if (fs.statSync(srcPath).isFile()) {
        const destPath = path.join(tempDir, file)
        fs.copyFileSync(srcPath, destPath)
        files.push(file)
        console.log('[PackManager] 复制图片:', file)
      }
    }
  }

  // 复制所有字体文件到 fonts 子目录
  if (fs.existsSync(fontsPath)) {
    const fontFiles = fs.readdirSync(fontsPath)
    if (fontFiles.length > 0) {
      const fontsTempDir = path.join(tempDir, 'fonts')
      fs.mkdirSync(fontsTempDir, { recursive: true })
      for (const file of fontFiles) {
        if (isFontFile(file)) {
          const srcPath = path.join(fontsPath, file)
          if (fs.statSync(srcPath).isFile()) {
            const destPath = path.join(fontsTempDir, file)
            fs.copyFileSync(srcPath, destPath)
            files.push('fonts/' + file)
            console.log('[PackManager] 复制字体:', file)
          }
        }
      }
    }
  }

  console.log('[PackManager] 准备导出文件:', files.length, '个')
  return { tempDir, files }
}

/**
 * 导出布局包
 * @param {object} options - 配置选项
 * @returns {Promise<{success: boolean, filePath?: string, error?: string}>}
 */
async function exportPack(options = {}) {
  const { windowRefs = {}, defaultName = 'my-bp-layout' } = options
  let tempDir = null

  try {
    // 检查是否有布局可以导出
    let hasLayout = false
    if (fs.existsSync(layoutPath)) {
      try {
        const content = fs.readFileSync(layoutPath, 'utf8')
        if (content && content.trim().length > 0) {
          const layout = JSON.parse(content)
          if (layout && typeof layout === 'object' && Object.keys(layout).length > 0) {
            hasLayout = true
          }
        }
      } catch (e) {
        // 忽略错误，后续会创建默认布局
      }
    }

    if (!hasLayout) {
      const response = await dialog.showMessageBox({
        type: 'warning',
        title: '提示',
        message: '当前没有保存的布局',
        detail: '将导出默认布局。如果您想导出自定义布局，请先在前台窗口进行布局调整并保存。',
        buttons: ['继续导出', '取消'],
        defaultId: 0,
        cancelId: 1
      })

      if (response.response === 1) {
        return { success: false, canceled: true }
      }
    }

    // 选择保存路径
    const result = await dialog.showSaveDialog({
      title: '导出BP布局包',
      defaultPath: `${defaultName}.bppack`,
      filters: [{ name: 'BP布局包', extensions: ['bppack'] }]
    })

    if (result.canceled || !result.filePath) {
      return { success: false, canceled: true }
    }

    console.log('[PackManager] 开始导出到:', result.filePath)

    // 准备导出目录
    const { tempDir: exportDir, files } = await prepareExportDir({ windowRefs })
    tempDir = exportDir

    console.log('[PackManager] 临时目录:', tempDir)
    console.log('[PackManager] 文件列表:', files)

    // 压缩为 ZIP
    const zipResult = await zipDirectory(tempDir, result.filePath)

    if (!zipResult.success) {
      throw new Error('压缩失败')
    }

    console.log('[PackManager] 导出成功，文件大小:', zipResult.size, '字节')

    // 清理临时目录
    safeRemoveDir(tempDir)

    return { success: true, filePath: result.filePath, size: zipResult.size }
  } catch (error) {
    console.error('[PackManager] 导出失败:', error)
    if (tempDir) safeRemoveDir(tempDir)
    return { success: false, error: error.message }
  }
}

/**
 * 导入布局包
 * @param {object} options - 配置选项
 * @returns {Promise<{success: boolean, layout?: object, packData?: object, error?: string}>}
 */
async function importPack(options = {}) {
  const { windowRefs = {}, filePath = null } = options
  let tempDir = null

  try {
    // 选择文件（如果没有提供）
    let bppackPath = filePath
    if (!bppackPath) {
      const result = await dialog.showOpenDialog({
        title: '导入BP布局包',
        filters: [{ name: 'BP布局包', extensions: ['bppack'] }],
        properties: ['openFile']
      })

      if (result.canceled || !result.filePaths.length) {
        return { success: false, canceled: true }
      }

      bppackPath = result.filePaths[0]
    }

    console.log('[PackManager] 开始导入:', bppackPath)

    // 验证 ZIP 文件
    const validation = await validateZip(bppackPath)
    if (!validation.valid) {
      throw new Error(`无效的布局包文件: ${validation.error}`)
    }

    // 创建临时目录
    tempDir = getTempDir('bppack-import')
    fs.mkdirSync(tempDir, { recursive: true })

    console.log('[PackManager] 临时目录:', tempDir)

    // 解压
    const unzipResult = await unzipFile(bppackPath, tempDir)
    if (!unzipResult.success) {
      throw new Error('解压失败')
    }

    console.log('[PackManager] 解压完成，文件数:', unzipResult.files.length)

    // 确保背景目录存在
    ensureDirectories()

    // 复制布局文件 - 优先使用 V2 格式
    const layoutV2File = path.join(tempDir, 'layout-v2.json')
    const layoutFile = path.join(tempDir, 'layout.json')
    let layout = null

    if (fs.existsSync(layoutV2File)) {
      // 新版 V2 布局格式
      try {
        const content = fs.readFileSync(layoutV2File, 'utf8').trim()
        console.log('[PackManager] 发现 V2 布局文件，大小:', content.length, '字节')

        if (content) {
          const v2Layout = remapLayoutAssetPaths(JSON.parse(content))
          // 直接保存到 layout-v2.json，并同步写入 layout.json（当前应用仍主要读取 layout.json）
          fs.writeFileSync(layoutV2Path, JSON.stringify(v2Layout, null, 2))
          fs.writeFileSync(layoutPath, JSON.stringify(v2Layout, null, 2))
          console.log('[PackManager] V2 布局文件已导入，包含页面:',
            Object.keys(v2Layout).filter(k => k.startsWith('frontend') || k.startsWith('scoreboard'))
          )
          layout = v2Layout
        }
      } catch (e) {
        console.error('[PackManager] V2 布局文件处理失败:', e.message)
      }
    } else if (fs.existsSync(layoutFile)) {
      // 旧版布局格式 - 保持兼容
      try {
        const stats = fs.statSync(layoutFile)
        console.log('[PackManager] 布局文件大小:', stats.size, '字节')

        const content = fs.readFileSync(layoutFile, 'utf8')
        console.log('[PackManager] 读取到的内容长度:', content.length)

        const trimmedContent = content.trim()
        if (!trimmedContent) {
          console.warn('[PackManager] 布局文件为空，使用默认布局')
          layout = {
            version: '1.0',
            elements: [],
            settings: { theme: 'default' }
          }
          fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2))
        } else {
          layout = remapLayoutAssetPaths(JSON.parse(trimmedContent))
          if (!layout || typeof layout !== 'object') {
            console.warn('[PackManager] 布局格式无效，使用默认布局')
            layout = {
              version: '1.0',
              elements: [],
              settings: { theme: 'default' }
            }
          }
          fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2))
          console.log('[PackManager] 旧版布局文件已导入，键数量:', Object.keys(layout).length)
        }
      } catch (e) {
        console.error('[PackManager] 布局文件处理失败:', e.message)
        console.warn('[PackManager] 使用默认布局')
        layout = {
          version: '1.0',
          elements: [],
          settings: { theme: 'default' }
        }
        fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2))
      }
    } else {
      console.warn('[PackManager] 布局包中缺少布局文件，使用默认布局')
      layout = {
        version: '1.0',
        elements: [],
        settings: { theme: 'default' }
      }
      fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2))
    }

    // 复制所有图片文件
    const extractedFiles = fs.readdirSync(tempDir)
    for (const file of extractedFiles) {
      if (file === 'layout.json' || file === 'layout-v2.json' || file === 'pack-config.json' || file === 'fonts') continue

      const srcPath = path.join(tempDir, file)
      if (fs.statSync(srcPath).isFile()) {
        const destPath = path.join(bgImagePath, file)
        fs.copyFileSync(srcPath, destPath)
        console.log('[PackManager] 复制图片:', file)
      }
    }

    // 复制字体文件
    const fontsTempDir = path.join(tempDir, 'fonts')
    if (fs.existsSync(fontsTempDir)) {
      ensureDirectories() // 确保字体目录存在
      const fontFiles = fs.readdirSync(fontsTempDir)
      for (const file of fontFiles) {
        if (isFontFile(file)) {
          const srcPath = path.join(fontsTempDir, file)
          if (fs.statSync(srcPath).isFile()) {
            const destPath = path.join(fontsPath, file)
            fs.copyFileSync(srcPath, destPath)
            console.log('[PackManager] 复制字体:', file)
          }
        }
      }
    }

    // 读取 pack 配置
    const packConfigFile = path.join(tempDir, 'pack-config.json')
    let packData = {}
    if (fs.existsSync(packConfigFile)) {
      try {
        const content = fs.readFileSync(packConfigFile, 'utf8').trim()
        if (content) {
          packData = JSON.parse(content)
          console.log('[PackManager] 读取 pack 配置:', Object.keys(packData).length, '个属性')
        } else {
          console.log('[PackManager] pack-config.json 为空，跳过')
        }
      } catch (e) {
        console.warn('[PackManager] 读取 pack-config.json 失败:', e.message)
        // 不阻止导入流程，继续执行
      }
    }

    // 应用窗口配置
    await applyPackData(packData, windowRefs)

    // 通知窗口重新加载布局
    const { frontendWindow, scoreboardWindowA, scoreboardWindowB, postMatchWindow } = windowRefs
    if (frontendWindow && !frontendWindow.isDestroyed()) {
      console.log('[PackManager] 通知前台窗口重新加载布局')
      frontendWindow.webContents.send('reload-layout-from-pack')
    }
    if (scoreboardWindowA && !scoreboardWindowA.isDestroyed()) {
      scoreboardWindowA.webContents.send('reload-layout-from-pack')
    }
    if (scoreboardWindowB && !scoreboardWindowB.isDestroyed()) {
      scoreboardWindowB.webContents.send('reload-layout-from-pack')
    }
    if (postMatchWindow && !postMatchWindow.isDestroyed()) {
      postMatchWindow.webContents.send('reload-layout-from-pack')
    }
    safeRemoveDir(tempDir)

    return { success: true, layout, packData }
  } catch (error) {
    console.error('[PackManager] 导入失败:', error)
    if (tempDir) safeRemoveDir(tempDir)
    return { success: false, error: error.message }
  }
}

/**
 * 应用 pack 配置到窗口
 * @param {object} packData - pack 配置数据
 * @param {object} windowRefs - 窗口引用
 */
async function applyPackData(packData, windowRefs) {
  const { frontendWindow, scoreboardWindowA, scoreboardWindowB, postMatchWindow } = windowRefs

  // 应用前台窗口大小
  if (packData.frontendBounds && frontendWindow && !frontendWindow.isDestroyed()) {
    frontendWindow.setBounds(packData.frontendBounds)
  }

  // 应用前台渲染分辨率（内容尺寸）
  if (packData.frontendContentSize && frontendWindow && !frontendWindow.isDestroyed()) {
    const w = Number(packData.frontendContentSize.width)
    const h = Number(packData.frontendContentSize.height)
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      try {
        frontendWindow.setContentSize(Math.round(w), Math.round(h))
      } catch (e) {
        // ignore
      }
    }
  }

  // 应用比分板窗口大小
  if (packData.scoreboardABounds && scoreboardWindowA && !scoreboardWindowA.isDestroyed()) {
    scoreboardWindowA.setBounds(packData.scoreboardABounds)
  }
  if (packData.scoreboardBBounds && scoreboardWindowB && !scoreboardWindowB.isDestroyed()) {
    scoreboardWindowB.setBounds(packData.scoreboardBBounds)
  }

  if (packData.postMatchBounds && postMatchWindow && !postMatchWindow.isDestroyed()) {
    postMatchWindow.setBounds(packData.postMatchBounds)
  }
}

/**
 * 从商店安装布局包
 * @param {string} packFilePath - 下载的布局包文件路径
 * @param {object} packInfo - 包信息 { id, name, version }
 * @param {object} options - 配置选项
 * @returns {Promise<{success: boolean, layout?: object, packData?: object, error?: string}>}
 */
async function installFromStore(packFilePath, packInfo, options = {}) {
  const { windowRefs = {} } = options

  // 使用导入功能
  const result = await importPack({
    windowRefs,
    filePath: packFilePath
  })

  if (result.success) {
    // 记录已安装的包
    saveInstalledPack({
      id: packInfo.id,
      name: packInfo.name,
      version: packInfo.version,
      installedAt: new Date().toISOString(),
      isActive: true
    })

    // 刷新窗口
    await refreshWindows(windowRefs)
  }

  return result
}

/**
 * 刷新所有窗口
 * @param {object} windowRefs - 窗口引用
 */
async function refreshWindows(windowRefs) {
  const { frontendWindow, scoreboardWindowA, scoreboardWindowB } = windowRefs

  const refresh = async (win, name) => {
    if (win && !win.isDestroyed()) {
      console.log(`[PackManager] 刷新 ${name}`)
      await win.webContents.session.clearCache()
      win.reload()
    }
  }

  // 延迟刷新确保文件写入完成
  setTimeout(async () => {
    await refresh(frontendWindow, '前台窗口')
    await refresh(scoreboardWindowA, '比分板A')
    await refresh(scoreboardWindowB, '比分板B')
  }, 500)
}

/**
 * 保存已安装的包记录
 * @param {object} packInfo - 包信息
 */
function saveInstalledPack(packInfo) {
  let installed = []

  try {
    if (fs.existsSync(installedPacksPath)) {
      installed = JSON.parse(fs.readFileSync(installedPacksPath, 'utf8'))
    }
  } catch (e) {
    console.warn('[PackManager] 读取已安装包列表失败:', e.message)
    installed = []
  }

  // 如果新包标记为 active，清除其他包的 active 状态
  if (packInfo.isActive) {
    installed.forEach(p => p.isActive = false)
  }

  // 更新或添加
  const existingIndex = installed.findIndex(p => p.id === packInfo.id)
  if (existingIndex >= 0) {
    installed[existingIndex] = { ...installed[existingIndex], ...packInfo }
  } else {
    installed.push(packInfo)
  }

  fs.writeFileSync(installedPacksPath, JSON.stringify(installed, null, 2))
  console.log('[PackManager] 已安装包记录已更新')
}

/**
 * 获取已安装的包列表
 * @returns {Array}
 */
function getInstalledPacks() {
  try {
    if (fs.existsSync(installedPacksPath)) {
      return JSON.parse(fs.readFileSync(installedPacksPath, 'utf8'))
    }
  } catch (e) {
    console.warn('[PackManager] 读取已安装包列表失败:', e.message)
  }
  return []
}

/**
 * 重置布局（恢复默认）
 * @param {object} windowRefs - 窗口引用
 */
async function resetLayout(windowRefs = {}) {
  const { frontendWindow, scoreboardWindowA, scoreboardWindowB, postMatchWindow } = windowRefs

  try {
    // 删除布局文件
    if (fs.existsSync(layoutPath)) {
      fs.unlinkSync(layoutPath)
    }

    // 删除所有背景图片
    if (fs.existsSync(bgImagePath)) {
      const files = fs.readdirSync(bgImagePath)
      for (const file of files) {
        const filePath = path.join(bgImagePath, file)
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath)
        }
      }
    }

    // 恢复前台窗口默认大小
    if (frontendWindow && !frontendWindow.isDestroyed()) {
      frontendWindow.setBounds({ x: 100, y: 100, width: 1280, height: 720 })

      // 通知前台窗口重新加载
      console.log('[PackManager] 通知前台窗口重置布局')
      frontendWindow.webContents.send('reload-layout-from-pack')
    }

    // 旧版兜底：清除比分板窗口的 localStorage（新版本已迁移到 layout.json）
    const clearScoreboardLegacyLocalStorage = async (win) => {
      if (win && !win.isDestroyed()) {
        try {
          await win.webContents.executeJavaScript(
            `localStorage.removeItem('scoreboard_layout_teamA'); localStorage.removeItem('scoreboard_layout_teamB')`
          )
        } catch (e) {
          console.warn('[PackManager] 清除比分板旧 localStorage 失败:', e.message)
        }
      }
    }
    await clearScoreboardLegacyLocalStorage(scoreboardWindowA)
    await clearScoreboardLegacyLocalStorage(scoreboardWindowB)

    // 通知比分板窗口重新加载
    if (scoreboardWindowA && !scoreboardWindowA.isDestroyed()) {
      scoreboardWindowA.webContents.send('reload-layout-from-pack')
    }
    if (scoreboardWindowB && !scoreboardWindowB.isDestroyed()) {
      scoreboardWindowB.webContents.send('reload-layout-from-pack')
    }

    // 通知赛后数据窗口重新加载
    if (postMatchWindow && !postMatchWindow.isDestroyed()) {
      postMatchWindow.webContents.send('reload-layout-from-pack')
    }

    return { success: true }
  } catch (error) {
    console.error('[PackManager] 重置布局失败:', error)
    return { success: false, error: error.message }
  }
}

module.exports = {
  ensureDirectories,
  exportPack,
  importPack,
  installFromStore,
  applyPackData,
  refreshWindows,
  saveInstalledPack,
  getInstalledPacks,
  resetLayout,
  collectPackData,
  isFontFile,
  // 常量导出
  layoutPath,
  bgImagePath,
  fontsPath,
  installedPacksPath,
  FONT_EXTENSIONS
}
