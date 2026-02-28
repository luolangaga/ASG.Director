function switchView(viewId) {
  document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('view-' + viewId);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const nav = document.getElementById('nav-' + viewId);
  if (nav) nav.classList.add('active');

  // Clear plugin menu highlights
  document.querySelectorAll('.plugin-menu-item').forEach(el => el.classList.remove('active'));

  const main = document.getElementById('mainContainer');
  const plugs = document.getElementById('pluginPagesContainer');
  if (main) main.classList.remove('hidden');
  if (plugs) {
    plugs.querySelectorAll('.plugin-page-container').forEach(p => p.classList.remove('active'));
  }
}

function switchSettingTab(tabId, e) {
  document.querySelectorAll('[id^="setting-tab-"]').forEach(el => el.style.display = 'none');
  document.getElementById('setting-tab-' + tabId).style.display = 'block';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  if (e && e.target) e.target.classList.add('active');
}

// ============================================================
// Layout & Settings Logic
// ============================================================

let currentLayout = null;

// Initialize
window.addEventListener('DOMContentLoaded', async () => {
  try {
    if (window.electronAPI && window.electronAPI.loadLayout) {
      const res = await window.electronAPI.loadLayout();
      if (res && res.success && res.layout) {
        currentLayout = res.layout;
        loadModel3dSettings();
      }
    }
    if (window.electronAPI && window.electronAPI.localPagesGetPages) {
      initLocalPagesWidget();
    }
    if (window.electronAPI && window.electronAPI.localBpAutoOpenGet) {
      loadLocalBpAutoOpenSettings();
    }
  } catch (e) {
    console.error('Failed to load layout:', e);
  }
});

function loadModel3dSettings() {
  if (!currentLayout || !currentLayout.model3d) return;
  const m = currentLayout.model3d;

  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  setCheck('enable3dModels', m.enabled);
  setCheck('useOfficialModels', m.useOfficialModels);

  setVal('survivorModelDir', m.survivorModelDir);
  setVal('hunterModelDir', m.hunterModelDir);
  setVal('survivorMotionDir', m.survivorMotionDir);
  setVal('hunterMotionDir', m.hunterMotionDir);

  setVal('render3dAntialias', String(m.antialias));
  setVal('render3dPixelRatio', m.pixelRatio);
  setVal('model3dTargetFPS', m.targetFPS);
  setVal('render3dShadowQuality', m.shadowQuality);

  setCheck('render3dEnableToon', m.enableToon);
  setCheck('render3dEnableOutline', m.enableOutline);
}

async function applyModel3dSettings(save = true) {
  if (!currentLayout) currentLayout = {};
  if (!currentLayout.model3d) currentLayout.model3d = {};

  const m = currentLayout.model3d;
  const getCheck = (id) => {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  };
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };

  m.enabled = getCheck('enable3dModels');
  m.useOfficialModels = getCheck('useOfficialModels');
  m.survivorModelDir = getVal('survivorModelDir');
  m.hunterModelDir = getVal('hunterModelDir');
  m.survivorMotionDir = getVal('survivorMotionDir');
  m.hunterMotionDir = getVal('hunterMotionDir');

  m.antialias = getVal('render3dAntialias') === 'true';
  m.pixelRatio = parseFloat(getVal('render3dPixelRatio')) || 1;
  m.targetFPS = parseInt(getVal('model3dTargetFPS')) || 30;
  m.shadowQuality = parseInt(getVal('render3dShadowQuality')) || 1024;

  m.enableToon = getCheck('render3dEnableToon');
  m.enableOutline = getCheck('render3dEnableOutline');

  if (save && window.electronAPI && window.electronAPI.saveLayout) {
    try {
      await window.electronAPI.saveLayout(currentLayout);
      if (typeof showStatus === 'function') showStatus('3D设置已保存', 'success');

      // If official models enabled, trigger download check
      if (m.useOfficialModels && window.electronAPI.prepareOfficialModels) {
        window.electronAPI.prepareOfficialModels();
      }
    } catch (e) {
      console.error('Failed to save layout', e);
      if (typeof showStatus === 'function') showStatus('保存失败', 'error');
    }
  }
}

async function pickFolderFor(elementId) {
  if (!window.electronAPI || !window.electronAPI.selectFolder) return;
  try {
    const result = await window.electronAPI.selectFolder();
    // Support both raw electron dialog return and wrapped return
    const path = result.filePaths ? result.filePaths[0] : (result.path || result);
    if (path && typeof path === 'string') {
      const el = document.getElementById(elementId);
      if (el) el.value = path;
    }
  } catch (e) {
    console.error('Pick folder failed:', e);
  }
}

let localPagesBaseUrl = ''

async function initLocalPagesWidget() {
  await refreshLocalPagesStatus()
  await refreshLocalPagesList()
}

let localBpAutoOpenSettings = null

function setLocalBpAutoOpenCheckbox(id, value) {
  const el = document.getElementById(id)
  if (el) el.checked = !!value
}

function getLocalBpAutoOpenCheckbox(id) {
  const el = document.getElementById(id)
  return el ? el.checked : false
}

function applyLocalBpAutoOpenSettings(settings) {
  if (!settings || typeof settings !== 'object') return
  setLocalBpAutoOpenCheckbox('localBpAutoOpenFrontend', settings.frontend)
  setLocalBpAutoOpenCheckbox('localBpAutoOpenConsole', settings.localBp)
  setLocalBpAutoOpenCheckbox('localBpAutoOpenCharacterDisplay', settings.characterDisplay)
  setLocalBpAutoOpenCheckbox('localBpAutoOpenScoreboardA', settings.scoreboardA)
  setLocalBpAutoOpenCheckbox('localBpAutoOpenScoreboardB', settings.scoreboardB)
  setLocalBpAutoOpenCheckbox('localBpAutoOpenScoreboardOverview', settings.scoreboardOverview)
  setLocalBpAutoOpenCheckbox('localBpAutoOpenPostMatch', settings.postMatch)
}

function collectLocalBpAutoOpenSettings() {
  return {
    frontend: getLocalBpAutoOpenCheckbox('localBpAutoOpenFrontend'),
    localBp: getLocalBpAutoOpenCheckbox('localBpAutoOpenConsole'),
    characterDisplay: getLocalBpAutoOpenCheckbox('localBpAutoOpenCharacterDisplay'),
    scoreboardA: getLocalBpAutoOpenCheckbox('localBpAutoOpenScoreboardA'),
    scoreboardB: getLocalBpAutoOpenCheckbox('localBpAutoOpenScoreboardB'),
    scoreboardOverview: getLocalBpAutoOpenCheckbox('localBpAutoOpenScoreboardOverview'),
    postMatch: getLocalBpAutoOpenCheckbox('localBpAutoOpenPostMatch')
  }
}

async function loadLocalBpAutoOpenSettings() {
  try {
    const res = await window.electronAPI.localBpAutoOpenGet()
    if (res && res.success) {
      localBpAutoOpenSettings = res.settings
      applyLocalBpAutoOpenSettings(res.settings)
    }
  } catch (e) {
    console.error('Failed to load local bp auto open settings', e)
  }
}

async function onLocalBpAutoOpenChange() {
  if (!window.electronAPI || !window.electronAPI.localBpAutoOpenSet) return
  const settings = collectLocalBpAutoOpenSettings()
  try {
    const res = await window.electronAPI.localBpAutoOpenSet(settings)
    if (res && res.success) {
      localBpAutoOpenSettings = res.settings
      if (typeof showStatus === 'function') showStatus('已保存', 'success')
      return
    }
    if (typeof showStatus === 'function') showStatus('保存失败', 'error')
  } catch (e) {
    console.error('Failed to save local bp auto open settings', e)
    if (typeof showStatus === 'function') showStatus('保存失败', 'error')
  }
}

async function refreshLocalPagesStatus() {
  const res = await window.electronAPI.localPagesGetStatus()
  const statusEl = document.getElementById('localPagesStatus')
  if (!res || !res.success) return
  const running = res.status && res.status.running
  if (statusEl) statusEl.textContent = running ? '运行中' : '未启动'
}

async function refreshLocalPagesList() {
  const res = await window.electronAPI.localPagesGetPages()
  const listEl = document.getElementById('localPagesList')
  const folderEl = document.getElementById('localPagesFolder')
  const baseUrlEl = document.getElementById('localPagesBaseUrl')
  if (!listEl || !res || !res.success) return
  localPagesBaseUrl = res.baseUrl || ''
  if (folderEl) folderEl.textContent = res.dir || ''
  if (baseUrlEl) baseUrlEl.textContent = localPagesBaseUrl
  const pages = Array.isArray(res.pages) ? res.pages : []
  if (!pages.length) {
    listEl.innerHTML = '<div style="color:var(--text-secondary); font-size:13px;">暂无页面</div>'
    return
  }
  const html = pages
    .filter(p => p.enabled !== false)
    .map(p => {
      const fileName = String(p.fileName).toLowerCase()
      const base = `${localPagesBaseUrl}/pages/${encodeURIComponent(p.fileName)}`
      if (fileName === 'scoreboard.html') {
        const urlA = `${base}?team=teamA`
        const urlB = `${base}?team=teamB`
        const hint = '分辨率：1280×720｜OBS：浏览器源→粘贴URL→设置宽高'
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-color);">
            <div style="flex:1; min-width:0;">
              <div style="font-size:14px;">${p.title || p.fileName} A队</div>
              <div style="font-size:12px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis;">${urlA}</div>
              <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">${hint}</div>
            </div>
            <button class="btn btn-ghost" onclick="copyLocalPageUrl('${urlA}')">复制</button>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-color);">
            <div style="flex:1; min-width:0;">
              <div style="font-size:14px;">${p.title || p.fileName} B队</div>
              <div style="font-size:12px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis;">${urlB}</div>
              <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">${hint}</div>
            </div>
            <button class="btn btn-ghost" onclick="copyLocalPageUrl('${urlB}')">复制</button>
          </div>
        `
      }
      if (fileName === 'character-display.html') {
        const hint = '分辨率：1366×768｜OBS：浏览器源→粘贴URL→设置宽高'
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-color);">
            <div style="flex:1; min-width:0;">
              <div style="font-size:14px;">${p.title || p.fileName}</div>
              <div style="font-size:12px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis;">${base}</div>
              <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">${hint}</div>
            </div>
            <button class="btn btn-ghost" onclick="copyLocalPageUrl('${base}')">复制</button>
          </div>
        `
      }
      if (fileName === 'frontend.html') {
        const hint = '分辨率：可自定义｜OBS：浏览器源→粘贴URL→设置宽高'
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-color);">
            <div style="flex:1; min-width:0;">
              <div style="font-size:14px;">${p.title || p.fileName}</div>
              <div style="font-size:12px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis;">${base}</div>
              <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">${hint}</div>
            </div>
            <button class="btn btn-ghost" onclick="copyLocalPageUrl('${base}')">复制</button>
          </div>
        `
      }
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-color);">
          <div style="flex:1; min-width:0;">
            <div style="font-size:14px;">${p.title || p.fileName}</div>
            <div style="font-size:12px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis;">${base}</div>
          </div>
          <button class="btn btn-ghost" onclick="copyLocalPageUrl('${base}')">复制</button>
        </div>
      `
    })
    .join('')
  listEl.innerHTML = html
}

function copyLocalPageUrl(url) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url)
  } else {
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
  }
}
