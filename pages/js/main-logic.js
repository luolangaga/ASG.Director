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
        await refreshLocalBpCustomWindowAutoOpenRows();
      }
    }
    if (window.electronAPI && window.electronAPI.localPagesGetPages) {
      initLocalPagesWidget();
    }
    if (window.electronAPI && window.electronAPI.localBpAutoOpenGet) {
      loadLocalBpAutoOpenSettings();
    }
    if (!localBpCustomWindowAutoOpenListenerBound && window.electronAPI && window.electronAPI.on) {
      localBpCustomWindowAutoOpenListenerBound = true
      window.electronAPI.on('update-data', async (data) => {
        if (data && data.type === 'layout-updated') {
          await refreshLocalBpCustomWindowAutoOpenRows(true)
        }
      })
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
let localPageEditorState = null
let localPageAiGenerating = false
const LOCAL_PAGE_AI_SETTINGS_KEY = 'local_page_ai_settings_v1'
const LOCAL_PAGE_AI_PROMPT_TEMPLATE = [
  '请生成一个用于 OBS 浏览器源的单页覆盖层。',
  '核心需求：',
  '1. 背景透明，可直接叠加在画面上；',
  '2. 支持 1920x1080，移动端也能正常显示；',
  '3. 提供 query 参数控制主要文本和颜色；',
  '4. 进入动画简洁，性能优先；',
  '5. 不依赖外部接口，单文件可运行。',
  '',
  '我自己的额外要求：'
].join('\n')
let localBpCustomWindowAutoOpenProfiles = []
let localBpCustomWindowAutoOpenListenerBound = false

async function initLocalPagesWidget() {
  await refreshLocalPagesStatus()
  await refreshLocalPagesList()
  loadLocalPageAiSettings()
  const aiModal = document.getElementById('localPageAiModal')
  if (aiModal && !aiModal.dataset.clickBound) {
    aiModal.dataset.clickBound = 'true'
    aiModal.addEventListener('click', (event) => {
      if (event.target === aiModal) closeLocalPageAiModal()
    })
  }
  const listEl = document.getElementById('localPagesList')
  if (listEl && !listEl.dataset.dblclickBound) {
    listEl.dataset.dblclickBound = 'true'
    listEl.addEventListener('dblclick', (event) => {
      if (!window.electronAPI || !window.electronAPI.localPagesReadFile) return
      const target = event.target
      if (target && target.closest && target.closest('button')) return
      const item = target && target.closest ? target.closest('[data-local-page]') : null
      if (!item) return
      const fileName = item.dataset.file
      const title = item.dataset.title
      if (!fileName) return
      openLocalPageEditor(fileName, title)
    })
  }
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

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text == null ? '' : String(text)
  return div.innerHTML
}

function normalizeLocalBpCustomWindowAutoOpenProfiles(layout) {
  const windows = Array.isArray(layout && layout.frontendWindows) ? layout.frontendWindows : []
  const seen = new Set()
  const out = []
  windows.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return
    const id = String(item.id || '').trim()
    if (!id || id === 'frontend-main' || seen.has(id)) return
    seen.add(id)
    const name = String(item.name || `前台窗口 ${idx + 1}`).trim() || `前台窗口 ${idx + 1}`
    out.push({
      id,
      name,
      autoOpen: item.autoOpen !== false
    })
  })
  return out
}

function renderLocalBpCustomWindowAutoOpenRows() {
  const wrap = document.getElementById('localBpAutoOpenCustomWindowsList')
  if (!wrap) return

  if (!localBpCustomWindowAutoOpenProfiles.length) {
    wrap.innerHTML = '<div style="grid-column:1 / -1; font-size:12px; color:var(--text-secondary);">暂无自定义窗口（可在组件设计器中创建）</div>'
    return
  }

  wrap.innerHTML = localBpCustomWindowAutoOpenProfiles.map(item => `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span title="${escapeHtml(item.id)}" style="min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
        ${escapeHtml(item.name)}
      </span>
      <label class="switch">
        <input type="checkbox" data-custom-window-id="${escapeHtml(item.id)}" ${item.autoOpen ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    </div>
  `).join('')

  wrap.querySelectorAll('input[data-custom-window-id]').forEach(el => {
    el.addEventListener('change', () => {
      const windowId = el.getAttribute('data-custom-window-id') || ''
      onLocalBpCustomWindowAutoOpenChange(windowId, !!el.checked)
    })
  })
}

async function refreshLocalBpCustomWindowAutoOpenRows(forceReloadLayout = false) {
  try {
    if (forceReloadLayout || !currentLayout) {
      const res = await window.electronAPI.loadLayout()
      if (res && res.success && res.layout) {
        currentLayout = res.layout
      } else if (!currentLayout) {
        currentLayout = {}
      }
    }
    localBpCustomWindowAutoOpenProfiles = normalizeLocalBpCustomWindowAutoOpenProfiles(currentLayout || {})
    renderLocalBpCustomWindowAutoOpenRows()
  } catch (e) {
    console.error('Failed to refresh custom window auto open rows', e)
  }
}

async function onLocalBpCustomWindowAutoOpenChange(windowId, checked) {
  const id = String(windowId || '').trim()
  if (!id || !window.electronAPI || !window.electronAPI.saveLayout) return
  try {
    if (!currentLayout) {
      const res = await window.electronAPI.loadLayout()
      currentLayout = (res && res.success && res.layout) ? res.layout : {}
    }

    if (!Array.isArray(currentLayout.frontendWindows)) currentLayout.frontendWindows = []
    const idx = currentLayout.frontendWindows.findIndex(item => item && item.id === id)
    if (idx >= 0) {
      currentLayout.frontendWindows[idx] = {
        ...(currentLayout.frontendWindows[idx] || {}),
        autoOpen: !!checked
      }
    } else {
      const profile = localBpCustomWindowAutoOpenProfiles.find(item => item.id === id)
      currentLayout.frontendWindows.push({
        id,
        name: profile ? profile.name : id,
        autoOpen: !!checked
      })
    }

    const result = await window.electronAPI.saveLayout(currentLayout)
    if (result && result.success) {
      if (typeof showStatus === 'function') showStatus('已保存', 'success')
    } else {
      if (typeof showStatus === 'function') showStatus('保存失败', 'error')
    }
    await refreshLocalBpCustomWindowAutoOpenRows(true)
  } catch (e) {
    console.error('Failed to save custom window auto open setting', e)
    if (typeof showStatus === 'function') showStatus('保存失败', 'error')
    await refreshLocalBpCustomWindowAutoOpenRows(true)
  }
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
    await refreshLocalBpCustomWindowAutoOpenRows()
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
  const obsBaseUrl = localPagesBaseUrl.replace('://localhost:', '://127.0.0.1:')
  if (folderEl) folderEl.textContent = res.dir || ''
  if (baseUrlEl) baseUrlEl.textContent = obsBaseUrl
  const pages = Array.isArray(res.pages) ? res.pages : []
  const routeAliasMap = {
    'frontend.html': '/frontend',
    'scoreboard.html': '/scoreboard',
    'character-display.html': '/character-display',
    'lower-third.html': '/lower-third',
    'ticker.html': '/ticker',
    'match-card.html': '/match-card'
  }
  if (!pages.length) {
    listEl.innerHTML = '<div style="color:var(--text-secondary); font-size:13px;">暂无页面</div>'
    return
  }
  const html = pages
    .filter(p => p.enabled !== false)
    .map(p => {
      const fileName = String(p.fileName).toLowerCase()
      const routeAlias = routeAliasMap[fileName]
      const base = routeAlias
        ? `${obsBaseUrl}${routeAlias}`
        : `${obsBaseUrl}/pages/${encodeURIComponent(p.fileName)}`
      if (fileName === 'scoreboard.html') {
        const urlA = `${obsBaseUrl}/scoreboard?team=teamA`
        const urlB = `${obsBaseUrl}/scoreboard?team=teamB`
        const hint = '分辨率：1280×720｜OBS：浏览器源→粘贴URL→设置宽高'
        return `
          <div data-local-page="true" data-file="${p.fileName}" data-title="${p.title || p.fileName}" style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-color);">
            <div style="flex:1; min-width:0;">
              <div style="font-size:14px;">${p.title || p.fileName} A队</div>
              <div style="font-size:12px; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis;">${urlA}</div>
              <div style="font-size:11px; color:var(--text-secondary); margin-top:4px;">${hint}</div>
            </div>
            <button class="btn btn-ghost" onclick="copyLocalPageUrl('${urlA}')">复制</button>
          </div>
          <div data-local-page="true" data-file="${p.fileName}" data-title="${p.title || p.fileName}" style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-color);">
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
          <div data-local-page="true" data-file="${p.fileName}" data-title="${p.title || p.fileName}" style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-color);">
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
          <div data-local-page="true" data-file="${p.fileName}" data-title="${p.title || p.fileName}" style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-color);">
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
        <div data-local-page="true" data-file="${p.fileName}" data-title="${p.title || p.fileName}" style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border-color);">
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

async function openLocalPageEditor(fileName, title) {
  const modal = document.getElementById('localPageEditorModal')
  const titleEl = document.getElementById('localPageEditorTitle')
  const textarea = document.getElementById('localPageEditorContent')
  if (!modal || !textarea || !window.electronAPI || !window.electronAPI.localPagesReadFile) return
  const res = await window.electronAPI.localPagesReadFile(fileName)
  if (!res || !res.success) {
    if (typeof showStatus === 'function') showStatus(res && res.message ? res.message : '读取失败', 'error')
    return
  }
  localPageEditorState = { fileName, title: title || fileName, originalContent: res.content }
  titleEl.textContent = `编辑：${title || fileName}`
  textarea.value = res.content || ''
  modal.classList.add('show')
  textarea.focus()
}

function closeLocalPageEditor() {
  const modal = document.getElementById('localPageEditorModal')
  const textarea = document.getElementById('localPageEditorContent')
  if (textarea) textarea.value = ''
  if (modal) modal.classList.remove('show')
  localPageEditorState = null
}

async function saveLocalPageEditor() {
  if (!localPageEditorState || !window.electronAPI || !window.electronAPI.localPagesWriteFile) return
  const textarea = document.getElementById('localPageEditorContent')
  const content = textarea ? textarea.value : ''
  const res = await window.electronAPI.localPagesWriteFile(localPageEditorState.fileName, content)
  if (!res || !res.success) {
    if (typeof showStatus === 'function') showStatus(res && res.message ? res.message : '保存失败', 'error')
    return
  }
  if (typeof showStatus === 'function') showStatus('已保存', 'success')
  closeLocalPageEditor()
  await refreshLocalPagesList()
}

function loadLocalPageAiSettings() {
  try {
    const raw = localStorage.getItem(LOCAL_PAGE_AI_SETTINGS_KEY)
    const data = raw ? JSON.parse(raw) : {}
    const apiUrlEl = document.getElementById('localPageAiApiUrl')
    const apiKeyEl = document.getElementById('localPageAiApiKey')
    const modelEl = document.getElementById('localPageAiModel')
    const fileNameEl = document.getElementById('localPageAiFileName')
    const titleEl = document.getElementById('localPageAiTitle')
    const promptEl = document.getElementById('localPageAiPrompt')
    if (apiUrlEl) {
      if (typeof data.apiBaseUrl === 'string' && data.apiBaseUrl.trim()) apiUrlEl.value = data.apiBaseUrl
      else if (!apiUrlEl.value.trim()) apiUrlEl.value = 'https://api.openai.com/v1'
    }
    if (apiKeyEl && typeof data.apiKey === 'string') apiKeyEl.value = data.apiKey
    if (modelEl) {
      if (typeof data.model === 'string' && data.model.trim()) modelEl.value = data.model
      else if (!modelEl.value.trim()) modelEl.value = 'gpt-4o-mini'
    }
    if (fileNameEl && typeof data.fileName === 'string') fileNameEl.value = data.fileName
    if (titleEl && typeof data.title === 'string') titleEl.value = data.title
    if (promptEl) {
      if (typeof data.prompt === 'string' && data.prompt.trim()) promptEl.value = data.prompt
      else if (!promptEl.value.trim()) promptEl.value = LOCAL_PAGE_AI_PROMPT_TEMPLATE
    }
  } catch (e) {
    console.warn('Failed to load local page AI settings', e)
  }
}

function saveLocalPageAiSettings(payload) {
  try {
    localStorage.setItem(LOCAL_PAGE_AI_SETTINGS_KEY, JSON.stringify(payload || {}))
  } catch (e) {
    console.warn('Failed to save local page AI settings', e)
  }
}

function openLocalPageAiModal() {
  const modal = document.getElementById('localPageAiModal')
  if (!modal) return
  loadLocalPageAiSettings()
  modal.classList.add('show')
}

function applyLocalPageAiPromptPreset(presetKey) {
  const promptEl = document.getElementById('localPageAiPrompt')
  if (!promptEl) return
  const presets = {
    obsTransparent: '页面用途：用于 OBS 浏览器源叠加。保持背景完全透明，主内容放在底部安全区域。',
    urlParams: '请支持 URL 参数：title、subtitle、accent、visible；参数变化能立即生效。',
    scoreOverlay: '内容类型：赛事信息条。显示队伍名、比分、回合信息，并提供轻量入场动画。'
  }
  const snippet = presets[presetKey]
  if (!snippet) return
  const current = promptEl.value.trim()
  promptEl.value = current ? `${current}\n${snippet}` : `${LOCAL_PAGE_AI_PROMPT_TEMPLATE}\n${snippet}`
  promptEl.focus()
}

function closeLocalPageAiModal() {
  if (localPageAiGenerating) return
  const modal = document.getElementById('localPageAiModal')
  if (modal) modal.classList.remove('show')
}

async function generateLocalPageWithAI() {
  if (localPageAiGenerating) return
  if (!window.electronAPI || !window.electronAPI.localPagesGenerateWithAi) {
    if (typeof showStatus === 'function') showStatus('当前版本不支持 AI 生成', 'error')
    return
  }
  const apiUrlEl = document.getElementById('localPageAiApiUrl')
  const apiKeyEl = document.getElementById('localPageAiApiKey')
  const modelEl = document.getElementById('localPageAiModel')
  const fileNameEl = document.getElementById('localPageAiFileName')
  const titleEl = document.getElementById('localPageAiTitle')
  const promptEl = document.getElementById('localPageAiPrompt')
  const submitBtn = document.getElementById('localPageAiGenerateBtn')

  const payload = {
    apiBaseUrl: apiUrlEl ? apiUrlEl.value.trim() : '',
    apiKey: apiKeyEl ? apiKeyEl.value.trim() : '',
    model: modelEl ? modelEl.value.trim() : '',
    fileName: fileNameEl ? fileNameEl.value.trim() : '',
    title: titleEl ? titleEl.value.trim() : '',
    prompt: promptEl ? promptEl.value.trim() : ''
  }

  if (!payload.apiBaseUrl || !payload.apiKey || !payload.prompt) {
    if (typeof showStatus === 'function') showStatus('请填写 API 地址、API Key 和提示词', 'warning')
    return
  }

  saveLocalPageAiSettings(payload)
  localPageAiGenerating = true
  if (submitBtn) {
    submitBtn.disabled = true
    submitBtn.textContent = '生成中...'
  }

  try {
    const res = await window.electronAPI.localPagesGenerateWithAi(payload)
    if (!res || !res.success) {
      if (typeof showStatus === 'function') showStatus((res && res.message) ? res.message : 'AI 生成失败', 'error')
      return
    }
    if (res.url) {
      try { copyLocalPageUrl(res.url) } catch {}
    }
    if (typeof showStatus === 'function') {
      const label = res.title ? `${res.title}（${res.fileName || '未命名文件'}）` : (res.fileName || '新页面')
      const suffix = res.url ? '，URL 已复制' : ''
      showStatus(`AI 生成完成：${label}${suffix}`, 'success')
    }
    await refreshLocalPagesList()
    closeLocalPageAiModal()
  } catch (e) {
    if (typeof showStatus === 'function') showStatus(`AI 生成失败: ${e.message || e}`, 'error')
  } finally {
    localPageAiGenerating = false
    if (submitBtn) {
      submitBtn.disabled = false
      submitBtn.textContent = '生成并写入'
    }
  }
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
