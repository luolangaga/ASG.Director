/**
 * ASG.Director 插件系统集成示例
 * 
 * 本文件展示如何将插件系统集成到 main.js 中
 * 请参考此文件修改你的 main.js
 * 
 * @author ASG Team
 * @version 1.0.0
 */

// ==================== 1. 导入插件系统 ====================

// 在 main.js 顶部添加导入
const { 
  bootstrapPluginSystem, 
  setPluginWindow, 
  setPluginRoomData,
  shutdownPlugins,
  eventBus,
  RoomEvents,
  LayoutEvents 
} = require('./plugins/bootstrap')

// ==================== 2. 在 app.whenReady() 中初始化 ====================

/*
app.whenReady().then(async () => {
  ensureDirectories()
  packManager.ensureDirectories()
  loadAuthState()
  createMainWindow()
  
  // 👇 添加这行：初始化插件系统
  await bootstrapPluginSystem({ mainWindow })
  
  // 延迟检查更新
  setTimeout(async () => {
    try {
      await updater.checkAndPromptUpdate(mainWindow)
    } catch (e) {
      console.error('[App] 检查更新失败:', e.message)
    }
  }, 2000)
})
*/

// ==================== 3. 在创建窗口后注册窗口 ====================

/*
// 在 createFrontendWindow 函数末尾添加：
function createFrontendWindow(roomData) {
  // ... 现有代码 ...
  
  // 👇 添加这行
  setPluginWindow('frontend', frontendWindow)
}

// 在 createBackendWindow 函数末尾添加：
function createBackendWindow(roomData) {
  // ... 现有代码 ...
  
  // 👇 添加这行
  setPluginWindow('backend', backendWindow)
}

// 类似地，为其他窗口添加：
// setPluginWindow('main', mainWindow)
// setPluginWindow('scoreboard-a', scoreboardWindowA)
// setPluginWindow('scoreboard-b', scoreboardWindowB)
// setPluginWindow('postmatch', postMatchWindow)
*/

// ==================== 4. 发布房间数据事件 ====================

/*
// 当房间数据更新时，调用：
function onRoomDataReceived(roomData) {
  setPluginRoomData(roomData)
  
  // 或者直接发布事件
  eventBus.publish(RoomEvents.UPDATED, { roomId: roomData.roomId, data: roomData })
}
*/

// ==================== 5. 在应用退出时清理 ====================

/*
app.on('before-quit', async () => {
  await shutdownPlugins()
})
*/

// ==================== 6. preload.js 集成 ====================

/*
// 在 preload.js 中添加：

const { pluginRendererAPI } = require('./plugins/renderer')

contextBridge.exposeInMainWorld('plugins', pluginRendererAPI)

// 然后在渲染进程中可以这样使用：
// const plugins = await window.plugins.getAllPlugins()
// await window.plugins.executeCommand('helloWorld.sayHello')
*/

// ==================== 完整的 main.js 修改示例 ====================

console.log(`
========================================
  ASG.Director 插件系统集成指南
========================================

要将插件系统集成到 main.js 中，请按以下步骤操作：

1. 在文件顶部导入插件系统模块
2. 在 app.whenReady() 中调用 bootstrapPluginSystem()
3. 在创建窗口后调用 setPluginWindow() 注册窗口
4. 在房间数据更新时调用 setPluginRoomData()
5. 在应用退出时调用 shutdownPlugins()

详细代码请查看本文件中的注释。
========================================
`)

module.exports = {
  // 导出供参考
  exampleUsage: true
}
