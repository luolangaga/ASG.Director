/**
 * ASG.Director 自动更新模块 v2.0
 * 
 * 改进功能:
 * - 更健壮的错误处理
 * - 断点续传支持
 * - 进度显示优化
 * - 多下载源支持
 * - 下载完整性校验
 */

const { app, dialog, shell, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { httpGet, downloadFile, formatSize } = require('./utils/downloader')

// 当前应用版本
const packageJson = require('./package.json')
const CURRENT_VERSION = packageJson.version

// 应用名称
const APP_NAME = 'ASG.Director'

// API 配置
const API_CONFIG = {
  development: 'https://api.idvevent.cn', // 用户要求: 全部使用生产环境
  production: 'https://api.idvevent.cn'
}

// 备用下载源
const FALLBACK_DOWNLOAD_URLS = [
  // 可以添加多个备用下载源
]

// 更新状态
let updateInfo = null
let isCheckingUpdate = false
let isDownloading = false

/**
 * 获取当前环境
 */
function getCurrentEnv() {
  return app.isPackaged ? 'production' : 'development'
}

/**
 * 获取 API 基础 URL
 */
function getApiBaseUrl() {
  return API_CONFIG[getCurrentEnv()]
}

/**
 * 比较版本号
 * @param {string} v1 - 版本1
 * @param {string} v2 - 版本2
 * @returns {number} - 1: v1 > v2, -1: v1 < v2, 0: 相等
 */
function compareVersions(v1, v2) {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number)
  const parts2 = v2.replace(/^v/, '').split('.').map(Number)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }
  return 0
}

/**
 * 检查更新
 * @returns {Promise<UpdateCheckResult>}
 */
async function checkForUpdate() {
  if (isCheckingUpdate) {
    console.log('[Updater] 已在检查更新中')
    return updateInfo
  }

  isCheckingUpdate = true
  console.log('[Updater] 开始检查更新...')
  console.log('[Updater] 当前版本:', CURRENT_VERSION)
  console.log('[Updater] API:', getApiBaseUrl())

  try {
    const url = `${getApiBaseUrl()}/api/app-versions/check?appName=${encodeURIComponent(APP_NAME)}&currentVersion=${encodeURIComponent(CURRENT_VERSION)}`

    updateInfo = await httpGet(url)

    console.log('[Updater] 检查结果:', updateInfo)

    // 本地再次验证版本比较
    if (updateInfo.hasUpdate && updateInfo.latestVersion) {
      const serverSaysUpdate = updateInfo.hasUpdate
      const localCheck = compareVersions(updateInfo.latestVersion, CURRENT_VERSION) > 0

      if (serverSaysUpdate !== localCheck) {
        console.log('[Updater] 警告: 服务器与本地版本比较结果不一致')
        console.log(`[Updater] 服务器: hasUpdate=${serverSaysUpdate}, 本地: ${localCheck}`)
        // 以更保守的方式处理：只有两者都认为需要更新时才更新
        updateInfo.hasUpdate = serverSaysUpdate && localCheck
      }
    }

    if (updateInfo.hasUpdate) {
      console.log(`[Updater] 发现新版本: ${updateInfo.latestVersion}`)
      if (updateInfo.forceUpdate) {
        console.log('[Updater] 这是强制更新！')
      }
    } else {
      console.log('[Updater] 已是最新版本')
    }

    return updateInfo
  } catch (error) {
    console.error('[Updater] 检查更新失败:', error.message)
    return {
      hasUpdate: false,
      error: error.message
    }
  } finally {
    isCheckingUpdate = false
  }
}

/**
 * 显示更新对话框
 * @param {BrowserWindow} parentWindow - 父窗口
 * @returns {Promise<boolean>} - 用户是否选择更新
 */
async function showUpdateDialog(parentWindow) {
  if (!updateInfo || !updateInfo.hasUpdate) {
    return false
  }

  const { latestVersion, currentVersion, releaseNotes, forceUpdate, downloadUrl, fileSize, checksum } = updateInfo

  // 构建消息
  let message = `发现新版本 ${latestVersion}\n当前版本 ${currentVersion || CURRENT_VERSION}`

  if (releaseNotes) {
    // 限制显示的更新日志长度
    const notes = releaseNotes.length > 500
      ? releaseNotes.substring(0, 500) + '...'
      : releaseNotes
    message += `\n\n更新内容:\n${notes}`
  }

  if (fileSize) {
    message += `\n\n文件大小: ${formatSize(fileSize)}`
  }

  const buttons = forceUpdate
    ? ['立即更新']
    : ['立即更新', '稍后提醒', '跳过此版本']

  const options = {
    type: forceUpdate ? 'warning' : 'info',
    title: forceUpdate ? '🔴 发现重要更新' : '✨ 发现新版本',
    message: forceUpdate ? '此更新为强制更新，请立即更新以继续使用' : '发现新版本',
    detail: message,
    buttons,
    defaultId: 0,
    cancelId: forceUpdate ? -1 : 1,
    noLink: true
  }

  const result = await dialog.showMessageBox(parentWindow, options)

  if (result.response === 0) {
    // 用户选择更新
    const success = await startDownloadWithProgress(downloadUrl, parentWindow, { checksum })
    return success
  }

  if (result.response === 2) {
    // 跳过此版本
    saveSkippedVersion(latestVersion)
    return false
  }

  // 如果是强制更新但用户关闭了对话框
  if (forceUpdate) {
    app.quit()
    return true
  }

  return false
}

/**
 * 保存跳过的版本
 */
function saveSkippedVersion(version) {
  try {
    const configPath = path.join(app.getPath('userData'), 'update-config.json')
    let config = {}
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
    }
    config.skippedVersion = version
    config.skippedAt = new Date().toISOString()
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  } catch (e) {
    console.error('[Updater] 保存跳过版本失败:', e.message)
  }
}

/**
 * 检查是否跳过了某个版本
 */
function isVersionSkipped(version) {
  try {
    const configPath = path.join(app.getPath('userData'), 'update-config.json')
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      return config.skippedVersion === version
    }
  } catch (e) {
    // 忽略错误
  }
  return false
}

/**
 * 带进度显示的下载
 * @param {string} downloadUrl - 下载地址
 * @param {BrowserWindow} parentWindow - 父窗口
 * @param {object} options - 选项
 * @returns {Promise<boolean>}
 */
async function startDownloadWithProgress(downloadUrl, parentWindow, options = {}) {
  if (!downloadUrl) {
    dialog.showErrorBox('更新失败', '未找到下载地址，请手动下载更新')
    return false
  }

  if (isDownloading) {
    console.log('[Updater] 已在下载中')
    return false
  }

  isDownloading = true

  // 确定下载文件名和路径
  const fileName = path.basename(new URL(downloadUrl).pathname) || 'ASG-Director-Setup.exe'
  const downloadPath = path.join(app.getPath('temp'), fileName)

  // 创建进度窗口
  const progressWindow = createProgressWindow(parentWindow)

  try {
    // 下载文件
    await downloadFile(downloadUrl, downloadPath, {
      onProgress: (progress, downloaded, total) => {
        updateProgressWindow(progressWindow, progress, downloaded, total)
      },
      maxRetries: 3,
      resumable: true
    })

    // 验证校验和（如果提供）
    if (options.checksum) {
      updateProgressWindow(progressWindow, 100, 0, 0, '正在验证文件...')
      const valid = await verifyChecksum(downloadPath, options.checksum)
      if (!valid) {
        throw new Error('文件校验失败，请重新下载')
      }
    }

    // 关闭进度窗口
    closeProgressWindow(progressWindow)

    // 下载完成，询问是否立即安装
    const installNow = await dialog.showMessageBox(parentWindow, {
      type: 'question',
      title: '下载完成',
      message: '更新已下载完成',
      detail: '是否立即安装更新？安装过程中程序将关闭。',
      buttons: ['立即安装', '稍后安装'],
      defaultId: 0
    })

    if (installNow.response === 0) {
      // 打开安装包
      shell.openPath(downloadPath)

      // 延迟退出
      setTimeout(() => {
        app.quit()
      }, 500)
    }

    return true
  } catch (error) {
    console.error('[Updater] 下载失败:', error)
    closeProgressWindow(progressWindow)

    // 提供备用下载选项
    const result = await dialog.showMessageBox(parentWindow, {
      type: 'error',
      title: '下载失败',
      message: '自动下载更新失败',
      detail: `错误: ${error.message}\n\n您可以选择在浏览器中下载，或稍后重试。`,
      buttons: ['在浏览器中下载', '重试', '取消'],
      defaultId: 0
    })

    if (result.response === 0) {
      shell.openExternal(downloadUrl)
    } else if (result.response === 1) {
      // 重试
      return startDownloadWithProgress(downloadUrl, parentWindow, options)
    }

    return false
  } finally {
    isDownloading = false
  }
}

/**
 * 创建进度窗口
 */
function createProgressWindow(parentWindow) {
  const progressWindow = new BrowserWindow({
    parent: parentWindow,
    modal: true,
    width: 480,
    height: 200,
    show: false,
    frame: false,
    resizable: false,
    transparent: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Microsoft YaHei', 'Segoe UI', sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            overflow: hidden;
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .container {
            width: 100%;
            padding: 32px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            animation: slideIn 0.3s ease-out;
          }
          @keyframes slideIn {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          h3 { 
            color: #fff; 
            text-align: center;
            font-size: 18px;
            font-weight: 500;
            margin-bottom: 24px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .progress-container { 
            width: 100%; 
            height: 8px; 
            background: rgba(255,255,255,0.3); 
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 12px;
          }
          .progress-bar { 
            height: 100%; 
            background: #fff;
            width: 0%; 
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
          }
          .progress-bar::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
            animation: shimmer 1.5s infinite;
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .progress-text { 
            color: rgba(255,255,255,0.95);
            font-size: 13px;
            text-align: center;
            font-weight: 500;
          }
          .speed-text {
            color: rgba(255,255,255,0.7);
            font-size: 12px;
            text-align: center;
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h3 id="title">正在下载更新</h3>
          <div class="progress-container">
            <div class="progress-bar" id="progressBar"></div>
          </div>
          <div class="progress-text" id="progressText">准备下载...</div>
          <div class="speed-text" id="speedText"></div>
        </div>
      </body>
    </html>
  `

  progressWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  progressWindow.once('ready-to-show', () => {
    progressWindow.show()
  })

  return progressWindow
}

/**
 * 更新进度窗口
 */
function updateProgressWindow(progressWindow, progress, downloaded, total, statusText = null) {
  if (!progressWindow || progressWindow.isDestroyed()) return

  const mb = (size) => (size / 1024 / 1024).toFixed(2)
  const text = statusText || `${progress}% (${mb(downloaded)}MB / ${mb(total)}MB)`

  progressWindow.webContents.executeJavaScript(`
    document.getElementById('progressBar').style.width = '${progress}%';
    document.getElementById('progressText').textContent = '${text}';
  `).catch(() => { })
}

/**
 * 关闭进度窗口
 */
function closeProgressWindow(progressWindow) {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.close()
  }
}

/**
 * 验证文件校验和
 * @param {string} filePath - 文件路径
 * @param {string} expectedChecksum - 期望的校验和 (格式: algorithm:hash)
 * @returns {Promise<boolean>}
 */
async function verifyChecksum(filePath, expectedChecksum) {
  return new Promise((resolve) => {
    try {
      // 解析校验和格式 (如 "sha256:abc123...")
      const [algorithm, expected] = expectedChecksum.includes(':')
        ? expectedChecksum.split(':')
        : ['sha256', expectedChecksum]

      const hash = crypto.createHash(algorithm)
      const stream = fs.createReadStream(filePath)

      stream.on('data', (data) => hash.update(data))
      stream.on('end', () => {
        const actual = hash.digest('hex')
        const valid = actual.toLowerCase() === expected.toLowerCase()

        if (!valid) {
          console.error(`[Updater] 校验失败: 期望 ${expected}, 实际 ${actual}`)
        }

        resolve(valid)
      })
      stream.on('error', () => resolve(false))
    } catch (e) {
      console.error('[Updater] 校验失败:', e.message)
      resolve(false)
    }
  })
}

/**
 * 启动时检查更新并处理
 * @param {BrowserWindow} mainWindow - 主窗口
 */
async function checkAndPromptUpdate(mainWindow) {
  try {
    const result = await checkForUpdate()

    if (result.hasUpdate) {
      // 检查是否跳过了这个版本（非强制更新时）
      if (!result.forceUpdate && isVersionSkipped(result.latestVersion)) {
        console.log('[Updater] 用户已跳过此版本:', result.latestVersion)
        return
      }

      // 延迟一小会，确保窗口已经完全显示
      await new Promise(resolve => setTimeout(resolve, 500))
      await showUpdateDialog(mainWindow)
    }
  } catch (error) {
    console.error('[Updater] 更新检查错误:', error)
  }
}

/**
 * 手动检查更新
 * @param {BrowserWindow} parentWindow - 父窗口
 */
async function manualCheckUpdate(parentWindow) {
  // 清除跳过的版本记录
  try {
    const configPath = path.join(app.getPath('userData'), 'update-config.json')
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      delete config.skippedVersion
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    }
  } catch (e) {
    // 忽略
  }

  const result = await checkForUpdate()

  if (result.error) {
    dialog.showErrorBox('检查更新失败', result.error)
    return
  }

  if (result.hasUpdate) {
    await showUpdateDialog(parentWindow)
  } else {
    dialog.showMessageBox(parentWindow, {
      type: 'info',
      title: '检查更新',
      message: '您使用的是最新版本',
      detail: `当前版本: ${CURRENT_VERSION}`
    })
  }
}

/**
 * 获取当前版本
 */
function getCurrentVersion() {
  return CURRENT_VERSION
}

/**
 * 获取更新信息
 */
function getUpdateInfo() {
  return updateInfo
}

module.exports = {
  checkForUpdate,
  showUpdateDialog,
  checkAndPromptUpdate,
  manualCheckUpdate,
  getCurrentVersion,
  getUpdateInfo,
  compareVersions,
  APP_NAME
}
