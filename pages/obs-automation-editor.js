const TRIGGER_DEFS = [
  { value: 'bp:hunter-selected', label: '监管者已选择', hint: '监管者角色确定后触发。' },
  { value: 'bp:survivor-selected', label: '任意求生者已选择', hint: '任意一个求生者槽位变化并选定后触发。' },
  { value: 'bp:survivor-1-selected', label: '选求生者1', hint: '当求生者已选人数达到 1 时触发（顺序事件）。' },
  { value: 'bp:survivor-2-selected', label: '选求生者2', hint: '当求生者已选人数达到 2 时触发（顺序事件）。' },
  { value: 'bp:survivor-3-selected', label: '选求生者3', hint: '当求生者已选人数达到 3 时触发（顺序事件）。' },
  { value: 'bp:survivor-4-selected', label: '选求生者4', hint: '当求生者已选人数达到 4 时触发（顺序事件）。' },
  { value: 'bp:all-survivors-selected', label: '全部求生者选完', hint: '四位求生者全部确定后触发。' },
  { value: 'bp:character-banned', label: '角色被禁用', hint: '任意禁用操作发生后触发。' },
  { value: 'bp:round-changed', label: '回合变化', hint: 'BP 回合号发生变化时触发。' },
  { value: 'localbp:state-updated', label: '本地 BP 状态更新', hint: '任意 BP 状态变化都会触发。' },
  { value: 'localbp:map-changed', label: '地图变化', hint: '地图名称变化时触发。' },
  { value: 'localbp:team-changed', label: '队伍信息变化', hint: '队伍名、Logo 或附加信息变化时触发。' },
  { value: 'localbp:score-updated', label: '比分更新', hint: '本地比分数据变化时触发（含大比分/小比分）。' },
  { value: 'localbp:reset', label: '本地 BP 重置', hint: '从有数据回到空状态时触发。' },
  { value: 'obs:sidebar-manual-trigger', label: 'OBS侧边栏手动触发', hint: '仅在 OBS 侧边栏页面点击触发。' },
  { value: 'obs:music-control', label: 'OBS音乐控制事件', hint: '用于侧边栏切歌控制，建议搭配“切换媒体源输入”积木。' },
  { value: 'timer:interval', label: '定时触发', hint: '按间隔自动触发，用于轮询/定时任务。' }
];

const ACTION_LIBRARY = [
  { type: 'SWITCH_SCENE', group: '场景控制', label: '切换场景', desc: '切换到指定 OBS 场景。', defaults: { sceneName: '' } },
  { type: 'SET_SOURCE_VISIBLE', group: '场景控制', label: '设置源可见性', desc: '控制场景中的某个源显示/隐藏。', defaults: { sceneName: '', sceneItemId: '', visible: true } },
  { type: 'DELAY', group: '流程控制', label: '等待', desc: '等待指定时间再执行后续动作。', defaults: { duration: '1s' } },
  { type: 'SET_TEXT', group: '源控制', label: '设置文本', desc: '设置文本源内容。', defaults: { sourceName: '', text: '' } },
  { type: 'SET_IMAGE', group: '源控制', label: '设置图片', desc: '设置图片源文件路径。', defaults: { sourceName: '', file: '' } },
  { type: 'SET_BROWSER_URL', group: '源控制', label: '设置浏览器 URL', desc: '更新浏览器源网址。', defaults: { sourceName: '', url: '' } },
  { type: 'REFRESH_BROWSER', group: '源控制', label: '刷新浏览器源', desc: '触发浏览器源刷新。', defaults: { sourceName: '' } },
  { type: 'SET_SOURCE_SETTINGS', group: '高级控制', label: '设置源属性', desc: '写入输入源 settings JSON。', defaults: { sourceName: '', settings: {}, overlay: true } },
  { type: 'SWITCH_MEDIA_INPUT', group: '高级控制', label: '切换媒体源输入', desc: '切换媒体源到新的 URL/本地文件。', defaults: { sourceName: '', mediaUrl: '', isLocalFile: false, restart: true, overlay: true } },
  { type: 'MUSIC_PLAYLIST', group: '高级控制', label: '音乐歌单', desc: '配置一个音乐源和多首歌曲，供侧边栏按钮切歌。', defaults: { sourceName: '', tracksText: '', restart: true, overlay: true } },
  { type: 'SET_SOURCE_TRANSFORM', group: '高级控制', label: '设置源变换', desc: '设置场景项位置/缩放/旋转。', defaults: { sceneName: '', sourceName: '', sceneItemId: '', transform: { positionX: 0, positionY: 0, scaleX: 1, scaleY: 1, rotation: 0 } } },
  { type: 'SET_FILTER_SETTINGS', group: '高级控制', label: '设置滤镜', desc: '更新滤镜 settings JSON。', defaults: { sourceName: '', filterName: '', settings: {} } },
  { type: 'SET_FILTER_ENABLED', group: '高级控制', label: '启用/禁用滤镜', desc: '切换滤镜启用状态。', defaults: { sourceName: '', filterName: '', enabled: true } },
  { type: 'START_RECORDING', group: '直播控制', label: '开始录制', desc: '触发 OBS 开始录制。', defaults: {} },
  { type: 'STOP_RECORDING', group: '直播控制', label: '停止录制', desc: '触发 OBS 停止录制。', defaults: {} },
  { type: 'START_STREAMING', group: '直播控制', label: '开始推流', desc: '触发 OBS 开始推流。', defaults: {} },
  { type: 'STOP_STREAMING', group: '直播控制', label: '停止推流', desc: '触发 OBS 停止推流。', defaults: {} },
  { type: 'CALL_CUSTOM_API', group: '扩展', label: '调用自定义API', desc: '按 URL + Method 发起请求，可把结果广播成事件。', defaults: { url: '', method: 'POST', headersJson: '{}', bodyJson: '{}', timeoutMs: 8000, resultEventName: '', targetPage: 'all', targetWindowId: '' } },
  { type: 'EMIT_CUSTOM_EVENT', group: '扩展', label: '广播自定义事件', desc: '向前台窗口广播事件，可触发模板变量更新。', defaults: { eventName: 'automation:custom-event', payloadJson: '{}', targetPage: 'all', targetWindowId: '' } },
  { type: 'SET_COMPONENT_PROPERTY', group: '扩展', label: '修改组件属性', desc: '按组件ID修改文本/样式/位置/可见性等属性。', defaults: { componentId: '', patchJson: '{"text":"Hello"}', targetPage: 'all', targetWindowId: '' } },
  { type: 'EXECUTE_COMMAND', group: '扩展', label: '触发命令事件', desc: '发送 executeCommand 事件。', defaults: { command: '', args: '' } },
  { type: 'CUSTOM_SCRIPT', group: '扩展', label: '自定义脚本', desc: '执行脚本（高级使用）。', defaults: { script: '' } }
];

const ACTION_MAP = ACTION_LIBRARY.reduce((acc, item) => {
  acc[item.type] = item;
  return acc;
}, {});

const CUSTOM_BLOCK_STORAGE_KEY = 'obs_automation_custom_blocks_v1';
const MODE_CLASSIC = 'classic';
const MODE_SCRATCH = 'scratch';
const BUILTIN_ACTION_COLORS = {
  '场景控制': '#4f83ff',
  '流程控制': '#fb8c00',
  '源控制': '#26a69a',
  '高级控制': '#8e66ff',
  '直播控制': '#ef5350',
  '扩展': '#ff7043'
};

let rules = [];
let scenes = [];
let currentRuleIndex = -1;
let dragPayload = null;
let editorMode = MODE_CLASSIC;
let scratchWorkspace = null;
let scratchSyncing = false;
let scratchBuilt = false;
let customBlocks = [];
let actionBlockTypeMap = {};
let scratchBlockConfigByType = {};

const el = {
  obsStatus: null,
  host: null,
  port: null,
  password: null,
  autoConnect: null,
  rulesList: null,
  editor: null,
  editorEmpty: null,
  triggerHint: null,
  triggerType: null,
  intervalRow: null,
  paletteRoot: null,
  canvas: null,
  workspaceClassic: null,
  workspaceScratch: null,
  modeClassic: null,
  modeScratch: null,
  scratchWorkspace: null,
  scratchCustomList: null
};

window.addEventListener('DOMContentLoaded', init);

async function init() {
  bindElements();
  bindEvents();
  buildTriggerOptions();
  renderPalette();
  loadCustomBlocks();
  renderCustomBlockList();
  setEditorMode(MODE_CLASSIC);
  if (window.obsAPI && typeof window.obsAPI.onStatus === 'function') {
    window.obsAPI.onStatus((status) => {
      applyStatus(status);
    });
  }
  await loadInitialData();
  renderRulesList();
  if (rules.length > 0) {
    selectRule(0);
  }
}

function bindElements() {
  el.obsStatus = document.getElementById('obsStatus');
  el.host = document.getElementById('host');
  el.port = document.getElementById('port');
  el.password = document.getElementById('password');
  el.autoConnect = document.getElementById('autoConnect');
  el.rulesList = document.getElementById('rulesList');
  el.editor = document.getElementById('editor');
  el.editorEmpty = document.getElementById('editorEmpty');
  el.triggerHint = document.getElementById('ruleTriggerHint');
  el.triggerType = document.getElementById('ruleTriggerType');
  el.intervalRow = document.getElementById('intervalRow');
  el.paletteRoot = document.getElementById('paletteRoot');
  el.canvas = document.getElementById('canvas');
  el.workspaceClassic = document.getElementById('workspaceClassic');
  el.workspaceScratch = document.getElementById('workspaceScratch');
  el.modeClassic = document.getElementById('btnModeClassic');
  el.modeScratch = document.getElementById('btnModeScratch');
  el.scratchWorkspace = document.getElementById('scratchWorkspace');
  el.scratchCustomList = document.getElementById('scratchCustomBlockList');
}

function bindEvents() {
  document.getElementById('btnConnect').addEventListener('click', connectOBS);
  document.getElementById('btnDisconnect').addEventListener('click', disconnectOBS);
  document.getElementById('btnSaveConfig').addEventListener('click', saveConfig);
  document.getElementById('btnNewRule').addEventListener('click', createNewRule);
  document.getElementById('btnSaveRule').addEventListener('click', saveCurrentRule);
  document.getElementById('btnTestRule').addEventListener('click', testCurrentRule);
  document.getElementById('btnDeleteRule').addEventListener('click', deleteCurrentRule);
  document.getElementById('btnSaveAll').addEventListener('click', saveAllRules);
  document.getElementById('btnSaveAllTop').addEventListener('click', saveAllRules);
  document.getElementById('btnOpenTutorialTop').addEventListener('click', openTutorial);
  el.modeClassic.addEventListener('click', () => setEditorMode(MODE_CLASSIC));
  el.modeScratch.addEventListener('click', () => setEditorMode(MODE_SCRATCH));
  document.getElementById('btnNewCustomBlock').addEventListener('click', createCustomBlockByPrompt);
  document.getElementById('btnExportCustomBlocks').addEventListener('click', exportCustomBlocks);
  document.getElementById('btnImportCustomBlocks').addEventListener('click', importCustomBlocks);
  el.triggerType.addEventListener('change', onTriggerTypeChanged);
  window.addEventListener('resize', () => {
    if (scratchWorkspace && window.Blockly) {
      window.Blockly.svgResize(scratchWorkspace);
    }
  });

  el.scratchCustomList.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-role="delete-custom-block"]');
    if (!button) return;
    const id = button.dataset.id;
    if (!id) return;
    deleteCustomBlock(id);
  });

  el.rulesList.addEventListener('click', (event) => {
    const item = event.target.closest('.rule-item');
    if (!item) return;
    const index = Number(item.dataset.index);
    if (!Number.isFinite(index)) return;
    collectCurrentRuleForm();
    selectRule(index);
  });

  const formIds = ['ruleName', 'ruleDescription', 'ruleEnabled', 'ruleTriggerType', 'ruleDelay', 'ruleCooldown', 'ruleInterval', 'ruleMaxTriggers', 'ruleCondition'];
  for (const id of formIds) {
    const node = document.getElementById(id);
    const eventName = id === 'ruleDescription' ? 'input' : 'change';
    node.addEventListener(eventName, () => {
      collectCurrentRuleForm();
      renderRulesList();
      if (id === 'ruleTriggerType') {
        updateScratchTriggerFromForm();
      }
    });
  }

  el.paletteRoot.addEventListener('click', (event) => {
    const item = event.target.closest('.palette-item');
    if (!item) return;
    const type = item.dataset.type;
    if (!ACTION_MAP[type]) return;
    insertActionAt(getCurrentRuleActions().length, type);
  });

  el.paletteRoot.addEventListener('dragstart', (event) => {
    const item = event.target.closest('.palette-item');
    if (!item) return;
    dragPayload = { source: 'palette', type: item.dataset.type };
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('text/plain', JSON.stringify(dragPayload));
  });

  el.canvas.addEventListener('dragstart', (event) => {
    const block = event.target.closest('.block');
    if (!block) return;
    const index = Number(block.dataset.index);
    if (!Number.isFinite(index)) return;
    dragPayload = { source: 'canvas', index };
    block.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(dragPayload));
  });

  el.canvas.addEventListener('dragend', (event) => {
    const block = event.target.closest('.block');
    if (block) block.classList.remove('dragging');
    clearDropZoneState();
  });

  el.canvas.addEventListener('dragover', (event) => {
    const zone = event.target.closest('.drop-zone');
    if (!zone) return;
    event.preventDefault();
    zone.classList.add('active');
  });

  el.canvas.addEventListener('dragleave', (event) => {
    const zone = event.target.closest('.drop-zone');
    if (!zone) return;
    zone.classList.remove('active');
  });

  el.canvas.addEventListener('drop', (event) => {
    const zone = event.target.closest('.drop-zone');
    if (!zone) return;
    event.preventDefault();
    let payload = dragPayload;
    if (!payload) {
      try {
        payload = JSON.parse(event.dataTransfer.getData('text/plain'));
      } catch {
        payload = null;
      }
    }
    clearDropZoneState();
    if (!payload) return;
    const insertIndex = Number(zone.dataset.index);
    if (!Number.isFinite(insertIndex)) return;
    if (payload.source === 'palette' && ACTION_MAP[payload.type]) {
      insertActionAt(insertIndex, payload.type);
    } else if (payload.source === 'canvas' && Number.isFinite(payload.index)) {
      moveAction(payload.index, insertIndex);
    }
  });

  el.canvas.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-role]');
    if (!button) return;
    const index = Number(button.dataset.index);
    if (!Number.isFinite(index)) return;
    if (button.dataset.role === 'remove-action') {
      removeAction(index);
    }
  });

  el.canvas.addEventListener('change', (event) => {
    const target = event.target;
    const index = Number(target.dataset.index);
    if (!Number.isFinite(index)) return;
    if (target.dataset.role === 'action-type') {
      changeActionType(index, target.value);
      return;
    }
    if (target.dataset.role === 'action-enabled') {
      updateAction(index, { enabled: target.checked });
      return;
    }
    if (target.dataset.role === 'action-delay') {
      updateAction(index, { delay: target.value.trim() });
      return;
    }
    if (target.dataset.role === 'param') {
      updateActionParam(index, target.dataset.param, target.value);
      return;
    }
    if (target.dataset.role === 'param-bool') {
      updateActionParam(index, target.dataset.param, target.value === 'true');
      return;
    }
    if (target.dataset.role === 'param-json') {
      try {
        const parsed = target.value.trim() ? JSON.parse(target.value) : {};
        if (target.dataset.param === '__all_params_json__') {
          updateAction(index, { params: parsed });
        } else {
          updateActionParam(index, target.dataset.param, parsed);
        }
        target.style.borderColor = '';
      } catch {
        target.style.borderColor = '#ef4444';
        showToast('JSON 格式错误，请检查后再保存', 'error');
      }
    }
  });
}

async function loadInitialData() {
  if (!window.obsAPI) {
    showToast('obsAPI 不可用，当前页面需在应用内打开', 'error');
    return;
  }
  try {
    const [config, loadedRules, status] = await Promise.all([
      window.obsAPI.getConfig(),
      window.obsAPI.getRules(),
      window.obsAPI.getStatus()
    ]);
    applyConfig(config || {});
    rules = Array.isArray(loadedRules) ? loadedRules.map(normalizeRule) : [];
    applyStatus(status || {});
  } catch (e) {
    showToast('初始化失败: ' + e.message, 'error');
  }
}

function applyConfig(config) {
  el.host.value = config.host || 'localhost';
  el.port.value = Number(config.port || 4455);
  el.password.value = config.password || '';
  el.autoConnect.checked = !!config.autoConnect;
}

function applyStatus(status) {
  scenes = Array.isArray(status.scenes) ? status.scenes.slice() : [];
  if (status.connected) {
    el.obsStatus.textContent = `OBS 已连接${status.currentScene ? ` | 当前场景: ${status.currentScene}` : ''}`;
    el.obsStatus.classList.add('connected');
  } else {
    el.obsStatus.textContent = 'OBS 未连接';
    el.obsStatus.classList.remove('connected');
  }
  if (currentRuleIndex >= 0) renderCanvas();
}

function buildTriggerOptions() {
  el.triggerType.innerHTML = TRIGGER_DEFS.map((item) => `<option value="${item.value}">${item.label}</option>`).join('');
  updateTriggerHint(el.triggerType.value);
}

function renderPalette() {
  const groups = {};
  for (const item of ACTION_LIBRARY) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  }
  el.paletteRoot.innerHTML = Object.keys(groups).map((groupName) => {
    return `
      <div class="palette-group">
        <div class="palette-group-title">${groupName}</div>
        ${groups[groupName].map((item) => `
          <div class="palette-item" draggable="true" data-type="${item.type}">
            <h4>${item.label}</h4>
            <p>${item.desc}</p>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

function renderRulesList() {
  if (!rules.length) {
    el.rulesList.innerHTML = '<div class="canvas-empty">暂无规则，点击上方“+ 新建”。</div>';
    return;
  }
  el.rulesList.innerHTML = rules.map((rule, index) => {
    const active = index === currentRuleIndex ? 'active' : '';
    const badgeClass = rule.enabled ? 'on' : 'off';
    const badgeText = rule.enabled ? '启用' : '禁用';
    const triggerLabel = getTriggerLabel(rule.triggerType);
    const actionCount = Array.isArray(rule.actions) ? rule.actions.length : 0;
    return `
      <div class="rule-item ${active}" data-index="${index}">
        <div class="rule-name-row">
          <div class="rule-name">${escapeHtml(rule.name || '未命名规则')}</div>
          <div class="rule-badge ${badgeClass}">${badgeText}</div>
        </div>
        <div class="rule-meta">
          <span>${triggerLabel}</span>
          <span>${actionCount} 个积木</span>
        </div>
      </div>
    `;
  }).join('');
}

function selectRule(index) {
  currentRuleIndex = index;
  const rule = rules[index];
  if (!rule) {
    showEditor(false);
    return;
  }
  showEditor(true);
  document.getElementById('ruleName').value = rule.name || '';
  document.getElementById('ruleDescription').value = rule.description || '';
  document.getElementById('ruleEnabled').checked = rule.enabled !== false;
  document.getElementById('ruleTriggerType').value = rule.triggerType || 'bp:hunter-selected';
  document.getElementById('ruleDelay').value = rule.delay != null ? String(rule.delay) : '0';
  document.getElementById('ruleCooldown').value = rule.cooldown != null ? String(rule.cooldown) : '0';
  document.getElementById('ruleInterval').value = rule.interval != null ? String(rule.interval) : '1m';
  document.getElementById('ruleMaxTriggers').value = Number(rule.maxTriggers || 0);
  document.getElementById('ruleCondition').value = rule.condition || '';
  updateTriggerHint(rule.triggerType);
  renderRulesList();
  renderCanvas();
  if (editorMode === MODE_SCRATCH) {
    ensureScratchWorkspace();
    syncRuleToScratchWorkspace(rule);
  }
}

function showEditor(show) {
  el.editor.style.display = show ? 'grid' : 'none';
  el.editorEmpty.style.display = show ? 'none' : 'flex';
}

function onTriggerTypeChanged() {
  updateTriggerHint(el.triggerType.value);
  collectCurrentRuleForm();
  updateScratchTriggerFromForm();
  renderRulesList();
}

function updateTriggerHint(triggerType) {
  const found = TRIGGER_DEFS.find((item) => item.value === triggerType);
  el.triggerHint.textContent = found ? found.hint : '未定义的触发事件';
  el.intervalRow.style.display = triggerType === 'timer:interval' ? 'block' : 'none';
}

function getCurrentRuleActions() {
  if (currentRuleIndex < 0 || !rules[currentRuleIndex]) return [];
  const rule = rules[currentRuleIndex];
  if (!Array.isArray(rule.actions)) rule.actions = [];
  return rule.actions;
}

function renderCanvas() {
  const actions = getCurrentRuleActions();
  if (!actions.length) {
    el.canvas.innerHTML = `
      <div class="drop-zone" data-index="0"></div>
      <div class="canvas-empty">
        将左侧动作积木拖到这里，或直接点击积木快速添加。
        <div style="margin-top:6px;">支持拖拽排序、启停单个动作、编辑高级 JSON 参数。</div>
      </div>
    `;
    return;
  }

  const parts = [];
  for (let i = 0; i <= actions.length; i++) {
    parts.push(`<div class="drop-zone" data-index="${i}"></div>`);
    if (i === actions.length) continue;
    parts.push(renderBlock(actions[i], i));
  }
  el.canvas.innerHTML = parts.join('');
}

function renderBlock(action, index) {
  const meta = ACTION_MAP[action.type] || { label: action.type };
  const typeOptions = ACTION_LIBRARY.slice();
  if (!ACTION_MAP[action.type]) {
    typeOptions.unshift({
      type: action.type,
      label: `自定义动作 (${action.type})`
    });
  }
  return `
    <div class="block" draggable="true" data-index="${index}">
      <div class="block-header">
        <div class="block-left">
          <span class="drag-handle">⋮⋮</span>
          <div class="block-title">${escapeHtml(meta.label || action.type)}</div>
        </div>
        <div class="block-controls">
          <select data-role="action-type" data-index="${index}">
            ${typeOptions.map((item) => `<option value="${item.type}" ${item.type === action.type ? 'selected' : ''}>${item.label}</option>`).join('')}
          </select>
          <label>
            <input type="checkbox" data-role="action-enabled" data-index="${index}" ${action.enabled === false ? '' : 'checked'}>
            启用
          </label>
          <button class="btn danger" data-role="remove-action" data-index="${index}" type="button">删除</button>
        </div>
      </div>
      <div class="block-body">
        <div class="block-field">
          <label>动作延迟（可选）</label>
          <input type="text" data-role="action-delay" data-index="${index}" value="${escapeHtml(action.delay != null ? String(action.delay) : '')}" placeholder="0 / 500ms / 1.5s / 01:30">
        </div>
        ${renderActionFields(action, index)}
      </div>
    </div>
  `;
}

function renderActionFields(action, index) {
  const p = action.params || {};
  switch (action.type) {
    case 'SWITCH_SCENE':
      return `
        <div class="block-field">
          <label>场景（下拉）</label>
          <select data-role="param" data-index="${index}" data-param="sceneName">
            <option value="">-- 选择场景 --</option>
            ${scenes.map((name) => `<option value="${escapeAttr(name)}" ${name === (p.sceneName || '') ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}
          </select>
        </div>
        <div class="block-field">
          <label>场景（手动输入）</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sceneName" value="${escapeHtml(p.sceneName || '')}" placeholder="与 OBS 场景名完全一致">
        </div>
      `;
    case 'SET_SOURCE_VISIBLE':
      return `
        <div class="block-field">
          <label>场景名</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sceneName" value="${escapeHtml(p.sceneName || '')}" placeholder="所属场景">
        </div>
        <div class="block-field">
          <label>sceneItemId</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sceneItemId" value="${escapeHtml(p.sceneItemId || '')}" placeholder="场景项 ID">
        </div>
        <div class="block-field">
          <label>可见性</label>
          <select data-role="param-bool" data-index="${index}" data-param="visible">
            <option value="true" ${p.visible === false ? '' : 'selected'}>显示</option>
            <option value="false" ${p.visible === false ? 'selected' : ''}>隐藏</option>
          </select>
        </div>
      `;
    case 'DELAY':
      return `
        <div class="block-field">
          <label>等待时长</label>
          <input type="text" data-role="param" data-index="${index}" data-param="duration" value="${escapeHtml(p.duration || '1s')}" placeholder="500ms / 2s / 1m / 01:30">
        </div>
      `;
    case 'SET_TEXT':
      return `
        <div class="block-field">
          <label>文本源名称</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sourceName" value="${escapeHtml(p.sourceName || '')}">
        </div>
        <div class="block-field">
          <label>文本内容（支持 {{bpHunter}}）</label>
          <input type="text" data-role="param" data-index="${index}" data-param="text" value="${escapeHtml(p.text || '')}">
        </div>
      `;
    case 'SET_IMAGE':
      return `
        <div class="block-field">
          <label>图片源名称</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sourceName" value="${escapeHtml(p.sourceName || '')}">
        </div>
        <div class="block-field">
          <label>图片文件路径</label>
          <input type="text" data-role="param" data-index="${index}" data-param="file" value="${escapeHtml(p.file || '')}">
        </div>
      `;
    case 'SET_BROWSER_URL':
      return `
        <div class="block-field">
          <label>浏览器源名称</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sourceName" value="${escapeHtml(p.sourceName || '')}">
        </div>
        <div class="block-field">
          <label>URL</label>
          <input type="text" data-role="param" data-index="${index}" data-param="url" value="${escapeHtml(p.url || '')}">
        </div>
      `;
    case 'REFRESH_BROWSER':
      return `
        <div class="block-field">
          <label>浏览器源名称</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sourceName" value="${escapeHtml(p.sourceName || '')}">
        </div>
      `;
    case 'SET_SOURCE_SETTINGS':
      return `
        <div class="block-field">
          <label>源名称</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sourceName" value="${escapeHtml(p.sourceName || '')}">
        </div>
        <div class="block-field">
          <label>overlay</label>
          <select data-role="param-bool" data-index="${index}" data-param="overlay">
            <option value="true" ${p.overlay === false ? '' : 'selected'}>true</option>
            <option value="false" ${p.overlay === false ? 'selected' : ''}>false</option>
          </select>
        </div>
        <div class="block-field" style="grid-column: 1 / -1;">
          <label>settings JSON</label>
          <textarea data-role="param-json" data-index="${index}" data-param="settings">${escapeHtml(stringifyJson(p.settings || {}))}</textarea>
        </div>
      `;
    case 'SWITCH_MEDIA_INPUT':
      return `
        <div class="block-field">
          <label>媒体源名称</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sourceName" value="${escapeHtml(p.sourceName || '')}" placeholder="OBS 中的媒体源名">
        </div>
        <div class="block-field" style="grid-column: 1 / -1;">
          <label>媒体链接 / 本地文件路径</label>
          <input type="text" data-role="param" data-index="${index}" data-param="mediaUrl" value="${escapeHtml(p.mediaUrl || '')}" placeholder="https://... 或 D:\\music\\song.mp3">
        </div>
        <div class="block-field">
          <label>本地文件</label>
          <select data-role="param-bool" data-index="${index}" data-param="isLocalFile">
            <option value="false" ${p.isLocalFile === true ? '' : 'selected'}>否（网络URL）</option>
            <option value="true" ${p.isLocalFile === true ? 'selected' : ''}>是（本地文件）</option>
          </select>
        </div>
        <div class="block-field">
          <label>切换后重启播放</label>
          <select data-role="param-bool" data-index="${index}" data-param="restart">
            <option value="true" ${p.restart === false ? '' : 'selected'}>是</option>
            <option value="false" ${p.restart === false ? 'selected' : ''}>否</option>
          </select>
        </div>
        <div class="block-field">
          <label>overlay</label>
          <select data-role="param-bool" data-index="${index}" data-param="overlay">
            <option value="true" ${p.overlay === false ? '' : 'selected'}>true</option>
            <option value="false" ${p.overlay === false ? 'selected' : ''}>false</option>
          </select>
        </div>
      `;
    case 'MUSIC_PLAYLIST':
      return `
        <div class="block-field">
          <label>音乐源名称</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sourceName" value="${escapeHtml(p.sourceName || '')}" placeholder="OBS 中媒体源名称">
        </div>
        <div class="block-field">
          <label>切歌后重启播放</label>
          <select data-role="param-bool" data-index="${index}" data-param="restart">
            <option value="true" ${p.restart === false ? '' : 'selected'}>是</option>
            <option value="false" ${p.restart === false ? 'selected' : ''}>否</option>
          </select>
        </div>
        <div class="block-field">
          <label>overlay</label>
          <select data-role="param-bool" data-index="${index}" data-param="overlay">
            <option value="true" ${p.overlay === false ? '' : 'selected'}>true</option>
            <option value="false" ${p.overlay === false ? 'selected' : ''}>false</option>
          </select>
        </div>
        <div class="block-field" style="grid-column: 1 / -1;">
          <label>歌曲列表（每行：歌曲名 | 链接）</label>
          <textarea data-role="param" data-index="${index}" data-param="tracksText" placeholder="开场曲 | https://example.com/a.mp3&#10;中场曲 | D:\\\\music\\\\b.mp3">${escapeHtml(p.tracksText || '')}</textarea>
        </div>
      `;
    case 'SET_SOURCE_TRANSFORM':
      return `
        <div class="block-field">
          <label>场景名</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sceneName" value="${escapeHtml(p.sceneName || '')}">
        </div>
        <div class="block-field">
          <label>源名称（推荐）</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sourceName" value="${escapeHtml(p.sourceName || '')}">
        </div>
        <div class="block-field">
          <label>sceneItemId（可选）</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sceneItemId" value="${escapeHtml(p.sceneItemId || '')}">
        </div>
        <div class="block-field" style="grid-column: 1 / -1;">
          <label>transform JSON（positionX, positionY, scaleX, scaleY, rotation）</label>
          <textarea data-role="param-json" data-index="${index}" data-param="transform">${escapeHtml(stringifyJson(p.transform || {}))}</textarea>
        </div>
      `;
    case 'SET_FILTER_SETTINGS':
      return `
        <div class="block-field">
          <label>源名称</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sourceName" value="${escapeHtml(p.sourceName || '')}">
        </div>
        <div class="block-field">
          <label>滤镜名称</label>
          <input type="text" data-role="param" data-index="${index}" data-param="filterName" value="${escapeHtml(p.filterName || '')}">
        </div>
        <div class="block-field" style="grid-column: 1 / -1;">
          <label>settings JSON</label>
          <textarea data-role="param-json" data-index="${index}" data-param="settings">${escapeHtml(stringifyJson(p.settings || {}))}</textarea>
        </div>
      `;
    case 'SET_FILTER_ENABLED':
      return `
        <div class="block-field">
          <label>源名称</label>
          <input type="text" data-role="param" data-index="${index}" data-param="sourceName" value="${escapeHtml(p.sourceName || '')}">
        </div>
        <div class="block-field">
          <label>滤镜名称</label>
          <input type="text" data-role="param" data-index="${index}" data-param="filterName" value="${escapeHtml(p.filterName || '')}">
        </div>
        <div class="block-field">
          <label>状态</label>
          <select data-role="param-bool" data-index="${index}" data-param="enabled">
            <option value="true" ${p.enabled === false ? '' : 'selected'}>启用</option>
            <option value="false" ${p.enabled === false ? 'selected' : ''}>禁用</option>
          </select>
        </div>
      `;
    case 'CALL_CUSTOM_API':
      return `
        <div class="block-field" style="grid-column: 1 / -1;">
          <label>API 地址</label>
          <input type="text" data-role="param" data-index="${index}" data-param="url" value="${escapeHtml(p.url || '')}" placeholder="https://api.example.com/hook">
        </div>
        <div class="block-field">
          <label>Method</label>
          <input type="text" data-role="param" data-index="${index}" data-param="method" value="${escapeHtml(p.method || 'POST')}" placeholder="GET / POST / PUT / PATCH / DELETE">
        </div>
        <div class="block-field">
          <label>超时(ms)</label>
          <input type="text" data-role="param" data-index="${index}" data-param="timeoutMs" value="${escapeHtml(p.timeoutMs != null ? String(p.timeoutMs) : '8000')}" placeholder="8000">
        </div>
        <div class="block-field">
          <label>结果事件名（可选）</label>
          <input type="text" data-role="param" data-index="${index}" data-param="resultEventName" value="${escapeHtml(p.resultEventName || '')}" placeholder="如: api:player-loaded">
        </div>
        <div class="block-field">
          <label>目标页面</label>
          <input type="text" data-role="param" data-index="${index}" data-param="targetPage" value="${escapeHtml(p.targetPage || 'all')}" placeholder="all / frontend / custom-frontend / character-display">
        </div>
        <div class="block-field">
          <label>目标窗口ID（可选）</label>
          <input type="text" data-role="param" data-index="${index}" data-param="targetWindowId" value="${escapeHtml(p.targetWindowId || '')}" placeholder="如: frontend-main">
        </div>
        <div class="block-field" style="grid-column: 1 / -1;">
          <label>Headers JSON</label>
          <textarea data-role="param" data-index="${index}" data-param="headersJson">${escapeHtml(p.headersJson || '{}')}</textarea>
        </div>
        <div class="block-field" style="grid-column: 1 / -1;">
          <label>Body JSON / 文本</label>
          <textarea data-role="param" data-index="${index}" data-param="bodyJson">${escapeHtml(p.bodyJson || '{}')}</textarea>
        </div>
      `;
    case 'EMIT_CUSTOM_EVENT':
      return `
        <div class="block-field">
          <label>事件名</label>
          <input type="text" data-role="param" data-index="${index}" data-param="eventName" value="${escapeHtml(p.eventName || 'automation:custom-event')}" placeholder="event:name">
        </div>
        <div class="block-field">
          <label>目标页面</label>
          <input type="text" data-role="param" data-index="${index}" data-param="targetPage" value="${escapeHtml(p.targetPage || 'all')}" placeholder="all / frontend / custom-frontend / character-display">
        </div>
        <div class="block-field">
          <label>目标窗口ID（可选）</label>
          <input type="text" data-role="param" data-index="${index}" data-param="targetWindowId" value="${escapeHtml(p.targetWindowId || '')}" placeholder="如: frontend-main">
        </div>
        <div class="block-field" style="grid-column: 1 / -1;">
          <label>Payload JSON</label>
          <textarea data-role="param" data-index="${index}" data-param="payloadJson">${escapeHtml(p.payloadJson || '{}')}</textarea>
        </div>
      `;
    case 'SET_COMPONENT_PROPERTY':
      return `
        <div class="block-field">
          <label>组件ID</label>
          <input type="text" data-role="param" data-index="${index}" data-param="componentId" value="${escapeHtml(p.componentId || '')}" placeholder="组件 id（如 sponsorTicker）">
        </div>
        <div class="block-field">
          <label>目标页面</label>
          <input type="text" data-role="param" data-index="${index}" data-param="targetPage" value="${escapeHtml(p.targetPage || 'all')}" placeholder="all / frontend / custom-frontend / character-display">
        </div>
        <div class="block-field">
          <label>目标窗口ID（可选）</label>
          <input type="text" data-role="param" data-index="${index}" data-param="targetWindowId" value="${escapeHtml(p.targetWindowId || '')}" placeholder="如: frontend-main">
        </div>
        <div class="block-field" style="grid-column: 1 / -1;">
          <label>Patch JSON（支持 text/html/style/contentStyle/x/y/width/height/visible/zIndex/propertyPath/value）</label>
          <textarea data-role="param" data-index="${index}" data-param="patchJson">${escapeHtml(p.patchJson || '{"text":"Hello"}')}</textarea>
        </div>
      `;
    case 'EXECUTE_COMMAND':
      return `
        <div class="block-field">
          <label>命令名</label>
          <input type="text" data-role="param" data-index="${index}" data-param="command" value="${escapeHtml(p.command || '')}">
        </div>
        <div class="block-field">
          <label>参数（文本）</label>
          <input type="text" data-role="param" data-index="${index}" data-param="args" value="${escapeHtml(p.args || '')}">
        </div>
      `;
    case 'CUSTOM_SCRIPT':
      return `
        <div class="block-field" style="grid-column: 1 / -1;">
          <label>脚本内容（async）</label>
          <textarea data-role="param" data-index="${index}" data-param="script">${escapeHtml(p.script || '')}</textarea>
        </div>
      `;
    default:
      return `
        <div class="block-field" style="grid-column: 1 / -1;">
          <label>自定义参数 JSON</label>
          <textarea data-role="param-json" data-index="${index}" data-param="__all_params_json__">${escapeHtml(stringifyJson(p || {}))}</textarea>
        </div>
      `;
  }
}

function clearDropZoneState() {
  document.querySelectorAll('.drop-zone.active').forEach((zone) => zone.classList.remove('active'));
  dragPayload = null;
}

function insertActionAt(index, type) {
  const actions = getCurrentRuleActions();
  const action = createDefaultAction(type);
  actions.splice(index, 0, action);
  renderCanvas();
  renderRulesList();
}

function moveAction(fromIndex, insertIndex) {
  const actions = getCurrentRuleActions();
  if (fromIndex < 0 || fromIndex >= actions.length) return;
  let target = insertIndex;
  if (target < 0) target = 0;
  if (target > actions.length) target = actions.length;
  const moved = actions.splice(fromIndex, 1)[0];
  if (!moved) return;
  if (fromIndex < target) target -= 1;
  actions.splice(target, 0, moved);
  renderCanvas();
}

function removeAction(index) {
  const actions = getCurrentRuleActions();
  if (index < 0 || index >= actions.length) return;
  actions.splice(index, 1);
  renderCanvas();
  renderRulesList();
}

function changeActionType(index, type) {
  const actions = getCurrentRuleActions();
  if (!ACTION_MAP[type] || !actions[index]) return;
  const old = actions[index];
  actions[index] = {
    type,
    enabled: old.enabled !== false,
    delay: old.delay || '',
    params: { ...ACTION_MAP[type].defaults }
  };
  renderCanvas();
}

function updateAction(index, patch) {
  const actions = getCurrentRuleActions();
  if (!actions[index]) return;
  actions[index] = { ...actions[index], ...patch };
}

function updateActionParam(index, key, value) {
  const actions = getCurrentRuleActions();
  if (!actions[index]) return;
  if (!actions[index].params || typeof actions[index].params !== 'object') {
    actions[index].params = {};
  }
  actions[index].params[key] = value;
}

function collectCurrentRuleForm() {
  if (currentRuleIndex < 0 || !rules[currentRuleIndex]) return;
  if (editorMode === MODE_SCRATCH) {
    syncRuleFromScratchWorkspace();
  }
  const rule = rules[currentRuleIndex];
  rule.name = document.getElementById('ruleName').value.trim() || '未命名规则';
  rule.description = document.getElementById('ruleDescription').value || '';
  rule.enabled = document.getElementById('ruleEnabled').checked;
  rule.triggerType = document.getElementById('ruleTriggerType').value;
  rule.delay = document.getElementById('ruleDelay').value.trim() || '0';
  rule.cooldown = document.getElementById('ruleCooldown').value.trim() || '0';
  rule.interval = document.getElementById('ruleInterval').value.trim() || '1m';
  rule.maxTriggers = Number(document.getElementById('ruleMaxTriggers').value || 0);
  rule.condition = document.getElementById('ruleCondition').value.trim();
  if (!Array.isArray(rule.actions)) rule.actions = [];
}

function normalizeRule(rule) {
  const normalized = {
    id: rule.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: rule.name || '未命名规则',
    description: rule.description || '',
    enabled: rule.enabled !== false,
    triggerType: rule.triggerType || 'bp:hunter-selected',
    delay: rule.delay != null ? rule.delay : '0',
    cooldown: rule.cooldown != null ? rule.cooldown : '0',
    interval: rule.interval != null ? rule.interval : '1m',
    maxTriggers: Number(rule.maxTriggers || 0),
    condition: rule.condition || '',
    actions: []
  };
  const list = Array.isArray(rule.actions) ? rule.actions : [];
  normalized.actions = list.map((action) => {
    const rawType = typeof action.type === 'string' ? action.type.trim() : '';
    const type = rawType || 'SWITCH_SCENE';
    const defaults = ACTION_MAP[type]?.defaults || {};
    return {
      type,
      enabled: action.enabled !== false,
      delay: action.delay != null ? action.delay : '',
      params: { ...defaults, ...(action.params || {}) }
    };
  });
  return normalized;
}

function createDefaultAction(type) {
  const meta = ACTION_MAP[type] || ACTION_MAP.SWITCH_SCENE;
  return {
    type: meta.type,
    enabled: true,
    delay: '',
    params: { ...(meta.defaults || {}) }
  };
}

function createNewRule() {
  collectCurrentRuleForm();
  const newRule = normalizeRule({
    id: `rule_${Date.now()}`,
    name: '新规则',
    triggerType: 'bp:survivor-1-selected',
    actions: [createDefaultAction('SWITCH_SCENE')]
  });
  rules.push(newRule);
  selectRule(rules.length - 1);
  renderRulesList();
  showToast('已创建新规则', 'info');
}

async function saveCurrentRule() {
  if (currentRuleIndex < 0) return;
  collectCurrentRuleForm();
  try {
    const result = await window.obsAPI.saveRules(rules);
    if (result && result.success === false) {
      throw new Error(result.error || '未知错误');
    }
    renderRulesList();
    showToast('当前规则已保存', 'success');
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

async function testCurrentRule() {
  if (currentRuleIndex < 0) return;
  collectCurrentRuleForm();
  const rule = rules[currentRuleIndex];
  try {
    const result = await window.obsAPI.testRule(rule);
    if (!result || result.success === false) {
      throw new Error(result?.error || '测试失败');
    }
    showToast('测试触发已发送', 'success');
  } catch (e) {
    showToast('测试失败: ' + e.message, 'error');
  }
}

function deleteCurrentRule() {
  if (currentRuleIndex < 0) return;
  const name = rules[currentRuleIndex]?.name || '该规则';
  if (!confirm(`确认删除“${name}”吗？`)) return;
  rules.splice(currentRuleIndex, 1);
  if (!rules.length) {
    currentRuleIndex = -1;
    showEditor(false);
  } else {
    currentRuleIndex = Math.max(0, currentRuleIndex - 1);
    selectRule(currentRuleIndex);
  }
  renderRulesList();
  showToast('规则已删除', 'info');
}

async function saveAllRules() {
  collectCurrentRuleForm();
  try {
    const result = await window.obsAPI.saveRules(rules);
    if (!result || result.success === false) {
      throw new Error(result?.error || '未知错误');
    }
    renderRulesList();
    showToast(`已保存 ${rules.length} 条规则`, 'success');
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

async function connectOBS() {
  const config = {
    host: el.host.value.trim() || 'localhost',
    port: Number(el.port.value) || 4455,
    password: el.password.value || '',
    autoConnect: el.autoConnect.checked
  };
  try {
    const result = await window.obsAPI.connect(config);
    if (!result || result.success === false) {
      throw new Error(result?.error || '连接失败');
    }
    showToast('OBS 连接成功', 'success');
  } catch (e) {
    showToast('连接失败: ' + e.message, 'error');
  }
}

async function disconnectOBS() {
  try {
    await window.obsAPI.disconnect();
    showToast('OBS 已断开', 'info');
  } catch (e) {
    showToast('断开失败: ' + e.message, 'error');
  }
}

async function saveConfig() {
  const config = {
    host: el.host.value.trim() || 'localhost',
    port: Number(el.port.value) || 4455,
    password: el.password.value || '',
    autoConnect: el.autoConnect.checked
  };
  try {
    const result = await window.obsAPI.saveConfig(config);
    if (!result || result.success === false) {
      throw new Error(result?.error || '保存失败');
    }
    showToast('连接配置已保存', 'success');
  } catch (e) {
    showToast('保存失败: ' + e.message, 'error');
  }
}

async function openTutorial() {
  try {
    await window.obsAPI.openTutorial();
  } catch (e) {
    showToast('打开教程失败: ' + e.message, 'error');
  }
}

function setEditorMode(mode) {
  if (mode !== MODE_CLASSIC && mode !== MODE_SCRATCH) return;
  editorMode = mode;
  const isScratch = mode === MODE_SCRATCH;
  el.modeClassic.classList.toggle('active', !isScratch);
  el.modeScratch.classList.toggle('active', isScratch);
  el.workspaceClassic.style.display = isScratch ? 'none' : 'grid';
  el.workspaceScratch.style.display = isScratch ? 'grid' : 'none';

  if (isScratch) {
    if (!ensureScratchWorkspace()) {
      editorMode = MODE_CLASSIC;
      el.modeClassic.classList.add('active');
      el.modeScratch.classList.remove('active');
      el.workspaceClassic.style.display = 'grid';
      el.workspaceScratch.style.display = 'none';
      return;
    }
    if (currentRuleIndex >= 0 && rules[currentRuleIndex]) {
      syncRuleToScratchWorkspace(rules[currentRuleIndex]);
    }
    if (window.Blockly && scratchWorkspace) {
      window.Blockly.svgResize(scratchWorkspace);
    }
  } else {
    syncRuleFromScratchWorkspace();
    renderCanvas();
  }
}

function loadCustomBlocks() {
  try {
    const raw = localStorage.getItem(CUSTOM_BLOCK_STORAGE_KEY);
    if (!raw) {
      customBlocks = [];
      return;
    }
    const parsed = JSON.parse(raw);
    customBlocks = Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') : [];
  } catch {
    customBlocks = [];
  }
}

function saveCustomBlocks() {
  try {
    localStorage.setItem(CUSTOM_BLOCK_STORAGE_KEY, JSON.stringify(customBlocks));
  } catch {
    showToast('自定义积木保存失败', 'error');
  }
}

function renderCustomBlockList() {
  if (!el.scratchCustomList) return;
  if (!customBlocks.length) {
    el.scratchCustomList.innerHTML = '<div class="canvas-empty">还没有自定义积木。点击上方按钮创建。</div>';
    return;
  }
  el.scratchCustomList.innerHTML = customBlocks.map((item) => {
    const typeText = escapeHtml(item.actionType || '未指定');
    const categoryText = escapeHtml(item.group || '自定义');
    const labelText = escapeHtml(item.label || '未命名积木');
    return `
      <div class="scratch-custom-item">
        <h4>${labelText}</h4>
        <p>ActionType: ${typeText}</p>
        <p>分类: ${categoryText}</p>
        <button class="btn danger" data-role="delete-custom-block" data-id="${escapeAttr(item.id || '')}" type="button">删除</button>
      </div>
    `;
  }).join('');
}

function createCustomBlockByPrompt() {
  const label = (prompt('请输入自定义积木显示名称（例如：切 Sponsor 图层）', '我的自定义动作') || '').trim();
  if (!label) return;

  const actionType = (prompt('请输入 ActionType（必须与 OBS 自动化动作类型一致，或使用你自己的扩展类型）', 'EXECUTE_COMMAND') || '').trim();
  if (!actionType) {
    showToast('ActionType 不能为空', 'error');
    return;
  }

  const group = (prompt('请输入分类名称（用于工具箱分组）', '自定义') || '').trim() || '自定义';
  const defaultsRaw = prompt('请输入参数默认值 JSON（对象），例如 {"command":"scene.jump","args":"{{bpHunter}}"}', '{"command":"","args":""}');
  if (defaultsRaw == null) return;

  let defaults;
  try {
    defaults = defaultsRaw.trim() ? JSON.parse(defaultsRaw) : {};
  } catch {
    showToast('参数默认值 JSON 解析失败', 'error');
    return;
  }

  if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
    showToast('参数默认值必须是 JSON 对象', 'error');
    return;
  }

  const color = (prompt('请输入积木颜色（可选，十六进制，例如 #ff9f43）', '#ff9f43') || '').trim() || '#ff9f43';
  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  customBlocks.push({
    id,
    label,
    actionType,
    group,
    defaults,
    color
  });
  saveCustomBlocks();
  renderCustomBlockList();
  rebuildScratchBlocksAndToolbox();
  showToast('自定义积木已创建', 'success');
}

function deleteCustomBlock(id) {
  const idx = customBlocks.findIndex((item) => item.id === id);
  if (idx < 0) return;
  const target = customBlocks[idx];
  if (!confirm(`确认删除自定义积木“${target.label || target.id}”？`)) return;
  customBlocks.splice(idx, 1);
  saveCustomBlocks();
  renderCustomBlockList();
  rebuildScratchBlocksAndToolbox();
  showToast('自定义积木已删除', 'info');
}

function exportCustomBlocks() {
  const text = JSON.stringify(customBlocks, null, 2);
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text);
      showToast('已复制自定义积木 JSON 到剪贴板', 'success');
      return;
    }
  } catch {
    // fallback prompt below
  }
  prompt('复制以下自定义积木 JSON', text);
}

function importCustomBlocks() {
  const raw = prompt('请粘贴自定义积木 JSON（数组）');
  if (raw == null) return;
  let parsed;
  try {
    parsed = raw.trim() ? JSON.parse(raw) : [];
  } catch {
    showToast('JSON 格式错误', 'error');
    return;
  }
  if (!Array.isArray(parsed)) {
    showToast('导入内容必须是数组', 'error');
    return;
  }
  customBlocks = parsed
    .filter((item) => item && typeof item === 'object')
    .map((item, idx) => ({
      id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `imported_${Date.now()}_${idx}`,
      label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : `导入积木 ${idx + 1}`,
      actionType: typeof item.actionType === 'string' && item.actionType.trim() ? item.actionType.trim() : 'EXECUTE_COMMAND',
      group: typeof item.group === 'string' && item.group.trim() ? item.group.trim() : '自定义',
      defaults: item.defaults && typeof item.defaults === 'object' && !Array.isArray(item.defaults) ? item.defaults : {},
      color: typeof item.color === 'string' && item.color.trim() ? item.color.trim() : '#ff9f43'
    }));
  saveCustomBlocks();
  renderCustomBlockList();
  rebuildScratchBlocksAndToolbox();
  showToast(`已导入 ${customBlocks.length} 个自定义积木`, 'success');
}

function ensureScratchWorkspace() {
  if (scratchWorkspace) return true;
  if (!window.Blockly) {
    showToast('Blockly 未加载，无法使用 Scratch 模式', 'error');
    return false;
  }
  if (!el.scratchWorkspace) return false;

  if (typeof window.Blockly.setLocale === 'function' && window.Blockly.Msg) {
    try {
      window.Blockly.setLocale(window.Blockly.Msg);
    } catch {
      // ignore locale setup errors
    }
  }

  if (!window.Blockly.Themes?.ASGDirectorScratch) {
    window.Blockly.Theme.defineTheme('ASGDirectorScratch', {
      base: window.Blockly.Themes?.Zelos || window.Blockly.Themes?.Classic,
      blockStyles: {
        event_blocks: { colourPrimary: '#ffbf00', colourSecondary: '#f6a600', colourTertiary: '#f59e0b' },
        action_blocks: { colourPrimary: '#60a5fa', colourSecondary: '#3b82f6', colourTertiary: '#2563eb' },
        custom_blocks: { colourPrimary: '#fb923c', colourSecondary: '#f97316', colourTertiary: '#ea580c' }
      },
      categoryStyles: {
        event_category: { colour: '#ffbf00' },
        scene_category: { colour: '#4f83ff' },
        source_category: { colour: '#26a69a' },
        flow_category: { colour: '#fb8c00' },
        advanced_category: { colour: '#8e66ff' },
        stream_category: { colour: '#ef5350' },
        ext_category: { colour: '#ff7043' },
        custom_category: { colour: '#fb923c' }
      },
      componentStyles: {
        workspaceBackgroundColour: '#1f2430',
        toolboxBackgroundColour: '#131820',
        toolboxForegroundColour: '#f8fafc',
        flyoutBackgroundColour: '#111827',
        flyoutForegroundColour: '#e2e8f0',
        flyoutOpacity: 1,
        scrollbarColour: '#4b5563',
        insertionMarkerColour: '#22d3ee',
        insertionMarkerOpacity: 0.3,
        markerColour: '#7dd3fc',
        cursorColour: '#7dd3fc'
      }
    });
  }

  rebuildScratchBlocksAndToolbox();

  scratchWorkspace = window.Blockly.inject(el.scratchWorkspace, {
    renderer: 'zelos',
    theme: window.Blockly.Themes.ASGDirectorScratch,
    toolbox: buildScratchToolbox(),
    grid: { spacing: 24, length: 2, colour: '#354154', snap: true },
    move: { scrollbars: true, drag: true, wheel: true },
    zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 1.5, minScale: 0.5, scaleSpeed: 1.1 },
    trashcan: true
  });
  scratchBuilt = true;

  scratchWorkspace.addChangeListener((event) => {
    if (scratchSyncing) return;
    if (!event) return;
    syncRuleFromScratchWorkspace();
    renderRulesList();
  });

  if (currentRuleIndex >= 0 && rules[currentRuleIndex]) {
    syncRuleToScratchWorkspace(rules[currentRuleIndex]);
  }

  return true;
}

function rebuildScratchBlocksAndToolbox() {
  if (!window.Blockly) return;

  actionBlockTypeMap = {};
  scratchBlockConfigByType = {};

  registerScratchEventBlock();
  registerScratchRawActionBlock();

  for (const action of ACTION_LIBRARY) {
    const blockType = getBuiltinBlockType(action.type);
    const color = BUILTIN_ACTION_COLORS[action.group] || '#60a5fa';
    registerScratchActionBlock({
      blockType,
      actionType: action.type,
      label: action.label,
      desc: action.desc,
      defaults: action.defaults || {},
      color,
      isCustom: false
    });
  }

  for (const custom of customBlocks) {
    const blockType = getCustomBlockType(custom.id);
    registerScratchActionBlock({
      blockType,
      actionType: custom.actionType,
      label: custom.label || '自定义积木',
      desc: `${custom.group || '自定义'} / ${custom.actionType || ''}`,
      defaults: custom.defaults || {},
      color: custom.color || '#fb923c',
      isCustom: true,
      customId: custom.id
    });
  }

  if (scratchWorkspace && scratchBuilt) {
    scratchWorkspace.updateToolbox(buildScratchToolbox());
    if (currentRuleIndex >= 0 && rules[currentRuleIndex]) {
      syncRuleToScratchWorkspace(rules[currentRuleIndex]);
    }
  }
}

function registerScratchEventBlock() {
  if (!window.Blockly) return;
  const blockType = 'obs_event_when';
  window.Blockly.Blocks[blockType] = {
    init() {
      const triggerOptions = TRIGGER_DEFS.map((item) => [item.label, item.value]);
      this.appendDummyInput('event_head')
        .appendField('当')
        .appendField(new window.Blockly.FieldDropdown(triggerOptions), 'TRIGGER')
        .appendField('触发');
      this.setNextStatement(true, null);
      this.setStyle('event_blocks');
      this.setTooltip('规则触发入口');
      this.setHelpUrl('');
    }
  };
}

function registerScratchRawActionBlock() {
  if (!window.Blockly) return;
  const blockType = 'obs_action_raw';
  scratchBlockConfigByType[blockType] = {
    blockType,
    actionType: '',
    defaults: {},
    paramSpecs: [],
    isCustom: true
  };
  window.Blockly.Blocks[blockType] = {
    init() {
      this.appendDummyInput('title').appendField('自定义动作（原始）');
      this.appendDummyInput('type_input')
        .appendField('ActionType')
        .appendField(new window.Blockly.FieldTextInput('EXECUTE_COMMAND'), 'ACTION_TYPE');
      this.appendDummyInput('enabled_input')
        .appendField('启用')
        .appendField(new window.Blockly.FieldDropdown([['是', 'true'], ['否', 'false']]), 'ENABLED');
      this.appendDummyInput('delay_input')
        .appendField('动作延迟')
        .appendField(new window.Blockly.FieldTextInput(''), 'ACTION_DELAY');
      this.appendDummyInput('params_input')
        .appendField('参数JSON')
        .appendField(new window.Blockly.FieldTextInput('{}'), 'PARAMS_JSON');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('custom_blocks');
      this.setTooltip('可输入任意 ActionType + 参数 JSON');
      this.setHelpUrl('');
    }
  };
}

function registerScratchActionBlock(config) {
  if (!window.Blockly) return;
  const blockType = config.blockType;
  const actionType = config.actionType;
  const paramSpecs = buildParamSpecsFromDefaults(config.defaults || {});

  scratchBlockConfigByType[blockType] = {
    blockType,
    actionType,
    defaults: config.defaults || {},
    paramSpecs,
    isCustom: config.isCustom === true,
    customId: config.customId || ''
  };

  if (!config.isCustom) {
    actionBlockTypeMap[actionType] = blockType;
  }

  window.Blockly.Blocks[blockType] = {
    init() {
      this.appendDummyInput('title').appendField(config.label || actionType || blockType);
      this.appendDummyInput('enabled_input')
        .appendField('启用')
        .appendField(new window.Blockly.FieldDropdown([['是', 'true'], ['否', 'false']]), 'ENABLED');
      this.appendDummyInput('delay_input')
        .appendField('动作延迟')
        .appendField(new window.Blockly.FieldTextInput(''), 'ACTION_DELAY');

      for (const spec of paramSpecs) {
        const fieldName = getScratchParamFieldName(spec.key);
        const row = this.appendDummyInput(`param_${spec.key}`);
        row.appendField(spec.label);
        if (spec.fieldType === 'bool') {
          row.appendField(
            new window.Blockly.FieldDropdown([['true', 'true'], ['false', 'false']]),
            fieldName
          );
        } else {
          row.appendField(new window.Blockly.FieldTextInput(formatScratchDefault(spec.defaultValue, spec.fieldType)), fieldName);
        }
      }

      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      if (config.isCustom) {
        this.setStyle('custom_blocks');
      } else {
        this.setStyle('action_blocks');
        this.setColour(config.color || '#60a5fa');
      }
      this.setTooltip(config.desc || '');
      this.setHelpUrl('');
    }
  };
}

function buildScratchToolbox() {
  const groupMap = {};
  for (const item of ACTION_LIBRARY) {
    if (!groupMap[item.group]) groupMap[item.group] = [];
    groupMap[item.group].push(item);
  }

  const groupToCategory = {
    '场景控制': 'scene_category',
    '源控制': 'source_category',
    '流程控制': 'flow_category',
    '高级控制': 'advanced_category',
    '直播控制': 'stream_category',
    '扩展': 'ext_category'
  };

  const contents = [
    {
      kind: 'category',
      name: '触发',
      categorystyle: 'event_category',
      contents: [{ kind: 'block', type: 'obs_event_when' }]
    }
  ];

  for (const [groupName, list] of Object.entries(groupMap)) {
    contents.push({
      kind: 'category',
      name: groupName,
      categorystyle: groupToCategory[groupName] || 'scene_category',
      contents: list.map((item) => ({ kind: 'block', type: getBuiltinBlockType(item.type) }))
    });
  }

  const customCategoryContents = [{ kind: 'block', type: 'obs_action_raw' }];
  for (const custom of customBlocks) {
    customCategoryContents.push({
      kind: 'block',
      type: getCustomBlockType(custom.id)
    });
  }
  contents.push({
    kind: 'category',
    name: '自定义',
    categorystyle: 'custom_category',
    contents: customCategoryContents
  });

  return {
    kind: 'categoryToolbox',
    contents
  };
}

function syncRuleToScratchWorkspace(rule) {
  if (!scratchWorkspace || !rule) return;
  scratchSyncing = true;
  try {
    scratchWorkspace.clear();
    const eventBlock = scratchWorkspace.newBlock('obs_event_when');
    eventBlock.initSvg();
    eventBlock.render();
    const triggerType = TRIGGER_DEFS.some((item) => item.value === rule.triggerType)
      ? rule.triggerType
      : TRIGGER_DEFS[0].value;
    eventBlock.setFieldValue(triggerType, 'TRIGGER');
    eventBlock.moveBy(48, 40);

    let prev = eventBlock;
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    for (const action of actions) {
      const blockType = resolveScratchBlockTypeForAction(action);
      if (!blockType || !window.Blockly.Blocks[blockType]) continue;
      const block = scratchWorkspace.newBlock(blockType);
      applyActionToScratchBlock(block, action);
      block.initSvg();
      block.render();
      if (prev.nextConnection && block.previousConnection) {
        prev.nextConnection.connect(block.previousConnection);
      }
      prev = block;
    }

    scratchWorkspace.render();
    if (window.Blockly) {
      window.Blockly.svgResize(scratchWorkspace);
    }
  } finally {
    scratchSyncing = false;
  }
}

function syncRuleFromScratchWorkspace() {
  if (!scratchWorkspace || scratchSyncing) return;
  if (currentRuleIndex < 0 || !rules[currentRuleIndex]) return;

  const rule = rules[currentRuleIndex];
  const topBlocks = scratchWorkspace.getTopBlocks(true);
  const eventBlock = topBlocks.find((block) => block.type === 'obs_event_when') || null;

  let firstAction = null;
  if (eventBlock) {
    const triggerType = eventBlock.getFieldValue('TRIGGER');
    if (triggerType && TRIGGER_DEFS.some((item) => item.value === triggerType)) {
      rule.triggerType = triggerType;
      el.triggerType.value = triggerType;
      updateTriggerHint(triggerType);
    }
    firstAction = eventBlock.getNextBlock();
  } else {
    firstAction = topBlocks.find((block) => isScratchActionBlockType(block.type)) || null;
  }

  rule.actions = collectScratchActions(firstAction);
}

function collectScratchActions(firstBlock) {
  const actions = [];
  let block = firstBlock;
  let guard = 0;
  while (block && guard < 300) {
    guard += 1;
    if (isScratchActionBlockType(block.type)) {
      actions.push(createActionFromScratchBlock(block));
    }
    block = block.getNextBlock();
  }
  return actions;
}

function createActionFromScratchBlock(block) {
  if (block.type === 'obs_action_raw') {
    let params = {};
    try {
      const raw = block.getFieldValue('PARAMS_JSON');
      params = raw ? JSON.parse(raw) : {};
    } catch {
      params = {};
    }
    return {
      type: (block.getFieldValue('ACTION_TYPE') || 'EXECUTE_COMMAND').trim() || 'EXECUTE_COMMAND',
      enabled: block.getFieldValue('ENABLED') !== 'false',
      delay: block.getFieldValue('ACTION_DELAY') || '',
      params: params && typeof params === 'object' ? params : {}
    };
  }

  const config = scratchBlockConfigByType[block.type];
  if (!config) {
    return createDefaultAction('SWITCH_SCENE');
  }

  const params = {};
  for (const spec of config.paramSpecs || []) {
    const fieldName = getScratchParamFieldName(spec.key);
    const rawValue = block.getFieldValue(fieldName);
    params[spec.key] = parseScratchFieldValue(rawValue, spec.fieldType, spec.defaultValue);
  }

  return {
    type: config.actionType || 'EXECUTE_COMMAND',
    enabled: block.getFieldValue('ENABLED') !== 'false',
    delay: block.getFieldValue('ACTION_DELAY') || '',
    params
  };
}

function applyActionToScratchBlock(block, action) {
  if (!block || !action) return;
  block.setFieldValue(action.enabled === false ? 'false' : 'true', 'ENABLED');
  block.setFieldValue(action.delay != null ? String(action.delay) : '', 'ACTION_DELAY');

  if (block.type === 'obs_action_raw') {
    block.setFieldValue(action.type || 'EXECUTE_COMMAND', 'ACTION_TYPE');
    block.setFieldValue(stringifyJsonCompact(action.params || {}), 'PARAMS_JSON');
    return;
  }

  const config = scratchBlockConfigByType[block.type];
  if (!config) return;
  const params = action.params && typeof action.params === 'object' ? action.params : {};
  for (const spec of config.paramSpecs || []) {
    const fieldName = getScratchParamFieldName(spec.key);
    const value = params[spec.key] !== undefined ? params[spec.key] : spec.defaultValue;
    if (spec.fieldType === 'bool') {
      block.setFieldValue(value === false ? 'false' : 'true', fieldName);
    } else if (spec.fieldType === 'json') {
      block.setFieldValue(stringifyJsonCompact(value), fieldName);
    } else {
      block.setFieldValue(value == null ? '' : String(value), fieldName);
    }
  }
}

function resolveScratchBlockTypeForAction(action) {
  if (!action || typeof action !== 'object') return 'obs_action_raw';
  const type = typeof action.type === 'string' ? action.type.trim() : '';
  if (!type) return 'obs_action_raw';

  if (actionBlockTypeMap[type]) {
    return actionBlockTypeMap[type];
  }

  for (const [blockType, config] of Object.entries(scratchBlockConfigByType)) {
    if (config?.isCustom && config.actionType === type) {
      return blockType;
    }
  }
  return 'obs_action_raw';
}

function updateScratchTriggerFromForm() {
  if (!scratchWorkspace || scratchSyncing) return;
  const eventBlock = scratchWorkspace.getTopBlocks(true).find((block) => block.type === 'obs_event_when');
  if (!eventBlock) return;
  const triggerType = el.triggerType.value;
  if (!TRIGGER_DEFS.some((item) => item.value === triggerType)) return;
  scratchSyncing = true;
  try {
    eventBlock.setFieldValue(triggerType, 'TRIGGER');
  } finally {
    scratchSyncing = false;
  }
}

function buildParamSpecsFromDefaults(defaults) {
  const list = [];
  const entries = Object.entries(defaults || {});
  for (const [key, value] of entries) {
    list.push({
      key,
      label: mapParamLabel(key),
      fieldType: inferScratchFieldType(value),
      defaultValue: value
    });
  }
  return list;
}

function inferScratchFieldType(value) {
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return 'number';
  if (value && typeof value === 'object') return 'json';
  return 'text';
}

function parseScratchFieldValue(rawValue, fieldType, defaultValue) {
  if (fieldType === 'bool') {
    return rawValue === 'true';
  }
  if (fieldType === 'number') {
    const n = Number(rawValue);
    return Number.isFinite(n) ? n : (Number.isFinite(defaultValue) ? defaultValue : 0);
  }
  if (fieldType === 'json') {
    try {
      return rawValue ? JSON.parse(rawValue) : {};
    } catch {
      return (defaultValue && typeof defaultValue === 'object') ? defaultValue : {};
    }
  }
  return rawValue == null ? '' : String(rawValue);
}

function formatScratchDefault(value, fieldType) {
  if (fieldType === 'bool') return value === false ? 'false' : 'true';
  if (fieldType === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (fieldType === 'json') return stringifyJsonCompact(value || {});
  return value == null ? '' : String(value);
}

function mapParamLabel(key) {
  const labels = {
    sceneName: '场景名',
    sceneItemId: 'SceneItemId',
    visible: '可见',
    duration: '时长',
    sourceName: '源名称',
    text: '文本',
    file: '文件',
    url: 'URL',
    settings: '设置JSON',
    overlay: 'Overlay',
    mediaUrl: '媒体地址',
    isLocalFile: '本地文件',
    restart: '重启播放',
    tracksText: '歌曲列表',
    filterName: '滤镜名',
    enabled: '启用',
    command: '命令',
    args: '参数',
    script: '脚本',
    transform: '变换JSON'
    ,
    method: 'Method',
    headersJson: 'Headers JSON',
    bodyJson: 'Body JSON',
    timeoutMs: '超时(ms)',
    resultEventName: '结果事件名',
    targetPage: '目标页面',
    targetWindowId: '目标窗口ID',
    eventName: '事件名',
    payloadJson: 'Payload JSON',
    componentId: '组件ID',
    patchJson: 'Patch JSON',
    propertyPath: '属性路径',
    value: '值'
  };
  return labels[key] || key;
}

function getBuiltinBlockType(actionType) {
  return `obs_action_${toScratchId(actionType)}`;
}

function getCustomBlockType(customId) {
  return `obs_custom_${toScratchId(customId)}`;
}

function toScratchId(text) {
  return String(text || '')
    .replace(/[^a-zA-Z0-9_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'x';
}

function getScratchParamFieldName(key) {
  return `P_${key}`;
}

function isScratchActionBlockType(type) {
  if (!type) return false;
  return type === 'obs_action_raw' || !!scratchBlockConfigByType[type];
}

function getTriggerLabel(triggerType) {
  const found = TRIGGER_DEFS.find((item) => item.value === triggerType);
  return found ? found.label : triggerType;
}

function stringifyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}

function stringifyJsonCompact(value) {
  try {
    return JSON.stringify(value == null ? {} : value);
  } catch {
    return '{}';
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2600);
}
