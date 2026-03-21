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

  let discoveredDevices = []
  let discoveryBusy = false

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
    renderDiscoveryList(next.remoteHost || '', next.remotePort || DEFAULTS.remotePort)
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
      `目标: ${status?.remoteHost ? `${status.remoteHost}:${status.remotePort || DEFAULTS.remotePort}` : '未选择'}`,
      `入站: ${inboundConnections}`,
      `自动重连: ${status?.autoConnect === false ? 'OFF' : 'ON'}`
    ]
    if (status?.lastError) parts.push(`错误: ${status.lastError}`)
    statusMeta.textContent = parts.join(' | ')
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => {
      const table = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }
      return table[char] || char
    })
  }

  function renderDiscoveryList(selectedHost, selectedPort) {
    const list = $id('directorSyncDiscoveryList')
    const hint = $id('directorSyncDiscoveryHint')
    if (!list || !hint) return

    const host = String(selectedHost || '').trim()
    const port = normalizePort(selectedPort, DEFAULTS.remotePort)

    if (discoveryBusy) {
      hint.textContent = '正在扫描局域网内的 ASG.Director 设备...'
    } else if (discoveredDevices.length > 0) {
      hint.textContent = `发现 ${discoveredDevices.length} 台可连接设备。`
    } else {
      hint.textContent = '暂未发现设备。请确认对方已开启“主端（被连接端）”，且处于同一局域网。'
    }

    if (discoveredDevices.length === 0) {
      list.innerHTML = `
        <div style="padding:10px 12px; border:1px dashed var(--border-color); border-radius:8px; font-size:12px; color:var(--text-secondary);">
          ${discoveryBusy ? '扫描中...' : '暂无设备'}
        </div>
      `
      return
    }

    list.innerHTML = discoveredDevices.map((device) => {
      const deviceHost = String(device.address || '').trim()
      const devicePort = normalizePort(device.remotePort, DEFAULTS.remotePort)
      const isSelected = host && host === deviceHost && port === devicePort
      const addresses = Array.isArray(device.addresses) ? device.addresses.filter(Boolean) : []
      const subline = addresses.length > 1 ? `可达地址：${addresses.join(' / ')}` : `${deviceHost}:${devicePort}`
      return `
        <button
          type="button"
          class="btn btn-ghost"
          data-role="director-sync-device"
          data-host="${escapeHtml(deviceHost)}"
          data-port="${escapeHtml(String(devicePort))}"
          style="text-align:left; justify-content:flex-start; padding:10px 12px; border:${isSelected ? '1px solid rgba(129,199,132,0.9)' : '1px solid var(--border-color)'}; background:${isSelected ? 'rgba(129,199,132,0.12)' : 'rgba(255,255,255,0.02)'};"
        >
          <div style="display:flex; flex-direction:column; align-items:flex-start; gap:4px;">
            <div style="font-size:13px; font-weight:600;">${escapeHtml(device.displayName || device.hostname || deviceHost)}</div>
            <div style="font-size:12px; color:var(--text-secondary);">${escapeHtml(subline)}</div>
          </div>
        </button>
      `
    }).join('')

    Array.from(list.querySelectorAll('[data-role="director-sync-device"]')).forEach((button) => {
      button.addEventListener('click', () => {
        const remoteHost = $id('directorSyncRemoteHost')
        const remotePort = $id('directorSyncRemotePort')
        if (remoteHost) remoteHost.value = button.dataset.host || ''
        if (remotePort) remotePort.value = button.dataset.port || String(DEFAULTS.remotePort)
        renderDiscoveryList(button.dataset.host || '', button.dataset.port || DEFAULTS.remotePort)
        toast(`已选择设备 ${button.dataset.host}:${button.dataset.port}`, 'info')
      })
    })
  }

  async function refreshDirectorSyncDiscovery() {
    if (!hasApi() || !window.electronAPI.directorSyncDiscover) return
    if (discoveryBusy) return

    discoveryBusy = true
    renderDiscoveryList(
      $id('directorSyncRemoteHost') ? $id('directorSyncRemoteHost').value : '',
      $id('directorSyncRemotePort') ? $id('directorSyncRemotePort').value : DEFAULTS.remotePort
    )

    try {
      const result = await window.electronAPI.directorSyncDiscover()
      if (!result || !result.success) {
        discoveredDevices = []
        renderDiscoveryList(
          $id('directorSyncRemoteHost') ? $id('directorSyncRemoteHost').value : '',
          $id('directorSyncRemotePort') ? $id('directorSyncRemotePort').value : DEFAULTS.remotePort
        )
        toast(result?.message || '局域网扫描失败', 'error')
        return
      }

      discoveredDevices = Array.isArray(result.devices) ? result.devices : []
      renderDiscoveryList(
        $id('directorSyncRemoteHost') ? $id('directorSyncRemoteHost').value : '',
        $id('directorSyncRemotePort') ? $id('directorSyncRemotePort').value : DEFAULTS.remotePort
      )
    } catch (e) {
      discoveredDevices = []
      renderDiscoveryList(
        $id('directorSyncRemoteHost') ? $id('directorSyncRemoteHost').value : '',
        $id('directorSyncRemotePort') ? $id('directorSyncRemotePort').value : DEFAULTS.remotePort
      )
      toast(e && e.message ? e.message : '局域网扫描失败', 'error')
    } finally {
      discoveryBusy = false
      renderDiscoveryList(
        $id('directorSyncRemoteHost') ? $id('directorSyncRemoteHost').value : '',
        $id('directorSyncRemotePort') ? $id('directorSyncRemotePort').value : DEFAULTS.remotePort
      )
    }
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
    renderDiscoveryList('', DEFAULTS.remotePort)
    refreshDirectorSyncDiscovery().catch((e) => {
      console.warn('[DirectorSync] discovery failed:', e)
    })

    const remoteHost = $id('directorSyncRemoteHost')
    const remotePort = $id('directorSyncRemotePort')
    const syncSelection = () => {
      renderDiscoveryList(
        remoteHost ? remoteHost.value : '',
        remotePort ? remotePort.value : DEFAULTS.remotePort
      )
    }
    if (remoteHost) remoteHost.addEventListener('input', syncSelection)
    if (remotePort) remotePort.addEventListener('input', syncSelection)

    if (window.electronAPI.onDirectorSyncStatus) {
      window.electronAPI.onDirectorSyncStatus((status) => {
        renderStatus(status || {})
      })
    }
  }

  window.directorSyncApplySettings = directorSyncApplySettings
  window.refreshDirectorSyncDiscovery = refreshDirectorSyncDiscovery
  window.directorSyncReconnectNow = directorSyncReconnectNow
  window.directorSyncDisconnectNow = directorSyncDisconnectNow
  window.refreshDirectorSyncStatus = refreshDirectorSyncStatus

  window.addEventListener('DOMContentLoaded', initDirectorSyncSettingsCard)
})()
