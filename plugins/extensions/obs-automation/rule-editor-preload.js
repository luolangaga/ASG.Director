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
  
  // 场景控制
  switchScene: (sceneName) => ipcRenderer.invoke('obs-automation:switch-scene', sceneName),
  
  // 状态监听
  onStatus: (callback) => {
    ipcRenderer.on('obs-status', (event, data) => callback(data))
  }
})
