let components = []
let frontendWindowProfiles = []
let selectedComponentId = null
let hasUnsavedChanges = false
let draggingComponentId = null

const MAIN_FRONTEND_WINDOW = {
  id: 'frontend-main',
  name: '主前台窗口',
  width: 1280,
  height: 720,
  autoOpen: true,
  alwaysOnTop: false,
  builtin: true
}

const PREVIEW_TEMPLATE_VARS = {
  bpHunter: '红蝶',
  bpSurvivors: ['园丁', '医生', '前锋', '调香师'],
  'bpSurvivors.0': '园丁',
  'bpSurvivors.1': '医生',
  'bpSurvivors.2': '前锋',
  'bpSurvivors.3': '调香师',
  bpSurvivorsText: '园丁, 医生, 前锋, 调香师',
  bpBannedSurvivorsText: '先知, 祭司',
  bpBannedHuntersText: '梦之女巫',
  matchTitle: 'A队 vs B队',
  matchScore: '2:1',
  matchScoreText: 'A队 2 : 1 B队',
  roomId: 'local-bp',
  roomName: '本地 BP',
  timestamp: Date.now()
}

const COMPONENT_TRIGGER_DEFS = [
  { value: 'component:init', label: '组件加载完成' },
  { value: 'component:click', label: '组件被点击' },
  { value: 'component:dblclick', label: '组件被双击' },
  { value: 'component:mouseenter', label: '鼠标移入组件' },
  { value: 'component:mouseleave', label: '鼠标离开组件' },
  { value: 'custom:event', label: '自定义事件' },
  { value: 'bp:hunter-selected', label: 'BP 监管者已选' },
  { value: 'bp:survivor-selected', label: 'BP 求生者已选' },
  { value: 'localbp:state-updated', label: '本地BP状态更新' },
  { value: 'localbp:score-updated', label: '比分更新' }
]

const COMPONENT_ACTION_LIBRARY = [
  { type: 'DELAY', group: 'flow', label: '等待', defaults: { duration: '500ms' } },
  { type: 'SET_COMPONENT_PROPERTY', group: 'component', label: '修改组件属性', defaults: { componentId: '', patchJson: '{"text":"{{bpHunter}}"}' } },
  { type: 'CALL_CUSTOM_API', group: 'data', label: '调用自定义 API', defaults: { url: '', method: 'GET', headersJson: '{}', bodyJson: '{}', timeoutMs: '8000', saveAs: 'lastApi', resultEventName: '' } },
  { type: 'EMIT_CUSTOM_EVENT', group: 'event', label: '触发自定义事件', defaults: { eventName: 'component:event', payloadJson: '{}' } },
  { type: 'EXECUTE_COMMAND', group: 'event', label: '执行动作命令', defaults: { command: '', argsJson: '{}' } }
]

const COMPONENT_ACTION_MAP = COMPONENT_ACTION_LIBRARY.reduce((acc, item) => {
  acc[item.type] = item
  return acc
}, {})

let selectedBehaviorRuleIdByComponent = {}

function generateId(prefix = 'comp') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

function sanitizeWindowId(input) {
  const value = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return value
}

function normalizeFrontendWindowProfile(raw, index = 0) {
  const item = (raw && typeof raw === 'object') ? raw : {}
  const id = sanitizeWindowId(item.id || `frontend-window-${index + 1}`)
  if (!id || id === MAIN_FRONTEND_WINDOW.id) return null
  return {
    id,
    name: String(item.name || `前台窗口 ${index + 1}`).trim() || `前台窗口 ${index + 1}`,
    width: Number.isFinite(Number(item.width)) ? Math.max(320, Math.round(Number(item.width))) : 1280,
    height: Number.isFinite(Number(item.height)) ? Math.max(180, Math.round(Number(item.height))) : 720,
    autoOpen: item.autoOpen !== false,
    alwaysOnTop: item.alwaysOnTop === true,
    enabled: item.enabled !== false
  }
}

function getAvailableFrontendWindows() {
  return [MAIN_FRONTEND_WINDOW, ...frontendWindowProfiles]
}

function getAvailableFrontendWindowIdSet() {
  return new Set(getAvailableFrontendWindows().map(item => item.id))
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast')
  if (!toast) return
  toast.textContent = message
  toast.className = 'toast ' + type
  toast.classList.add('show')
  setTimeout(() => toast.classList.remove('show'), 2500)
}

async function openComponentBehaviorTutorial() {
  try {
    if (!window.electronAPI || typeof window.electronAPI.openComponentDesignerTutorial !== 'function') {
      showToast('当前版本不支持教程窗口，请升级应用', 'error')
      return
    }
    const result = await window.electronAPI.openComponentDesignerTutorial()
    if (!result || !result.success) {
      showToast(`打开教程失败: ${(result && result.error) || '未知错误'}`, 'error')
    }
  } catch (error) {
    showToast(`打开教程失败: ${error.message || error}`, 'error')
  }
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/"/g, '&quot;')
}

function resolveTemplate(template, vars, eventData = {}) {
  if (typeof template !== 'string' || !template) return ''
  return template.replace(/\{\{([^}]+)\}\}/g, (full, pathExpr) => {
    const key = String(pathExpr || '').trim()
    if (!key) return ''

    if (key.startsWith('eventData.')) {
      const path = key.slice(10)
      return nestedValue(eventData, path) ?? ''
    }

    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return vars[key] ?? ''
    }

    return nestedValue(vars, key) ?? ''
  })
}

function nestedValue(obj, pathExpr) {
  const source = (obj && typeof obj === 'object') ? obj : null
  if (!source || !pathExpr) return undefined
  const parts = String(pathExpr).split('.')
  let cursor = source
  for (const part of parts) {
    if (cursor == null) return undefined
    cursor = cursor[part]
  }
  return cursor
}

function generateTextHtml(comp) {
  const styles = [
    `font-size: ${comp.fontSize || 16}px`,
    `font-weight: ${comp.fontWeight || 'normal'}`,
    `color: ${comp.color || '#ffffff'}`,
    `text-align: ${comp.textAlign || 'left'}`,
    `background-color: ${comp.backgroundColor || 'transparent'}`,
    'padding: 8px 12px',
    'border-radius: 4px'
  ]
  return `<div style="${styles.join('; ')}">${escapeHtml(comp.content || '')}</div>`
}

function generateImageHtml(comp) {
  if (!comp.imageUrl && !comp.imageData) {
    return '<div style="padding:20px;color:#aaa;text-align:center;">暂无图片</div>'
  }
  const src = comp.imageData || comp.imageUrl
  const styles = [
    `width: ${comp.imageWidth || '100%'}`,
    `height: ${comp.imageHeight || '100%'}`,
    `object-fit: ${comp.objectFit || 'contain'}`,
    'display:block'
  ]
  return `<img src="${src}" style="${styles.join('; ')}" />`
}

function deepCloneJson(value, fallback = {}) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return JSON.parse(JSON.stringify(fallback))
  }
}

function createDefaultBehaviorRule(index = 0) {
  return {
    id: generateId('rule'),
    name: `规则 ${index + 1}`,
    enabled: true,
    triggerType: 'component:click',
    triggerEventName: '',
    actions: []
  }
}

function normalizeBehaviorAction(raw, index = 0) {
  const item = (raw && typeof raw === 'object') ? raw : {}
  const type = COMPONENT_ACTION_MAP[item.type] ? item.type : 'SET_COMPONENT_PROPERTY'
  const meta = COMPONENT_ACTION_MAP[type]
  return {
    id: String(item.id || generateId('act')),
    type,
    enabled: item.enabled !== false,
    delay: String(item.delay || ''),
    params: {
      ...deepCloneJson(meta.defaults || {}, {}),
      ...(item.params && typeof item.params === 'object' ? item.params : {})
    },
    order: Number.isFinite(Number(item.order)) ? Number(item.order) : index
  }
}

function normalizeBehaviorRule(raw, index = 0) {
  const item = (raw && typeof raw === 'object') ? raw : {}
  const triggerType = COMPONENT_TRIGGER_DEFS.some(v => v.value === item.triggerType) ? item.triggerType : 'component:click'
  const actions = Array.isArray(item.actions) ? item.actions.map((action, idx) => normalizeBehaviorAction(action, idx)) : []
  return {
    id: String(item.id || generateId('rule')),
    name: String(item.name || `规则 ${index + 1}`),
    enabled: item.enabled !== false,
    triggerType,
    triggerEventName: String(item.triggerEventName || ''),
    actions
  }
}

function ensureComponentBehaviorModel(comp) {
  if (!comp || typeof comp !== 'object') return
  const behavior = (comp.behavior && typeof comp.behavior === 'object') ? comp.behavior : {}
  const rules = Array.isArray(behavior.rules) ? behavior.rules.map((rule, idx) => normalizeBehaviorRule(rule, idx)) : []
  comp.behavior = {
    version: 1,
    rules
  }
  if (!comp.behavior.rules.length) {
    comp.behavior.rules.push(createDefaultBehaviorRule(0))
  }
  const selected = selectedBehaviorRuleIdByComponent[comp.id]
  if (!selected || !comp.behavior.rules.some(rule => rule.id === selected)) {
    selectedBehaviorRuleIdByComponent[comp.id] = comp.behavior.rules[0].id
  }
}

function getSelectedComponent() {
  return components.find(item => item.id === selectedComponentId) || null
}

function getSelectedBehaviorRule(comp = getSelectedComponent()) {
  if (!comp) return null
  ensureComponentBehaviorModel(comp)
  const selectedRuleId = selectedBehaviorRuleIdByComponent[comp.id]
  return comp.behavior.rules.find(rule => rule.id === selectedRuleId) || comp.behavior.rules[0] || null
}

function getTriggerLabel(triggerType) {
  const found = COMPONENT_TRIGGER_DEFS.find(item => item.value === triggerType)
  return found ? found.label : triggerType
}

function getActionTypeOptionsMarkup(currentType) {
  return COMPONENT_ACTION_LIBRARY.map(item =>
    `<option value="${item.type}" ${item.type === currentType ? 'selected' : ''}>${escapeHtml(item.label)}</option>`
  ).join('')
}

function renderBehaviorRuleList(comp = getSelectedComponent()) {
  const wrap = document.getElementById('blocksRuleList')
  if (!wrap) return
  if (!comp) {
    wrap.innerHTML = '<div class="empty-state" style="padding:12px 8px;">请先选择组件</div>'
    return
  }
  ensureComponentBehaviorModel(comp)
  const selectedRule = getSelectedBehaviorRule(comp)
  wrap.innerHTML = comp.behavior.rules.map(rule => {
    const activeClass = (selectedRule && selectedRule.id === rule.id) ? 'active' : ''
    const actionCount = Array.isArray(rule.actions) ? rule.actions.length : 0
    return `
      <div class="blocks-rule-item ${activeClass}" onclick="selectBehaviorRule('${rule.id}')">
        <div class="blocks-rule-head">
          <div class="blocks-rule-name">${escapeHtml(rule.name || '未命名规则')}</div>
          <button class="blocks-mini-btn" title="删除规则" onclick="event.stopPropagation(); removeBehaviorRule('${rule.id}')">🗑</button>
        </div>
        <div class="blocks-rule-meta">${escapeHtml(getTriggerLabel(rule.triggerType))} · ${actionCount} 动作</div>
      </div>
    `
  }).join('')
}

function renderBehaviorRuleConfig(comp = getSelectedComponent(), rule = getSelectedBehaviorRule(comp)) {
  const titleEl = document.getElementById('blocksRuleTitle')
  const configEl = document.getElementById('blocksRuleConfig')
  if (!titleEl || !configEl) return
  if (!comp || !rule) {
    titleEl.textContent = '选择一条规则开始编辑'
    configEl.classList.add('hidden')
    configEl.innerHTML = ''
    return
  }

  titleEl.textContent = `${comp.name || '组件'} · ${rule.name || '未命名规则'}`

  const triggerOptions = COMPONENT_TRIGGER_DEFS.map(item =>
    `<option value="${item.value}" ${item.value === rule.triggerType ? 'selected' : ''}>${escapeHtml(item.label)}</option>`
  ).join('')

  configEl.classList.remove('hidden')
  configEl.innerHTML = `
    <input class="blocks-action-input" type="text" value="${escapeAttr(rule.name || '')}" placeholder="规则名称"
      oninput="updateBehaviorRuleField('${rule.id}', 'name', this.value)">
    <select class="blocks-action-input" onchange="updateBehaviorRuleField('${rule.id}', 'triggerType', this.value)">
      ${triggerOptions}
    </select>
    <label class="target-page-item" style="margin:0;">
      <input type="checkbox" ${rule.enabled !== false ? 'checked' : ''} onchange="updateBehaviorRuleField('${rule.id}', 'enabled', this.checked)">
      <span class="target-page-name">启用</span>
    </label>
    ${rule.triggerType === 'custom:event' ? `
      <input class="blocks-action-input" style="grid-column:1 / -1;" type="text" value="${escapeAttr(rule.triggerEventName || '')}"
        placeholder="监听事件名，例如：component:event"
        oninput="updateBehaviorRuleField('${rule.id}', 'triggerEventName', this.value)">
    ` : ''}
  `
}

function renderBehaviorActionFields(ruleId, action, actionIndex) {
  const p = (action && action.params && typeof action.params === 'object') ? action.params : {}
  if (action.type === 'DELAY') {
    return `
      <div class="blocks-action-field">
        <label class="blocks-action-label">等待时长</label>
        <input class="blocks-action-input" type="text" value="${escapeAttr(p.duration || '500ms')}" placeholder="500ms / 1.2s"
          oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'duration', this.value)">
      </div>
    `
  }
  if (action.type === 'SET_COMPONENT_PROPERTY') {
    return `
      <div class="blocks-action-field">
        <label class="blocks-action-label">目标组件ID（空=当前组件）</label>
        <input class="blocks-action-input" type="text" value="${escapeAttr(p.componentId || '')}" placeholder="例如：comp_xxx"
          oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'componentId', this.value)">
      </div>
      <div class="blocks-action-field wide">
        <label class="blocks-action-label">Patch JSON（支持模板变量）</label>
        <textarea class="blocks-action-input" oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'patchJson', this.value)">${escapeHtml(p.patchJson || '{"text":"{{bpHunter}}"}')}</textarea>
      </div>
    `
  }
  if (action.type === 'CALL_CUSTOM_API') {
    return `
      <div class="blocks-action-field wide">
        <label class="blocks-action-label">API URL</label>
        <input class="blocks-action-input" type="text" value="${escapeAttr(p.url || '')}" placeholder="https://api.example.com/hook"
          oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'url', this.value)">
      </div>
      <div class="blocks-action-field">
        <label class="blocks-action-label">Method</label>
        <input class="blocks-action-input" type="text" value="${escapeAttr(p.method || 'GET')}"
          oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'method', this.value)">
      </div>
      <div class="blocks-action-field">
        <label class="blocks-action-label">超时(ms)</label>
        <input class="blocks-action-input" type="text" value="${escapeAttr(p.timeoutMs || '8000')}"
          oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'timeoutMs', this.value)">
      </div>
      <div class="blocks-action-field">
        <label class="blocks-action-label">结果变量名</label>
        <input class="blocks-action-input" type="text" value="${escapeAttr(p.saveAs || 'lastApi')}"
          oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'saveAs', this.value)">
      </div>
      <div class="blocks-action-field">
        <label class="blocks-action-label">返回后触发事件名（可选）</label>
        <input class="blocks-action-input" type="text" value="${escapeAttr(p.resultEventName || '')}"
          oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'resultEventName', this.value)">
      </div>
      <div class="blocks-action-field wide">
        <label class="blocks-action-label">Headers JSON</label>
        <textarea class="blocks-action-input" oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'headersJson', this.value)">${escapeHtml(p.headersJson || '{}')}</textarea>
      </div>
      <div class="blocks-action-field wide">
        <label class="blocks-action-label">Body JSON / 字符串</label>
        <textarea class="blocks-action-input" oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'bodyJson', this.value)">${escapeHtml(p.bodyJson || '{}')}</textarea>
      </div>
    `
  }
  if (action.type === 'EMIT_CUSTOM_EVENT') {
    return `
      <div class="blocks-action-field">
        <label class="blocks-action-label">事件名</label>
        <input class="blocks-action-input" type="text" value="${escapeAttr(p.eventName || 'component:event')}"
          oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'eventName', this.value)">
      </div>
      <div class="blocks-action-field wide">
        <label class="blocks-action-label">Payload JSON</label>
        <textarea class="blocks-action-input" oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'payloadJson', this.value)">${escapeHtml(p.payloadJson || '{}')}</textarea>
      </div>
    `
  }
  if (action.type === 'EXECUTE_COMMAND') {
    return `
      <div class="blocks-action-field">
        <label class="blocks-action-label">命令名</label>
        <input class="blocks-action-input" type="text" value="${escapeAttr(p.command || '')}" placeholder="例如：play-next-animation"
          oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'command', this.value)">
      </div>
      <div class="blocks-action-field wide">
        <label class="blocks-action-label">参数 JSON</label>
        <textarea class="blocks-action-input" oninput="updateBehaviorActionField('${ruleId}', ${actionIndex}, 'argsJson', this.value)">${escapeHtml(p.argsJson || '{}')}</textarea>
      </div>
    `
  }
  return '<div class="blocks-action-field wide"><div class="blocks-action-label">未知动作类型</div></div>'
}

function renderBehaviorActionList(comp = getSelectedComponent(), rule = getSelectedBehaviorRule(comp)) {
  const listEl = document.getElementById('blocksActionList')
  if (!listEl) return
  if (!comp || !rule) {
    listEl.innerHTML = '<div class="empty-state">请选择规则</div>'
    return
  }
  const actions = Array.isArray(rule.actions) ? rule.actions : []
  if (!actions.length) {
    listEl.innerHTML = '<div class="empty-state">暂无动作，右上角可添加动作积木。</div>'
    return
  }

  listEl.innerHTML = actions.map((action, idx) => {
    const meta = COMPONENT_ACTION_MAP[action.type] || { label: action.type, group: 'flow' }
    return `
      <div class="blocks-action-card">
        <div class="blocks-action-head ${meta.group || 'flow'}">
          <span>${escapeHtml(meta.label || action.type)}</span>
          <div class="blocks-action-actions">
            <button class="blocks-mini-btn" title="上移" onclick="moveBehaviorAction('${rule.id}', ${idx}, -1)">↑</button>
            <button class="blocks-mini-btn" title="下移" onclick="moveBehaviorAction('${rule.id}', ${idx}, 1)">↓</button>
            <button class="blocks-mini-btn" title="删除" onclick="removeBehaviorAction('${rule.id}', ${idx})">🗑</button>
          </div>
        </div>
        <div class="blocks-action-body">
          <div class="blocks-action-field">
            <label class="blocks-action-label">动作类型</label>
            <select class="blocks-action-input" onchange="switchBehaviorActionType('${rule.id}', ${idx}, this.value)">
              ${getActionTypeOptionsMarkup(action.type)}
            </select>
          </div>
          <div class="blocks-action-field">
            <label class="blocks-action-label">动作前延迟（可选）</label>
            <input class="blocks-action-input" type="text" value="${escapeAttr(action.delay || '')}" placeholder="如 300ms"
              oninput="updateBehaviorActionBase('${rule.id}', ${idx}, 'delay', this.value)">
          </div>
          ${renderBehaviorActionFields(rule.id, action, idx)}
        </div>
      </div>
    `
  }).join('')
}

function renderBehaviorEditorPanel() {
  const comp = getSelectedComponent()
  const actionTypePicker = document.getElementById('blocksNewActionType')
  if (actionTypePicker && !actionTypePicker.dataset.inited) {
    actionTypePicker.dataset.inited = '1'
    actionTypePicker.innerHTML = COMPONENT_ACTION_LIBRARY.map(item => `<option value="${item.type}">${escapeHtml(item.label)}</option>`).join('')
  }
  renderBehaviorRuleList(comp)
  renderBehaviorRuleConfig(comp)
  renderBehaviorActionList(comp)
}

function findBehaviorRuleById(comp, ruleId) {
  if (!comp || !ruleId) return null
  ensureComponentBehaviorModel(comp)
  return comp.behavior.rules.find(rule => rule.id === ruleId) || null
}

function selectBehaviorRule(ruleId) {
  const comp = getSelectedComponent()
  if (!comp) return
  const rule = findBehaviorRuleById(comp, ruleId)
  if (!rule) return
  selectedBehaviorRuleIdByComponent[comp.id] = rule.id
  renderBehaviorEditorPanel()
}

function addBehaviorRule() {
  const comp = getSelectedComponent()
  if (!comp) {
    showToast('请先选择一个组件', 'error')
    return
  }
  ensureComponentBehaviorModel(comp)
  const rule = createDefaultBehaviorRule(comp.behavior.rules.length)
  comp.behavior.rules.push(rule)
  selectedBehaviorRuleIdByComponent[comp.id] = rule.id
  hasUnsavedChanges = true
  renderBehaviorEditorPanel()
}

function removeBehaviorRule(ruleId) {
  const comp = getSelectedComponent()
  if (!comp) return
  ensureComponentBehaviorModel(comp)
  if (comp.behavior.rules.length <= 1) {
    showToast('至少保留一条规则', 'error')
    return
  }
  comp.behavior.rules = comp.behavior.rules.filter(rule => rule.id !== ruleId)
  if (!comp.behavior.rules.length) comp.behavior.rules.push(createDefaultBehaviorRule(0))
  selectedBehaviorRuleIdByComponent[comp.id] = comp.behavior.rules[0].id
  hasUnsavedChanges = true
  renderBehaviorEditorPanel()
}

function updateBehaviorRuleField(ruleId, field, value) {
  const comp = getSelectedComponent()
  const rule = findBehaviorRuleById(comp, ruleId)
  if (!rule) return
  if (field === 'enabled') {
    rule.enabled = value !== false
    hasUnsavedChanges = true
    renderBehaviorRuleList(comp)
    return
  } else if (field === 'triggerType') {
    rule.triggerType = value
    if (value !== 'custom:event') rule.triggerEventName = ''
    hasUnsavedChanges = true
    renderBehaviorEditorPanel()
    return
  } else {
    rule[field] = value
  }
  hasUnsavedChanges = true
  if (field === 'name') {
    renderBehaviorRuleList(comp)
    const titleEl = document.getElementById('blocksRuleTitle')
    if (titleEl) {
      titleEl.textContent = `${comp.name || '组件'} · ${rule.name || '未命名规则'}`
    }
  }
}

function createBehaviorAction(type) {
  const meta = COMPONENT_ACTION_MAP[type] || COMPONENT_ACTION_LIBRARY[0]
  return {
    id: generateId('act'),
    type: meta.type,
    enabled: true,
    delay: '',
    params: deepCloneJson(meta.defaults || {}, {})
  }
}

function addBehaviorAction() {
  const comp = getSelectedComponent()
  if (!comp) return
  const rule = getSelectedBehaviorRule(comp)
  if (!rule) return
  const picker = document.getElementById('blocksNewActionType')
  const actionType = picker ? picker.value : COMPONENT_ACTION_LIBRARY[0].type
  rule.actions.push(createBehaviorAction(actionType))
  hasUnsavedChanges = true
  renderBehaviorEditorPanel()
}

function removeBehaviorAction(ruleId, actionIndex) {
  const comp = getSelectedComponent()
  const rule = findBehaviorRuleById(comp, ruleId)
  if (!rule || !Array.isArray(rule.actions)) return
  rule.actions.splice(actionIndex, 1)
  hasUnsavedChanges = true
  renderBehaviorEditorPanel()
}

function moveBehaviorAction(ruleId, actionIndex, direction) {
  const comp = getSelectedComponent()
  const rule = findBehaviorRuleById(comp, ruleId)
  if (!rule || !Array.isArray(rule.actions)) return
  const toIndex = actionIndex + direction
  if (toIndex < 0 || toIndex >= rule.actions.length) return
  const temp = rule.actions[actionIndex]
  rule.actions[actionIndex] = rule.actions[toIndex]
  rule.actions[toIndex] = temp
  hasUnsavedChanges = true
  renderBehaviorEditorPanel()
}

function switchBehaviorActionType(ruleId, actionIndex, actionType) {
  const comp = getSelectedComponent()
  const rule = findBehaviorRuleById(comp, ruleId)
  if (!rule || !Array.isArray(rule.actions) || !rule.actions[actionIndex]) return
  const next = createBehaviorAction(actionType)
  next.id = rule.actions[actionIndex].id || next.id
  next.delay = rule.actions[actionIndex].delay || ''
  rule.actions[actionIndex] = next
  hasUnsavedChanges = true
  renderBehaviorEditorPanel()
}

function updateBehaviorActionBase(ruleId, actionIndex, field, value) {
  const comp = getSelectedComponent()
  const rule = findBehaviorRuleById(comp, ruleId)
  if (!rule || !Array.isArray(rule.actions) || !rule.actions[actionIndex]) return
  rule.actions[actionIndex][field] = value
  hasUnsavedChanges = true
}

function updateBehaviorActionField(ruleId, actionIndex, field, value) {
  const comp = getSelectedComponent()
  const rule = findBehaviorRuleById(comp, ruleId)
  if (!rule || !Array.isArray(rule.actions) || !rule.actions[actionIndex]) return
  const action = rule.actions[actionIndex]
  if (!action.params || typeof action.params !== 'object') action.params = {}
  action.params[field] = value
  hasUnsavedChanges = true
}

function migrateComponentWindows(comp) {
  const available = getAvailableFrontendWindowIdSet()
  const next = Array.isArray(comp.targetWindows) ? comp.targetWindows : []
  const filtered = next.map(v => String(v || '').trim()).filter(v => available.has(v))

  if (Array.isArray(comp.targetPages) && comp.targetPages.includes('frontend')) {
    if (filtered.length === 0) {
      comp.targetWindows = [MAIN_FRONTEND_WINDOW.id]
    } else {
      comp.targetWindows = filtered
    }
  } else {
    comp.targetWindows = filtered
  }
}

async function loadEditorData() {
  try {
    const result = await window.electronAPI.loadLayout()
    const layout = (result && result.success && result.layout) ? result.layout : {}

    components = Array.isArray(layout.customComponents) ? layout.customComponents : []

    const rawWindows = Array.isArray(layout.frontendWindows) ? layout.frontendWindows : []
    const seen = new Set()
    frontendWindowProfiles = []
    rawWindows.forEach((item, idx) => {
      const normalized = normalizeFrontendWindowProfile(item, idx)
      if (!normalized) return
      if (seen.has(normalized.id)) return
      seen.add(normalized.id)
      frontendWindowProfiles.push(normalized)
    })

    components.forEach(comp => {
      migrateComponentWindows(comp)
      ensureComponentBehaviorModel(comp)
    })
  } catch (error) {
    console.error('加载组件设计器数据失败:', error)
    components = []
    frontendWindowProfiles = []
  }
}

function renderWindowList() {
  const list = document.getElementById('frontendWindowList')
  const countEl = document.getElementById('windowCount')
  if (!list || !countEl) return

  const rows = getAvailableFrontendWindows()
  countEl.textContent = `${rows.length} 个`

  list.innerHTML = rows.map(win => {
    const builtinTag = win.builtin ? '<span class="window-item-meta">固定</span>' : ''
    const metaText = win.builtin
      ? '默认 BP 前台 · 可拖入组件加载'
      : `空白组件窗口 · ${win.width}×${win.height}${win.autoOpen !== false ? ' · 自动打开' : ''}${win.alwaysOnTop ? ' · 置顶' : ''} · 可拖入组件`

    const removeBtn = win.builtin
      ? ''
      : `<button title="删除" onclick="event.stopPropagation(); removeFrontendWindow('${win.id}')">🗑️</button>`

    const closeBtn = win.builtin
      ? ''
      : `<button title="关闭" onclick="event.stopPropagation(); closeFrontendWindow('${win.id}')">✖</button>`

    return `
      <div class="window-item" data-window-id="${win.id}">
        <div style="min-width:0;flex:1;">
          <div class="window-item-name">${escapeHtml(win.name)} ${builtinTag}</div>
          <div class="window-item-meta">${escapeHtml(metaText)}</div>
        </div>
        <div class="window-item-actions">
          <button title="打开" onclick="event.stopPropagation(); openFrontendWindow('${win.id}')">↗</button>
          ${closeBtn}
          ${removeBtn}
        </div>
      </div>
    `
  }).join('')
}

function renderComponentList() {
  const list = document.getElementById('componentList')
  const count = document.getElementById('componentCount')
  if (!list || !count) return

  count.textContent = `${components.length} 个`

  if (components.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <div class="empty-state-title">暂无组件</div>
        <div class="empty-state-desc">点击上方“新建组件”创建您的第一个组件</div>
      </div>`
    return
  }

  list.innerHTML = components.map(comp => {
    const typeIcons = { text: '📝', image: '🖼️', html: '🌐' }
    const active = comp.id === selectedComponentId ? 'active' : ''
    return `
      <div class="component-item ${active}" data-id="${comp.id}" draggable="true" onclick="selectComponent('${comp.id}')">
        <div class="component-icon">${typeIcons[comp.type] || '📦'}</div>
        <div class="component-info">
          <div class="component-name">${escapeHtml(comp.name || '未命名')}</div>
          <div class="component-type">${comp.type === 'text' ? '文本' : comp.type === 'image' ? '图片' : 'HTML'}</div>
        </div>
        <div class="component-actions">
          <button onclick="event.stopPropagation(); duplicateComponent('${comp.id}')" title="复制">📋</button>
          <button class="delete" onclick="event.stopPropagation(); deleteComponent('${comp.id}')" title="删除">🗑️</button>
        </div>
      </div>
    `
  }).join('')
}

function renderFrontendWindowTargets(comp) {
  const wrap = document.getElementById('targetFrontendWindows')
  if (!wrap || !comp) return

  const pages = Array.isArray(comp.targetPages) ? comp.targetPages : []
  const frontendEnabled = pages.includes('frontend')
  const selected = Array.isArray(comp.targetWindows) ? comp.targetWindows : [MAIN_FRONTEND_WINDOW.id]

  const html = getAvailableFrontendWindows().map(win => {
    const checked = selected.includes(win.id)
    return `
      <label class="target-page-item ${frontendEnabled ? '' : 'disabled'}" style="opacity:${frontendEnabled ? 1 : 0.45};">
        <input type="checkbox" data-target-window="${win.id}" ${checked ? 'checked' : ''} ${frontendEnabled ? '' : 'disabled'}>
        <span class="target-page-name">🪟 ${escapeHtml(win.name)}</span>
      </label>
    `
  }).join('')

  wrap.innerHTML = html
  wrap.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => saveCurrentComponent(false))
  })
}

function selectComponent(id) {
  selectedComponentId = id
  const comp = components.find(c => c.id === id)
  if (!comp) return

  migrateComponentWindows(comp)
  ensureComponentBehaviorModel(comp)

  document.getElementById('editorArea').style.display = 'flex'
  document.getElementById('editorPlaceholder').style.display = 'none'
  document.getElementById('propertiesPanel').style.display = 'block'

  document.getElementById('propName').value = comp.name || ''
  document.getElementById('propType').value = comp.type || 'text'
  document.getElementById('propWidth').value = comp.width || 'auto'
  document.getElementById('propHeight').value = comp.height || 'auto'

  document.getElementById('textProperties').style.display = comp.type === 'text' ? 'block' : 'none'
  document.getElementById('imageProperties').style.display = comp.type === 'image' ? 'block' : 'none'
  document.getElementById('htmlProperties').style.display = comp.type === 'html' ? 'block' : 'none'

  if (comp.type === 'text') {
    document.getElementById('propTextContent').value = comp.content || ''
    document.getElementById('propFontSize').value = comp.fontSize || 16
    document.getElementById('propFontWeight').value = comp.fontWeight || 'normal'
    document.getElementById('propTextColor').value = comp.color || '#ffffff'
    document.getElementById('propTextColorText').value = comp.color || '#ffffff'
    document.getElementById('propTextAlign').value = comp.textAlign || 'left'
    document.getElementById('propBgColorText').value = comp.backgroundColor || 'transparent'
  }

  if (comp.type === 'image') {
    document.getElementById('propImageUrl').value = comp.imageUrl || ''
    document.getElementById('propImageWidth').value = comp.imageWidth || 'auto'
    document.getElementById('propImageHeight').value = comp.imageHeight || 'auto'
    document.getElementById('propObjectFit').value = comp.objectFit || 'contain'
    updateImagePreview(comp.imageData || comp.imageUrl)
  }

  if (comp.type === 'html') {
    document.getElementById('propCustomCss').value = comp.customCss || ''
  }

  const targetCheckboxes = document.querySelectorAll('#targetPages input[type="checkbox"]')
  targetCheckboxes.forEach(cb => {
    cb.checked = Array.isArray(comp.targetPages) && comp.targetPages.includes(cb.value)
  })

  renderFrontendWindowTargets(comp)

  document.getElementById('codeEditor').value = comp.html || ''

  renderComponentList()
  updatePreview()
  renderBehaviorEditorPanel()
}

function updatePreview() {
  const preview = document.getElementById('previewContent')
  if (!preview) return

  const comp = components.find(item => item.id === selectedComponentId)
  if (!comp) {
    preview.innerHTML = '<div class="empty-state"><div class="empty-state-icon">👀</div><div class="empty-state-desc">选择一个组件查看预览</div></div>'
    return
  }

  let html = comp.html || ''
  if (comp.type === 'text') {
    html = generateTextHtml(comp)
  } else if (comp.type === 'image') {
    html = generateImageHtml(comp)
  }

  html = resolveTemplate(html, PREVIEW_TEMPLATE_VARS, PREVIEW_TEMPLATE_VARS)

  if (comp.customCss) {
    const css = resolveTemplate(comp.customCss, PREVIEW_TEMPLATE_VARS, PREVIEW_TEMPLATE_VARS)
    html = `<style>${css}</style>${html}`
  }

  const containerStyle = `
    width: ${comp.width || 'auto'};
    height: ${comp.height || 'auto'};
    min-width: 50px;
    min-height: 30px;
  `
  preview.innerHTML = `<div style="${containerStyle}">${html}</div>`
}

function refreshPreview() {
  saveCurrentComponent(false)
  updatePreview()
}

function switchEditorTab(tab) {
  document.querySelectorAll('.editor-tab').forEach(item => item.classList.remove('active'))
  const tabBtn = document.querySelector(`.editor-tab[data-tab="${tab}"]`)
  if (tabBtn) tabBtn.classList.add('active')

  document.querySelectorAll('.editor-panel').forEach(item => item.classList.remove('active'))
  const panel = document.getElementById(`${tab}Panel`)
  if (panel) panel.classList.add('active')

  if (tab === 'code') {
    const comp = components.find(item => item.id === selectedComponentId)
    if (comp) document.getElementById('codeEditor').value = comp.html || ''
  } else if (tab === 'blocks') {
    renderBehaviorEditorPanel()
  }
}

function createNewComponent() {
  document.getElementById('newComponentModal').classList.add('show')
  document.getElementById('newComponentName').value = ''
  document.getElementById('newComponentName').focus()
  document.querySelectorAll('.type-option').forEach(opt => opt.classList.remove('selected'))
  const textOpt = document.querySelector('.type-option[data-type="text"]')
  if (textOpt) textOpt.classList.add('selected')
}

function closeNewComponentModal() {
  document.getElementById('newComponentModal').classList.remove('show')
}

function confirmNewComponent() {
  const name = document.getElementById('newComponentName').value.trim() || '新组件'
  const selectedType = document.querySelector('.type-option.selected')
  const type = selectedType ? selectedType.dataset.type : 'text'

  const comp = {
    id: generateId('comp'),
    name,
    type,
    targetPages: ['frontend'],
    targetWindows: [MAIN_FRONTEND_WINDOW.id],
    width: '200',
    height: type === 'text' ? 'auto' : '100',
    createdAt: new Date().toISOString()
  }

  if (type === 'text') {
    comp.content = '示例文本 {{bpHunter}}'
    comp.fontSize = 16
    comp.fontWeight = 'normal'
    comp.color = '#ffffff'
    comp.textAlign = 'left'
    comp.backgroundColor = 'transparent'
    comp.html = generateTextHtml(comp)
  } else if (type === 'image') {
    comp.imageUrl = ''
    comp.imageWidth = '100%'
    comp.imageHeight = '100%'
    comp.objectFit = 'contain'
    comp.html = generateImageHtml(comp)
  } else {
    comp.html = '<div style="padding:12px;color:#fff;">{{matchTitle}}</div>'
    comp.customCss = ''
  }

  ensureComponentBehaviorModel(comp)
  components.push(comp)
  hasUnsavedChanges = true
  closeNewComponentModal()
  renderComponentList()
  selectComponent(comp.id)
  showToast('组件已创建', 'success')
}

function duplicateComponent(id) {
  const source = components.find(item => item.id === id)
  if (!source) return
  const copy = JSON.parse(JSON.stringify(source))
  copy.id = generateId('comp')
  copy.name = `${source.name || '组件'} (副本)`
  copy.createdAt = new Date().toISOString()
  ensureComponentBehaviorModel(copy)
  components.push(copy)
  hasUnsavedChanges = true
  renderComponentList()
  selectComponent(copy.id)
}

function deleteComponent(id) {
  if (!confirm('确定删除这个组件吗？')) return
  components = components.filter(item => item.id !== id)
  delete selectedBehaviorRuleIdByComponent[id]
  hasUnsavedChanges = true

  if (selectedComponentId === id) {
    selectedComponentId = null
    document.getElementById('editorArea').style.display = 'none'
    document.getElementById('editorPlaceholder').style.display = 'flex'
    document.getElementById('propertiesPanel').style.display = 'none'
  }

  renderComponentList()
  renderBehaviorEditorPanel()
  showToast('组件已删除')
}

function deleteCurrentComponent() {
  if (!selectedComponentId) return
  deleteComponent(selectedComponentId)
}

function readTargetFrontendWindowsFromForm() {
  const checked = []
  document.querySelectorAll('#targetFrontendWindows input[type="checkbox"]').forEach(cb => {
    if (cb.checked) checked.push(cb.getAttribute('data-target-window'))
  })

  const unique = Array.from(new Set(checked.filter(Boolean)))
  if (!unique.length) unique.push(MAIN_FRONTEND_WINDOW.id)
  return unique
}

function saveCurrentComponent(shouldRenderList = true) {
  if (!selectedComponentId) return
  const comp = components.find(item => item.id === selectedComponentId)
  if (!comp) return
  ensureComponentBehaviorModel(comp)

  const oldName = comp.name
  comp.name = document.getElementById('propName').value || '未命名组件'
  comp.width = document.getElementById('propWidth').value || 'auto'
  comp.height = document.getElementById('propHeight').value || 'auto'

  comp.targetPages = []
  document.querySelectorAll('#targetPages input[type="checkbox"]').forEach(cb => {
    if (cb.checked) comp.targetPages.push(cb.value)
  })

  if (comp.targetPages.includes('frontend')) {
    comp.targetWindows = readTargetFrontendWindowsFromForm()
  } else {
    comp.targetWindows = []
  }

  if (comp.type === 'text') {
    comp.content = document.getElementById('propTextContent').value || ''
    comp.fontSize = parseInt(document.getElementById('propFontSize').value, 10) || 16
    comp.fontWeight = document.getElementById('propFontWeight').value || 'normal'
    comp.color = document.getElementById('propTextColorText').value || '#ffffff'
    comp.textAlign = document.getElementById('propTextAlign').value || 'left'
    comp.backgroundColor = document.getElementById('propBgColorText').value || 'transparent'
    comp.html = generateTextHtml(comp)
  } else if (comp.type === 'image') {
    comp.imageUrl = document.getElementById('propImageUrl').value || ''
    comp.imageWidth = document.getElementById('propImageWidth').value || '100%'
    comp.imageHeight = document.getElementById('propImageHeight').value || '100%'
    comp.objectFit = document.getElementById('propObjectFit').value || 'contain'
    comp.html = generateImageHtml(comp)
  } else if (comp.type === 'html') {
    comp.html = document.getElementById('codeEditor').value || ''
    comp.customCss = document.getElementById('propCustomCss').value || ''
  }

  hasUnsavedChanges = true

  if (shouldRenderList || comp.name !== oldName) {
    renderComponentList()
  }
  updatePreview()
}

async function saveAllComponents() {
  try {
    const result = await window.electronAPI.loadLayout()
    const layout = (result && result.success && result.layout) ? result.layout : {}

    components.forEach(comp => {
      migrateComponentWindows(comp)
      ensureComponentBehaviorModel(comp)
    })

    layout.customComponents = components
    layout.frontendWindows = frontendWindowProfiles.map(item => ({
      id: item.id,
      name: item.name,
      width: item.width,
      height: item.height,
      autoOpen: item.autoOpen !== false,
      alwaysOnTop: item.alwaysOnTop === true,
      enabled: item.enabled !== false
    }))

    const saveResult = await window.electronAPI.saveLayout(layout)
    if (!saveResult || !saveResult.success) {
      throw new Error(saveResult && saveResult.error ? saveResult.error : '保存失败')
    }

    hasUnsavedChanges = false
    showToast('组件与窗口配置已保存', 'success')

    if (window.electronAPI.sendToFrontend) {
      window.electronAPI.sendToFrontend({
        type: 'custom-components-updated',
        components,
        frontendWindows: layout.frontendWindows
      })
      window.electronAPI.sendToFrontend({ type: 'layout-updated' })
    }
  } catch (error) {
    console.error('保存失败:', error)
    showToast(`保存失败: ${error.message || error}`, 'error')
  }
}

async function selectImage() {
  try {
    const result = await window.electronAPI.invoke('select-component-image')
    if (!result || !result.success || !result.data) return

    const comp = components.find(item => item.id === selectedComponentId)
    if (!comp) return

    comp.imageData = result.data
    comp.imageUrl = ''
    document.getElementById('propImageUrl').value = ''
    updateImagePreview(result.data)
    hasUnsavedChanges = true
    saveCurrentComponent(false)
  } catch (error) {
    console.error('选择图片失败:', error)
    showToast('选择图片失败', 'error')
  }
}

function updateImagePreview(src) {
  const preview = document.getElementById('imagePreview')
  if (!preview) return
  if (!src) {
    preview.innerHTML = '<span class="image-preview-placeholder">暂无图片</span>'
    return
  }
  preview.innerHTML = `<img src="${src}" alt="预览">`
}

function clearImage() {
  const comp = components.find(item => item.id === selectedComponentId)
  if (!comp) return
  comp.imageData = ''
  comp.imageUrl = ''
  updateImagePreview('')
  hasUnsavedChanges = true
  saveCurrentComponent(false)
}

function insertTemplateVariable(token) {
  const focused = document.activeElement
  if (focused && (focused.tagName === 'TEXTAREA' || focused.tagName === 'INPUT')) {
    const start = focused.selectionStart || 0
    const end = focused.selectionEnd || 0
    const value = focused.value || ''
    focused.value = value.slice(0, start) + token + value.slice(end)
    focused.selectionStart = focused.selectionEnd = start + token.length
    focused.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }

  const comp = components.find(item => item.id === selectedComponentId)
  if (!comp) return

  if (comp.type === 'text') {
    const input = document.getElementById('propTextContent')
    input.value = (input.value || '') + token
    input.dispatchEvent(new Event('input', { bubbles: true }))
  } else if (comp.type === 'image') {
    const input = document.getElementById('propImageUrl')
    input.value = (input.value || '') + token
    input.dispatchEvent(new Event('input', { bubbles: true }))
  } else {
    const input = document.getElementById('codeEditor')
    input.value = (input.value || '') + token
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function createNewFrontendWindow() {
  document.getElementById('newFrontendWindowModal').classList.add('show')
  document.getElementById('newWindowName').value = ''
  document.getElementById('newWindowId').value = ''
  document.getElementById('newWindowWidth').value = '1280'
  document.getElementById('newWindowHeight').value = '720'
  document.getElementById('newWindowAutoOpen').checked = true
  document.getElementById('newWindowAlwaysOnTop').checked = false
  document.getElementById('newWindowName').focus()
}

function closeNewFrontendWindowModal() {
  document.getElementById('newFrontendWindowModal').classList.remove('show')
}

async function confirmNewFrontendWindow() {
  const name = document.getElementById('newWindowName').value.trim() || '未命名前台窗口'
  const idInput = document.getElementById('newWindowId').value.trim() || name
  const id = sanitizeWindowId(idInput)

  if (!id || id === MAIN_FRONTEND_WINDOW.id) {
    showToast('窗口 ID 无效，请使用英文/数字/连字符', 'error')
    return
  }

  if (frontendWindowProfiles.some(item => item.id === id)) {
    showToast('窗口 ID 已存在，请更换', 'error')
    return
  }

  const profile = {
    id,
    name,
    width: Math.max(320, parseInt(document.getElementById('newWindowWidth').value, 10) || 1280),
    height: Math.max(180, parseInt(document.getElementById('newWindowHeight').value, 10) || 720),
    autoOpen: document.getElementById('newWindowAutoOpen').checked,
    alwaysOnTop: document.getElementById('newWindowAlwaysOnTop').checked,
    enabled: true
  }

  frontendWindowProfiles.push(profile)
  hasUnsavedChanges = true

  components.forEach(comp => {
    migrateComponentWindows(comp)
  })

  renderWindowList()
  if (selectedComponentId) {
    const comp = components.find(item => item.id === selectedComponentId)
    if (comp) renderFrontendWindowTargets(comp)
  }

  closeNewFrontendWindowModal()
  showToast('前台窗口已添加', 'success')

  try {
    if (window.electronAPI.openCustomFrontendWindow) {
      await saveAllComponents()
      await window.electronAPI.openCustomFrontendWindow(profile.id)
    }
  } catch (error) {
    console.warn('打开新前台窗口失败:', error)
  }
}

async function openFrontendWindow(windowId) {
  try {
    if (windowId === MAIN_FRONTEND_WINDOW.id) {
      await window.electronAPI.openLocalFrontend()
      return
    }
    if (window.electronAPI.openCustomFrontendWindow) {
      await saveAllComponents()
      const result = await window.electronAPI.openCustomFrontendWindow(windowId)
      if (!result || !result.success) {
        showToast(`打开失败: ${(result && result.error) || '未知错误'}`, 'error')
      }
    }
  } catch (error) {
    showToast(`打开失败: ${error.message || error}`, 'error')
  }
}

async function closeFrontendWindow(windowId) {
  if (!windowId || windowId === MAIN_FRONTEND_WINDOW.id) return
  try {
    if (window.electronAPI.closeCustomFrontendWindow) {
      await window.electronAPI.closeCustomFrontendWindow(windowId)
    }
  } catch (error) {
    console.warn('关闭窗口失败:', error)
  }
}

function removeFrontendWindow(windowId) {
  if (!windowId || windowId === MAIN_FRONTEND_WINDOW.id) return
  const profile = frontendWindowProfiles.find(item => item.id === windowId)
  if (!profile) return

  if (!confirm(`确定删除前台窗口“${profile.name}”吗？`)) return

  frontendWindowProfiles = frontendWindowProfiles.filter(item => item.id !== windowId)

  components.forEach(comp => {
    if (!Array.isArray(comp.targetWindows)) return
    comp.targetWindows = comp.targetWindows.filter(id => id !== windowId)
    migrateComponentWindows(comp)
  })

  hasUnsavedChanges = true
  renderWindowList()

  if (selectedComponentId) {
    const comp = components.find(item => item.id === selectedComponentId)
    if (comp) renderFrontendWindowTargets(comp)
  }

  closeFrontendWindow(windowId)
  showToast('前台窗口已删除')
}

function resolveDraggedComponentId(event) {
  if (draggingComponentId) return draggingComponentId
  try {
    const raw = event?.dataTransfer?.getData('text/plain') || ''
    if (!raw) return ''
    if (raw.startsWith('component:')) return raw.slice(10)
    return raw
  } catch {
    return ''
  }
}

function attachComponentToWindow(componentId, targetWindowId, options = {}) {
  const compId = String(componentId || '').trim()
  const windowId = String(targetWindowId || '').trim()
  if (!compId || !windowId) return false

  const source = components.find(item => item.id === compId)
  if (!source) return false

  const windowName = getAvailableFrontendWindows().find(item => item.id === windowId)?.name || windowId
  const createCopy = options.createCopy === true

  if (createCopy) {
    const copy = JSON.parse(JSON.stringify(source))
    copy.id = generateId('comp')
    copy.name = `${source.name || '组件'} (${windowName})`
    copy.createdAt = new Date().toISOString()
    const pages = Array.isArray(copy.targetPages) ? copy.targetPages.slice() : []
    if (!pages.includes('frontend')) pages.push('frontend')
    copy.targetPages = pages
    copy.targetWindows = [windowId]
    ensureComponentBehaviorModel(copy)
    migrateComponentWindows(copy)
    components.push(copy)
    hasUnsavedChanges = true
    renderComponentList()
    selectComponent(copy.id)
    showToast(`已复制到窗口：${windowName}`, 'success')
    return true
  }

  const pages = Array.isArray(source.targetPages) ? source.targetPages : []
  if (!pages.includes('frontend')) pages.push('frontend')
  source.targetPages = pages

  const targets = Array.isArray(source.targetWindows) ? source.targetWindows.slice() : []
  if (targets.includes(windowId)) {
    showToast(`该组件已在窗口：${windowName}`, 'info')
    return false
  }
  targets.push(windowId)
  source.targetWindows = targets
  migrateComponentWindows(source)

  hasUnsavedChanges = true
  renderComponentList()
  if (selectedComponentId === source.id) {
    renderFrontendWindowTargets(source)
  }
  showToast(`已加载到窗口：${windowName}`, 'success')
  return true
}

function setupEventListeners() {
  document.querySelectorAll('.type-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.type-option').forEach(item => item.classList.remove('selected'))
      opt.classList.add('selected')
    })
  })

  const syncColor = (pickerId, textId) => {
    const picker = document.getElementById(pickerId)
    const text = document.getElementById(textId)
    if (!picker || !text) return

    picker.addEventListener('input', e => {
      text.value = e.target.value
      saveCurrentComponent(false)
    })

    text.addEventListener('input', e => {
      const color = e.target.value
      if (/^#[0-9A-Fa-f]{6}$/.test(color) || color === 'transparent') {
        if (color !== 'transparent') picker.value = color
        saveCurrentComponent(false)
      }
    })
  }

  syncColor('propTextColor', 'propTextColorText')
  syncColor('propBgColor', 'propBgColorText')

  const codeEditor = document.getElementById('codeEditor')
  if (codeEditor) {
    codeEditor.addEventListener('input', e => {
      const comp = components.find(item => item.id === selectedComponentId)
      if (!comp) return
      comp.html = e.target.value
      hasUnsavedChanges = true
      updatePreview()
    })
  }

  const imageUrlInput = document.getElementById('propImageUrl')
  if (imageUrlInput) {
    imageUrlInput.addEventListener('input', e => {
      const comp = components.find(item => item.id === selectedComponentId)
      if (!comp || comp.type !== 'image') return
      comp.imageUrl = e.target.value
      comp.imageData = ''
      updateImagePreview(e.target.value)
      hasUnsavedChanges = true
      saveCurrentComponent(false)
    })
  }

  const autoSaveInputs = [
    'propName', 'propWidth', 'propHeight',
    'propTextContent', 'propFontSize', 'propFontWeight', 'propTextAlign',
    'propImageWidth', 'propImageHeight', 'propObjectFit',
    'propCustomCss'
  ]

  autoSaveInputs.forEach(id => {
    const el = document.getElementById(id)
    if (!el) return
    el.addEventListener('input', () => saveCurrentComponent(id === 'propName'))
  })

  document.querySelectorAll('#targetPages input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      saveCurrentComponent(false)
      const comp = components.find(item => item.id === selectedComponentId)
      if (comp) renderFrontendWindowTargets(comp)
    })
  })

  const componentList = document.getElementById('componentList')
  const windowList = document.getElementById('frontendWindowList')

  if (componentList) {
    componentList.addEventListener('dragstart', (event) => {
      const item = event.target && event.target.closest ? event.target.closest('.component-item[data-id]') : null
      if (!item) return
      const compId = item.getAttribute('data-id') || ''
      if (!compId) return
      draggingComponentId = compId
      item.classList.add('dragging')
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = event.ctrlKey || event.altKey ? 'copy' : 'move'
        event.dataTransfer.setData('text/plain', `component:${compId}`)
      }
    })

    componentList.addEventListener('dragend', () => {
      draggingComponentId = null
      componentList.querySelectorAll('.component-item.dragging').forEach(node => node.classList.remove('dragging'))
      if (windowList) {
        windowList.querySelectorAll('.window-item.drop-active').forEach(node => node.classList.remove('drop-active'))
      }
    })
  }

  if (windowList) {
    windowList.addEventListener('dragover', (event) => {
      const windowItem = event.target && event.target.closest ? event.target.closest('.window-item[data-window-id]') : null
      if (!windowItem) return
      const compId = resolveDraggedComponentId(event)
      if (!compId) return
      event.preventDefault()
      windowList.querySelectorAll('.window-item.drop-active').forEach(node => {
        if (node !== windowItem) node.classList.remove('drop-active')
      })
      windowItem.classList.add('drop-active')
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = event.ctrlKey || event.altKey ? 'copy' : 'move'
      }
    })

    windowList.addEventListener('dragleave', (event) => {
      const windowItem = event.target && event.target.closest ? event.target.closest('.window-item[data-window-id]') : null
      if (!windowItem) return
      if (windowItem.contains(event.relatedTarget)) return
      windowItem.classList.remove('drop-active')
    })

    windowList.addEventListener('drop', (event) => {
      const windowItem = event.target && event.target.closest ? event.target.closest('.window-item[data-window-id]') : null
      if (!windowItem) return
      event.preventDefault()
      const windowId = windowItem.getAttribute('data-window-id') || ''
      const compId = resolveDraggedComponentId(event)
      windowList.querySelectorAll('.window-item.drop-active').forEach(node => node.classList.remove('drop-active'))
      if (!windowId || !compId) return
      const copied = event.ctrlKey || event.altKey
      attachComponentToWindow(compId, windowId, { createCopy: copied })
    })
  }

  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault()
      saveAllComponents()
    }

    if (e.ctrlKey && e.key.toLowerCase() === 'n') {
      e.preventDefault()
      createNewComponent()
    }

    if (e.key === 'F12') {
      e.preventDefault()
      window.electronAPI?.invoke?.('toggle-devtools')
    }
  })

  window.addEventListener('beforeunload', event => {
    if (!hasUnsavedChanges) return
    event.preventDefault()
    event.returnValue = '有未保存的更改，确定离开吗？'
  })
}

async function init() {
  await loadEditorData()
  renderWindowList()
  renderComponentList()
  renderBehaviorEditorPanel()
  setupEventListeners()
}

document.addEventListener('DOMContentLoaded', init)
