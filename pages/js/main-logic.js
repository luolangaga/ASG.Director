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
