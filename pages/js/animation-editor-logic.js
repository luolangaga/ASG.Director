/**
 * Idvevent 动画编辑器逻辑
 * 支持创建、编辑、预览和保存自定义CSS动画
 */

// 动画数据
let animations = []
let customComponents = []
let selectedAnimationId = null
let hasUnsavedChanges = false
let currentFilter = 'all'

// 预设动画模板
const ANIMATION_PRESETS = {
  fadeIn: {
    name: '淡入',
    keyframes: `@keyframes %NAME% {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}`,
    duration: 0.5,
    easing: 'ease-out'
  },
  fadeOut: {
    name: '淡出',
    keyframes: `@keyframes %NAME% {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}`,
    duration: 0.5,
    easing: 'ease-in'
  },
  slideInLeft: {
    name: '左滑入',
    keyframes: `@keyframes %NAME% {
  from {
    opacity: 0;
    transform: translateX(-100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}`,
    duration: 0.6,
    easing: 'ease-out'
  },
  slideInRight: {
    name: '右滑入',
    keyframes: `@keyframes %NAME% {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}`,
    duration: 0.6,
    easing: 'ease-out'
  },
  slideInUp: {
    name: '上滑入',
    keyframes: `@keyframes %NAME% {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}`,
    duration: 0.6,
    easing: 'ease-out'
  },
  slideInDown: {
    name: '下滑入',
    keyframes: `@keyframes %NAME% {
  from {
    opacity: 0;
    transform: translateY(-50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}`,
    duration: 0.6,
    easing: 'ease-out'
  },
  zoomIn: {
    name: '放大入场',
    keyframes: `@keyframes %NAME% {
  from {
    opacity: 0;
    transform: scale(0.3);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}`,
    duration: 0.5,
    easing: 'ease-out'
  },
  zoomOut: {
    name: '缩小入场',
    keyframes: `@keyframes %NAME% {
  from {
    opacity: 0;
    transform: scale(1.5);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}`,
    duration: 0.5,
    easing: 'ease-out'
  },
  rotateIn: {
    name: '旋转入场',
    keyframes: `@keyframes %NAME% {
  from {
    opacity: 0;
    transform: rotate(-180deg) scale(0.5);
  }
  to {
    opacity: 1;
    transform: rotate(0) scale(1);
  }
}`,
    duration: 0.8,
    easing: 'ease-out'
  },
  bounce: {
    name: '弹跳',
    keyframes: `@keyframes %NAME% {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-30px);
  }
  60% {
    transform: translateY(-15px);
  }
}`,
    duration: 1,
    easing: 'ease'
  },
  shake: {
    name: '抖动',
    keyframes: `@keyframes %NAME% {
  0%, 100% {
    transform: translateX(0);
  }
  10%, 30%, 50%, 70%, 90% {
    transform: translateX(-10px);
  }
  20%, 40%, 60%, 80% {
    transform: translateX(10px);
  }
}`,
    duration: 0.8,
    easing: 'ease'
  },
  pulse: {
    name: '脉冲',
    keyframes: `@keyframes %NAME% {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}`,
    duration: 1.5,
    easing: 'ease-in-out',
    iterationCount: 'infinite'
  },
  flash: {
    name: '闪烁',
    keyframes: `@keyframes %NAME% {
  0%, 50%, 100% {
    opacity: 1;
  }
  25%, 75% {
    opacity: 0;
  }
}`,
    duration: 1,
    easing: 'linear',
    iterationCount: 'infinite'
  },
  glow: {
    name: '发光',
    keyframes: `@keyframes %NAME% {
  0%, 100% {
    box-shadow: 0 0 5px rgba(255, 215, 0, 0.5),
                0 0 10px rgba(255, 215, 0, 0.3),
                0 0 15px rgba(255, 215, 0, 0.1);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.8),
                0 0 30px rgba(255, 215, 0, 0.6),
                0 0 40px rgba(255, 215, 0, 0.4);
  }
}`,
    duration: 2,
    easing: 'ease-in-out',
    iterationCount: 'infinite'
  },
  dissolve: {
    name: '溶解',
    keyframes: `@keyframes %NAME% {
  0% {
    opacity: 0;
    filter: blur(20px) brightness(3);
    transform: scale(1.2);
  }
  50% {
    opacity: 0.5;
    filter: blur(10px) brightness(2);
  }
  100% {
    opacity: 1;
    filter: blur(0) brightness(1);
    transform: scale(1);
  }
}`,
    duration: 1.2,
    easing: 'ease-out'
  }
}

// 动画类别映射
const CATEGORY_LABELS = {
  entrance: { icon: '🚀', label: '开场动画' },
  'entrance-ban-survivor': { icon: '🚀', label: '入场(求生者Ban新增)' },
  'entrance-ban-hunter': { icon: '🚀', label: '入场(监管者Ban新增)' },
  'entrance-global-ban-survivor': { icon: '🚀', label: '入场(全局Ban求生新增)' },
  'entrance-global-ban-hunter': { icon: '🚀', label: '入场(全局Ban监管新增)' },
  select: { icon: '👆', label: '选择(通用)' },
  'select-survivor1': { icon: '👆', label: '选择(求生1)' },
  'select-survivor2': { icon: '👆', label: '选择(求生2)' },
  'select-survivor3': { icon: '👆', label: '选择(求生3)' },
  'select-survivor4': { icon: '👆', label: '选择(求生4)' },
  'select-hunter': { icon: '👆', label: '选择(监管者)' },
  blink: { icon: '✨', label: '闪烁(通用)' },
  'blink-survivor1': { icon: '✨', label: '闪烁(求生1)' },
  'blink-survivor2': { icon: '✨', label: '闪烁(求生2)' },
  'blink-survivor3': { icon: '✨', label: '闪烁(求生3)' },
  'blink-survivor4': { icon: '✨', label: '闪烁(求生4)' },
  'blink-hunter': { icon: '✨', label: '闪烁(监管者)' },
  custom: { icon: '🎨', label: '自定义动画' }
}

// 生成唯一ID
function generateId() {
  return 'anim_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
}

// Toast 提示
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast')
  toast.textContent = message
  toast.className = 'toast ' + type
  toast.classList.add('show')
  setTimeout(() => {
    toast.classList.remove('show')
  }, 3000)
}

// 初始化
async function init() {
  populateCategorySelect()
  await loadAnimations()
  renderAnimationList()
  setupEventListeners()
  initTimeline()
}

function populateCategorySelect() {
  const select = document.getElementById('propCategory')
  if (!select) return
  select.innerHTML = Object.entries(CATEGORY_LABELS).map(([val, info]) =>
    `<option value="${val}">${info.icon} ${info.label}</option>`
  ).join('')
}

// 加载动画
async function loadAnimations() {
  try {
    const result = await window.electronAPI.loadLayout()
    if (result.success && result.layout) {
      animations = result.layout.customAnimations || []
      customComponents = result.layout.customComponents || []
    } else {
      animations = []
      customComponents = []
    }

    renderCustomComponentTargets()
  } catch (e) {
    console.error('加载动画失败:', e)
    animations = []
  }
}

function renderCustomComponentTargets() {
  const list = document.getElementById('targetList')
  // 移除旧的动态目标
  if (!list) return
  list.querySelectorAll('.dynamic-target').forEach(el => el.remove())

  if (!customComponents || !Array.isArray(customComponents)) return

  customComponents.forEach(comp => {
    const label = document.createElement('label')
    label.className = 'target-item dynamic-target'
    label.innerHTML = `
            <input type="checkbox" value="${comp.id}"> ${escapeHtml(comp.name)} (组件)
        `
    list.appendChild(label)
  })
}

// 保存所有动画
async function saveAllAnimations() {
  try {
    const result = await window.electronAPI.loadLayout()
    const layout = (result.success && result.layout) ? result.layout : {}
    layout.customAnimations = animations

    const saveResult = await window.electronAPI.saveLayout(layout)
    if (saveResult.success) {
      hasUnsavedChanges = false
      showToast('所有动画已保存', 'success')

      // 通知前台刷新动画
      if (window.electronAPI.sendToFrontend) {
        window.electronAPI.sendToFrontend({ type: 'custom-animations-updated', animations })
      }
    } else {
      showToast('保存失败: ' + saveResult.error, 'error')
    }
  } catch (e) {
    console.error('保存失败:', e)
    showToast('保存失败: ' + e.message, 'error')
  }
}

// 保存当前动画
async function saveCurrentAnimation() {
  if (!selectedAnimationId) return

  const anim = animations.find(a => a.id === selectedAnimationId)
  if (!anim) return

  // 从表单读取数据
  anim.name = document.getElementById('propName').value || '未命名动画'
  anim.category = document.getElementById('propCategory').value
  anim.duration = parseFloat(document.getElementById('propDuration').value) || 1
  anim.delay = parseFloat(document.getElementById('propDelay').value) || 0
  anim.easing = document.getElementById('propEasing').value
  anim.iterationCount = document.getElementById('propIterationCount').value
  anim.direction = document.getElementById('propDirection').value
  anim.fillMode = document.getElementById('propFillMode').value
  anim.keyframes = document.getElementById('codeEditor').value

  // 获取应用目标
  const targetCheckboxes = document.querySelectorAll('#targetList input[type="checkbox"]')
  anim.targets = []
  targetCheckboxes.forEach(cb => {
    if (cb.checked) anim.targets.push(cb.value)
  })

  // 生成完整的CSS
  anim.cssClass = generateCssClass(anim)

  hasUnsavedChanges = true
  renderAnimationList()
  updatePreview()
  showToast('动画已更新', 'success')
}

// 生成CSS类
function generateCssClass(anim) {
  const desiredAnimName = 'asg-anim-' + anim.id.replace(/[^a-zA-Z0-9]/g, '')
  let keyframes = anim.keyframes || ''

  // 确保关键帧名称与我们的唯一ID一致
  const match = keyframes.match(/@keyframes\s+([a-zA-Z0-9_-]+)/)
  if (match && match[1]) {
    const existingName = match[1]
    if (existingName === '%NAME%') {
      keyframes = keyframes.replace(/%NAME%/g, desiredAnimName)
    } else if (existingName !== desiredAnimName) {
      // 替换已存在的名称为新的唯一名称
      // 仅替换 @keyframes 定义处，避免误伤
      keyframes = keyframes.replace(new RegExp(`@keyframes\\s+${existingName}`), `@keyframes ${desiredAnimName}`)
    }
  } else {
    // Fallback
    keyframes = keyframes.replace(/%NAME%/g, desiredAnimName)
  }

  return `
${keyframes}

.${desiredAnimName} {
  animation-name: ${desiredAnimName};
  animation-duration: ${anim.duration}s;
  animation-timing-function: ${anim.easing};
  animation-delay: ${anim.delay}s;
  animation-iteration-count: ${anim.iterationCount};
  animation-direction: ${anim.direction};
  animation-fill-mode: ${anim.fillMode};
}
`.trim()
}

// 渲染动画列表
function renderAnimationList() {
  const list = document.getElementById('animationList')
  const count = document.getElementById('animationCount')

  // 根据筛选条件过滤
  let filteredAnimations = currentFilter === 'all'
    ? animations
    : animations.filter(a => a.category === currentFilter)

  count.textContent = animations.length + ' 个'

  if (filteredAnimations.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎬</div>
        <div class="empty-state-title">暂无动画</div>
        <div class="empty-state-desc">点击上方"新建动画"创建您的第一个动画</div>
      </div>`
    return
  }

  list.innerHTML = filteredAnimations.map(anim => {
    const category = CATEGORY_LABELS[anim.category] || CATEGORY_LABELS.custom
    const isActive = anim.id === selectedAnimationId
    return `
      <div class="animation-item ${isActive ? 'active' : ''}" data-id="${anim.id}" onclick="selectAnimation('${anim.id}')">
        <div class="animation-icon">${category.icon}</div>
        <div class="animation-info">
          <div class="animation-name">${escapeHtml(anim.name || '未命名')}</div>
          <div class="animation-type">${category.label} · ${anim.duration}s</div>
        </div>
        <div class="animation-actions">
          <button onclick="event.stopPropagation(); duplicateAnimation('${anim.id}')" title="复制">📋</button>
          <button class="delete" onclick="event.stopPropagation(); deleteAnimation('${anim.id}')" title="删除">🗑️</button>
        </div>
      </div>
    `
  }).join('')
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 选择动画
function selectAnimation(id) {
  selectedAnimationId = id
  const anim = animations.find(a => a.id === id)
  if (!anim) return

  // 显示编辑区和属性面板
  document.getElementById('editorArea').style.display = 'flex'
  document.getElementById('editorPlaceholder').style.display = 'none'
  document.getElementById('propertiesPanel').style.display = 'block'

  // 填充属性
  document.getElementById('propName').value = anim.name || ''
  document.getElementById('propCategory').value = anim.category || 'custom'
  document.getElementById('propDuration').value = anim.duration || 1
  document.getElementById('propDelay').value = anim.delay || 0
  document.getElementById('propEasing').value = anim.easing || 'ease'
  document.getElementById('propIterationCount').value = anim.iterationCount || '1'
  document.getElementById('propDirection').value = anim.direction || 'normal'
  document.getElementById('propFillMode').value = anim.fillMode || 'forwards'
  document.getElementById('codeEditor').value = anim.keyframes || ''

  // 填充应用目标
  const targetCheckboxes = document.querySelectorAll('#targetList input[type="checkbox"]')
  targetCheckboxes.forEach(cb => {
    cb.checked = anim.targets && anim.targets.includes(cb.value)
  })

  renderAnimationList()
  updatePreview()
}

// 更新预览
function updatePreview() {
  const anim = animations.find(a => a.id === selectedAnimationId)
  if (!anim) return

  const demoBox = document.getElementById('previewDemoBox')

  // 移除旧的动画样式
  const oldStyle = document.getElementById('previewAnimationStyle')
  if (oldStyle) oldStyle.remove()

  // 重置demo box
  demoBox.style.animation = 'none'
  demoBox.offsetHeight // 触发reflow

  // 处理 CSS 和 动画名称
  let keyframes = anim.keyframes || ''
  let animName = 'asg-preview-anim' // default fallback

  // 1. 尝试从 Keyframes 中解析名称
  // 支持 @keyframes name { ... } 格式
  const match = keyframes.match(/@keyframes\s+([a-zA-Z0-9_-]+)/)
  if (match && match[1]) {
    // 如果找到了名称，直接使用它
    animName = match[1]

    // 如果名称是 %NAME%，说明是模板，我们替换它
    if (animName === '%NAME%') {
      animName = 'asg-preview-anim'
      keyframes = keyframes.replace(/%NAME%/g, animName)
    }
  } else if (keyframes.includes('%NAME%')) {
    // 如果没匹配到 @keyframes 但有 %NAME%，可能是 incomplete CSS
    animName = 'asg-preview-anim'
    keyframes = keyframes.replace(/%NAME%/g, animName)
  }

  const styleEl = document.createElement('style')
  styleEl.id = 'previewAnimationStyle'
  styleEl.textContent = keyframes
  document.head.appendChild(styleEl)

  // 应用动画
  const timing = anim.easing || 'ease'
  const duration = anim.duration || 1
  const delay = anim.delay || 0
  const iteration = anim.iterationCount || 1
  const direction = anim.direction || 'normal'
  const fillMode = anim.fillMode || 'forwards'

  demoBox.style.animation = `${animName} ${duration}s ${timing} ${delay}s ${iteration} ${direction} ${fillMode}`
}

// 播放动画
function playAnimation() {
  const demoBox = document.getElementById('previewDemoBox')
  demoBox.style.animation = 'none'
  demoBox.offsetHeight // 触发reflow
  updatePreview()
}

// 停止动画
function stopAnimation() {
  const demoBox = document.getElementById('previewDemoBox')
  demoBox.style.animation = 'none'
}

// 重置预览
function resetPreview() {
  const demoBox = document.getElementById('previewDemoBox')
  demoBox.style.animation = 'none'
  demoBox.style.opacity = '1'
  demoBox.style.transform = 'none'
  demoBox.style.filter = 'none'
}

// 分类筛选
function filterByCategory(category) {
  currentFilter = category

  // 更新按钮状态
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.category === category)
  })

  renderAnimationList()
}

// 新建动画
function createNewAnimation() {
  document.getElementById('newAnimationModal').classList.add('show')
  document.getElementById('newAnimationName').value = ''
  document.getElementById('newAnimationName').focus()

  // 重置类型选择
  document.querySelectorAll('#newAnimationModal .type-option').forEach(opt => opt.classList.remove('selected'))
  document.querySelector('#newAnimationModal .type-option[data-type="entrance"]').classList.add('selected')
}

function closeNewAnimationModal() {
  document.getElementById('newAnimationModal').classList.remove('show')
}

function confirmNewAnimation() {
  const name = document.getElementById('newAnimationName').value.trim() || '新动画'
  const typeOption = document.querySelector('#newAnimationModal .type-option.selected')
  const category = typeOption ? typeOption.dataset.type : 'custom'

  // 根据类别获取默认的预设
  let defaultPreset = ANIMATION_PRESETS.fadeIn
  if (category === 'blink') {
    defaultPreset = ANIMATION_PRESETS.pulse
  } else if (category === 'select') {
    defaultPreset = ANIMATION_PRESETS.glow
  }

  const newAnimation = {
    id: generateId(),
    name,
    category,
    duration: defaultPreset.duration || 1,
    delay: 0,
    easing: defaultPreset.easing || 'ease',
    iterationCount: defaultPreset.iterationCount || '1',
    direction: 'normal',
    fillMode: 'forwards',
    keyframes: defaultPreset.keyframes.replace(/%NAME%/g, 'asg-anim-' + generateId()),
    targets: [],
    createdAt: new Date().toISOString()
  }

  // 生成CSS类
  newAnimation.cssClass = generateCssClass(newAnimation)

  animations.push(newAnimation)
  hasUnsavedChanges = true
  closeNewAnimationModal()
  renderAnimationList()
  selectAnimation(newAnimation.id)
  showToast('动画已创建', 'success')
}

// 复制动画
function duplicateAnimation(id) {
  const anim = animations.find(a => a.id === id)
  if (!anim) return

  const newId = generateId()
  const newName = 'asg-anim-' + newId.replace(/[^a-zA-Z0-9]/g, '')

  // 深度复制并更新 ID
  const newAnim = {
    ...JSON.parse(JSON.stringify(anim)),
    id: newId,
    name: anim.name + ' (副本)',
    createdAt: new Date().toISOString()
  }

  // 更新 Keyframes 中的名称，避免冲突
  let keyframes = newAnim.keyframes || ''
  const match = keyframes.match(/@keyframes\s+([a-zA-Z0-9_-]+)/)
  if (match && match[1]) {
    const existingName = match[1]
    if (existingName === '%NAME%') {
      newAnim.keyframes = keyframes.replace(/%NAME%/g, newName)
    } else {
      newAnim.keyframes = keyframes.replace(new RegExp(`@keyframes\\s+${existingName}`), `@keyframes ${newName}`)
    }
  } else if (keyframes.includes('%NAME%')) {
    newAnim.keyframes = keyframes.replace(/%NAME%/g, newName)
  }

  // 重新生成CSS类
  newAnim.cssClass = generateCssClass(newAnim)

  animations.push(newAnim)
  hasUnsavedChanges = true
  renderAnimationList()
  selectAnimation(newAnim.id)
  showToast('动画已复制')
}

// 删除动画
function deleteAnimation(id) {
  if (!confirm('确定要删除这个动画吗？')) return

  animations = animations.filter(a => a.id !== id)
  hasUnsavedChanges = true

  if (selectedAnimationId === id) {
    selectedAnimationId = null
    document.getElementById('editorArea').style.display = 'none'
    document.getElementById('editorPlaceholder').style.display = 'flex'
    document.getElementById('propertiesPanel').style.display = 'none'
  }

  renderAnimationList()
  showToast('动画已删除')
}

// 删除当前动画
function deleteCurrentAnimation() {
  if (selectedAnimationId) {
    deleteAnimation(selectedAnimationId)
  }
}

// 应用预设动画
function applyPreset(presetName) {
  const preset = ANIMATION_PRESETS[presetName]
  if (!preset) return

  const anim = animations.find(a => a.id === selectedAnimationId)
  if (!anim) return

  const animName = 'asg-anim-' + anim.id.replace(/[^a-zA-Z0-9]/g, '')

  // 更新动画属性
  document.getElementById('propDuration').value = preset.duration || 1
  document.getElementById('propEasing').value = preset.easing || 'ease'
  if (preset.iterationCount) {
    document.getElementById('propIterationCount').value = preset.iterationCount
  }
  document.getElementById('codeEditor').value = preset.keyframes.replace(/%NAME%/g, animName)

  // 保存并预览
  saveCurrentAnimation()
  showToast(`已应用 "${preset.name}" 效果`)
}

// 应用代码
function applyCode() {
  saveCurrentAnimation()
  showToast('代码已应用')
}

// 初始化时间轴
function initTimeline() {
  const track = document.getElementById('timelineTrack')
  const playhead = document.getElementById('timelinePlayhead')
  const timeDisplay = document.getElementById('timelineTime')

  let isDragging = false

  playhead.addEventListener('mousedown', (e) => {
    isDragging = true
    e.preventDefault()
  })

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return

    const rect = track.getBoundingClientRect()
    let x = e.clientX - rect.left
    x = Math.max(0, Math.min(x, rect.width))

    playhead.style.left = x + 'px'

    // 计算时间
    const anim = animations.find(a => a.id === selectedAnimationId)
    const duration = anim ? anim.duration : 1
    const time = (x / rect.width) * duration
    timeDisplay.textContent = time.toFixed(2) + 's'
  })

  document.addEventListener('mouseup', () => {
    isDragging = false
  })
}

// 添加关键帧
function addKeyframe() {
  showToast('关键帧功能开发中...')
}

// 设置事件监听
function setupEventListeners() {
  // 类型选择
  document.querySelectorAll('.type-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const modal = opt.closest('.modal-overlay')
      modal.querySelectorAll('.type-option').forEach(o => o.classList.remove('selected'))
      opt.classList.add('selected')
    })
  })

  // 自动保存属性变化
  const autoSaveInputs = ['propName', 'propCategory', 'propDuration', 'propDelay', 'propEasing', 'propIterationCount', 'propDirection', 'propFillMode']
  autoSaveInputs.forEach(id => {
    const el = document.getElementById(id)
    if (el) {
      el.addEventListener('change', () => {
        saveCurrentAnimation()
      })
    }
  })

  // 代码编辑器变化
  document.getElementById('codeEditor').addEventListener('input', () => {
    hasUnsavedChanges = true
    updatePreview()
  })

  // 应用目标变化
  // 应用目标变化 (使用事件委托以支持动态添加的复选框)
  document.getElementById('targetList').addEventListener('change', (e) => {
    if (e.target.matches('input[type="checkbox"]')) {
      saveCurrentAnimation()
    }
  })

  // 键盘快捷键
  document.addEventListener('keydown', e => {
    // Ctrl+S 保存
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      saveAllAnimations()
    }
    // Ctrl+N 新建
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault()
      createNewAnimation()
    }
    // Space 播放/停止预览
    if (e.code === 'Space' && !e.target.matches('input, textarea')) {
      e.preventDefault()
      playAnimation()
    }
    // F12 开发者工具
    if (e.key === 'F12') {
      e.preventDefault()
      window.electronAPI?.invoke?.('toggle-devtools')
    }
  })

  // 关闭前警告
  window.addEventListener('beforeunload', e => {
    if (hasUnsavedChanges) {
      e.preventDefault()
      e.returnValue = '有未保存的更改，确定要离开吗？'
    }
  })
}

// 初始化
document.addEventListener('DOMContentLoaded', init)

// 导出为全局函数
window.createNewAnimation = createNewAnimation
window.closeNewAnimationModal = closeNewAnimationModal
window.confirmNewAnimation = confirmNewAnimation
window.selectAnimation = selectAnimation
window.duplicateAnimation = duplicateAnimation
window.deleteAnimation = deleteAnimation
window.deleteCurrentAnimation = deleteCurrentAnimation
window.saveAllAnimations = saveAllAnimations
window.saveCurrentAnimation = saveCurrentAnimation
window.filterByCategory = filterByCategory
window.applyPreset = applyPreset
window.applyCode = applyCode
window.playAnimation = playAnimation
window.stopAnimation = stopAnimation
window.resetPreview = resetPreview
window.addKeyframe = addKeyframe
