/**
 * OBS 自动化插件 - 测试版本
 * 用于调试和验证基本功能
 */

const OBSWebSocket = require('./OBSWebSocket')

async function activate(context) {
  const { api, log, globalState, subscriptions, extensionPath } = context
  
  log('🎬 [测试] OBS 自动化插件正在激活...')
  log(`📂 [测试] 插件路径: ${extensionPath || __dirname}`)
  log(`📂 [测试] __dirname: ${__dirname}`)
  
  // 检查 context 的所有属性
  log(`[测试] Context keys: ${Object.keys(context).join(', ')}`)
  
  // 检查 API 可用性
  if (api) {
    log(`[测试] API keys: ${Object.keys(api).join(', ')}`)
    log(`✓ [测试] commands: ${!!api.commands}`)
    log(`✓ [测试] events: ${!!api.events}`)
    log(`✓ [测试] components: ${!!api.components}`)
    log(`✓ [测试] notifications: ${!!api.notifications}`)
  } else {
    log('❌ [测试] API 未定义')
  }
  
  // 测试简单命令注册
  try {
    const cmd = api.commands.registerCommand('obsAutomation.test', () => {
      log('✅ [测试] 测试命令执行成功')
    })
    subscriptions.push(cmd)
    log('✅ [测试] 命令注册成功')
  } catch (e) {
    log(`❌ [测试] 命令注册失败: ${e.message}`)
    log(`   Stack: ${e.stack}`)
  }
  
  // 测试 OBS WebSocket
  try {
    const obs = new OBSWebSocket()
    log('✅ [测试] OBS WebSocket 实例创建成功')
  } catch (e) {
    log(`❌ [测试] OBS WebSocket 创建失败: ${e.message}`)
  }
  
  log('✅ [测试] 插件激活完成')
  
  return {
    test: () => 'OBS Automation Test OK'
  }
}

function deactivate() {
  console.log('[测试] 插件已停用')
}

module.exports = { activate, deactivate }
