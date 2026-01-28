/**
 * ASG.Director 插件系统引导模块
 * 
 * 用于在主进程中初始化插件系统
 * 
 * @author ASG Team
 * @version 1.0.0
 */

const { initializePluginSystem, shutdownPluginSystem, pluginManager, pluginAPI, eventBus, AppEvents } = require('./core')
const { ipcMain, BrowserWindow } = require('electron')

/**
 * 引导插件系统
 * 在 app.whenReady() 后调用
 * 
 * @param {Object} options - 选项
 * @param {BrowserWindow} options.mainWindow - 主窗口
 */
let _readyResolver
const readyPromise = new Promise(resolve => {
  _readyResolver = resolve
})

async function bootstrapPluginSystem(options = {}) {
  const { app, mainWindow } = options
  
  console.log('[PluginBootstrap] 开始引导插件系统...')
  
  try {
    // 初始化插件系统
    await initializePluginSystem({
      app,
      mainWindow
    })
    
    // 设置 IPC 处理器
    setupPluginIPCHandlers()
    
    console.log('[PluginBootstrap] 插件系统引导完成')
    _readyResolver(true)
    
    return true
  } catch (error) {
    console.error('[PluginBootstrap] 插件系统引导失败:', error)
    _readyResolver(false) // 即使失败也要 resolve，避免永久等待
    return false
  }
}

/**
 * 设置插件相关的 IPC 处理器
 */
function setupPluginIPCHandlers() {
  // 获取所有插件列表（包括禁用的）
  ipcMain.handle('plugins:get-all', async () => {
    const plugins = await pluginManager.getAllPluginsIncludingDisabled()
    return plugins.map(p => ({
      id: p.id,
      name: p.manifest.displayName || p.manifest.name,
      description: p.manifest.description,
      version: p.manifest.version,
      author: p.manifest.author,
      state: p.state,
      error: p.error
    }))
  })
  
  // 获取插件详情
  ipcMain.handle('plugins:get-detail', (event, pluginId) => {
    const plugin = pluginManager.getPlugin(pluginId)
    if (!plugin) return null
    
    return {
      id: plugin.id,
      manifest: plugin.manifest,
      state: plugin.state,
      activationTime: plugin.activationTime,
      error: plugin.error
    }
  })
  
  // 启用插件
  ipcMain.handle('plugins:enable', async (event, pluginId) => {
    pluginManager.enablePlugin(pluginId)
    
    // 尝试加载和激活
    const manifests = await pluginManager.discoverPlugins()
    const manifest = manifests.find(m => m.name === pluginId)
    
    if (manifest) {
      await pluginManager.loadPlugin(manifest)
      await pluginManager.activatePlugin(pluginId)
    }
    
    return { success: true }
  })
  
  // 禁用插件
  ipcMain.handle('plugins:disable', async (event, pluginId) => {
    await pluginManager.deactivatePlugin(pluginId)
    pluginManager.disablePlugin(pluginId)
    
    // 清理该插件注册的所有组件
    pluginAPI.components.unregisterPluginComponents(pluginId)
    
    // 通知所有窗口刷新插件组件
    const { BrowserWindow } = require('electron')
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('plugin:components-changed')
    })
    
    return { success: true }
  })
  
  // 重新加载插件
  ipcMain.handle('plugins:reload', async (event, pluginId) => {
    const success = await pluginManager.reloadPlugin(pluginId)
    return { success }
  })
  
  // 获取插件设置
  ipcMain.handle('plugins:get-settings', (event, pluginId) => {
    return pluginManager.getPluginSettings(pluginId)
  })
  
  // 更新插件设置
  ipcMain.handle('plugins:update-settings', (event, pluginId, settings) => {
    pluginManager.updatePluginSettings(pluginId, settings)
    return { success: true }
  })
  
  // 获取所有命令
  ipcMain.handle('plugins:get-commands', () => {
    return pluginAPI.commands.getCommands()
  })
  
  // 执行命令
  ipcMain.handle('plugins:execute-command', async (event, commandId, ...args) => {
    try {
      const result = await pluginAPI.commands.executeCommand(commandId, ...args)
      return { success: true, result }
    } catch (error) {
      return { success: false, error: error.message }
    }
  })
}

/**
 * 设置窗口引用
 * @param {string} name - 窗口名称
 * @param {BrowserWindow} window - 窗口实例
 */
function setPluginWindow(name, window) {
  pluginAPI.setWindow(name, window)
  
  if (window) {
    eventBus.publish(AppEvents.WINDOW_CREATED, { windowId: name })
    
    window.on('closed', () => {
      pluginAPI.setWindow(name, null)
      eventBus.publish(AppEvents.WINDOW_CLOSED, { windowId: name })
    })
    
    window.on('focus', () => {
      eventBus.publish(AppEvents.WINDOW_FOCUSED, { windowId: name })
    })
  }
}

/**
 * 设置房间数据
 * @param {Object} data - 房间数据
 */
function setPluginRoomData(data) {
  pluginAPI.setRoomData(data)
}

/**
 * 关闭插件系统
 */
async function shutdownPlugins() {
  await shutdownPluginSystem()
}

module.exports = {
  bootstrapPluginSystem,
  waitPluginSystemReady: () => readyPromise,
  setPluginWindow,
  setPluginRoomData,
  shutdownPlugins,
  pluginManager,
  pluginAPI,
  eventBus
}
