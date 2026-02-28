/**
 * OBS 自动化规则编辑器 - Preload 脚本
 * 在渲染进程中暴露安全的 API
 */

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('obsAPI', {
  // 配置相关
  getConfig: () => ipcRenderer.invoke('obs-automation:get-config'),
  saveConfig: (config) => ipcRenderer.invoke('obs-automation:save-config', config),
  
  // 连接相关
  connect: (config) => ipcRenderer.invoke('obs-automation:connect', config),
  disconnect: () => ipcRenderer.invoke('obs-automation:disconnect'),
  getStatus: () => ipcRenderer.invoke('obs-automation:get-status'),
  
  // 规则相关
  getRules: () => ipcRenderer.invoke('obs-automation:get-rules'),
  saveRules: (rules) => ipcRenderer.invoke('obs-automation:save-rules', rules),
  testRule: (rule) => ipcRenderer.invoke('obs-automation:test-rule', rule),
  getSidebarManualRules: (options) => ipcRenderer.invoke('obs-automation:get-sidebar-manual-rules', options || {}),
  triggerSidebarManualRule: (payload) => ipcRenderer.invoke('obs-automation:trigger-sidebar-manual-rule', payload || {}),
  getMusicConfig: () => ipcRenderer.invoke('obs-automation:get-music-config'),
  saveMusicConfig: (config) => ipcRenderer.invoke('obs-automation:save-music-config', config || {}),
  switchSong: (options) => ipcRenderer.invoke('obs-automation:switch-song', options || {}),
  
  // 场景控制
  switchScene: (sceneName) => ipcRenderer.invoke('obs-automation:switch-scene', sceneName),

  // 教程
  openTutorial: () => ipcRenderer.invoke('obs-automation:open-tutorial'),
  
  // 状态监听
  onStatus: (callback) => {
    ipcRenderer.on('obs-status', (event, data) => callback(data))
  }
})
