(function () {
  const DEFAULTS = Object.freeze({
    enabled: false,
    serverEnabled: false,
    clientEnabled: false,
    listenPort: 19625,
    remoteHost: '',
    remotePort: 19625,
    autoConnect: true
  })

  function $id(id) {
    return document.getElementById(id)
  }

  function hasApi() {
    return !!(window.electronAPI && window.electronAPI.directorSyncGetSettings)
  }

  function toast(message, type) {
    if (typeof window.showStatus === 'function') {
      window.showStatus(message, type || 'info')
      return
    }
    console.log('[DirectorSync]', message)
  }

  function normalizePort(value, fallback) {
    const n = parseInt(value, 10)
    if (!Number.isFinite(n) || n < 1024 || n > 65535) return fallback
    return n
  }

  function applySettingsToUI(settings) {
    const next = settings && typeof settings === 'object' ? settings : DEFAULTS
    const serverEnabled = $id('directorSyncServerEnabled')
    const clientEnabled = $id('directorSyncClientEnabled')
    const listenPort = $id('directorSyncListenPort')
    const remoteHost = $id('directorSyncRemoteHost')
    const remotePort = $id('directorSyncRemotePort')
    const autoConnect = $id('directorSyncAutoConnect')

    if (serverEnabled) serverEnabled.checked = !!next.serverEnabled
    if (clientEnabled) clientEnabled.checked = !!next.clientEnabled
    if (listenPort) listenPort.value = String(next.listenPort || DEFAULTS.listenPort)
    if (remoteHost) remoteHost.value = next.remoteHost || ''
    if (remotePort) remotePort.value = String(next.remotePort || DEFAULTS.remotePort)
    if (autoConnect) autoConnect.checked = next.autoConnect !== false
  }

  function collectSettingsFromUI() {
    const serverEnabled = !!($id('directorSyncServerEnabled') && $id('directorSyncServerEnabled').checked)
    const clientEnabled = !!($id('directorSyncClientEnabled') && $id('directorSyncClientEnabled').checked)
    return {
      enabled: serverEnabled || clientEnabled,
      serverEnabled,
      clientEnabled,
      listenPort: normalizePort($id('directorSyncListenPort') ? $id('directorSyncListenPort').value : DEFAULTS.listenPort, DEFAULTS.listenPort),
      remoteHost: $id('directorSyncRemoteHost') ? String($id('directorSyncRemoteHost').value || '').trim() : '',
      remotePort: normalizePort($id('directorSyncRemotePort') ? $id('directorSyncRemotePort').value : DEFAULTS.remotePort, DEFAULTS.remotePort),
      autoConnect: !!($id('directorSyncAutoConnect') && $id('directorSyncAutoConnect').checked)
    }
  }

  function renderStatus(status) {
    const statusText = $id('directorSyncStatusText')
    const statusMeta = $id('directorSyncStatusMeta')
    if (!statusText || !statusMeta) return

    const listening = !!status?.listening
    const outboundConnected = !!status?.outboundConnected
    const inboundConnections = Number(status?.inboundConnections || 0)
    const serverEnabled = !!status?.serverEnabled
    const clientEnabled = !!status?.clientEnabled
    const enabled = !!status?.enabled

    let label = '已关闭'
    if (enabled) {
      const hasAnyConnection = outboundConnected || inboundConnections > 0
      if (hasAnyConnection) label = '已连接'
      else if ((serverEnabled && listening) || clientEnabled) label = '等待连接'
      else label = '启动中'
    }

    statusText.textContent = label
    statusText.style.color = enabled
      ? ((outboundConnected || inboundConnections > 0) ? '#81c784' : '#ffd54f')
      : '#9aa4b2'

    const parts = [
      `主端: ${serverEnabled ? (listening ? '监听中' : '未监听') : '已关闭'}`,
      `连接端: ${clientEnabled ? (outboundConnected ? '已连接' : '未连接') : '已关闭'}`,
      `入站: ${inboundConnections}`,
      `自动重连: ${status?.autoConnect === false ? 'OFF' : 'ON'}`
    ]
    if (status?.lastError) parts.push(`错误: ${status.lastError}`)
    statusMeta.textContent = parts.join(' | ')
  }

  async function loadDirectorSyncSettings() {
    if (!hasApi()) return
    const result = await window.electronAPI.directorSyncGetSettings()
    if (!result || !result.success) return
    applySettingsToUI(result.settings || DEFAULTS)
    renderStatus(result.status || {})
  }

  async function directorSyncApplySettings() {
    if (!hasApi()) {
      toast('当前版本不支持跨导播同步', 'error')
      return
    }
    const patch = collectSettingsFromUI()
    const result = await window.electronAPI.directorSyncSetSettings(patch)
    if (!result || !result.success) {
      toast('保存失败', 'error')
      return
    }
    applySettingsToUI(result.settings || DEFAULTS)
    renderStatus(result.status || {})
    toast('✅ 跨导播同步设置已保存', 'success')
  }

  async function directorSyncReconnectNow() {
    if (!hasApi()) return
    const result = await window.electronAPI.directorSyncReconnect()
    if (result && result.success) {
      renderStatus(result.status || {})
      toast('已发起连接请求', 'info')
    }
  }

  async function directorSyncDisconnectNow() {
    if (!hasApi()) return
    const result = await window.electronAPI.directorSyncDisconnect()
    if (result && result.success) {
      renderStatus(result.status || {})
      toast('已断开主动连接', 'info')
    }
  }

  async function refreshDirectorSyncStatus() {
    if (!hasApi()) return
    const result = await window.electronAPI.directorSyncGetStatus()
    if (result && result.success) renderStatus(result.status || {})
  }

  function initDirectorSyncSettingsCard() {
    const root = $id('directorSyncCard')
    if (!root) return

    if (!hasApi()) {
      const statusText = $id('directorSyncStatusText')
      const statusMeta = $id('directorSyncStatusMeta')
      if (statusText) statusText.textContent = '不可用'
      if (statusMeta) statusMeta.textContent = '当前版本不支持跨导播同步'
      return
    }

    loadDirectorSyncSettings().catch((e) => {
      console.warn('[DirectorSync] load settings failed:', e)
    })

    if (window.electronAPI.onDirectorSyncStatus) {
      window.electronAPI.onDirectorSyncStatus((status) => {
        renderStatus(status || {})
      })
    }
  }

  window.directorSyncApplySettings = directorSyncApplySettings
  window.directorSyncReconnectNow = directorSyncReconnectNow
  window.directorSyncDisconnectNow = directorSyncDisconnectNow
  window.refreshDirectorSyncStatus = refreshDirectorSyncStatus

  window.addEventListener('DOMContentLoaded', initDirectorSyncSettingsCard)
})()
