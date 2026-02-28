let state = {
  survivors: [null, null, null, null],
  hunter: null,
  hunterBannedSurvivors: [],
  survivorBannedHunters: [],
  globalBannedSurvivors: [],
  globalBannedHunters: [],
  // 每个求生者单独的天赋数组
  survivorTalents: [[], [], [], []],  // survivorTalents[i] = 第i个求生者的天赋数组
  hunterTalents: [],    // 监管者天赋（多选）
  hunterSkills: [],      // 监管者技能（无数量限制）
  playerNames: ['', '', '', '', ''],  // 5个选手名字
  // 当前正在编辑天赋的求生者索引
  editingSurvivorIndex: null
}

let characters = {
  survivors: [],
  hunters: []
}
let characterAssetOverrides = {}

function getCharacterAssetSrc(type, variant, name) {
  const folderMap = type === 'survivor'
    ? { header: 'surHeader', half: 'surHalf', big: 'surBig' }
    : { header: 'hunHeader', half: 'hunHalf', big: 'hunBig' }
  const folder = folderMap[variant]
  if (!folder || !name) return ''
  const override = characterAssetOverrides && characterAssetOverrides[folder] && characterAssetOverrides[folder][name]
  return override || `../assets/${folder}/${name}.png`
}

const LOCAL_BP_CONSOLE_BG_DEFAULTS = Object.freeze({
  imagePath: null,
  maskOpacity: 0.25,
  blur: 0,
  autoCompressLargeImage: true,
  cardOpacity: 1
})
let localBpConsoleBackground = { ...LOCAL_BP_CONSOLE_BG_DEFAULTS }
let localBpConsoleBgSaveTimer = null

function clampLocalBpConsoleBgNumber(value, min, max, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, num))
}

function normalizeLocalBpConsoleBgSettings(raw) {
  const base = raw && typeof raw === 'object' ? raw : {}
  const imagePath = (typeof base.imagePath === 'string' && base.imagePath.trim())
    ? base.imagePath.trim()
    : null
  const maskOpacity = clampLocalBpConsoleBgNumber(base.maskOpacity, 0, 1, LOCAL_BP_CONSOLE_BG_DEFAULTS.maskOpacity)
  const blur = clampLocalBpConsoleBgNumber(base.blur, 0, 40, LOCAL_BP_CONSOLE_BG_DEFAULTS.blur)
  const autoCompressLargeImage = base.autoCompressLargeImage !== false
  const cardOpacity = clampLocalBpConsoleBgNumber(base.cardOpacity, 0, 1, LOCAL_BP_CONSOLE_BG_DEFAULTS.cardOpacity)
  return { imagePath, maskOpacity, blur, autoCompressLargeImage, cardOpacity }
}

function toLocalBpConsoleBgFileUrl(filePath, bustCache = false) {
  if (!filePath) return ''
  const normalized = String(filePath).replace(/\\/g, '/')
  let url = normalized.startsWith('/')
    ? `file://${encodeURI(normalized)}`
    : `file:///${encodeURI(normalized)}`
  if (bustCache) {
    url += (url.includes('?') ? '&' : '?') + `_t=${Date.now()}`
  }
  return url
}

function setLocalBpConsoleBgPathLabel(filePath) {
  const el = document.getElementById('localBpConsoleBgPath')
  if (!el) return
  if (!filePath) {
    el.textContent = '未设置'
    el.title = ''
    return
  }
  const normalized = String(filePath).replace(/\\/g, '/')
  const fileName = normalized.split('/').pop() || filePath
  el.textContent = fileName
  el.title = String(filePath)
}

function updateLocalBpConsoleBgLabels() {
  const maskInput = document.getElementById('localBpConsoleBgMask')
  const blurInput = document.getElementById('localBpConsoleBgBlur')
  const cardOpacityInput = document.getElementById('localBpConsoleBgCardOpacity')
  const maskValue = document.getElementById('localBpConsoleBgMaskValue')
  const blurValue = document.getElementById('localBpConsoleBgBlurValue')
  const cardOpacityValue = document.getElementById('localBpConsoleBgCardOpacityValue')
  if (maskInput && maskValue) {
    const val = parseInt(maskInput.value, 10) || 0
    maskValue.textContent = `${val}%`
  }
  if (blurInput && blurValue) {
    const val = parseInt(blurInput.value, 10) || 0
    blurValue.textContent = `${val}px`
  }
  if (cardOpacityInput && cardOpacityValue) {
    const val = parseInt(cardOpacityInput.value, 10) || 100
    cardOpacityValue.textContent = `${val}%`
  }
}

function syncLocalBpConsoleBgInputs(settings) {
  const maskInput = document.getElementById('localBpConsoleBgMask')
  const blurInput = document.getElementById('localBpConsoleBgBlur')
  const autoCompressInput = document.getElementById('localBpConsoleBgAutoCompress')
  const cardOpacityInput = document.getElementById('localBpConsoleBgCardOpacity')
  if (maskInput) maskInput.value = String(Math.round(settings.maskOpacity * 100))
  if (blurInput) blurInput.value = String(Math.round(settings.blur))
  if (autoCompressInput) autoCompressInput.checked = settings.autoCompressLargeImage !== false
  if (cardOpacityInput) cardOpacityInput.value = String(Math.round(settings.cardOpacity * 100))
  setLocalBpConsoleBgPathLabel(settings.imagePath)
  updateLocalBpConsoleBgLabels()
}

function applyLocalBpConsoleBgSettings(settings, options = {}) {
  const body = document.body
  if (!body) return
  const normalized = normalizeLocalBpConsoleBgSettings(settings)
  const hasImage = !!normalized.imagePath
  const bustCache = options.bustCache === true
  const cardOpacity = clampLocalBpConsoleBgNumber(normalized.cardOpacity, 0, 1, 1)
  const cardAltOpacity = clampLocalBpConsoleBgNumber(cardOpacity * 0.92, 0, 1, 0.92)
  const topMenuOpacity = clampLocalBpConsoleBgNumber(0.18 + cardOpacity * 0.72, 0, 1, 0.85)

  body.style.setProperty('--local-bp-custom-bg-mask-opacity', String(normalized.maskOpacity))
  body.style.setProperty('--local-bp-custom-bg-blur', `${normalized.blur}px`)
  body.style.setProperty('--local-bp-custom-bg-scale', String(1 + Math.min(0.2, normalized.blur / 180)))
  body.style.setProperty('--local-bp-card-opacity', String(cardOpacity))
  body.style.setProperty('--fluent-surface', `rgba(255, 255, 255, ${cardOpacity})`)
  body.style.setProperty('--fluent-surface-alt', `rgba(250, 249, 248, ${cardAltOpacity})`)
  body.style.setProperty('--local-bp-top-menu-opacity', String(topMenuOpacity))

  if (hasImage) {
    const imageUrl = toLocalBpConsoleBgFileUrl(normalized.imagePath, bustCache)
    const safeImageUrl = imageUrl.replace(/"/g, '\\"')
    body.style.setProperty('--local-bp-custom-bg-image', `url("${safeImageUrl}")`)
    body.classList.add('has-custom-bg')
  } else {
    body.style.setProperty('--local-bp-custom-bg-image', 'none')
    body.classList.remove('has-custom-bg')
  }
}

function collectLocalBpConsoleBgSettingsFromInputs() {
  const maskInput = document.getElementById('localBpConsoleBgMask')
  const blurInput = document.getElementById('localBpConsoleBgBlur')
  const autoCompressInput = document.getElementById('localBpConsoleBgAutoCompress')
  const cardOpacityInput = document.getElementById('localBpConsoleBgCardOpacity')
  const maskPercent = clampLocalBpConsoleBgNumber(maskInput ? parseInt(maskInput.value, 10) : 25, 0, 100, 25)
  const blur = clampLocalBpConsoleBgNumber(blurInput ? parseInt(blurInput.value, 10) : 0, 0, 40, 0)
  const cardOpacityPercent = clampLocalBpConsoleBgNumber(cardOpacityInput ? parseInt(cardOpacityInput.value, 10) : 100, 0, 100, 100)
  return {
    imagePath: localBpConsoleBackground.imagePath,
    maskOpacity: maskPercent / 100,
    blur,
    autoCompressLargeImage: autoCompressInput ? autoCompressInput.checked : localBpConsoleBackground.autoCompressLargeImage !== false,
    cardOpacity: cardOpacityPercent / 100
  }
}

async function loadLocalBpConsoleBgSettings() {
  try {
    let settings = { ...LOCAL_BP_CONSOLE_BG_DEFAULTS }
    if (window.electronAPI && window.electronAPI.getLocalBpConsoleBackground) {
      const result = await window.electronAPI.getLocalBpConsoleBackground()
      if (result && result.success && result.settings) {
        settings = normalizeLocalBpConsoleBgSettings(result.settings)
      }
    }
    localBpConsoleBackground = settings
    syncLocalBpConsoleBgInputs(localBpConsoleBackground)
    applyLocalBpConsoleBgSettings(localBpConsoleBackground)
  } catch (e) {
    console.error('[LocalBP] 加载控制台背景设置失败:', e)
  }
}

async function persistLocalBpConsoleBgSettings(nextSettings, options = {}) {
  const normalized = normalizeLocalBpConsoleBgSettings(nextSettings)
  const bustCache = options.bustCache === true
  const showError = options.showError !== false
  try {
    if (window.electronAPI && window.electronAPI.setLocalBpConsoleBackground) {
      const result = await window.electronAPI.setLocalBpConsoleBackground(normalized)
      if (!result || !result.success) {
        throw new Error(result?.error || '保存背景设置失败')
      }
      localBpConsoleBackground = normalizeLocalBpConsoleBgSettings(result.settings || normalized)
    } else {
      localBpConsoleBackground = normalized
    }
    syncLocalBpConsoleBgInputs(localBpConsoleBackground)
    applyLocalBpConsoleBgSettings(localBpConsoleBackground, { bustCache })
    return true
  } catch (e) {
    if (showError) {
      console.error('[LocalBP] 保存控制台背景设置失败:', e)
    }
    return false
  }
}

function queueLocalBpConsoleBgSave(immediate = false) {
  if (localBpConsoleBgSaveTimer) {
    clearTimeout(localBpConsoleBgSaveTimer)
    localBpConsoleBgSaveTimer = null
  }
  const delay = immediate ? 0 : 180
  localBpConsoleBgSaveTimer = setTimeout(async () => {
    const draft = collectLocalBpConsoleBgSettingsFromInputs()
    localBpConsoleBackground = normalizeLocalBpConsoleBgSettings(draft)
    applyLocalBpConsoleBgSettings(localBpConsoleBackground)
    await persistLocalBpConsoleBgSettings(localBpConsoleBackground, { showError: immediate })
  }, delay)
}

function onLocalBpConsoleBgInput(immediate = false) {
  updateLocalBpConsoleBgLabels()
  queueLocalBpConsoleBgSave(immediate)
}

async function selectLocalBpConsoleBackground() {
  try {
    if (!window.electronAPI || !window.electronAPI.selectLocalBpConsoleBackground) {
      console.error('[LocalBP] 当前版本不支持选择控制台背景')
      return
    }
    const result = await window.electronAPI.selectLocalBpConsoleBackground({
      autoCompressLargeImage: localBpConsoleBackground.autoCompressLargeImage !== false
    })
    if (!result || !result.success) {
      if (!result?.canceled) {
        console.error('[LocalBP] 选择控制台背景失败:', result?.error || '未知错误')
      }
      return
    }
    const imagePath = result.path ? String(result.path) : ''
    if (!/\.(png|jpe?g|gif|webp|bmp)$/i.test(imagePath)) {
      console.error('[LocalBP] 控制台背景仅支持常见图片格式')
      return
    }
    const draft = collectLocalBpConsoleBgSettingsFromInputs()
    draft.imagePath = imagePath
    await persistLocalBpConsoleBgSettings(draft, { bustCache: true, showError: true })
  } catch (e) {
    console.error('[LocalBP] 选择控制台背景异常:', e)
  }
}

async function clearLocalBpConsoleBackground() {
  const draft = collectLocalBpConsoleBgSettingsFromInputs()
  draft.imagePath = null
  await persistLocalBpConsoleBgSettings(draft, { showError: true })
}

if (window.electronAPI && typeof window.electronAPI.on === 'function') {
  window.electronAPI.on('local-bp-console-bg-updated', (settings) => {
    localBpConsoleBackground = normalizeLocalBpConsoleBgSettings(settings)
    syncLocalBpConsoleBgInputs(localBpConsoleBackground)
    applyLocalBpConsoleBgSettings(localBpConsoleBackground, { bustCache: true })
  })
}

const AUTO_GLOBAL_BAN_KEY = 'localBp_autoGlobalBan'
let autoGlobalBan = loadAutoGlobalBanState()

function getDefaultAutoGlobalBanState() {
  return {
    enabled: false,
    currentRole: 'asbh',
    rounds: []
  }
}

function normalizeAutoGlobalBanState(raw) {
  const base = getDefaultAutoGlobalBanState()
  if (!raw || typeof raw !== 'object') return base
  const role = raw.currentRole === 'ahbs' ? 'ahbs' : 'asbh'
  const rounds = Array.isArray(raw.rounds) ? raw.rounds : []
  return {
    enabled: !!raw.enabled,
    currentRole: role,
    rounds: rounds.map(round => {
      const survivors = Array.isArray(round?.survivors) ? round.survivors.filter(Boolean) : []
      const hunter = typeof round?.hunter === 'string' ? round.hunter : ''
      const assigned = round?.assigned === 'ahbs' ? 'ahbs' : (round?.assigned === 'asbh' ? 'asbh' : null)
      const id = typeof round?.id === 'string' && round.id ? round.id : `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const timestamp = typeof round?.timestamp === 'number' ? round.timestamp : Date.now()
      return { id, survivors, hunter, assigned, timestamp }
    })
  }
}

function loadAutoGlobalBanState() {
  try {
    const raw = localStorage.getItem(AUTO_GLOBAL_BAN_KEY)
    const data = raw ? JSON.parse(raw) : null
    return normalizeAutoGlobalBanState(data)
  } catch {
    return getDefaultAutoGlobalBanState()
  }
}

function saveAutoGlobalBanState() {
  localStorage.setItem(AUTO_GLOBAL_BAN_KEY, JSON.stringify(autoGlobalBan))
}

function uniqueList(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).filter(Boolean)))
}

const LOCAL_BP_MODULE_LAYOUT_KEY = 'localBp_module_layout_v1'
const LOCAL_BP_LAYOUT_PAGES = ['bp', 'ocr', 'baseinfo', 'talents', 'score', 'postmatch']
const LOCAL_BP_LAYOUT_PAGE_LABELS = Object.freeze({
  bp: 'BP控制',
  ocr: 'OCR控制台',
  baseinfo: '对局基础信息',
  talents: '天赋与技能',
  score: '比分管理',
  postmatch: '赛后数据'
})

const LOCAL_BP_MODULE_SPECS = Object.freeze([
  { id: 'bp-top-section', selector: '#bp-top-section', title: 'BP顶部操作', page: 'bp' },
  { id: 'bp-main-scroll-module', selector: '#bp-main-scroll-module', title: 'BP主操作区', page: 'bp' },
  { id: 'ocr-main-scroll-module', selector: '#ocr-main-scroll-module', title: 'OCR控制台', page: 'ocr' },
  { id: 'talents-main-scroll-module', selector: '#talents-main-scroll-module', title: '天赋与技能', page: 'talents' },
  { id: 'baseinfo-top-section', selector: '#baseinfo-top-section', title: '基础信息顶部操作', page: 'baseinfo' },
  { id: 'baseinfo-main-scroll-module', selector: '#baseinfo-main-scroll-module', title: '基础信息主内容', page: 'baseinfo' },
  { id: 'score-controls', selector: '#score-controls', title: '比分页操作', page: 'score' },
  { id: 'score-main-scroll-module', selector: '#score-main-scroll-module', title: '比分页主内容', page: 'score' },
  { id: 'postmatch-controls', selector: '#postmatch-controls', title: '赛后页操作', page: 'postmatch' },
  { id: 'postmatch-main-scroll-module', selector: '#postmatch-main-scroll-module', title: '赛后页主内容', page: 'postmatch' }
])

let localBpLayoutEditMode = false
let localBpModuleLayoutReady = false
let localBpResizingModuleId = null
let localBpPointerDrag = null
const localBpModuleShellMap = new Map()
const localBpModuleCanvasMap = new Map()
const LOCAL_BP_MODULE_MIN_WIDTH = 280
const LOCAL_BP_MODULE_GAP = 12
const LOCAL_BP_SPLIT_FIT_EPSILON = 2

function parsePositiveInt(value, fallback = null) {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n
}

function getLocalBpModuleSpec(id) {
  return LOCAL_BP_MODULE_SPECS.find(item => item.id === id) || null
}

function getLocalBpPageContainer(page) {
  return document.querySelector(`#page-${page} > .container`)
}

function ensureLocalBpModuleCanvas(page) {
  if (!LOCAL_BP_LAYOUT_PAGES.includes(page)) return null
  const cached = localBpModuleCanvasMap.get(page)
  if (cached && cached.isConnected) return cached
  const container = getLocalBpPageContainer(page)
  if (!container) return null

  let canvas = container.querySelector(`.lb-module-canvas[data-page="${page}"]`)
  if (!canvas) {
    canvas = document.createElement('div')
    canvas.className = 'lb-module-canvas'
    canvas.dataset.page = page
    container.appendChild(canvas)
  }
  localBpModuleCanvasMap.set(page, canvas)
  return canvas
}

function buildLocalBpModulePageOptions(selectEl, currentPage) {
  if (!selectEl) return
  selectEl.innerHTML = ''
  LOCAL_BP_LAYOUT_PAGES.forEach((page) => {
    const option = document.createElement('option')
    option.value = page
    option.textContent = LOCAL_BP_LAYOUT_PAGE_LABELS[page] || page
    if (page === currentPage) option.selected = true
    selectEl.appendChild(option)
  })
}

function clearLocalBpModuleDropHints() {
  document.querySelectorAll('.lb-module-shell.lb-module-drop-before').forEach((node) => node.classList.remove('lb-module-drop-before'))
  document.querySelectorAll('.lb-module-shell.lb-module-dock-left').forEach((node) => node.classList.remove('lb-module-dock-left'))
  document.querySelectorAll('.lb-module-shell.lb-module-dock-right').forEach((node) => node.classList.remove('lb-module-dock-right'))
  document.querySelectorAll('.lb-module-canvas.lb-canvas-dock-left').forEach((node) => node.classList.remove('lb-canvas-dock-left'))
  document.querySelectorAll('.lb-module-canvas.lb-canvas-dock-right').forEach((node) => node.classList.remove('lb-canvas-dock-right'))
}

function getLocalBpModuleCanvasFromPoint(x, y) {
  const target = document.elementFromPoint(x, y)
  if (!target || !target.closest) return null
  return target.closest('.lb-module-canvas')
}

function getLocalBpInsertBeforeByPoint(canvas, x, y, excludeShell) {
  if (!canvas) return null
  const shells = Array.from(canvas.querySelectorAll('.lb-module-shell[data-module-id]'))
    .filter((shell) => shell !== excludeShell)

  for (const shell of shells) {
    const rect = shell.getBoundingClientRect()
    if (!rect.width || !rect.height) continue
    const midY = rect.top + rect.height * 0.5
    const midX = rect.left + rect.width * 0.5
    if (y < midY) return shell
    if (y <= rect.bottom && x < midX) return shell
  }
  return null
}

function getLocalBpShellFromPoint(x, y, excludeShell) {
  const target = document.elementFromPoint(x, y)
  if (!target || !target.closest) return null
  const shell = target.closest('.lb-module-shell[data-module-id]')
  if (!shell || shell === excludeShell) return null
  if (shell.classList.contains('lb-module-floating')) return null
  return shell
}

function getLocalBpCanvasContentWidth(canvas, fallback = 0) {
  if (!canvas) return fallback
  const style = window.getComputedStyle(canvas)
  const paddingLeft = parseFloat(style.paddingLeft || '0') || 0
  const paddingRight = parseFloat(style.paddingRight || '0') || 0
  const raw = Math.floor((canvas.clientWidth || 0) - paddingLeft - paddingRight)
  if (raw > 0) return raw
  const rect = canvas.getBoundingClientRect()
  const rectRaw = Math.floor((rect.width || 0) - paddingLeft - paddingRight)
  if (rectRaw > 0) return rectRaw
  return fallback
}

function getLocalBpCanvasHalfWidth(canvas, fallback = 520) {
  const canvasWidth = getLocalBpCanvasContentWidth(canvas, 0)
  if (!canvasWidth) return fallback
  return Math.max(LOCAL_BP_MODULE_MIN_WIDTH, Math.floor((canvasWidth - LOCAL_BP_MODULE_GAP - LOCAL_BP_SPLIT_FIT_EPSILON) / 2))
}

function updateLocalBpModulePageSelectByShell(shell, page) {
  const select = shell ? shell.querySelector('.lb-module-page-select') : null
  if (!select) return
  select.value = page
}

function getLocalBpSplitAvailableWidth(canvas, fallback = 1040) {
  const canvasWidth = getLocalBpCanvasContentWidth(canvas, 0)
  if (!canvasWidth) return fallback
  const exactAvailable = Math.floor(canvasWidth - LOCAL_BP_MODULE_GAP - LOCAL_BP_SPLIT_FIT_EPSILON)
  return Math.max((LOCAL_BP_MODULE_MIN_WIDTH * 2), exactAvailable)
}

function getLocalBpShellCurrentWidth(shell, fallback = LOCAL_BP_MODULE_MIN_WIDTH) {
  if (!shell) return fallback
  const explicit = parsePositiveInt(shell.style.width, null)
  if (explicit) return explicit
  const rectWidth = Math.round(shell.getBoundingClientRect().width || 0)
  if (rectWidth > 0) return rectWidth
  return fallback
}

function setLocalBpShellWidth(shell, width) {
  if (!shell) return
  const nextWidth = Math.max(LOCAL_BP_MODULE_MIN_WIDTH, Math.round(width || 0))
  shell.style.width = `${nextWidth}px`
  shell.style.flexBasis = `${nextWidth}px`
}

function setLocalBpShellFullWidth(shell) {
  if (!shell) return
  shell.style.width = ''
  shell.style.flexBasis = ''
}

function clearLocalBpSplitLink(shell) {
  if (!shell) return
  const selfId = shell.dataset.moduleId || ''
  const peerId = shell.dataset.splitPeer || ''
  if (peerId) {
    const peer = localBpModuleShellMap.get(peerId)
    if (peer && peer.dataset.splitPeer === selfId) {
      peer.removeAttribute('data-split-peer')
    }
  }
  shell.removeAttribute('data-split-peer')
}

function getLocalBpSplitPeerShell(shell, requireSameParent = true) {
  if (!shell) return null
  const selfId = shell.dataset.moduleId || ''
  const peerId = shell.dataset.splitPeer || ''
  if (!selfId || !peerId) return null
  const peer = localBpModuleShellMap.get(peerId)
  if (!peer || peer === shell) return null
  if ((peer.dataset.splitPeer || '') !== selfId) return null
  if (requireSameParent && peer.parentElement !== shell.parentElement) return null
  return peer
}

function linkLocalBpSplitPair(shellA, shellB) {
  if (!shellA || !shellB || shellA === shellB) return
  clearLocalBpSplitLink(shellA)
  clearLocalBpSplitLink(shellB)
  const aId = shellA.dataset.moduleId || ''
  const bId = shellB.dataset.moduleId || ''
  if (!aId || !bId) return
  shellA.dataset.splitPeer = bId
  shellB.dataset.splitPeer = aId
}

function normalizeLocalBpSplitPairWidths(shell) {
  const peer = getLocalBpSplitPeerShell(shell, true)
  if (!peer || !shell.parentElement) return false
  const available = getLocalBpSplitAvailableWidth(shell.parentElement, 1040)
  let shellWidth = getLocalBpShellCurrentWidth(shell, Math.floor(available * 0.5))
  shellWidth = Math.max(LOCAL_BP_MODULE_MIN_WIDTH, Math.min(available - LOCAL_BP_MODULE_MIN_WIDTH, shellWidth))
  let peerWidth = available - shellWidth
  if (peerWidth < LOCAL_BP_MODULE_MIN_WIDTH) {
    peerWidth = LOCAL_BP_MODULE_MIN_WIDTH
    shellWidth = available - peerWidth
  }
  setLocalBpShellWidth(shell, shellWidth)
  setLocalBpShellWidth(peer, peerWidth)
  return true
}

function getLocalBpSplitDragPreviewWidth(parent, targetShell, fallback = 520) {
  if (!parent || !targetShell) return fallback
  const available = getLocalBpSplitAvailableWidth(parent, Math.max(560, fallback * 2))
  let targetWidth = getLocalBpShellCurrentWidth(targetShell, Math.floor(available * 0.7))
  targetWidth = Math.max(LOCAL_BP_MODULE_MIN_WIDTH, Math.min(available - LOCAL_BP_MODULE_MIN_WIDTH, targetWidth))
  let dragWidth = available - targetWidth
  if (dragWidth < LOCAL_BP_MODULE_MIN_WIDTH) dragWidth = LOCAL_BP_MODULE_MIN_WIDTH
  return Math.round(dragWidth)
}

function setLocalBpModuleWidthPreset(shell, mode) {
  if (!shell) return
  const peerBefore = getLocalBpSplitPeerShell(shell, true)
  clearLocalBpSplitLink(shell)
  const canvas = shell.closest('.lb-module-canvas')
  if (mode === 'half') {
    const halfWidth = Math.max(LOCAL_BP_MODULE_MIN_WIDTH, Math.floor(getLocalBpSplitAvailableWidth(canvas, 1040) / 2))
    setLocalBpShellWidth(shell, halfWidth)
    saveLocalBpModuleLayout()
    return
  }
  setLocalBpShellFullWidth(shell)
  if (peerBefore) setLocalBpShellFullWidth(peerBefore)
  saveLocalBpModuleLayout()
}

function applyLocalBpSplitLayout(dragShell, targetShell, side, parent) {
  if (!dragShell || !targetShell || !parent) return false
  const dockSide = side === 'left' ? 'left' : (side === 'right' ? 'right' : null)
  if (!dockSide) return false

  const available = getLocalBpSplitAvailableWidth(parent, 1040)
  let targetWidth = getLocalBpShellCurrentWidth(targetShell, Math.floor(available * 0.75))
  targetWidth = Math.max(LOCAL_BP_MODULE_MIN_WIDTH, Math.min(available - LOCAL_BP_MODULE_MIN_WIDTH, targetWidth))
  let dragWidth = available - targetWidth
  if (dragWidth < LOCAL_BP_MODULE_MIN_WIDTH) {
    dragWidth = LOCAL_BP_MODULE_MIN_WIDTH
    targetWidth = available - dragWidth
  }

  setLocalBpShellWidth(targetShell, targetWidth)
  setLocalBpShellWidth(dragShell, dragWidth)

  if (dockSide === 'left') {
    parent.insertBefore(dragShell, targetShell)
  } else {
    parent.insertBefore(dragShell, targetShell.nextElementSibling)
  }

  linkLocalBpSplitPair(dragShell, targetShell)
  normalizeLocalBpSplitPairWidths(dragShell)

  return true
}

function getLocalBpCanvasDockSide(canvas, pointerX) {
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  if (!rect.width) return null
  const ratio = Math.max(0, Math.min(1, (pointerX - rect.left) / rect.width))
  if (ratio <= 0.38) return 'left'
  if (ratio >= 0.62) return 'right'
  return null
}

function getLocalBpShellDockSide(shell, pointerX) {
  if (!shell) return null
  const rect = shell.getBoundingClientRect()
  if (!rect.width) return null
  const ratio = Math.max(0, Math.min(1, (pointerX - rect.left) / rect.width))
  if (ratio <= 0.46) return 'left'
  if (ratio >= 0.54) return 'right'
  return null
}

function pickLocalBpNearestShell(canvas, pointerX, pointerY, excludeShell) {
  if (!canvas) return null
  const shells = Array.from(canvas.querySelectorAll('.lb-module-shell[data-module-id]'))
    .filter((shell) => shell !== excludeShell && !shell.classList.contains('lb-module-floating'))
  if (!shells.length) return null

  let bestShell = null
  let bestScore = Infinity
  for (const shell of shells) {
    const rect = shell.getBoundingClientRect()
    if (!rect.width || !rect.height) continue
    const centerX = rect.left + rect.width * 0.5
    const centerY = rect.top + rect.height * 0.5
    const dy = Math.abs(pointerY - centerY)
    const dx = Math.abs(pointerX - centerX)
    const score = dy * 1.4 + dx
    if (score < bestScore) {
      bestScore = score
      bestShell = shell
    }
  }
  return bestShell
}

function detectLocalBpDockIntent(dragShell, pointerX, pointerY, fallbackParent = null) {
  const pointCanvas = getLocalBpModuleCanvasFromPoint(pointerX, pointerY)
  const parent = pointCanvas || fallbackParent
  if (!parent) return null

  let targetShell = getLocalBpShellFromPoint(pointerX, pointerY, dragShell)
  let side = null

  if (targetShell && targetShell.parentElement === parent) {
    side = getLocalBpShellDockSide(targetShell, pointerX) || getLocalBpCanvasDockSide(parent, pointerX)
  } else {
    targetShell = pickLocalBpNearestShell(parent, pointerX, pointerY, dragShell)
    side = getLocalBpCanvasDockSide(parent, pointerX)
  }

  if (!targetShell || !side) return null

  return {
    mode: 'split',
    targetId: targetShell.dataset.moduleId || '',
    side,
    parent
  }
}

function setupLocalBpModuleResize(shell) {
  if (!shell) return
  const handle = shell.querySelector('.lb-module-resize')
  if (!handle) return

  handle.addEventListener('mousedown', (event) => {
    if (!localBpLayoutEditMode) return
    event.preventDefault()
    event.stopPropagation()

    const page = shell.closest('.lb-module-canvas')?.dataset?.page || shell.dataset.defaultPage || 'bp'
    const canvas = ensureLocalBpModuleCanvas(page)
    const canvasRect = canvas ? canvas.getBoundingClientRect() : null
    const splitPeer = getLocalBpSplitPeerShell(shell, true)

    localBpResizingModuleId = shell.dataset.moduleId || ''
    const startX = event.clientX
    const startY = event.clientY
    const startWidth = Math.round(shell.getBoundingClientRect().width)
    const startHeight = Math.round(shell.getBoundingClientRect().height)

    const onMouseMove = (moveEvent) => {
      if (!localBpResizingModuleId) return
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY

      const liveRect = canvas ? canvas.getBoundingClientRect() : canvasRect
      const maxWidth = liveRect ? Math.max(LOCAL_BP_MODULE_MIN_WIDTH, Math.floor(liveRect.width)) : Math.max(LOCAL_BP_MODULE_MIN_WIDTH, window.innerWidth - 80)
      let nextWidth = Math.max(LOCAL_BP_MODULE_MIN_WIDTH, Math.min(maxWidth, startWidth + dx))
      const nextHeight = Math.max(96, Math.min(window.innerHeight - 80, startHeight + dy))

      if (splitPeer && splitPeer.parentElement === shell.parentElement) {
        const available = getLocalBpSplitAvailableWidth(canvas, Math.max(560, maxWidth))
        nextWidth = Math.max(LOCAL_BP_MODULE_MIN_WIDTH, Math.min(available - LOCAL_BP_MODULE_MIN_WIDTH, startWidth + dx))
        const peerWidth = available - nextWidth
        setLocalBpShellWidth(shell, nextWidth)
        setLocalBpShellWidth(splitPeer, peerWidth)
      } else {
        setLocalBpShellWidth(shell, nextWidth)
      }

      shell.style.height = `${Math.round(nextHeight)}px`
    }

    const onMouseUp = () => {
      if (!localBpResizingModuleId) return
      localBpResizingModuleId = null
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      normalizeLocalBpSplitPairWidths(shell)
      saveLocalBpModuleLayout()
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  })
}

function setupLocalBpModuleDrag(shell) {
  if (!shell) return
  const moduleId = shell.dataset.moduleId || ''
  const dragHandle = shell.querySelector('.lb-module-drag-handle')
  const dragZone = shell.querySelector('.lb-module-title-wrap') || dragHandle
  if (!dragZone) return

  dragZone.addEventListener('mousedown', (event) => {
    if (!localBpLayoutEditMode || !moduleId) return
    const interactiveTarget = event.target?.closest?.('button, select, input, textarea, a')
    if (interactiveTarget) return
    event.preventDefault()
    event.stopPropagation()

    const rect = shell.getBoundingClientRect()
    const placeholder = document.createElement('div')
    placeholder.className = 'lb-module-placeholder'
    placeholder.style.width = `${Math.max(280, Math.round(rect.width))}px`
    placeholder.style.height = `${Math.max(96, Math.round(rect.height))}px`

    const parent = shell.parentElement
    if (!parent) return
    parent.insertBefore(placeholder, shell.nextSibling)

    shell.classList.add('dragging', 'lb-module-floating')
    shell.style.width = `${Math.round(rect.width)}px`
    shell.style.height = `${Math.round(rect.height)}px`
    shell.style.left = `${Math.round(rect.left)}px`
    shell.style.top = `${Math.round(rect.top)}px`

    localBpPointerDrag = {
      moduleId,
      shell,
      placeholder,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      originalWidth: Math.max(280, Math.round(rect.width)),
      wasSplitBeforeDrag: !!getLocalBpSplitPeerShell(shell, true),
      onMouseMove: null,
      onMouseUp: null,
      dock: null,
      tabHover: null
    }

    const onMouseMove = (moveEvent) => {
      if (!localBpPointerDrag || localBpPointerDrag.moduleId !== moduleId) return
      const dragState = localBpPointerDrag
      const nextLeft = Math.round(moveEvent.clientX - dragState.offsetX)
      const nextTop = Math.round(moveEvent.clientY - dragState.offsetY)
      dragState.shell.style.left = `${nextLeft}px`
      dragState.shell.style.top = `${nextTop}px`

      const pointerTarget = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
      const hoveredTab = pointerTarget?.closest?.('.menu-tab[data-page]')
      const hoveredPage = hoveredTab?.dataset?.page || ''
      if (LOCAL_BP_LAYOUT_PAGES.includes(hoveredPage) && typeof switchPage === 'function') {
        const now = Date.now()
        if (!dragState.tabHover || dragState.tabHover.page !== hoveredPage) {
          dragState.tabHover = { page: hoveredPage, ts: now }
        } else if (now - dragState.tabHover.ts >= 220) {
          switchPage(hoveredPage)
          const switchedCanvas = ensureLocalBpModuleCanvas(hoveredPage)
          if (switchedCanvas && dragState.placeholder.parentElement !== switchedCanvas) {
            switchedCanvas.appendChild(dragState.placeholder)
          }
          dragState.tabHover = null
        }
      } else {
        dragState.tabHover = null
      }

      const hoveredCanvas = getLocalBpModuleCanvasFromPoint(moveEvent.clientX, moveEvent.clientY)
      const targetCanvas = hoveredCanvas || dragState.placeholder.parentElement
      if (!targetCanvas) return

      if (dragState.placeholder.parentElement !== targetCanvas) {
        targetCanvas.appendChild(dragState.placeholder)
      }
      clearLocalBpModuleDropHints()

      const dockIntent = detectLocalBpDockIntent(dragState.shell, moveEvent.clientX, moveEvent.clientY, targetCanvas)
      if (dockIntent && dockIntent.parent === targetCanvas) {
        const hoveredShell = localBpModuleShellMap.get(dockIntent.targetId)
        targetCanvas.classList.add(dockIntent.side === 'left' ? 'lb-canvas-dock-left' : 'lb-canvas-dock-right')
        if (hoveredShell) {
          hoveredShell.classList.add(dockIntent.side === 'left' ? 'lb-module-dock-left' : 'lb-module-dock-right')
        }

        dragState.dock = dockIntent

        const previewWidth = hoveredShell
          ? getLocalBpSplitDragPreviewWidth(targetCanvas, hoveredShell, dragState.originalWidth)
          : getLocalBpCanvasHalfWidth(targetCanvas, dragState.originalWidth)
        dragState.placeholder.style.width = `${previewWidth}px`

        if (dockIntent.side === 'left' && hoveredShell) {
          if (dragState.placeholder !== hoveredShell.previousElementSibling) {
            targetCanvas.insertBefore(dragState.placeholder, hoveredShell)
          }
        } else if (hoveredShell && dragState.placeholder !== hoveredShell.nextElementSibling) {
          targetCanvas.insertBefore(dragState.placeholder, hoveredShell.nextElementSibling)
        }
        return
      }

      dragState.dock = null
      dragState.placeholder.style.width = `${dragState.originalWidth}px`
      const insertBefore = getLocalBpInsertBeforeByPoint(targetCanvas, moveEvent.clientX, moveEvent.clientY, dragState.shell)
      if (insertBefore && insertBefore !== dragState.placeholder) {
        insertBefore.classList.add('lb-module-drop-before')
        targetCanvas.insertBefore(dragState.placeholder, insertBefore)
      } else if (dragState.placeholder.parentElement === targetCanvas) {
        targetCanvas.appendChild(dragState.placeholder)
      }
    }

    const onMouseUp = (upEvent) => {
      if (!localBpPointerDrag || localBpPointerDrag.moduleId !== moduleId) return
      const dragState = localBpPointerDrag
      localBpPointerDrag = null

      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)

      const targetParent = dragState.placeholder.parentElement
      if (targetParent) {
        targetParent.insertBefore(dragState.shell, dragState.placeholder)
      }
      dragState.placeholder.remove()
      clearLocalBpModuleDropHints()

      dragState.shell.classList.remove('dragging', 'lb-module-floating')
      dragState.shell.style.left = ''
      dragState.shell.style.top = ''

      const releaseCanvas = getLocalBpModuleCanvasFromPoint(upEvent?.clientX || 0, upEvent?.clientY || 0) || targetParent
      const releaseDock = detectLocalBpDockIntent(dragState.shell, upEvent?.clientX || 0, upEvent?.clientY || 0, releaseCanvas)
      const finalDock = releaseDock || dragState.dock

      let splitApplied = false
      if (finalDock && finalDock.mode === 'split') {
        const splitTarget = localBpModuleShellMap.get(finalDock.targetId || '')
        const splitParent = finalDock.parent || targetParent
        if (splitTarget && splitParent && splitTarget.parentElement === splitParent) {
          splitApplied = applyLocalBpSplitLayout(dragState.shell, splitTarget, finalDock.side, splitParent)
        }
      }
      if (!splitApplied) {
        clearLocalBpSplitLink(dragState.shell)
        if (dragState.wasSplitBeforeDrag) {
          setLocalBpShellFullWidth(dragState.shell)
        }
      }

      const newPage = getLocalBpModulePageByShell(dragState.shell) || dragState.shell.dataset.defaultPage || 'bp'
      updateLocalBpModulePageSelectByShell(dragState.shell, newPage)
      ensureLocalBpModuleDataReady(moduleId)
      saveLocalBpModuleLayout()
    }

    localBpPointerDrag.onMouseMove = onMouseMove
    localBpPointerDrag.onMouseUp = onMouseUp

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  })
}

function ensureLocalBpModuleDataReady(moduleId) {
  if (!moduleId) return
  if (moduleId.startsWith('score-')) {
    initScorePage()
    return
  }
  if (moduleId.startsWith('postmatch-')) {
    initPostMatchPage()
    return
  }
  if (moduleId.startsWith('baseinfo-')) {
    initBaseInfoPage()
    return
  }
  if (moduleId === 'talents-main-scroll-module') {
    updateTalentSkillUI()
    return
  }
  if (moduleId === 'ocr-main-scroll-module' && !localBpOcrInitDone) {
    initLocalBpOcrPanel()
      .then(() => renderLocalBpOcrRegions())
      .catch((error) => setLocalBpOcrStatus(error?.message || 'OCR 面板初始化失败', 'error'))
  }
}

function createLocalBpModuleShell(spec, sourceEl) {
  const shell = document.createElement('div')
  shell.className = 'lb-module-shell'
  shell.dataset.moduleId = spec.id
  shell.dataset.defaultPage = spec.page

  const header = document.createElement('div')
  header.className = 'lb-module-header'

  const titleWrap = document.createElement('div')
  titleWrap.className = 'lb-module-title-wrap'

  const dragHandle = document.createElement('span')
  dragHandle.className = 'lb-module-drag-handle'
  dragHandle.textContent = '::'
  dragHandle.title = '拖拽排序'

  const title = document.createElement('span')
  title.className = 'lb-module-title'
  title.textContent = spec.title

  titleWrap.appendChild(dragHandle)
  titleWrap.appendChild(title)

  const actions = document.createElement('div')
  actions.className = 'lb-module-actions'

  const pageSelect = document.createElement('select')
  pageSelect.className = 'lb-module-page-select'
  buildLocalBpModulePageOptions(pageSelect, spec.page)
  pageSelect.addEventListener('change', () => {
    const targetPage = LOCAL_BP_LAYOUT_PAGES.includes(pageSelect.value) ? pageSelect.value : spec.page
    const targetCanvas = ensureLocalBpModuleCanvas(targetPage)
    if (!targetCanvas) return
    clearLocalBpSplitLink(shell)
    targetCanvas.appendChild(shell)
    ensureLocalBpModuleDataReady(spec.id)
    saveLocalBpModuleLayout()
  })

  const resetBtn = document.createElement('button')
  resetBtn.className = 'btn btn-secondary btn-small'
  resetBtn.textContent = '重置尺寸'
  resetBtn.addEventListener('click', () => {
    const peerBefore = getLocalBpSplitPeerShell(shell, true)
    clearLocalBpSplitLink(shell)
    setLocalBpShellFullWidth(shell)
    if (peerBefore) setLocalBpShellFullWidth(peerBefore)
    shell.style.height = ''
    saveLocalBpModuleLayout()
  })

  const halfBtn = document.createElement('button')
  halfBtn.className = 'btn btn-secondary btn-small'
  halfBtn.textContent = '半宽'
  halfBtn.title = '快速两列排布'
  halfBtn.addEventListener('click', () => {
    setLocalBpModuleWidthPreset(shell, 'half')
  })

  const fullBtn = document.createElement('button')
  fullBtn.className = 'btn btn-secondary btn-small'
  fullBtn.textContent = '整宽'
  fullBtn.title = '恢复整行宽度'
  fullBtn.addEventListener('click', () => {
    setLocalBpModuleWidthPreset(shell, 'full')
  })

  actions.appendChild(pageSelect)
  actions.appendChild(halfBtn)
  actions.appendChild(fullBtn)
  actions.appendChild(resetBtn)
  header.appendChild(titleWrap)
  header.appendChild(actions)

  const body = document.createElement('div')
  body.className = 'lb-module-body'
  body.appendChild(sourceEl)

  const resize = document.createElement('div')
  resize.className = 'lb-module-resize'
  resize.title = '拖拽调整大小'

  shell.appendChild(header)
  shell.appendChild(body)
  shell.appendChild(resize)

  setupLocalBpModuleDrag(shell)
  setupLocalBpModuleResize(shell)
  return shell
}

function loadLocalBpModuleLayout() {
  try {
    const raw = localStorage.getItem(LOCAL_BP_MODULE_LAYOUT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return (parsed && typeof parsed === 'object' && parsed.modules && typeof parsed.modules === 'object')
      ? parsed.modules
      : null
  } catch {
    return null
  }
}

function getLocalBpModulePageByShell(shell) {
  return shell?.closest('.lb-module-canvas')?.dataset?.page || ''
}

function applyLocalBpModuleLayout(modulesLayout) {
  const layout = modulesLayout && typeof modulesLayout === 'object' ? modulesLayout : {}
  const sortBuckets = {}
  LOCAL_BP_LAYOUT_PAGES.forEach((page) => {
    sortBuckets[page] = []
  })

  LOCAL_BP_MODULE_SPECS.forEach((spec, index) => {
    const shell = localBpModuleShellMap.get(spec.id)
    if (!shell) return
    const saved = (layout[spec.id] && typeof layout[spec.id] === 'object') ? layout[spec.id] : {}
    const targetPage = LOCAL_BP_LAYOUT_PAGES.includes(saved.page) ? saved.page : spec.page
    const order = Number.isFinite(parseInt(saved.order, 10)) ? parseInt(saved.order, 10) : index

    const targetCanvas = ensureLocalBpModuleCanvas(targetPage)
    if (targetCanvas) {
      sortBuckets[targetPage].push({ shell, order, id: spec.id })
      updateLocalBpModulePageSelectByShell(shell, targetPage)
    }

    const width = parsePositiveInt(saved.width, null)
    const height = parsePositiveInt(saved.height, null)
    shell.style.width = width ? `${width}px` : ''
    shell.style.flexBasis = width ? `${width}px` : ''
    shell.style.height = height ? `${height}px` : ''
    clearLocalBpSplitLink(shell)
  })

  Object.keys(sortBuckets).forEach((page) => {
    const canvas = ensureLocalBpModuleCanvas(page)
    if (!canvas) return
    sortBuckets[page]
      .sort((a, b) => a.order - b.order)
      .forEach((item) => canvas.appendChild(item.shell))
  })

  const linkedPairs = new Set()
  LOCAL_BP_MODULE_SPECS.forEach((spec) => {
    const saved = (layout[spec.id] && typeof layout[spec.id] === 'object') ? layout[spec.id] : {}
    const peerId = typeof saved.splitWith === 'string' ? saved.splitWith : ''
    if (!peerId) return
    const pairKey = spec.id < peerId ? `${spec.id}|${peerId}` : `${peerId}|${spec.id}`
    if (linkedPairs.has(pairKey)) return

    const shell = localBpModuleShellMap.get(spec.id)
    const peer = localBpModuleShellMap.get(peerId)
    if (!shell || !peer) return
    if (shell.parentElement !== peer.parentElement) return

    const peerSaved = (layout[peerId] && typeof layout[peerId] === 'object') ? layout[peerId] : {}
    if (peerSaved.splitWith !== spec.id) return

    linkLocalBpSplitPair(shell, peer)
    normalizeLocalBpSplitPairWidths(shell)
    linkedPairs.add(pairKey)
  })
}

function collectLocalBpModuleLayout() {
  const modules = {}
  LOCAL_BP_LAYOUT_PAGES.forEach((page) => {
    const canvas = ensureLocalBpModuleCanvas(page)
    if (!canvas) return
    const shells = Array.from(canvas.querySelectorAll('.lb-module-shell[data-module-id]'))
    shells.forEach((shell, order) => {
      const id = shell.dataset.moduleId
      if (!id) return
      const splitPeer = getLocalBpSplitPeerShell(shell, true)
      modules[id] = {
        page,
        order,
        width: parsePositiveInt(shell.style.width, null),
        height: parsePositiveInt(shell.style.height, null),
        splitWith: splitPeer ? (splitPeer.dataset.moduleId || null) : null
      }
    })
  })
  return { modules }
}

function saveLocalBpModuleLayout() {
  try {
    const payload = collectLocalBpModuleLayout()
    localStorage.setItem(LOCAL_BP_MODULE_LAYOUT_KEY, JSON.stringify(payload))
  } catch (error) {
    console.warn('[LocalBP] 保存模块布局失败:', error?.message || error)
  }
}

function applyLocalBpLayoutEditMode() {
  const body = document.body
  if (!body) return
  body.classList.toggle('localbp-layout-edit', localBpLayoutEditMode)

  const bar = document.getElementById('localBpLayoutEditBar')
  if (bar) bar.style.display = localBpLayoutEditMode ? 'flex' : 'none'

  const toggleBtn = document.getElementById('layoutEditToggleBtn')
  if (toggleBtn) toggleBtn.classList.toggle('active', localBpLayoutEditMode)

  localBpModuleShellMap.forEach((shell) => {
    const select = shell.querySelector('.lb-module-page-select')
    if (select) select.disabled = !localBpLayoutEditMode
  })

  if (!localBpLayoutEditMode && localBpPointerDrag && localBpPointerDrag.shell) {
    const dragState = localBpPointerDrag
    localBpPointerDrag = null
    if (dragState.onMouseMove) window.removeEventListener('mousemove', dragState.onMouseMove)
    if (dragState.onMouseUp) window.removeEventListener('mouseup', dragState.onMouseUp)
    const targetParent = dragState.placeholder?.parentElement
    if (targetParent) targetParent.insertBefore(dragState.shell, dragState.placeholder)
    if (dragState.placeholder) dragState.placeholder.remove()
    dragState.shell.classList.remove('dragging', 'lb-module-floating')
    dragState.shell.style.left = ''
    dragState.shell.style.top = ''
    saveLocalBpModuleLayout()
  }
}

function toggleLocalBpLayoutEditMode(force) {
  const next = typeof force === 'boolean' ? force : !localBpLayoutEditMode
  localBpLayoutEditMode = !!next
  applyLocalBpLayoutEditMode()
}

function resetLocalBpModuleLayout() {
  localStorage.removeItem(LOCAL_BP_MODULE_LAYOUT_KEY)
  applyLocalBpModuleLayout(null)
  saveLocalBpModuleLayout()
}

function initLocalBpModuleLayout() {
  if (localBpModuleLayoutReady) return
  localBpModuleLayoutReady = true

  LOCAL_BP_LAYOUT_PAGES.forEach((page) => ensureLocalBpModuleCanvas(page))

  LOCAL_BP_MODULE_SPECS.forEach((spec) => {
    const sourceEl = document.querySelector(spec.selector)
    if (!sourceEl) return
    const shell = createLocalBpModuleShell(spec, sourceEl)
    localBpModuleShellMap.set(spec.id, shell)
    const defaultCanvas = ensureLocalBpModuleCanvas(spec.page)
    if (defaultCanvas) defaultCanvas.appendChild(shell)
  })

  const saved = loadLocalBpModuleLayout()
  applyLocalBpModuleLayout(saved)
  applyLocalBpLayoutEditMode()
}

function ensureLocalBpModulesOnPageReady(page) {
  if (!page) return
  const canvas = ensureLocalBpModuleCanvas(page)
  if (!canvas) return
  const shells = canvas.querySelectorAll('.lb-module-shell[data-module-id]')
  shells.forEach((shell) => ensureLocalBpModuleDataReady(shell.dataset.moduleId || ''))
}

if (typeof window !== 'undefined') {
  window.toggleLocalBpLayoutEditMode = toggleLocalBpLayoutEditMode
  window.resetLocalBpModuleLayout = resetLocalBpModuleLayout
}

function clearAutoGlobalBanHistory() {
  autoGlobalBan.rounds = []
  saveAutoGlobalBanState()
  renderAutoGlobalBanUI()
}

function toggleAutoGlobalBan(enabled) {
  autoGlobalBan.enabled = !!enabled
  saveAutoGlobalBanState()
  renderAutoGlobalBanUI()
  applyAutoGlobalBans(true)
}

function setAutoGlobalRole(role) {
  if (role !== 'asbh' && role !== 'ahbs') return
  autoGlobalBan.currentRole = role
  saveAutoGlobalBanState()
  renderAutoGlobalBanUI()
  applyAutoGlobalBans(true)
}

function recordAutoGlobalBanRound() {
  const survivors = state.survivors.filter(Boolean)
  const hunter = state.hunter || ''
  if (survivors.length === 0 && !hunter) return
  const round = {
    id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    survivors,
    hunter,
    assigned: null,
    timestamp: Date.now()
  }
  autoGlobalBan.rounds.unshift(round)
  saveAutoGlobalBanState()
  renderAutoGlobalBanUI()
  if (autoGlobalBan.enabled) applyAutoGlobalBans()
}

function assignAutoGlobalBanRound(roundId, role) {
  const targetRole = role === 'asbh' || role === 'ahbs' ? role : null
  const round = autoGlobalBan.rounds.find(r => r.id === roundId)
  if (!round) return
  round.assigned = targetRole
  saveAutoGlobalBanState()
  renderAutoGlobalBanUI()
  applyAutoGlobalBans(true)
}

async function swapAutoGlobalBanRoundsByTeamRotation() {
  if (!autoGlobalBan || !Array.isArray(autoGlobalBan.rounds)) return

  let changed = false
  autoGlobalBan.rounds = autoGlobalBan.rounds.map((round) => {
    if (!round || typeof round !== 'object') return round
    const currentAssigned = round.assigned
    const swappedAssigned = currentAssigned === 'asbh'
      ? 'ahbs'
      : (currentAssigned === 'ahbs' ? 'asbh' : currentAssigned)

    if (swappedAssigned !== currentAssigned) {
      changed = true
      return { ...round, assigned: swappedAssigned }
    }
    return round
  })

  if (!changed) return

  saveAutoGlobalBanState()
  renderAutoGlobalBanUI()
  await applyAutoGlobalBans(true)
}

if (typeof window !== 'undefined') {
  window.swapAutoGlobalBanRoundsByTeamRotation = swapAutoGlobalBanRoundsByTeamRotation
}

function buildAutoGlobalBanItem(round) {
  const el = document.createElement('div')
  el.className = 'auto-global-ban-item'
  el.draggable = true
  el.dataset.roundId = round.id

  const survivorsRow = document.createElement('div')
  survivorsRow.className = 'auto-global-ban-item-row'
  survivorsRow.textContent = round.survivors.length ? round.survivors.join(' / ') : '无求生'

  const hunterRow = document.createElement('div')
  hunterRow.className = 'auto-global-ban-item-row'
  hunterRow.textContent = round.hunter || '无监管'

  el.appendChild(survivorsRow)
  el.appendChild(hunterRow)

  el.addEventListener('dragstart', (event) => {
    el.classList.add('dragging')
    event.dataTransfer.setData('text/plain', round.id)
  })

  el.addEventListener('dragend', () => {
    el.classList.remove('dragging')
  })

  return el
}

function renderAutoGlobalBanPool(bodyEl, rounds) {
  if (!bodyEl) return
  bodyEl.innerHTML = ''
  if (!rounds.length) {
    const empty = document.createElement('div')
    empty.className = 'auto-global-ban-empty'
    empty.textContent = '拖拽对局到这里'
    bodyEl.appendChild(empty)
    return
  }
  rounds.forEach(round => {
    bodyEl.appendChild(buildAutoGlobalBanItem(round))
  })
}

function renderAutoGlobalBanUI() {
  const toggleEl = document.getElementById('autoGlobalBanToggle')
  if (toggleEl) toggleEl.checked = autoGlobalBan.enabled

  const roleASBH = document.getElementById('autoGlobalRoleASBH')
  const roleAHBS = document.getElementById('autoGlobalRoleAHBS')
  if (roleASBH) roleASBH.classList.toggle('active', autoGlobalBan.currentRole === 'asbh')
  if (roleAHBS) roleAHBS.classList.toggle('active', autoGlobalBan.currentRole === 'ahbs')

  const unassigned = autoGlobalBan.rounds.filter(r => !r.assigned)
  const asbhRounds = autoGlobalBan.rounds.filter(r => r.assigned === 'asbh')
  const ahbsRounds = autoGlobalBan.rounds.filter(r => r.assigned === 'ahbs')

  renderAutoGlobalBanPool(document.getElementById('autoGlobalPoolUnassignedBody'), unassigned)
  renderAutoGlobalBanPool(document.getElementById('autoGlobalPoolASBHBody'), asbhRounds)
  renderAutoGlobalBanPool(document.getElementById('autoGlobalPoolAHBSBody'), ahbsRounds)
}

function initAutoGlobalBanDnD() {
  const pools = document.querySelectorAll('.auto-global-ban-pool')
  pools.forEach(pool => {
    pool.addEventListener('dragover', (event) => {
      event.preventDefault()
      pool.classList.add('drag-over')
    })
    pool.addEventListener('dragleave', () => {
      pool.classList.remove('drag-over')
    })
    pool.addEventListener('drop', (event) => {
      event.preventDefault()
      pool.classList.remove('drag-over')
      const roundId = event.dataTransfer.getData('text/plain')
      const role = pool.dataset.role || ''
      assignAutoGlobalBanRound(roundId, role)
    })
  })
}

function computeAutoGlobalBans(role) {
  const rounds = autoGlobalBan.rounds.filter(r => r.assigned === role)
  const survivorSet = new Set()
  const hunterSet = new Set()
  rounds.forEach(round => {
    round.survivors.forEach(name => survivorSet.add(name))
    if (round.hunter) hunterSet.add(round.hunter)
  })
  return {
    survivors: Array.from(survivorSet),
    hunters: Array.from(hunterSet)
  }
}

async function replaceGlobalBans(survivors, hunters) {
  const uniqueSurvivors = uniqueList(survivors)
  const uniqueHunters = uniqueList(hunters)

  let survivorSetOk = false
  let hunterSetOk = false

  try {
    const res = await window.electronAPI.invoke('localBp:setGlobalBan', 'survivor', uniqueSurvivors)
    if (!res || res.success !== false) survivorSetOk = true
  } catch {}

  try {
    const res = await window.electronAPI.invoke('localBp:setGlobalBan', 'hunter', uniqueHunters)
    if (!res || res.success !== false) hunterSetOk = true
  } catch {}

  if (!survivorSetOk) {
    for (const name of [...state.globalBannedSurvivors]) {
      await window.electronAPI.invoke('localBp:removeGlobalBanSurvivor', name)
    }
    for (const name of uniqueSurvivors) {
      await window.electronAPI.invoke('localBp:addGlobalBanSurvivor', name)
    }
  }

  if (!hunterSetOk) {
    for (const name of [...state.globalBannedHunters]) {
      await window.electronAPI.invoke('localBp:removeGlobalBanHunter', name)
    }
    for (const name of uniqueHunters) {
      await window.electronAPI.invoke('localBp:addGlobalBanHunter', name)
    }
  }

  state.globalBannedSurvivors = uniqueSurvivors
  state.globalBannedHunters = uniqueHunters
  updateDisplay()
  updateCharacterStatus()
}

async function applyAutoGlobalBans(force) {
  if (!force && !autoGlobalBan.enabled) return
  const role = autoGlobalBan.currentRole
  const next = computeAutoGlobalBans(role)
  await replaceGlobalBans(next.survivors, next.hunters)
}

let pickType = null
let pickIndex = null
let pickAction = null
let currentSurvivorIndex = 0 // 当前选中的求生者索引（用于天赋选择）

if (typeof window !== 'undefined') {
  window.alert = () => {}
  window.confirm = () => true
}

// ========== 对局基础信息（matchBase）统一源 ==========
const LOCAL_ROOM_ID = 'local-bp'
const MATCH_BASE_KEY = 'localBp_matchBase'
const SCORE_STORAGE_KEY = `score_${LOCAL_ROOM_ID}`
const POSTMATCH_STORAGE_KEY = `postmatch_${LOCAL_ROOM_ID}`
const TEAM_MANAGER_KEY = 'asg_team_manager_teams'
const TEAM_MANAGER_SELECTION_KEY = 'asg_team_manager_selection'

let teamManagerTeams = []

let localTeamCsvInput = null
let localImportTeamCsvBtn = null
let localTeamManagerClearBtn = null
let localTeamManagerCount = null
let localTeamManagerTeamA = null
let localTeamManagerTeamB = null
let localTeamManagerPreviewA = null
let localTeamManagerPreviewB = null
let localApplyTeamManagerBtn = null

let matchBase = null

function loadTeamManagerTeams() {
  try {
    const raw = localStorage.getItem(TEAM_MANAGER_KEY)
    const data = raw ? JSON.parse(raw) : []
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveTeamManagerData() {
  localStorage.setItem(TEAM_MANAGER_KEY, JSON.stringify(teamManagerTeams))
}

function loadTeamManagerSelection() {
  try {
    const raw = localStorage.getItem(TEAM_MANAGER_SELECTION_KEY)
    const data = raw ? JSON.parse(raw) : {}
    return {
      teamA: typeof data?.teamA === 'string' ? data.teamA : '',
      teamB: typeof data?.teamB === 'string' ? data.teamB : ''
    }
  } catch {
    return { teamA: '', teamB: '' }
  }
}

function saveTeamManagerSelection(sel) {
  localStorage.setItem(TEAM_MANAGER_SELECTION_KEY, JSON.stringify(sel || {}))
}

function detectCsvDelimiter(text) {
  const firstLine = String(text || '').split(/\r?\n/, 1)[0] || ''
  const candidates = [',', ';', '\t']
  let best = ','
  let bestCount = -1
  for (const delimiter of candidates) {
    const count = (firstLine.match(new RegExp(`\\${delimiter}`, 'g')) || []).length
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }
  return best
}

function parseCsvRows(text, delimiter = ',') {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    if (!inQuotes && ch === delimiter) {
      row.push(field)
      field = ''
      continue
    }
    field += ch
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.map(r => r.map(v => (v || '').trim())).filter(r => r.some(v => v !== ''))
}

function normalizeHeader(h) {
  return (h || '').replace(/\uFEFF/g, '').replace(/\u0000/g, '').trim().toLowerCase()
}

function normalizeCell(v) {
  return String(v || '').replace(/\u0000/g, '').trim()
}

function findHeaderIndex(header, aliases) {
  return header.findIndex(h => aliases.includes(h))
}

function parseTeamsFromCsv(text) {
  const sanitized = String(text || '').replace(/\u0000/g, '')
  const rows = parseCsvRows(sanitized, detectCsvDelimiter(sanitized))
  if (rows.length <= 1) return []
  const header = rows[0].map(normalizeHeader)
  const idx = {
    teamName: findHeaderIndex(header, ['teamname', 'team_name', '战队名称', '队伍名称']),
    teamId: findHeaderIndex(header, ['teamid', 'team_id', '战队id', '战队编号', '队伍id', '队伍编号']),
    qq: findHeaderIndex(header, ['qqnumber', 'qq', 'qq号']),
    playerName: findHeaderIndex(header, ['playername', 'player_name', '选手名称', '成员名称']),
    gameId: findHeaderIndex(header, ['gameid', 'game_id', '游戏id', '游戏编号']),
    gameRank: findHeaderIndex(header, ['gamerank', 'game_rank', '段位']),
    playerDesc: findHeaderIndex(header, ['playerdescription', 'player_description', '选手描述', '成员描述'])
  }
  const map = new Map()
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const teamName = idx.teamName >= 0 ? normalizeCell(row[idx.teamName]) : ''
    const teamId = idx.teamId >= 0 ? normalizeCell(row[idx.teamId]) : ''
    if (!teamName && !teamId) continue
    const key = teamId && teamName
      ? `id:${teamId}|name:${teamName}`
      : (teamId ? `id:${teamId}` : `name:${teamName}`)
    if (!map.has(key)) {
      map.set(key, {
        id: teamId,
        name: teamName || teamId,
        qq: idx.qq >= 0 ? normalizeCell(row[idx.qq]) : '',
        players: []
      })
    }
    const team = map.get(key)
    const playerName = idx.playerName >= 0 ? normalizeCell(row[idx.playerName]) : ''
    const gameId = idx.gameId >= 0 ? normalizeCell(row[idx.gameId]) : ''
    const gameRank = idx.gameRank >= 0 ? normalizeCell(row[idx.gameRank]) : ''
    const playerDescription = idx.playerDesc >= 0 ? normalizeCell(row[idx.playerDesc]) : ''
    if (playerName || gameId) {
      const exists = team.players.some(p => (p.name || '') === playerName && (p.gameId || '') === gameId)
      if (!exists) {
        team.players.push({ name: playerName, gameId, gameRank, description: playerDescription })
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN'))
}

function findTeamFromManager(teams, val) {
  if (!val) return null
  return teams.find(t => (t.id || t.name) === val) || null
}

function renderTeamManager() {
  if (localTeamManagerCount) {
    localTeamManagerCount.textContent = teamManagerTeams.length ? `已导入 ${teamManagerTeams.length} 支队伍` : '未导入'
  }
  const selection = loadTeamManagerSelection()
  const buildOptions = (selectEl, selectedId) => {
    if (!selectEl) return
    const options = ['<option value="">请选择</option>'].concat(teamManagerTeams.map(t => {
      const val = t.id || t.name
      const label = t.name + (t.id ? ` (${t.id.slice(0, 6)}...)` : '')
      return `<option value="${val}">${label}</option>`
    }))
    selectEl.innerHTML = options.join('')
    if (selectedId) selectEl.value = selectedId
  }
  buildOptions(localTeamManagerTeamA, selection.teamA || '')
  buildOptions(localTeamManagerTeamB, selection.teamB || '')
  updateTeamPreview()
}

function renderPreview(el, team) {
  if (!el) return
  if (!team) {
    el.textContent = ''
    return
  }
  const players = team.players || []
  const list = players.map(p => p.name || p.gameId).filter(Boolean)
  el.textContent = list.length ? `阵容：${list.join('、')}` : '未识别选手'
}

function updateTeamPreview() {
  const teamA = findTeamFromManager(teamManagerTeams, localTeamManagerTeamA?.value)
  const teamB = findTeamFromManager(teamManagerTeams, localTeamManagerTeamB?.value)
  renderPreview(localTeamManagerPreviewA, teamA)
  renderPreview(localTeamManagerPreviewB, teamB)
  saveTeamManagerSelection({ teamA: localTeamManagerTeamA?.value || '', teamB: localTeamManagerTeamB?.value || '' })
}

async function importTeamCsv() {
  const file = localTeamCsvInput?.files?.[0]
  if (!file) {
    alert('请选择CSV文件')
    return
  }
  try {
    const text = await file.text()
    const teams = parseTeamsFromCsv(text)
    if (!teams.length) {
      alert('CSV未解析到队伍数据')
      return
    }
    teamManagerTeams = teams
    saveTeamManagerData()
    renderTeamManager()
    alert(`已导入 ${teams.length} 支队伍`)
  } catch (e) {
    alert('导入失败: ' + (e?.message || e))
  }
}

function clearTeamManager() {
  teamManagerTeams = []
  saveTeamManagerData()
  renderTeamManager()
}

function clearCurrentBpSelection() {
  state.survivors = [null, null, null, null]
  state.hunter = null
  state.hunterBannedSurvivors = []
  state.survivorBannedHunters = []
  state.survivorTalents = [[], [], [], []]
  state.hunterTalents = []
  state.hunterSkills = []
  document.querySelectorAll('.survivor-tab').forEach(tab => {
    tab.classList.remove('active', 'has-talents')
  })
  updateDisplay()
  updateCharacterStatus()
  updateTalentSkillUI()
  updateCurrentSurvivorTalentsDisplay()
  resetSearchInputs()
}

function applyTeamsToLocalBpFromManager() {
  const teams = loadTeamManagerTeams()
  const selection = loadTeamManagerSelection()
  const teamA = findTeamFromManager(teams, selection.teamA)
  const teamB = findTeamFromManager(teams, selection.teamB)
  if (!teamA && !teamB) {
    alert('请先在主页选择队伍')
    return
  }
  clearCurrentBpSelection()
  if (!matchBase) loadMatchBase()
  matchBase = normalizeMatchBase(matchBase || {})
  if (teamA) {
    matchBase.teamA.name = teamA.name || matchBase.teamA.name
    const rosterA = (teamA.players || []).map(p => p.name || p.gameId).filter(Boolean)
    if (rosterA.length) {
      matchBase.teamA.fullMembers = ensureFullMembers(rosterA)
      matchBase.teamA.roster = [...matchBase.teamA.fullMembers]
      matchBase.teamA.members = ensureMembers5(rosterA)
    }
  }
  if (teamB) {
    matchBase.teamB.name = teamB.name || matchBase.teamB.name
    const rosterB = (teamB.players || []).map(p => p.name || p.gameId).filter(Boolean)
    if (rosterB.length) {
      matchBase.teamB.fullMembers = ensureFullMembers(rosterB)
      matchBase.teamB.roster = [...matchBase.teamB.fullMembers]
      matchBase.teamB.members = ensureMembers5(rosterB)
    }
  }
  matchBase.lineup.survivors = []
  matchBase.lineup.hunter = null
  saveMatchBase(false)
  renderMatchBaseForm()
  updateLineupOptions()
  if (window.baseManager) {
    window.baseManager.load()
    window.baseManager.render()
  }
  alert('已应用到本地BP')
}

function initLocalTeamManagerUI() {
  localTeamCsvInput = document.getElementById('localTeamCsvInput')
  localImportTeamCsvBtn = document.getElementById('localImportTeamCsvBtn')
  localTeamManagerClearBtn = document.getElementById('localTeamManagerClearBtn')
  localTeamManagerCount = document.getElementById('localTeamManagerCount')
  localTeamManagerTeamA = document.getElementById('localTeamManagerTeamA')
  localTeamManagerTeamB = document.getElementById('localTeamManagerTeamB')
  localTeamManagerPreviewA = document.getElementById('localTeamManagerPreviewA')
  localTeamManagerPreviewB = document.getElementById('localTeamManagerPreviewB')
  localApplyTeamManagerBtn = document.getElementById('localApplyTeamManagerBtn')
  if (!localTeamManagerCount) return
  localImportTeamCsvBtn?.addEventListener('click', importTeamCsv)
  localTeamManagerClearBtn?.addEventListener('click', clearTeamManager)
  localTeamManagerTeamA?.addEventListener('change', updateTeamPreview)
  localTeamManagerTeamB?.addEventListener('change', updateTeamPreview)
  localApplyTeamManagerBtn?.addEventListener('click', applyTeamsToLocalBpFromManager)
  teamManagerTeams = loadTeamManagerTeams()
  renderTeamManager()
}

function getDefaultMatchBase() {
  return {
    mapName: '',
    teamA: {
      name: 'A队',
      logo: '',
      roster: [],
      members: ['', '', '', '', ''],
      memberRoles: [
        { canPlayHunter: false, canPlaySurvivor: false },
        { canPlayHunter: false, canPlaySurvivor: false },
        { canPlayHunter: false, canPlaySurvivor: false },
        { canPlayHunter: false, canPlaySurvivor: false },
        { canPlayHunter: false, canPlaySurvivor: false }
      ]
    },
    teamB: {
      name: 'B队',
      logo: '',
      roster: [],
      members: ['', '', '', '', ''],
      memberRoles: [
        { canPlayHunter: false, canPlaySurvivor: false },
        { canPlayHunter: false, canPlaySurvivor: false },
        { canPlayHunter: false, canPlaySurvivor: false },
        { canPlayHunter: false, canPlaySurvivor: false },
        { canPlayHunter: false, canPlaySurvivor: false }
      ]
    },
    lineup: {
      team: 'A',  // 'A' or 'B'
      survivors: [],  // Array of member indices (max 4)
      hunter: null    // Member index or null
    },
    defaultImages: {
      slot0: '',  // 求生者1默认图像
      slot1: '',  // 求生者2默认图像
      slot2: '',  // 求生者3默认图像
      slot3: '',  // 求生者4默认图像
      hunter: ''  // 监管者默认图像
    }
  }
}

function ensureMembers5(list) {
  const arr = Array.isArray(list) ? list.slice(0, 5) : []
  while (arr.length < 5) arr.push('')
  return arr
}

function ensureFullMembers(list) {
  if (!Array.isArray(list)) return []
  return list.map(v => String(v || '').trim()).filter(Boolean)
}

function getTeamRoster(team) {
  if (Array.isArray(team?.fullMembers) && team.fullMembers.length > 0) return team.fullMembers
  return Array.isArray(team?.members) ? team.members : []
}

function getTeamMemberName(team, index) {
  const roster = getTeamRoster(team)
  return roster[index] || ''
}

function ensureMemberRoles5(list) {
  const arr = Array.isArray(list) ? list.slice(0, 5) : []
  while (arr.length < 5) {
    arr.push({ canPlayHunter: false, canPlaySurvivor: false })
  }
  // Ensure each item has the required properties
  return arr.map(item => ({
    canPlayHunter: item?.canPlayHunter === true,
    canPlaySurvivor: item?.canPlaySurvivor === true
  }))
}

function normalizeMatchBase(raw) {
  const d = getDefaultMatchBase()
  const r = raw && typeof raw === 'object' ? raw : {}
  const out = {
    mapName: typeof r.mapName === 'string' ? r.mapName : d.mapName,
    teamA: {
      name: typeof r.teamA?.name === 'string' ? r.teamA.name : d.teamA.name,
      logo: typeof r.teamA?.logo === 'string' ? r.teamA.logo : d.teamA.logo,
      members: ensureMembers5(r.teamA?.members || r.teamA?.roster),
      fullMembers: ensureFullMembers(r.teamA?.fullMembers || r.teamA?.roster || r.teamA?.members),
      roster: ensureFullMembers(r.teamA?.roster || r.teamA?.fullMembers || r.teamA?.members),
      memberRoles: ensureMemberRoles5(r.teamA?.memberRoles)
    },
    teamB: {
      name: typeof r.teamB?.name === 'string' ? r.teamB.name : d.teamB.name,
      logo: typeof r.teamB?.logo === 'string' ? r.teamB.logo : d.teamB.logo,
      members: ensureMembers5(r.teamB?.members || r.teamB?.roster),
      fullMembers: ensureFullMembers(r.teamB?.fullMembers || r.teamB?.roster || r.teamB?.members),
      roster: ensureFullMembers(r.teamB?.roster || r.teamB?.fullMembers || r.teamB?.members),
      memberRoles: ensureMemberRoles5(r.teamB?.memberRoles)
    },
    lineup: {
      team: (r.lineup?.team === 'A' || r.lineup?.team === 'B') ? r.lineup.team : d.lineup.team,
      survivors: Array.isArray(r.lineup?.survivors) ? r.lineup.survivors.filter(i => Number.isInteger(i) && i >= 0) : d.lineup.survivors,
      hunter: (Number.isInteger(r.lineup?.hunter) && r.lineup.hunter >= 0) ? r.lineup.hunter : d.lineup.hunter
    },
    defaultImages: {
      slot0: typeof r.defaultImages?.slot0 === 'string' ? r.defaultImages.slot0 : '',
      slot1: typeof r.defaultImages?.slot1 === 'string' ? r.defaultImages.slot1 : '',
      slot2: typeof r.defaultImages?.slot2 === 'string' ? r.defaultImages.slot2 : '',
      slot3: typeof r.defaultImages?.slot3 === 'string' ? r.defaultImages.slot3 : '',
      hunter: typeof r.defaultImages?.hunter === 'string' ? r.defaultImages.hunter : ''
    }
  }
  return out
}

function tryParseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function toFileUrl(p) {
  if (!p) return ''
  if (p.startsWith('file://')) return p
  // 先规范化路径（反斜杠转正斜杠）
  const normalized = String(p).replace(/\\/g, '/')
  // 分割路径为各部分，分别编码每个部分（但保留斜杠）
  const parts = normalized.split('/')
  const encoded = parts.map(part => {
    // 不编码驱动器字母部分（如 C:）和空字符串
    if (part.endsWith(':') || part === '') return part
    // 对其他部分进行URI编码
    return encodeURIComponent(part)
  }).join('/')
  return `file:///${encoded.replace(/^\/+/, '')}`
}

function loadMatchBase() {
  if (window.baseManager) {
    // ✨ 优先使用 baseManager 的状态，避免 desync
    try {
      const raw = JSON.parse(JSON.stringify(window.baseManager.state))
      matchBase = normalizeMatchBase(raw)
      return matchBase
    } catch (e) {
      console.error('Failed to load matchBase from baseManager:', e)
    }
  }
  const raw = localStorage.getItem(MATCH_BASE_KEY)
  matchBase = normalizeMatchBase(tryParseJson(raw))
  return matchBase
}

function renderMatchBaseForm() {
  if (!matchBase) return
  const setVal = (id, v) => {
    const el = document.getElementById(id)
    if (el && typeof v === 'string') el.value = v
  }
  const setChecked = (id, checked) => {
    const el = document.getElementById(id)
    if (el && el.type === 'checkbox') el.checked = !!checked
  }

  setVal('baseMapName', matchBase.mapName || '')
  setVal('baseTeamAName', matchBase.teamA?.name || 'A队')
  setVal('baseTeamBName', matchBase.teamB?.name || 'B队')

  for (let i = 0; i < 5; i++) {
    setVal(`baseTeamAMember${i}`, matchBase.teamA?.members?.[i] || '')
    setVal(`baseTeamBMember${i}`, matchBase.teamB?.members?.[i] || '')

    // Set role checkboxes for team A
    const roleA = matchBase.teamA?.memberRoles?.[i]
    setChecked(`baseTeamAMember${i}Hunter`, roleA?.canPlayHunter)
    setChecked(`baseTeamAMember${i}Survivor`, roleA?.canPlaySurvivor)

    // Set role checkboxes for team B
    const roleB = matchBase.teamB?.memberRoles?.[i]
    setChecked(`baseTeamBMember${i}Hunter`, roleB?.canPlayHunter)
    setChecked(`baseTeamBMember${i}Survivor`, roleB?.canPlaySurvivor)
  }

  const aLogo = document.getElementById('baseTeamALogoPreview')
  if (aLogo) {
    const src = matchBase.teamA?.logo || ''
    if (src) {
      aLogo.src = src
      aLogo.style.display = 'block'
    } else {
      aLogo.removeAttribute('src')
      aLogo.style.display = 'none'
    }
  }

  const bLogo = document.getElementById('baseTeamBLogoPreview')
  if (bLogo) {
    const src = matchBase.teamB?.logo || ''
    if (src) {
      bLogo.src = src
      bLogo.style.display = 'block'
    } else {
      bLogo.removeAttribute('src')
      bLogo.style.display = 'none'
    }
  }

  // 地图下拉：兼容旧数据/自定义地图名
  ensureSelectHasValue('baseMapName', matchBase.mapName || '')
}

function ensureSelectHasValue(selectId, value) {
  const el = document.getElementById(selectId)
  if (!el || el.tagName !== 'SELECT') return
  const v = (value || '').trim()
  if (!v) return
  const exists = Array.from(el.options || []).some(o => o && o.value === v)
  if (exists) return

  const opt = document.createElement('option')
  opt.value = v
  opt.textContent = v
  const insertIndex = (el.options && el.options.length > 0 && el.options[0].value === '') ? 1 : 0
  el.insertBefore(opt, el.options[insertIndex] || null)
}

async function initMapSelects() {
  const selects = ['baseMapName']
    .map(id => document.getElementById(id))
    .filter(Boolean)
    .filter(el => el.tagName === 'SELECT')
  if (selects.length === 0) return

  let maps = []
  try {
    const res = await window.electronAPI.listMapAssets()
    if (res && res.success && Array.isArray(res.maps)) maps = res.maps
  } catch {
    maps = []
  }

  // 兜底：如果列表为空，使用硬编码的默认地图列表，防止后端读取失败导致功能不可用
  if (maps.length === 0) {
    console.warn('[LocalBP] 未能获取地图列表，使用默认列表')
    maps = ['军工厂', '红教堂', '圣心医院', '湖景村', '月亮河公园', '里奥的回忆', '永眠镇', '唐人街', '不归林']
  }

  for (const sel of selects) {
    const current = (sel.value || '').trim()
    sel.innerHTML = ''

    const empty = document.createElement('option')
    empty.value = ''
    empty.textContent = '（请选择地图）'
    sel.appendChild(empty)

    for (const name of maps) {
      const opt = document.createElement('option')
      opt.value = name
      opt.textContent = name
      sel.appendChild(opt)
    }

    // 兼容已有值/自定义值
    ensureSelectHasValue(sel.id, matchBase?.mapName || current)
    sel.value = matchBase?.mapName || current || ''
  }
}

function syncMatchBaseToScoreAndPostMatch() {
  if (!window.baseManager) return;
  const matchBase = window.baseManager.state;

  // 1) 同步比分页输入框
  const scoreA = document.getElementById('scoreTeamAName')
  const scoreB = document.getElementById('scoreTeamBName')
  if (scoreA) scoreA.value = matchBase.teamA.name || 'A队'
  if (scoreB) scoreB.value = matchBase.teamB.name || 'B队'

  // 2) 同步赛后页基础字段
  const pmMap = document.getElementById('pmMapNameDisplay')
  if (pmMap) pmMap.textContent = matchBase.mapName || '未选择地图'
  const pmA = document.getElementById('pmTeamAName')
  const pmB = document.getElementById('pmTeamBName')
  if (pmA) pmA.value = matchBase.teamA.name || 'A队'
  if (pmB) pmB.value = matchBase.teamB.name || 'B队'

  // 3) 同步并持久化到展示窗口读的键（不覆盖比分/赛后其它字段）
  syncScoreStorageBaseFields()
  syncPostMatchStorageBaseFields()
}

// 简易计算比分字符串（用于同步 Character Display）
function _getScoreMetaForSync(isTeamA) {
  let d = typeof scoreData !== 'undefined' ? scoreData : null
  if (!d || !d.bos) {
    try {
      const s = localStorage.getItem(SCORE_STORAGE_KEY) || localStorage.getItem('localBp_score')
      if (s) d = JSON.parse(s)
    } catch { }
  }
  if (!d || !Array.isArray(d.bos)) return 'W:0 D:0 L:0'

  let w = 0, draw = 0, l = 0
  d.bos.forEach(bo => {
    if (!bo || !bo.upper || !bo.lower) return
    const uA = parseInt(bo.upper.teamA) || 0
    const uB = parseInt(bo.upper.teamB) || 0
    const lA = parseInt(bo.lower.teamA) || 0
    const lB = parseInt(bo.lower.teamB) || 0

    // 只有上下半局都有分才算完成
    const hasUpper = uA > 0 || uB > 0
    const hasLower = lA > 0 || lB > 0

    if (hasUpper && hasLower) {
      const tA = uA + lA
      const tB = uB + lB
      if (isTeamA) {
        if (tA > tB) w++
        else if (tB > tA) l++
        else draw++
      } else {
        if (tB > tA) w++
        else if (tA > tB) l++
        else draw++
      }
    }
  })
  return `W:${w} D:${draw} L:${l}`
}

async function syncMatchBaseToFrontend() {
  try {
    let currentMatchBase = matchBase
    if (window.baseManager) {
      currentMatchBase = window.baseManager.state
    } else {
      if (!currentMatchBase) loadMatchBase()
      currentMatchBase = matchBase
    }

    const playerNames = ['', '', '', '', '']

    // 检查是否是新的 baseManager 结构 (matchConfig)
    if (currentMatchBase.matchConfig) {
      const { survivors, hunter } = currentMatchBase.matchConfig
      // 求生者 (直接是名字数组)
      for (let i = 0; i < 4; i++) {
        if (survivors && survivors[i]) {
          playerNames[i] = survivors[i]
        }
      }
      // 监管者 (直接是名字)
      if (hunter) {
        playerNames[4] = hunter
      }
    } else {
      // 旧结构 (lineup + indices)
      const team = currentMatchBase.lineup.team === 'A' ? currentMatchBase.teamA : currentMatchBase.teamB
      // 求生者
      for (let i = 0; i < 4; i++) {
        const memberIdx = currentMatchBase.lineup.survivors[i]
        if (typeof memberIdx === 'number' && memberIdx >= 0) {
          playerNames[i] = getTeamMemberName(team, memberIdx)
        }
      }
      // 监管者
      if (typeof currentMatchBase.lineup.hunter === 'number' && currentMatchBase.lineup.hunter >= 0) {
        playerNames[4] = getTeamMemberName(team, currentMatchBase.lineup.hunter)
      }
    }

    console.log('[同步选手名字] 选手名字:', playerNames)

    await window.electronAPI.invoke('localBp:applyMatchBase', {
      mapName: currentMatchBase.mapName || '',
      teamA: {
        name: currentMatchBase.teamA?.name || 'A队',
        logo: currentMatchBase.teamA?.logo || '',
        meta: _getScoreMetaForSync(true)
      },
      teamB: {
        name: currentMatchBase.teamB?.name || 'B队',
        logo: currentMatchBase.teamB?.logo || '',
        meta: _getScoreMetaForSync(false)
      },
      playerNames: playerNames
    })
    console.log('[同步选手名字] IPC调用成功')
  } catch (e) {
    console.error('[同步选手名字] 失败:', e)
  }
}

function saveMatchBase(showToast) {
  if (!matchBase) loadMatchBase()
  localStorage.setItem(MATCH_BASE_KEY, JSON.stringify(matchBase))
  syncMatchBaseToScoreAndPostMatch()
  renderMatchBaseForm()
  syncMatchBaseToFrontend()
  syncDefaultImagesToMainProcess() // 新增：同步默认图片到主进程
  if (showToast) alert('对局基础信息已保存')
}

async function syncDefaultImagesToMainProcess() {
  try {
    if (!matchBase?.defaultImages) return
    await window.electronAPI.invoke('localBp:setDefaultImages', matchBase.defaultImages)
  } catch (e) {
    console.error('[syncDefaultImages] Error:', e)
  }
}

function resetMatchBase() {
  if (!confirm('确定重置对局基础信息？（队名/Logo/成员/地图）')) return
  matchBase = getDefaultMatchBase()
  localStorage.setItem(MATCH_BASE_KEY, JSON.stringify(matchBase))
  syncMatchBaseToScoreAndPostMatch()
  renderMatchBaseForm()
  syncMatchBaseToFrontend()
}

function updateMatchBaseTeamName(team, name) {
  if (window.baseManager) {
    window.baseManager.updateTeamName(team, name)
    return
  }
  if (!matchBase) loadMatchBase()
  if (team === 'A') matchBase.teamA.name = name || 'A队'
  if (team === 'B') matchBase.teamB.name = name || 'B队'
  localStorage.setItem(MATCH_BASE_KEY, JSON.stringify(matchBase))
  syncMatchBaseToScoreAndPostMatch()
  syncMatchBaseToFrontend()
}

function updateMatchBaseMapName(name) {
  if (window.baseManager) {
    window.baseManager.setMap(name);
  }
}

function updateMatchBaseMember(team, index, value) {
  if (!matchBase) loadMatchBase()
  if (!Number.isInteger(index) || index < 0 || index > 4) return
  const target = team === 'A' ? matchBase.teamA : (team === 'B' ? matchBase.teamB : null)
  if (!target) return
  target.members[index] = value || ''
  if (!Array.isArray(target.fullMembers)) target.fullMembers = [...target.members]
  while (target.fullMembers.length <= index) target.fullMembers.push('')
  target.fullMembers[index] = value || ''
  target.roster = ensureFullMembers(target.fullMembers)
  localStorage.setItem(MATCH_BASE_KEY, JSON.stringify(matchBase))
  updateLineupOptions()
}

function updateMemberRoles(team, index) {
  if (!matchBase) loadMatchBase()
  if (!Number.isInteger(index) || index < 0 || index > 4) return

  const hunterCheckbox = document.getElementById(`baseTeam${team}Member${index}Hunter`)
  const survivorCheckbox = document.getElementById(`baseTeam${team}Member${index}Survivor`)

  if (!hunterCheckbox || !survivorCheckbox) return

  const roles = {
    canPlayHunter: hunterCheckbox.checked,
    canPlaySurvivor: survivorCheckbox.checked
  }

  if (team === 'A') {
    matchBase.teamA.memberRoles[index] = roles
  } else if (team === 'B') {
    matchBase.teamB.memberRoles[index] = roles
  }

  localStorage.setItem(MATCH_BASE_KEY, JSON.stringify(matchBase))
  updateLineupOptions()
}

function swapTeamInfo() {
  if (!confirm('确定要交换A队和B队的所有信息（队名、Logo、成员、角色）吗？')) return

  if (!matchBase) loadMatchBase()

  // Swap team data
  const tempTeam = {
    name: matchBase.teamA.name,
    logo: matchBase.teamA.logo,
    members: [...matchBase.teamA.members],
    fullMembers: Array.isArray(matchBase.teamA.fullMembers) ? [...matchBase.teamA.fullMembers] : [],
    roster: Array.isArray(matchBase.teamA.roster) ? [...matchBase.teamA.roster] : [],
    memberRoles: matchBase.teamA.memberRoles.map(r => ({ ...r }))
  }

  matchBase.teamA.name = matchBase.teamB.name
  matchBase.teamA.logo = matchBase.teamB.logo
  matchBase.teamA.members = [...matchBase.teamB.members]
  matchBase.teamA.fullMembers = Array.isArray(matchBase.teamB.fullMembers) ? [...matchBase.teamB.fullMembers] : []
  matchBase.teamA.roster = Array.isArray(matchBase.teamB.roster) ? [...matchBase.teamB.roster] : []
  matchBase.teamA.memberRoles = matchBase.teamB.memberRoles.map(r => ({ ...r }))

  matchBase.teamB.name = tempTeam.name
  matchBase.teamB.logo = tempTeam.logo
  matchBase.teamB.members = [...tempTeam.members]
  matchBase.teamB.fullMembers = [...tempTeam.fullMembers]
  matchBase.teamB.roster = [...tempTeam.roster]
  matchBase.teamB.memberRoles = tempTeam.memberRoles.map(r => ({ ...r }))

  // Save and refresh
  saveMatchBase(false)
  if (typeof window.swapScoreTeamsData === 'function') {
    window.swapScoreTeamsData()
  }
  alert('队伍信息已交换！')
}

async function selectTeamLogoForBase(team) {
  try {
    if (!window.electronAPI?.selectTeamLogo) throw new Error('当前版本不支持选择Logo')
    const ipcTeam = team === 'A' ? 'teamA' : 'teamB'
    const res = await window.electronAPI.selectTeamLogo(ipcTeam)
    if (!res || res.success === false) {
      if (res?.canceled) return
      throw new Error(res?.error || '选择失败')
    }

    const url = toFileUrl(res.path)
    if (window.baseManager) {
      window.baseManager.setTeamLogo(team, url);
    }
  } catch (e) {
    alert('选择Logo失败：' + (e?.message || e))
  }
}

function clearTeamLogoForBase(team) {
  if (!matchBase) loadMatchBase()
  if (team === 'A') matchBase.teamA.logo = ''
  else matchBase.teamB.logo = ''
  saveMatchBase(false)
}

// ========== 上场阵容管理 ==========
function updateLineupOptions() {
  if (!matchBase) loadMatchBase()

  const selectedTeam = document.querySelector('input[name="lineupTeam"]:checked')?.value || 'A'
  matchBase.lineup.team = selectedTeam

  const team = selectedTeam === 'A' ? matchBase.teamA : matchBase.teamB
  const roster = getTeamRoster(team)
  const survivorContainer = document.getElementById('survivorLineupOptions')
  const hunterContainer = document.getElementById('hunterLineupOptions')

  if (!survivorContainer || !hunterContainer) return

  // Generate survivor options
  survivorContainer.innerHTML = ''
  roster.forEach((memberName, index) => {
    const nameText = String(memberName || '').trim()
    const canPlay = index >= 5 ? true : team.memberRoles[index]?.canPlaySurvivor
    if (!canPlay || !nameText) return

    const isChecked = matchBase.lineup.survivors.includes(index)
    const checkbox = document.createElement('label')
    checkbox.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px;background:#fff;border:2px solid #e2e8f0;border-radius:6px;cursor:pointer;'
    checkbox.innerHTML = `
          <input type="checkbox" value="${index}" ${isChecked ? 'checked' : ''} onchange="toggleSurvivorLineup(${index})">
          <span style="font-weight:500;">${nameText}</span>
        `
    survivorContainer.appendChild(checkbox)
  })

  if (survivorContainer.children.length === 0) {
    survivorContainer.innerHTML = '<div style="color:#9ca3af;font-size:13px;padding:8px;">暂无可选的求生者（请先设置成员角色）</div>'
  }

  // Generate hunter options
  hunterContainer.innerHTML = ''
  roster.forEach((memberName, index) => {
    const nameText = String(memberName || '').trim()
    const canPlay = index >= 5 ? true : team.memberRoles[index]?.canPlayHunter
    if (!canPlay || !nameText) return

    const isChecked = matchBase.lineup.hunter === index
    const radio = document.createElement('label')
    radio.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px;background:#fff;border:2px solid #e2e8f0;border-radius:6px;cursor:pointer;'
    radio.innerHTML = `
          <input type="radio" name="hunterLineup" value="${index}" ${isChecked ? 'checked' : ''} onchange="selectHunterLineup(${index})">
          <span style="font-weight:500;">${nameText}</span>
        `
    hunterContainer.appendChild(radio)
  })

  if (hunterContainer.children.length === 0) {
    hunterContainer.innerHTML = '<div style="color:#9ca3af;font-size:13px;padding:8px;">暂无可选的监管者（请先设置成员角色）</div>'
  }

  updateLineupDisplay()
  saveMatchBase(false)
}

function toggleSurvivorLineup(index) {
  if (!matchBase) loadMatchBase()

  const idx = matchBase.lineup.survivors.indexOf(index)
  if (idx > -1) {
    matchBase.lineup.survivors.splice(idx, 1)
  } else {
    if (matchBase.lineup.survivors.length >= 4) {
      alert('最多只能选择4个求生者！')
      updateLineupOptions() // Refresh to uncheck
      return
    }
    matchBase.lineup.survivors.push(index)
  }

  updateLineupDisplay()
  saveMatchBase(false)
}

function selectHunterLineup(index) {
  if (!matchBase) loadMatchBase()
  matchBase.lineup.hunter = index
  updateLineupDisplay()
  saveMatchBase(false)
}

function updateLineupDisplay() {
  if (!matchBase) return

  const team = matchBase.lineup.team === 'A' ? matchBase.teamA : matchBase.teamB
  const survivorsDisplay = document.getElementById('currentSurvivorsDisplay')
  const hunterDisplay = document.getElementById('currentHunterDisplay')

  if (survivorsDisplay) {
    if (matchBase.lineup.survivors.length === 0) {
      survivorsDisplay.textContent = '未选择'
      survivorsDisplay.style.color = '#9ca3af'
    } else {
      const names = matchBase.lineup.survivors.map(i => getTeamMemberName(team, i) || `成员${i + 1}`).join(', ')
      survivorsDisplay.textContent = names
      survivorsDisplay.style.color = '#059669'
    }
  }

  if (hunterDisplay) {
    if (matchBase.lineup.hunter === null) {
      hunterDisplay.textContent = '未选择'
      hunterDisplay.style.color = '#9ca3af'
    } else {
      hunterDisplay.textContent = getTeamMemberName(team, matchBase.lineup.hunter) || `成员${matchBase.lineup.hunter + 1}`
      hunterDisplay.style.color = '#dc2626'
    }
  }
}

async function applyLineup() {
  if (!matchBase) loadMatchBase()

  if (matchBase.lineup.survivors.length > 4) {
    alert('最多只能选择4个求生者！当前选择了' + matchBase.lineup.survivors.length + '个')
    return
  }

  if (matchBase.lineup.survivors.length !== 4) {
    alert('请选择4个求生者！当前选择了' + matchBase.lineup.survivors.length + '个')
    return
  }

  if (matchBase.lineup.hunter === null) {
    alert('请选择1个监管者！')
    return
  }

  const team = matchBase.lineup.team === 'A' ? matchBase.teamA : matchBase.teamB
  console.log('[应用阵容] 当前队伍:', matchBase.lineup.team, 'survivors:', matchBase.lineup.survivors, 'hunter:', matchBase.lineup.hunter)

  // Apply to post-match data
  for (let i = 0; i < 4; i++) {
    const memberIndex = matchBase.lineup.survivors[i]
    const memberName = getTeamMemberName(team, memberIndex)
    const input = document.getElementById(`pmS${i + 1}Name`)
    if (input) input.value = memberName
  }

  const hunterName = getTeamMemberName(team, matchBase.lineup.hunter)
  const hunterInput = document.getElementById('pmHunterName')
  if (hunterInput) hunterInput.value = hunterName

  // Save post-match data
  savePostMatch()

  // 同步选手名字到前台BP
  await syncMatchBaseToFrontend()

  alert('上场阵容已应用到赛后数据和前台BP！')
}

// 天赋和技能常量
let SURVIVOR_TALENTS = ['回光返照', '飞轮效应', '化险为夷', '膝跳反射']
let HUNTER_TALENTS = ['封闭空间', '底牌', '张狂', '挽留']
let HUNTER_SKILLS = ['聆听', '失常', '兴奋', '巡视者', '传送', '窥视者', '闪现', '移行']

// 加载角色列表
async function loadCharacters() {
  const result = await window.electronAPI.invoke('localBp:getCharacters')
  if (result.success) {
    if (result.data) {
      // 保持兼容：使用字符串数组作为选择列表的核心
      // 后端返回的 getCharacters 可能已经是 enriched data，或者只是 name
      // 这里依赖 getCharacterIndex 的改动，或者 getCharacters 保持 name list
      // 检查 result.data 结构
      if (Array.isArray(result.data.survivors) && typeof result.data.survivors[0] === 'object') {
        characters.survivors = result.data.survivors.map(c => c.name)
        characters.hunters = result.data.hunters.map(c => c.name)
      } else {
        characters = result.data
        if (characters.pinyinMap && typeof characters.pinyinMap === 'object') {
          CHAR_PY_MAP = characters.pinyinMap
        }
      }
    }
  }

  // 尝试获取 talents / skills 定义
  const idxRes = await window.electronAPI.invoke('character:get-index')
  if (idxRes.success && idxRes.data) {
    characterAssetOverrides = idxRes.data.assetOverrides || {}
    if (idxRes.data.survivorTalents && idxRes.data.survivorTalents.length > 0) {
      SURVIVOR_TALENTS = idxRes.data.survivorTalents.map(t => typeof t === 'string' ? t : t.name)
    }
    if (idxRes.data.hunterTalents && idxRes.data.hunterTalents.length > 0) {
      HUNTER_TALENTS = idxRes.data.hunterTalents.map(t => typeof t === 'string' ? t : t.name)
    }
    if (idxRes.data.hunterSkills && idxRes.data.hunterSkills.length > 0) {
      HUNTER_SKILLS = idxRes.data.hunterSkills.map(t => typeof t === 'string' ? t : t.name)
    }
  }

  renderTalentSkillSelects()
}

async function loadState() {
  const result = await window.electronAPI.invoke('localBp:getState')
  if (result && result.success && result.data) {
    const data = result.data
    state.survivors = Array.isArray(data.survivors) ? data.survivors : [null, null, null, null]
    state.hunter = data.hunter || null
    state.hunterBannedSurvivors = Array.isArray(data.hunterBannedSurvivors) ? data.hunterBannedSurvivors : []
    state.survivorBannedHunters = Array.isArray(data.survivorBannedHunters) ? data.survivorBannedHunters : []
    state.globalBannedSurvivors = uniqueList(data.globalBannedSurvivors)
    state.globalBannedHunters = uniqueList(data.globalBannedHunters)
    // 加载每个求生者的天赋（二维数组）
    state.survivorTalents = Array.isArray(data.survivorTalents) && data.survivorTalents.length === 4
      ? data.survivorTalents.map(t => Array.isArray(t) ? t : [])
      : [[], [], [], []]
    state.hunterTalents = Array.isArray(data.hunterTalents) ? data.hunterTalents : []
    state.hunterSkills = Array.isArray(data.hunterSkills) ? data.hunterSkills : []
    state.playerNames = Array.isArray(data.playerNames) ? data.playerNames : ['', '', '', '', '']
  }
  // 恢复选手名字输入框
  for (let i = 0; i < 5; i++) {
    const input = document.getElementById(`player-name-${i}`)
    if (input && state.playerNames[i]) {
      input.value = state.playerNames[i]
    }
  }
  // 更新天赋/技能UI
  updateTalentSkillUI()
}

function applyLocalBpStateFromUpdateData(payload) {
  if (!payload || typeof payload !== 'object') return
  const round = payload.currentRoundData || {}
  state.survivors = Array.isArray(round.selectedSurvivors) ? round.selectedSurvivors : [null, null, null, null]
  state.hunter = round.selectedHunter || null
  state.hunterBannedSurvivors = Array.isArray(round.hunterBannedSurvivors) ? round.hunterBannedSurvivors : []
  state.survivorBannedHunters = Array.isArray(round.survivorBannedHunters) ? round.survivorBannedHunters : []
  state.globalBannedSurvivors = uniqueList(payload.globalBannedSurvivors)
  state.globalBannedHunters = uniqueList(payload.globalBannedHunters)
  state.survivorTalents = Array.isArray(payload.survivorTalents) && payload.survivorTalents.length === 4
    ? payload.survivorTalents.map(t => Array.isArray(t) ? t : [])
    : [[], [], [], []]
  state.hunterTalents = Array.isArray(payload.hunterTalents) ? payload.hunterTalents : []
  state.hunterSkills = Array.isArray(payload.hunterSkills) ? payload.hunterSkills : []
  state.playerNames = Array.isArray(payload.playerNames) ? payload.playerNames : ['', '', '', '', '']
  if (typeof payload.mapName === 'string' && payload.mapName) {
    if (!matchBase) loadMatchBase()
    matchBase.mapName = payload.mapName
  }
  updateDisplay()
  updateCharacterStatus()
  updateTalentSkillUI()
  if (window.bpGuideState && window.bpGuideState.active) {
    renderBpGuideStep()
  }
}

function isBanned(name) {
  return (
    state.hunterBannedSurvivors.includes(name) ||
    state.survivorBannedHunters.includes(name) ||
    state.globalBannedSurvivors.includes(name) ||
    state.globalBannedHunters.includes(name)
  )
}

function renderPickGrid() {
  const grid = document.getElementById('pick-grid')
  if (!pickType) {
    grid.innerHTML = ''
    return
  }

  let list = pickType === 'survivor' ? characters.survivors : characters.hunters
  if (pickType === 'survivor') {
    list = [...list].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  }

  grid.innerHTML = list.map(name => `
        <div class="character-item" onclick="selectCharacter('${name}')" data-name="${name}">
          <img class="character-img" src="${getCharacterAssetSrc(pickType, 'header', name)}" onerror="this.style.display='none'">
          <div class="character-name">${name}</div>
        </div>
      `).join('')

  updateCharacterStatus()
}

function openPickModal(type, index) {
  pickType = type
  pickIndex = index
  pickAction = type === 'survivor' ? 'slot-survivor' : 'slot-hunter'
  const modal = document.getElementById('pickModal')
  modal.classList.add('show')
  updatePickModalTitle()
  renderPickGrid()
}

function openBanModal(mode) {
  if (mode === 'ban-survivor') {
    pickType = 'survivor'
    pickIndex = null
    pickAction = 'ban-survivor'
  } else if (mode === 'ban-hunter') {
    pickType = 'hunter'
    pickIndex = null
    pickAction = 'ban-hunter'
  } else if (mode === 'global-survivor') {
    pickType = 'survivor'
    pickIndex = null
    pickAction = 'global-survivor'
  } else if (mode === 'global-hunter') {
    pickType = 'hunter'
    pickIndex = null
    pickAction = 'global-hunter'
  } else {
    return
  }

  const modal = document.getElementById('pickModal')
  modal.classList.add('show')
  updatePickModalTitle()
  renderPickGrid()
}

function closePickModal() {
  const status = getBpGuideLockStatus()
  if (status.active && !status.done) return
  if (status.active && status.done) clearBpGuideLock()
  const modal = document.getElementById('pickModal')
  modal.classList.remove('show')
  pickType = null
  pickIndex = null
  pickAction = null
}

// 选择角色（弹窗内）
async function selectCharacter(name) {
  const pickingSlot = pickAction === 'slot-survivor' || pickAction === 'slot-hunter'
  if (pickingSlot && isBanned(name)) {
    alert('该角色已被禁用')
    return
  }

  if (pickAction === 'slot-survivor') {
    await window.electronAPI.invoke('localBp:setSurvivor', { index: pickIndex, character: name })
    state.survivors[pickIndex] = name
  } else if (pickAction === 'slot-hunter') {
    await window.electronAPI.invoke('localBp:setHunter', name)
    state.hunter = name
  } else if (pickAction === 'ban-survivor') {
    await window.electronAPI.invoke('localBp:addBanSurvivor', name)
    if (!state.hunterBannedSurvivors.includes(name)) state.hunterBannedSurvivors.push(name)
  } else if (pickAction === 'ban-hunter') {
    await window.electronAPI.invoke('localBp:addBanHunter', name)
    if (!state.survivorBannedHunters.includes(name)) state.survivorBannedHunters.push(name)
  } else if (pickAction === 'global-survivor') {
    await window.electronAPI.invoke('localBp:addGlobalBanSurvivor', name)
    if (!state.globalBannedSurvivors.includes(name)) state.globalBannedSurvivors.push(name)
  } else if (pickAction === 'global-hunter') {
    await window.electronAPI.invoke('localBp:addGlobalBanHunter', name)
    if (!state.globalBannedHunters.includes(name)) state.globalBannedHunters.push(name)
  }

  updateDisplay()

  updateCharacterStatus()
  const guideAction = getGuideActionFromPickAction(pickAction)
  if (handleGuideLockAfterSelection(guideAction)) return
  closePickModal()
}

// 更新显示
function updateDisplay() {
  // 更新卡槽
  for (let i = 0; i < 4; i++) {
    const slot = document.getElementById(`slot-${i}`)
    const char = document.getElementById(`char-${i}`)
    const charText = document.getElementById(`char-text-${i}`)
    const defaultImg = document.getElementById(`default-img-${i}`)
    const blink = document.getElementById(`blink-${i}`)
    const playerNameEl = document.getElementById(`slot-player-${i}`)
    const talentsEl = document.getElementById(`slot-talents-${i}`)

    if (slot) {
      if (state.survivors[i]) {
        slot.classList.add('filled')
        // 有角色：右键清空
        slot.oncontextmenu = (e) => {
          // 如果右键点击在搜索输入框上，不处理
          if (e.target.classList.contains('slot-search')) return
          e.preventDefault()
          clearSlot(i)
        }
      } else {
        slot.classList.remove('filled')
        // 无角色：右键显示菜单
        slot.oncontextmenu = (e) => {
          // 如果右键点击在搜索输入框上，不处理
          if (e.target.classList.contains('slot-search')) return
          e.preventDefault()
          showSlotContextMenu(e, i, 'survivor')
        }
      }
    }

    if (char && charText && defaultImg) {
      const defaultImage = matchBase?.defaultImages?.[`slot${i}`]
      if (state.survivors[i]) {
        // 有角色：显示角色名，隐藏默认图片
        charText.textContent = state.survivors[i]
        charText.style.display = 'block'
        defaultImg.style.display = 'none'
        defaultImg.src = ''
      } else if (defaultImage) {
        // 无角色但有默认图像：隐藏文字，显示图片
        charText.style.display = 'none'
        defaultImg.style.display = 'block'
        defaultImg.src = defaultImage
      } else {
        // 无角色无默认图像：显示"未选择"
        charText.textContent = '未选择'
        charText.style.display = 'block'
        defaultImg.style.display = 'none'
        defaultImg.src = ''
      }
    }
    if (blink) {
      blink.style.display = 'inline-block'
    }

    // 显示选手名字
    if (playerNameEl) {
      playerNameEl.textContent = state.playerNames[i] || ''
    }

    // 显示该求生者的天赋（每个求生者单独的天赋）
    if (talentsEl) {
      const talents = state.survivorTalents[i] || []
      if (talents.length > 0) {
        talentsEl.innerHTML = talents.map(talent =>
          `<img class="slot-talent-icon" src="../assets/talents/${talent}.png" title="${talent}" onerror="this.style.display='none'">`
        ).join('')
      } else {
        talentsEl.innerHTML = ''
      }
    }
  }



  const hunterSlot = document.getElementById('slot-hunter')
  const hunterChar = document.getElementById('char-hunter')
  const hunterCharText = document.getElementById('char-text-hunter')
  const hunterDefaultImg = document.getElementById('default-img-hunter')
  const hunterBlink = document.getElementById('blink-4')
  const hunterPlayerNameEl = document.getElementById('slot-player-4')
  const hunterTalentsEl = document.getElementById('slot-talents-hunter')
  const hunterSkillsEl = document.getElementById('slot-skills-hunter')

  if (hunterSlot) {
    if (state.hunter) {
      hunterSlot.classList.add('filled')
      hunterSlot.oncontextmenu = (e) => {
        // 如果右键点击在搜索输入框上，不处理
        if (e.target.classList.contains('slot-search')) return
        e.preventDefault()
        clearHunter()
      }
    } else {
      hunterSlot.classList.remove('filled')
      // 无角色：右键显示菜单
      hunterSlot.oncontextmenu = (e) => {
        // 如果右键点击在搜索输入框上，不处理
        if (e.target.classList.contains('slot-search')) return
        e.preventDefault()
        showSlotContextMenu(e, 4, 'hunter')
      }
    }
  }
  if (hunterChar && hunterCharText && hunterDefaultImg) {
    const defaultImage = matchBase?.defaultImages?.hunter
    if (state.hunter) {
      // 有角色：显示角色名，隐藏默认图片
      hunterCharText.textContent = state.hunter
      hunterCharText.style.display = 'block'
      hunterDefaultImg.style.display = 'none'
      hunterDefaultImg.src = ''
    } else if (defaultImage) {
      // 无角色但有默认图片：隐藏文字，显示图片
      hunterCharText.style.display = 'none'
      hunterDefaultImg.style.display = 'block'
      hunterDefaultImg.src = defaultImage
    } else {
      // 无角色无默认图像：显示"未选择"
      hunterCharText.textContent = '未选择'
      hunterCharText.style.display = 'block'
      hunterDefaultImg.style.display = 'none'
      hunterDefaultImg.src = ''
    }
  }
  if (hunterBlink) {
    hunterBlink.style.display = 'inline-block'
  }

  // 显示监管者选手名字
  if (hunterPlayerNameEl) {
    hunterPlayerNameEl.textContent = state.playerNames[4] || ''
  }

  // 显示监管者天赋（支持多选）
  if (hunterTalentsEl) {
    if (state.hunterTalents && state.hunterTalents.length > 0) {
      hunterTalentsEl.innerHTML = state.hunterTalents.map(talent =>
        `<img class="slot-talent-icon" src="../assets/talents/${talent}.png" title="${talent}" onerror="this.style.display='none'">`
      ).join('')
    } else {
      hunterTalentsEl.innerHTML = ''
    }
  }

  // 显示监管者技能
  if (hunterSkillsEl) {
    if (state.hunterSkills && state.hunterSkills.length > 0) {
      hunterSkillsEl.innerHTML = state.hunterSkills.map(skill =>
        `<img class="slot-talent-icon" src="../assets/skills/${skill}.png" title="${skill}" onerror="this.style.display='none'">`
      ).join('')
    } else {
      hunterSkillsEl.innerHTML = ''
    }
  }

  // 更新禁用列表
  const renderBanList = (elementId, items, removeFnName) => {
    const el = document.getElementById(elementId)
    if (!el) return
    if (!items || items.length === 0) {
      el.innerHTML = '<div class="empty-state">点击添加</div>'
      return
    }
    el.innerHTML = items.map(name => `
          <div class="ban-item" onclick="event.stopPropagation()">
            <span>${name}</span>
            <span class="ban-item-remove" onclick="event.stopPropagation(); ${removeFnName}('${name}')">×</span>
          </div>
        `).join('')
  }

  renderBanList('ban-survivor-list', state.hunterBannedSurvivors, 'removeBanSurvivor')
  renderBanList('ban-hunter-list', state.survivorBannedHunters, 'removeBanHunter')
  renderBanList('global-ban-survivor-list', state.globalBannedSurvivors, 'removeGlobalBanSurvivor')
  renderBanList('global-ban-hunter-list', state.globalBannedHunters, 'removeGlobalBanHunter')
  if (window.bpGuideState && window.bpGuideState.active) {
    renderBpGuideStep()
  }
}

// ========== 默认图像右键菜单功能 ==========

// 显示槽位右键菜单
function showSlotContextMenu(e, slotIndex, type) {
  const slotKey = type === 'hunter' ? 'hunter' : `slot${slotIndex}`
  const hasDefaultImage = matchBase?.defaultImages?.[slotKey]

  const menu = document.createElement('div')
  menu.className = 'context-menu'
  menu.style.cssText = `
        position: fixed;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
        background: #fff;
        border: 1px solid #ccc;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        min-width: 160px;
        overflow: hidden;
      `

  menu.innerHTML = `
        <div class="context-menu-item" data-action="set" style="padding: 10px 14px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 16px;">📷</span>
          <span>设置默认图像</span>
        </div>
        ${hasDefaultImage ? `
          <div class="context-menu-item" data-action="clear" style="padding: 10px 14px; cursor: pointer; color: #e53e3e; display: flex; align-items: center; gap: 8px; border-top: 1px solid #eee;">
            <span style="font-size: 16px;">🗑️</span>
            <span>清除默认图像</span>
          </div>
        ` : ''}
      `

  // 添加hover效果
  menu.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('mouseover', () => {
      item.style.background = item.dataset.action === 'clear' ? '#fff5f5' : '#f7fafc'
    })
    item.addEventListener('mouseout', () => {
      item.style.background = '#fff'
    })
    item.addEventListener('click', () => {
      if (item.dataset.action === 'set') {
        selectDefaultImageFor(slotKey)
      } else if (item.dataset.action === 'clear') {
        clearDefaultImageFor(slotKey)
      }
      closeContextMenu()
    })
  })

  document.body.appendChild(menu)

  // 点击其他地方关闭菜单
  const closeHandler = (ev) => {
    if (!menu.contains(ev.target)) {
      closeContextMenu()
      document.removeEventListener('click', closeHandler)
    }
  }
  setTimeout(() => document.addEventListener('click', closeHandler), 0)

  window.currentContextMenu = menu
}

function closeContextMenu() {
  if (window.currentContextMenu) {
    window.currentContextMenu.remove()
    window.currentContextMenu = null
  }
}

// 选择默认图像
async function selectDefaultImageFor(slotKey) {
  try {
    console.log('[DefaultImage] Selecting image for slot:', slotKey)
    const res = await window.electronAPI.selectImageForSlot()
    console.log('[DefaultImage] Selection result:', res)

    if (res && res.success && res.path) {
      // ✨ 确保 matchBase 存在，避免讨厌的 null 错误~
      if (!matchBase) {
        matchBase = getDefaultMatchBase()
      }
      if (!matchBase.defaultImages) matchBase.defaultImages = {}
      
      const fileUrl = toFileUrl(res.path)
      console.log('[DefaultImage] Original path:', res.path)
      console.log('[DefaultImage] Converted URL:', fileUrl)

      matchBase.defaultImages[slotKey] = fileUrl
      await saveMatchBase(false)

      console.log('[DefaultImage] Saved matchBase.defaultImages:', matchBase.defaultImages)
      updateDisplay()  // 立即更新显示
      alert(`默认图像已设置成功！\n路径: ${res.path}`)
    } else {
      console.log('[DefaultImage] Selection cancelled or failed')
    }
  } catch (e) {
    console.error('[DefaultImage] Error:', e)
    alert('选择图像失败: ' + (e?.message || e))
  }
}

// 清除默认图像
async function clearDefaultImageFor(slotKey) {
  if (!matchBase.defaultImages) return
  matchBase.defaultImages[slotKey] = ''
  await saveMatchBase(false)
  updateDisplay()  // 立即更新显示
}

// ========== 其他功能 ==========


// 清空卡槽
async function clearSlot(index) {
  await window.electronAPI.invoke('localBp:setSurvivor', { index, character: null })
  state.survivors[index] = null
  updateDisplay()
  updateCharacterStatus()
}

// 清空监管者
async function clearHunter() {
  await window.electronAPI.invoke('localBp:setHunter', null)
  state.hunter = null
  updateDisplay()
  updateCharacterStatus()
}

// 更新角色状态
function updateCharacterStatus() {
  document.querySelectorAll('.character-item').forEach(item => {
    const name = item.dataset.name
    item.classList.remove('selected', 'banned')

    if (isBanned(name)) {
      item.classList.add('banned')
    } else if (state.survivors.includes(name) || state.hunter === name) {
      item.classList.add('selected')
    }
  })
}

async function openBackend() {
  try {
    const res = await window.electronAPI.invoke('open-local-backend')
    if (!res || res.success === false) throw new Error(res?.error || '打开失败')
  } catch (e) {
    alert('打开后台失败：' + (e?.message || e))
  }
}

async function removeBanSurvivor(name) {
  await window.electronAPI.invoke('localBp:removeBanSurvivor', name)
  state.hunterBannedSurvivors = state.hunterBannedSurvivors.filter(b => b !== name)
  updateDisplay()
  updateCharacterStatus()
}

async function removeBanHunter(name) {
  await window.electronAPI.invoke('localBp:removeBanHunter', name)
  state.survivorBannedHunters = state.survivorBannedHunters.filter(b => b !== name)
  updateDisplay()
  updateCharacterStatus()
}

async function removeGlobalBanSurvivor(name) {
  await window.electronAPI.invoke('localBp:removeGlobalBanSurvivor', name)
  state.globalBannedSurvivors = state.globalBannedSurvivors.filter(b => b !== name)
  updateDisplay()
  updateCharacterStatus()
}

async function removeGlobalBanHunter(name) {
  await window.electronAPI.invoke('localBp:removeGlobalBanHunter', name)
  state.globalBannedHunters = state.globalBannedHunters.filter(b => b !== name)
  updateDisplay()
  updateCharacterStatus()
}

// 触发闪烁
async function triggerBlink(index) {
  await window.electronAPI.invoke('localBp:triggerBlink', index)

  // 更新按钮状态
  const slotId = index === 4 ? `slot-hunter` : `slot-${index}`
  const slot = document.getElementById(slotId)
  if (slot) {
    const btn = slot.querySelector('.slot-blink-btn')
    if (btn) {
      if (btn.textContent === '闪烁') {
        btn.textContent = '停止'
        btn.style.color = '#e53e3e'
        btn.style.borderColor = '#e53e3e'
        btn.style.background = '#fff5f5'
      } else {
        btn.textContent = '闪烁'
        btn.style.color = ''
        btn.style.borderColor = ''
        btn.style.background = ''
      }
    }
  }
}

function resetSearchInputs() {
  document.querySelectorAll('.slot-search, .ban-search').forEach(input => {
    input.value = ''
    input.title = ''
    input.style.borderColor = ''
    input.style.backgroundColor = ''
    input.disabled = false
    input.readOnly = false
    input.removeAttribute('disabled')
    input.removeAttribute('readonly')
    input.style.pointerEvents = 'auto'
    input.tabIndex = 0
    input.blur()
  })
}

function unlockAllInputs() {
  if (document.body) document.body.style.pointerEvents = 'auto'
  document.querySelectorAll('input, textarea, select').forEach(input => {
    input.disabled = false
    input.readOnly = false
    input.removeAttribute('disabled')
    input.removeAttribute('readonly')
    input.style.pointerEvents = 'auto'
    if (input.tabIndex < 0) input.tabIndex = 0
  })
  const overlays = document.querySelectorAll('[id$="Overlay"], [id$="overlay"]')
  overlays.forEach(el => {
    if (el.id === 'commandPaletteOverlay' || el.id === 'localBpOcrPreviewOverlay') return
    el.remove()
  })
  const backdrops = document.querySelectorAll('[id$="Backdrop"], [id$="backdrop"]')
  backdrops.forEach(el => el.remove())
  document.querySelectorAll('.context-menu').forEach(menu => menu.remove())
}

function resetInteractionOverlays() {
  const pickModal = document.getElementById('pickModal')
  if (pickModal) pickModal.classList.remove('show')
  pickType = null
  pickIndex = null
  pickAction = null
  const palette = document.getElementById('commandPaletteOverlay')
  if (palette) palette.style.display = 'none'
  const activeModals = document.querySelectorAll('.modal.show')
  activeModals.forEach(modal => modal.classList.remove('show'))
  const guideModal = document.getElementById('bpGuideModal')
  if (guideModal) {
    guideModal.classList.remove('show')
    guideModal.classList.remove('bp-guide-actions-only')
  }
  if (document.body) document.body.classList.remove('bp-guide-embedded')
  if (typeof unmountBpGuideWorkspace === 'function') unmountBpGuideWorkspace()
  if (typeof closeBpGuide === 'function') closeBpGuide()
  if (window.bpGuideState) {
    window.bpGuideState.active = false
    window.bpGuideState.started = false
  }
  const onboarding = document.getElementById('localbp-onboarding-overlay')
  if (onboarding) onboarding.remove()
  if (window.currentContextMenu) {
    window.currentContextMenu.remove()
    window.currentContextMenu = null
  }
}

function scheduleResetReload() {
  setTimeout(() => {
    location.reload()
  }, 120)
}

// 重置BP
async function resetBp(keepGlobal) {
  if (keepGlobal) {
    recordAutoGlobalBanRound()
    await window.electronAPI.invoke('localBp:setSurvivor', { index: 0, character: null })
    await window.electronAPI.invoke('localBp:setSurvivor', { index: 1, character: null })
    await window.electronAPI.invoke('localBp:setSurvivor', { index: 2, character: null })
    await window.electronAPI.invoke('localBp:setSurvivor', { index: 3, character: null })
    await window.electronAPI.invoke('localBp:setHunter', null)

    for (const name of [...state.hunterBannedSurvivors]) {
      await window.electronAPI.invoke('localBp:removeBanSurvivor', name)
    }
    for (const name of [...state.survivorBannedHunters]) {
      await window.electronAPI.invoke('localBp:removeBanHunter', name)
    }

    state.survivors = [null, null, null, null]
    state.hunter = null
    state.hunterBannedSurvivors = []
    state.survivorBannedHunters = []
    state.survivorTalents = [[], [], [], []]
    state.hunterTalents = []
    state.hunterSkills = []
  } else {
    await window.electronAPI.invoke('localBp:reset')
    state = {
      survivors: [null, null, null, null],
      hunter: null,
      hunterBannedSurvivors: [],
      survivorBannedHunters: [],
      globalBannedSurvivors: [],
      globalBannedHunters: [],
      survivorTalents: [[], [], [], []],
      hunterTalents: [],
      hunterSkills: [],
      playerNames: ['', '', '', '', ''],
      editingSurvivorIndex: null
    }
    clearAutoGlobalBanHistory()
    for (let i = 0; i < 5; i++) {
      const input = document.getElementById(`player-name-${i}`)
      if (input) input.value = ''
    }
  }

  document.querySelectorAll('.survivor-tab').forEach(tab => {
    tab.classList.remove('active', 'has-talents')
  })
  updateDisplay()
  updateCharacterStatus()
  updateTalentSkillUI()
  updateCurrentSurvivorTalentsDisplay()
  resetSearchInputs()
  resetInteractionOverlays()

  if (window.electronAPI && window.electronAPI.sendToFrontend) {
    window.electronAPI.sendToFrontend({ type: 'bp-reset' })
  }
  scheduleResetReload()
}

async function resetBpForGuideNextHalf() {
  await window.electronAPI.invoke('localBp:setSurvivor', { index: 0, character: null })
  await window.electronAPI.invoke('localBp:setSurvivor', { index: 1, character: null })
  await window.electronAPI.invoke('localBp:setSurvivor', { index: 2, character: null })
  await window.electronAPI.invoke('localBp:setSurvivor', { index: 3, character: null })
  await window.electronAPI.invoke('localBp:setHunter', null)

  for (const name of [...state.hunterBannedSurvivors]) {
    await window.electronAPI.invoke('localBp:removeBanSurvivor', name)
  }
  for (const name of [...state.survivorBannedHunters]) {
    await window.electronAPI.invoke('localBp:removeBanHunter', name)
  }
  for (const name of [...state.globalBannedSurvivors]) {
    await window.electronAPI.invoke('localBp:removeGlobalBanSurvivor', name)
  }
  for (const name of [...state.globalBannedHunters]) {
    await window.electronAPI.invoke('localBp:removeGlobalBanHunter', name)
  }

  state.survivors = [null, null, null, null]
  state.hunter = null
  state.hunterBannedSurvivors = []
  state.survivorBannedHunters = []
  state.globalBannedSurvivors = []
  state.globalBannedHunters = []
  state.survivorTalents = [[], [], [], []]
  state.hunterTalents = []
  state.hunterSkills = []

  document.querySelectorAll('.survivor-tab').forEach(tab => {
    tab.classList.remove('active', 'has-talents')
  })
  updateDisplay()
  updateCharacterStatus()
  updateTalentSkillUI()
  updateCurrentSurvivorTalentsDisplay()
  resetSearchInputs()
  resetInteractionOverlays()

  if (window.electronAPI && window.electronAPI.sendToFrontend) {
    window.electronAPI.sendToFrontend({ type: 'bp-reset' })
  }
  scheduleResetReload()
}

async function resetBpForGuideNextBo(keepGlobal) {
  if (keepGlobal === 'upper' || keepGlobal === 'lower') {
    await resetBpForGuideNextBoKeepGlobal(keepGlobal)
    return
  }
  await window.electronAPI.invoke('localBp:reset')
  state = {
    survivors: [null, null, null, null],
    hunter: null,
    hunterBannedSurvivors: [],
    survivorBannedHunters: [],
    globalBannedSurvivors: [],
    globalBannedHunters: [],
    survivorTalents: [[], [], [], []],
    hunterTalents: [],
    hunterSkills: [],
    playerNames: ['', '', '', '', ''],
    editingSurvivorIndex: null
  }
  for (let i = 0; i < 5; i++) {
    const input = document.getElementById(`player-name-${i}`)
    if (input) input.value = ''
  }
  document.querySelectorAll('.survivor-tab').forEach(tab => {
    tab.classList.remove('active', 'has-talents')
  })
  updateDisplay()
  updateCharacterStatus()
  updateTalentSkillUI()
  updateCurrentSurvivorTalentsDisplay()
  resetSearchInputs()
  resetInteractionOverlays()
  if (window.electronAPI && window.electronAPI.sendToFrontend) {
    window.electronAPI.sendToFrontend({ type: 'bp-reset' })
  }
  scheduleResetReload()
}

async function resetBpForGuideNextBoKeepGlobal(source) {
  await window.electronAPI.invoke('localBp:setSurvivor', { index: 0, character: null })
  await window.electronAPI.invoke('localBp:setSurvivor', { index: 1, character: null })
  await window.electronAPI.invoke('localBp:setSurvivor', { index: 2, character: null })
  await window.electronAPI.invoke('localBp:setSurvivor', { index: 3, character: null })
  await window.electronAPI.invoke('localBp:setHunter', null)

  for (const name of [...state.hunterBannedSurvivors]) {
    await window.electronAPI.invoke('localBp:removeBanSurvivor', name)
  }
  for (const name of [...state.survivorBannedHunters]) {
    await window.electronAPI.invoke('localBp:removeBanHunter', name)
  }

  state.survivors = [null, null, null, null]
  state.hunter = null
  state.hunterBannedSurvivors = []
  state.survivorBannedHunters = []
  state.survivorTalents = [[], [], [], []]
  state.hunterTalents = []
  state.hunterSkills = []
  state.playerNames = ['', '', '', '', '']
  state.editingSurvivorIndex = null

  await applyGuideGlobalBansFromSource(source)

  for (let i = 0; i < 5; i++) {
    const input = document.getElementById(`player-name-${i}`)
    if (input) input.value = ''
  }
  document.querySelectorAll('.survivor-tab').forEach(tab => {
    tab.classList.remove('active', 'has-talents')
  })
  updateDisplay()
  updateCharacterStatus()
  updateTalentSkillUI()
  updateCurrentSurvivorTalentsDisplay()
  resetSearchInputs()
  resetInteractionOverlays()
  if (window.electronAPI && window.electronAPI.sendToFrontend) {
    window.electronAPI.sendToFrontend({ type: 'bp-reset' })
  }
  scheduleResetReload()
}

function captureGuideGlobalBans(half) {
  const stateGuide = window.bpGuideState
  if (!stateGuide.lastBoGlobalBans) {
    stateGuide.lastBoGlobalBans = {
      upper: { survivors: [], hunters: [] },
      lower: { survivors: [], hunters: [] }
    }
  }
  const target = half === 'lower' ? 'lower' : 'upper'
  stateGuide.lastBoGlobalBans[target] = {
    survivors: [...state.globalBannedSurvivors],
    hunters: [...state.globalBannedHunters]
  }
}

async function applyGuideGlobalBansFromSource(source) {
  const stateGuide = window.bpGuideState
  const pick = source === 'lower' ? 'lower' : (source === 'upper' ? 'upper' : 'none')
  if (pick === 'none') return
  const snapshot = stateGuide.lastBoGlobalBans?.[pick]
  if (!snapshot) return

  state.globalBannedSurvivors = []
  state.globalBannedHunters = []
  const survivors = Array.isArray(snapshot.survivors) ? snapshot.survivors : []
  const hunters = Array.isArray(snapshot.hunters) ? snapshot.hunters : []
  for (const name of survivors) {
    await window.electronAPI.invoke('localBp:addGlobalBanSurvivor', name)
    if (!state.globalBannedSurvivors.includes(name)) state.globalBannedSurvivors.push(name)
  }
  for (const name of hunters) {
    await window.electronAPI.invoke('localBp:addGlobalBanHunter', name)
    if (!state.globalBannedHunters.includes(name)) state.globalBannedHunters.push(name)
  }
}

// 更新前端显示
function updateFrontend() {
  alert('已更新前端显示')
}

// 打开比分控制（打开后台窗口）
async function openScoreControl() {
  try {
    await window.electronAPI.invoke('open-local-backend')
  } catch (error) {
    alert('打开比分控制失败: ' + error.message)
  }
}

// 打开赛后数据（打开后台窗口）
async function openPostMatchControl() {
  try {
    await window.electronAPI.invoke('open-local-backend')
  } catch (error) {
    alert('打开赛后数据失败: ' + error.message)
  }
}

// 打开角色展示页面
async function openCharacterDisplay() {
  try {
    await window.electronAPI.invoke('localBp:openCharacterDisplay')
  } catch (error) {
    alert('打开角色展示失败: ' + error.message)
  }
}

// ========== 天赋、技能、选手名字功能 ==========

// 更新选手名字
async function updatePlayerName(index, name) {
  state.playerNames[index] = name
  await window.electronAPI.invoke('localBp:setPlayerName', { index, name })
  updateDisplay()
}

// 选择求生者来设置天赋
function selectSurvivorForTalent(index) {
  state.editingSurvivorIndex = index
  updateSurvivorTalentUI()
}

// 切换求生者天赋（为指定求生者）
async function toggleSurvivorTalent(index, talent) {
  let i = index
  let t = talent
  if (typeof index === 'string') {
    t = index
    i = state.editingSurvivorIndex
  }
  if (i === null || i === undefined) return
  if (!state.survivorTalents[i]) state.survivorTalents[i] = []
  const idx = state.survivorTalents[i].indexOf(t)
  if (idx >= 0) {
    state.survivorTalents[i].splice(idx, 1)
  } else {
    state.survivorTalents[i].push(t)
  }
  await window.electronAPI.invoke('localBp:setSurvivorTalents', { index: i, talents: state.survivorTalents[i] })
  updateSurvivorTalentUI()
  updateDisplay()
}

// 更新求生者天赋UI（所有求生者）
function updateSurvivorTalentUI() {
  document.querySelectorAll('.survivor-talent-item').forEach(item => {
    const i = Number(item.dataset.survivorIndex)
    const talent = item.dataset.talent
    const isSelected = Number.isInteger(i) && state.survivorTalents[i] && state.survivorTalents[i].includes(talent)
    item.classList.toggle('selected', isSelected)
  })
  document.querySelectorAll('[data-survivor-title]').forEach(el => {
    const i = Number(el.dataset.survivorTitle)
    const name = state.survivors[i] || `求生者${i + 1}`
    el.textContent = name
  })
}

// 更新当前求生者天赋显示
function updateCurrentSurvivorTalentsDisplay() {
  const el = document.getElementById('current-survivor-talents')
  if (!el) return
  const i = state.editingSurvivorIndex
  if (i === null) {
    el.textContent = '请先选择一个求生者'
    return
  }
  const talents = state.survivorTalents[i] || []
  const name = state.survivors[i] || `求生者${i + 1}`
  if (talents.length === 0) {
    el.textContent = `${name}: 未选择天赋`
  } else {
    el.textContent = `${name}: ${talents.join(', ')}`
  }
}

// 切换监管者天赋（支持多选）
async function toggleHunterTalent(talent) {
  const idx = state.hunterTalents.indexOf(talent)
  if (idx >= 0) {
    state.hunterTalents.splice(idx, 1)
  } else {
    state.hunterTalents.push(talent)
  }
  await window.electronAPI.invoke('localBp:setHunterTalents', state.hunterTalents)
  updateTalentSkillUI()
  updateDisplay()
}

// 切换监管者技能（无数量限制）
async function toggleHunterSkill(skill) {
  const idx = state.hunterSkills.indexOf(skill)
  if (idx >= 0) {
    state.hunterSkills.splice(idx, 1)
  } else {
    state.hunterSkills.push(skill)
  }
  await window.electronAPI.invoke('localBp:setHunterSkills', state.hunterSkills)
  updateTalentSkillUI()
  updateDisplay()
}

// 更新天赋和技能UI
function updateTalentSkillUI() {
  // 求生者天赋（当前选中的）
  updateSurvivorTalentUI()

  // 监管者天赋（多选）
  document.querySelectorAll('#hunter-talent-grid .talent-item').forEach(item => {
    const talent = item.dataset.talent
    item.classList.toggle('selected', state.hunterTalents.includes(talent))
  })

  // 监管者技能
  document.querySelectorAll('#hunter-skill-grid .skill-item').forEach(item => {
    const skill = item.dataset.skill
    item.classList.toggle('selected', state.hunterSkills.includes(skill))
  })
}

// ========== 页面切换功能 ==========
function switchPage(page) {
  document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'))
  document.getElementById('page-' + page)?.classList.add('active')
  document.querySelector(`.menu-tab[data-page="${page}"]`)?.classList.add('active')

  // 切换到比分页时初始化
  if (page === 'score') initScorePage()
  // 切换到赛后数据页时初始化
  if (page === 'postmatch') initPostMatchPage()
  // 切换到对局基础信息页时初始化
  if (page === 'baseinfo') initBaseInfoPage()
  // 切换到天赋/技能页时刷新UI
  if (page === 'talents') {
    updateTalentSkillUI()
  }
  // 切到 OCR 页时懒初始化并重绘区域框
  if (page === 'ocr') {
    if (localBpOcrInitDone) {
      renderLocalBpOcrConfigToUi()
      renderLocalBpOcrRegions()
      if (localBpOcrRunning) setLocalBpOcrStatus('识别中', 'running')
      else setLocalBpOcrStatus('待机', 'idle')
      return
    }
    initLocalBpOcrPanel()
      .then(() => renderLocalBpOcrRegions())
      .catch((error) => {
        setLocalBpOcrStatus(error?.message || 'OCR 面板初始化失败', 'error')
      })
  }

  ensureLocalBpModulesOnPageReady(page)
}

function initBaseInfoPage() {
  if (!matchBase) loadMatchBase()
  renderMatchBaseForm()
}

// ========== 比分管理功能 ==========
let scoreData = {
  bos: [],
  teamAWins: 0, teamBWins: 0,
  teamADraws: 0, teamBDraws: 0,
  currentRound: 1,
  currentHalf: 1,
  displayConfig: { auto: true, round: 1, half: 'upper' },
  scoreboardDisplay: { teamA: 'auto', teamB: 'auto' },
  teamAName: 'A队', teamBName: 'B队',
  teamALogo: '', teamBLogo: ''
}
let scoreDataReady = false

function normalizeDisplayHalf(value) {
  return value === 'lower' ? 'lower' : 'upper'
}

function normalizeDisplayConfig(rawConfig, rawScoreData, boCount) {
  const safeBoCount = Math.max(1, parseInt(boCount, 10) || 1)
  const legacyMode = rawScoreData?.scoreboardDisplay?.teamA
  const legacyHalf = (parseInt(rawScoreData?.currentHalf, 10) || 1) === 2 ? 'lower' : 'upper'
  const legacyRound = parseInt(rawScoreData?.currentRound, 10) || 1

  const cfg = (rawConfig && typeof rawConfig === 'object') ? rawConfig : {}
  const auto = (typeof cfg.auto === 'boolean')
    ? cfg.auto
    : !(legacyMode === 'upper' || legacyMode === 'lower')
  const roundRaw = parseInt(cfg.round, 10) || legacyRound || 1
  const round = Math.min(safeBoCount, Math.max(1, roundRaw))
  const half = normalizeDisplayHalf(cfg.half || (legacyMode === 'upper' || legacyMode === 'lower' ? legacyMode : legacyHalf))
  return { auto, round, half }
}

function getScoreDisplayTarget(dataInput) {
  const data = normalizeScoreData(dataInput)
  const bos = Array.isArray(data.bos) ? data.bos : []
  const safeBos = bos.length ? bos : [{ upper: { teamA: 0, teamB: 0 }, lower: { teamA: 0, teamB: 0 } }]
  const cfg = normalizeDisplayConfig(data.displayConfig, data, safeBos.length)

  let targetIndex = 0
  let targetHalf = 'upper'

  if (cfg.auto) {
    let found = false
    for (let i = safeBos.length - 1; i >= 0; i--) {
      const bo = safeBos[i] || {}
      const hasLower = (parseInt(bo?.lower?.teamA, 10) || 0) > 0 || (parseInt(bo?.lower?.teamB, 10) || 0) > 0
      const hasUpper = (parseInt(bo?.upper?.teamA, 10) || 0) > 0 || (parseInt(bo?.upper?.teamB, 10) || 0) > 0
      if (hasLower) {
        targetIndex = i
        targetHalf = 'lower'
        found = true
        break
      }
      if (hasUpper) {
        targetIndex = i
        targetHalf = 'upper'
        found = true
        break
      }
    }
    if (!found) {
      targetIndex = 0
      targetHalf = 'upper'
    }
  } else {
    targetIndex = Math.min(safeBos.length - 1, Math.max(0, cfg.round - 1))
    targetHalf = normalizeDisplayHalf(cfg.half)
  }

  return {
    bo: safeBos[targetIndex] || safeBos[0],
    half: targetHalf,
    round: targetIndex + 1
  }
}

function getCurrentDisplayedSmallScore(dataInput) {
  const target = getScoreDisplayTarget(dataInput)
  const bo = target.bo || {}
  const halfData = bo[target.half] || {}
  return {
    teamA: parseInt(halfData.teamA, 10) || 0,
    teamB: parseInt(halfData.teamB, 10) || 0,
    round: target.round,
    half: target.half
  }
}

function normalizeScoreData(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}
  const bos = Array.isArray(d.bos) ? d.bos : []
  const safeBos = bos.length ? bos : [{ upper: { teamA: 0, teamB: 0 }, lower: { teamA: 0, teamB: 0 } }]
  const displayConfig = normalizeDisplayConfig(d.displayConfig, d, safeBos.length)
  const legacyMode = displayConfig.auto ? 'auto' : displayConfig.half
  return {
    bos: safeBos,
    teamAWins: d.teamAWins || 0,
    teamBWins: d.teamBWins || 0,
    teamADraws: d.teamADraws || 0,
    teamBDraws: d.teamBDraws || 0,
    currentRound: displayConfig.round,
    currentHalf: displayConfig.half === 'lower' ? 2 : 1,
    displayConfig,
    scoreboardDisplay: { teamA: legacyMode, teamB: legacyMode },
    teamAName: typeof d.teamAName === 'string' ? d.teamAName : 'A队',
    teamBName: typeof d.teamBName === 'string' ? d.teamBName : 'B队',
    teamALogo: typeof d.teamALogo === 'string' ? d.teamALogo : '',
    teamBLogo: typeof d.teamBLogo === 'string' ? d.teamBLogo : ''
  }
}

function loadScoreDataAny() {
  const a = tryParseJson(localStorage.getItem(SCORE_STORAGE_KEY))
  if (a) return normalizeScoreData(a)
  const b = tryParseJson(localStorage.getItem('localBp_score'))
  if (b) return normalizeScoreData(b)
  return normalizeScoreData(null)
}

function getScoreDataForWrite() {
  // 比分页未初始化时，不要用默认空对象覆盖已存在存档
  if (scoreDataReady && scoreData && typeof scoreData === 'object') {
    scoreData = normalizeScoreData(scoreData)
    return scoreData
  }
  scoreData = loadScoreDataAny()
  scoreDataReady = true
  return scoreData
}

function syncScoreStorageBaseFields() {
  // 从现有 scoreData（或本地存储）读出来，更新队名/Logo，再写回 score_${LOCAL_ROOM_ID}
  const data = normalizeScoreData(getScoreDataForWrite())
  let currentMatchBase = matchBase
  if (window.baseManager) {
    currentMatchBase = window.baseManager.state
  } else if (!currentMatchBase) {
    loadMatchBase()
    currentMatchBase = matchBase
  }
  if (currentMatchBase) {
    if (typeof currentMatchBase.teamA?.name === 'string') data.teamAName = currentMatchBase.teamA.name
    if (typeof currentMatchBase.teamB?.name === 'string') data.teamBName = currentMatchBase.teamB.name
    if (typeof currentMatchBase.teamA?.logo === 'string') data.teamALogo = currentMatchBase.teamA.logo
    if (typeof currentMatchBase.teamB?.logo === 'string') data.teamBLogo = currentMatchBase.teamB.logo
  }
  scoreData = data
  localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(data))
  localStorage.setItem('localBp_score', JSON.stringify(data))
}

function initScorePage() {
  if (!matchBase && !window.baseManager) loadMatchBase()
  scoreData = loadScoreDataAny()
  scoreDataReady = true
  let currentMatchBase = matchBase
  if (window.baseManager) {
    currentMatchBase = window.baseManager.state
  } else if (!currentMatchBase) {
    loadMatchBase()
    currentMatchBase = matchBase
  }
  if (currentMatchBase) {
    if (typeof currentMatchBase.teamA?.name === 'string') scoreData.teamAName = currentMatchBase.teamA.name
    if (typeof currentMatchBase.teamB?.name === 'string') scoreData.teamBName = currentMatchBase.teamB.name
    if (typeof currentMatchBase.teamA?.logo === 'string') scoreData.teamALogo = currentMatchBase.teamA.logo
    if (typeof currentMatchBase.teamB?.logo === 'string') scoreData.teamBLogo = currentMatchBase.teamB.logo
  }
  document.getElementById('scoreTeamAName').value = scoreData.teamAName || 'A队'
  document.getElementById('scoreTeamBName').value = scoreData.teamBName || 'B队'
  calculateScore()
  renderBoList()
  updateScoreboardDisplayUI()
  updateScoreDisplay()
  syncScoreStorageBaseFields()
}

function updateScoreTeamName(team, name) {
  updateMatchBaseTeamName(team, name)
  // updateMatchBaseTeamName 内部会同步存储与 UI，这里仅刷新显示
  let currentMatchBase = matchBase
  if (window.baseManager) currentMatchBase = window.baseManager.state
  if (team === 'A') scoreData.teamAName = (typeof currentMatchBase?.teamA?.name === 'string' ? currentMatchBase.teamA.name : (name || 'A队'))
  else scoreData.teamBName = (typeof currentMatchBase?.teamB?.name === 'string' ? currentMatchBase.teamB.name : (name || 'B队'))
  updateScoreDisplay()
}

function addBo() {
  scoreData.bos.push({ upper: { teamA: 0, teamB: 0 }, lower: { teamA: 0, teamB: 0 } })
  saveScoreData()
  renderBoList()
  updateScoreboardDisplayUI()
}

function renderBoList() {
  const container = document.getElementById('boScoreList')
  if (!container) return
  const activeIdx = (scoreData.currentRound || 1) - 1
  container.innerHTML = scoreData.bos.map((bo, i) => {
    const isActive = (i === activeIdx)
    const result = getBoResult(bo)
    const badge = result === 'A' ? '<span style="color:#64b5f6;font-weight:bold;">A队胜</span>' :
      result === 'B' ? '<span style="color:#ef5350;font-weight:bold;">B队胜</span>' :
        result === 'D' ? '<span style="color:#ffd700;font-weight:bold;">平局</span>' : '<span style="color:#999;">待定</span>'

    return `<div id="bo-item-${i}" style="background:#f7fafc;border:2px solid ${isActive ? '#ffd700' : '#e2e8f0'};box-shadow: ${isActive ? '0 0 12px rgba(255, 215, 0, 0.3)' : 'none'};border-radius:10px;padding:15px;margin-bottom:15px; transition: all 0.3s;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div>
                ${isActive ? '<span style="color:#ffd700;margin-right:5px;">🏆</span>' : ''}
                <strong>第${i + 1}个BO</strong> <span id="bo-badge-${i}">${badge}</span>
            </div>
            <button class="btn btn-danger btn-small" onclick="removeBo(${i})">删除</button>
          </div>
          <div style="display:flex;gap:15px;align-items:center;margin-bottom:8px;">
            <span style="width:60px;color:#666;">上半局:</span>
            <span style="color:#64b5f6;">A队</span>
            <input type="number" value="${bo.upper.teamA}" min="0" onchange="updateBo(${i},'upper','teamA',this.value)" style="width:60px;padding:6px;border:1px solid #ddd;border-radius:4px;">
            <span>:</span>
            <input type="number" value="${bo.upper.teamB}" min="0" onchange="updateBo(${i},'upper','teamB',this.value)" style="width:60px;padding:6px;border:1px solid #ddd;border-radius:4px;">
            <span style="color:#ef5350;">B队</span>
          </div>
          <div style="display:flex;gap:15px;align-items:center;">
            <span style="width:60px;color:#666;">下半局:</span>
            <span style="color:#64b5f6;">A队</span>
            <input type="number" value="${bo.lower.teamA}" min="0" onchange="updateBo(${i},'lower','teamA',this.value)" style="width:60px;padding:6px;border:1px solid #ddd;border-radius:4px;">
            <span>:</span>
            <input type="number" value="${bo.lower.teamB}" min="0" onchange="updateBo(${i},'lower','teamB',this.value)" style="width:60px;padding:6px;border:1px solid #ddd;border-radius:4px;">
            <span style="color:#ef5350;">B队</span>
          </div>
        </div>`
  }).join('')
}

let saveScoreTimer = null

function debouncedSaveScoreData() {
  if (saveScoreTimer) clearTimeout(saveScoreTimer)
  saveScoreTimer = setTimeout(() => {
    saveScoreData()
  }, 500)
}

function updateBo(boIndex, half, team, value) {
  scoreData.bos[boIndex][half][team] = parseInt(value) || 0
  calculateScore()
  debouncedSaveScoreData()
  // renderBoList() // ✨ 优化：不再重绘列表，避免输入框失去焦点
  updateScoreDisplay()

  // ✨ 仅更新胜负标签
  const bo = scoreData.bos[boIndex]
  const result = getBoResult(bo)
  const badgeHtml = result === 'A' ? '<span style="color:#64b5f6;font-weight:bold;">A队胜</span>' :
      result === 'B' ? '<span style="color:#ef5350;font-weight:bold;">B队胜</span>' :
      result === 'D' ? '<span style="color:#ffd700;font-weight:bold;">平局</span>' : '<span style="color:#999;">待定</span>'
  
  const badgeEl = document.getElementById(`bo-badge-${boIndex}`)
  if (badgeEl) badgeEl.innerHTML = badgeHtml
}

function removeBo(index) {
  if (scoreData.bos.length > 1 && confirm('确定删除此BO？')) {
    scoreData.bos.splice(index, 1)
    if (scoreData.currentRound > scoreData.bos.length) scoreData.currentRound = scoreData.bos.length
    calculateScore()
    saveScoreData()
    renderBoList()
    updateScoreboardDisplayUI()
    updateScoreDisplay()
  }
}

function getBoResult(bo) {
  const hasUpper = bo.upper.teamA > 0 || bo.upper.teamB > 0
  const hasLower = bo.lower.teamA > 0 || bo.lower.teamB > 0
  if (!hasUpper || !hasLower) return 'P'
  const totalA = bo.upper.teamA + bo.lower.teamA
  const totalB = bo.upper.teamB + bo.lower.teamB
  if (totalA > totalB) return 'A'
  if (totalB > totalA) return 'B'
  return 'D'
}

function calculateScore() {
  let aW = 0, bW = 0, aD = 0, bD = 0
  scoreData.bos.forEach(bo => {
    const r = getBoResult(bo)
    if (r === 'A') aW++
    else if (r === 'B') bW++
    else if (r === 'D') { aD++; bD++ }
  })
  scoreData.teamAWins = aW
  scoreData.teamBWins = bW
  scoreData.teamADraws = aD
  scoreData.teamBDraws = bD
}

function updateScoreDisplay() {
  const aName = scoreData.teamAName || 'A队'
  const bName = scoreData.teamBName || 'B队'
  document.getElementById('scoreTeamALabel').textContent = aName
  document.getElementById('scoreTeamBLabel').textContent = bName
  document.getElementById('scoreTeamAWins').textContent = scoreData.teamAWins
  document.getElementById('scoreTeamBWins').textContent = scoreData.teamBWins
  const completed = scoreData.bos.filter(bo => getBoResult(bo) !== 'P').length
  const aL = completed - scoreData.teamAWins - scoreData.teamADraws
  const bL = completed - scoreData.teamBWins - scoreData.teamBDraws
  document.getElementById('scoreTeamARecord').textContent = `${aName}: ${scoreData.teamAWins}胜 ${scoreData.teamADraws}平 ${aL}负`
  document.getElementById('scoreTeamBRecord').textContent = `${bName}: ${scoreData.teamBWins}胜 ${scoreData.teamBDraws}平 ${bL}负`
}

function saveScoreData() {
  scoreData = getScoreDataForWrite()

  // 关键修复：优先从 baseManager 获取最新的 matchBase 状态
  // 避免全局变量 matchBase 是旧值导致 Logo 被清空或回滚
  let currentMatchBase = matchBase
  if (window.baseManager) {
    currentMatchBase = window.baseManager.state
  } else {
    if (!currentMatchBase) loadMatchBase()
    currentMatchBase = matchBase
  }

  // ✨ 确保从最新的 currentMatchBase 同步队名和Logo
  // 只有当 currentMatchBase 中有值时才覆盖 scoreData，避免意外清空
  if (currentMatchBase) {
    if (typeof currentMatchBase.teamA?.name === 'string') scoreData.teamAName = currentMatchBase.teamA.name
    if (typeof currentMatchBase.teamB?.name === 'string') scoreData.teamBName = currentMatchBase.teamB.name
    // 使用 typeof 检查，允许空字符串（即清除Logo）被同步，同时避免 undefined 覆盖现有值
    if (typeof currentMatchBase.teamA?.logo === 'string') scoreData.teamALogo = currentMatchBase.teamA.logo
    if (typeof currentMatchBase.teamB?.logo === 'string') scoreData.teamBLogo = currentMatchBase.teamB.logo
  }
  
  // 如果 scoreData 中还是空的，尝试保留原值或使用默认值，不做破坏性覆盖

  try {
    scoreData.__assetRev = Date.now()
    localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(scoreData))
    localStorage.setItem('localBp_score', JSON.stringify(scoreData))
    
    // ✨ 同步到主进程，解决插件不同步问题
    if (window.electronAPI && window.electronAPI.invoke) {
      window.electronAPI.invoke('localBp:updateScoreData', scoreData).catch(e => {
        console.error('[Score] Failed to sync score data:', e)
      })
    }
  } catch (e) {
    console.error('Failed to save scoreData:', e)
  }
  
  // 广播更新

  syncMatchBaseToFrontend()
  syncPostMatchLiveHeaderToForm()
  syncPostMatchStorageBaseFields()
}

function swapScoreTeamsData() {
  scoreData = normalizeScoreData(getScoreDataForWrite())

  scoreData.bos = (Array.isArray(scoreData.bos) ? scoreData.bos : []).map((bo) => {
    const upperA = parseInt(bo?.upper?.teamA, 10) || 0
    const upperB = parseInt(bo?.upper?.teamB, 10) || 0
    const lowerA = parseInt(bo?.lower?.teamA, 10) || 0
    const lowerB = parseInt(bo?.lower?.teamB, 10) || 0
    return {
      upper: { teamA: upperB, teamB: upperA },
      lower: { teamA: lowerB, teamB: lowerA }
    }
  })

  const oldAName = scoreData.teamAName
  const oldBName = scoreData.teamBName
  const oldALogo = scoreData.teamALogo
  const oldBLogo = scoreData.teamBLogo
  scoreData.teamAName = oldBName
  scoreData.teamBName = oldAName
  scoreData.teamALogo = oldBLogo
  scoreData.teamBLogo = oldALogo

  calculateScore()
  saveScoreData()
  renderBoList()
  updateScoreDisplay()
  updateScoreboardDisplayUI()

  const nameAInput = document.getElementById('scoreTeamAName')
  const nameBInput = document.getElementById('scoreTeamBName')
  if (nameAInput) nameAInput.value = scoreData.teamAName || 'A队'
  if (nameBInput) nameBInput.value = scoreData.teamBName || 'B队'
}

function resetScore() {
  if (confirm('确定重置所有比分？')) {
    const prev = normalizeScoreData(getScoreDataForWrite())
    const boCount = Math.max(1, Array.isArray(prev.bos) ? prev.bos.length : 1)
    const cfg = normalizeDisplayConfig(prev.displayConfig, prev, boCount)
    const clearedBos = Array.from({ length: boCount }, () => ({
      upper: { teamA: 0, teamB: 0 },
      lower: { teamA: 0, teamB: 0 }
    }))
    const safeRound = Math.min(boCount, Math.max(1, cfg.round))
    const safeHalf = normalizeDisplayHalf(cfg.half)
    const mode = cfg.auto ? 'auto' : safeHalf

    scoreData = {
      ...prev,
      bos: clearedBos,
      teamAWins: 0, teamBWins: 0,
      teamADraws: 0, teamBDraws: 0,
      currentRound: safeRound,
      currentHalf: safeHalf === 'lower' ? 2 : 1,
      displayConfig: { auto: !!cfg.auto, round: safeRound, half: safeHalf },
      scoreboardDisplay: { teamA: mode, teamB: mode }
    }

    saveScoreData()
    renderBoList()
    updateScoreDisplay()
    updateScoreboardDisplayUI()
    document.getElementById('scoreTeamAName').value = scoreData.teamAName
    document.getElementById('scoreTeamBName').value = scoreData.teamBName
  }
}

function updateScoreboardDisplayUI() {
  const cfg = normalizeDisplayConfig(scoreData?.displayConfig, scoreData, scoreData?.bos?.length || 1)

  const roundSelect = document.getElementById('displayRoundSelect')
  if (roundSelect) {
    const current = cfg.round
    roundSelect.innerHTML = scoreData.bos.map((_, i) => `<option value="${i + 1}" ${current === (i + 1) ? 'selected' : ''}>第 ${i + 1} 个BO</option>`).join('')
  }

  const halfSelect = document.getElementById('displayHalfSelect')
  if (halfSelect) {
    halfSelect.value = cfg.half
  }

  const autoToggle = document.getElementById('displayAutoModeToggle')
  if (autoToggle) {
    autoToggle.checked = !!cfg.auto
  }

  const disableManual = !!cfg.auto
  if (roundSelect) {
    roundSelect.disabled = disableManual
    roundSelect.style.background = disableManual ? '#f0f0f0' : ''
    roundSelect.style.cursor = disableManual ? 'not-allowed' : ''
    roundSelect.style.color = disableManual ? '#777' : ''
  }
  if (halfSelect) {
    halfSelect.disabled = disableManual
    halfSelect.style.background = disableManual ? '#f0f0f0' : ''
    halfSelect.style.cursor = disableManual ? 'not-allowed' : ''
    halfSelect.style.color = disableManual ? '#777' : ''
  }
}

function updateScoreboardDisplayConfig() {
  const autoToggle = document.getElementById('displayAutoModeToggle')
  const roundSelect = document.getElementById('displayRoundSelect')
  const halfSelect = document.getElementById('displayHalfSelect')

  const auto = !!autoToggle?.checked
  const round = parseInt(roundSelect?.value, 10) || 1
  const half = normalizeDisplayHalf(halfSelect?.value)

  scoreData.displayConfig = { auto, round, half }
  scoreData.currentRound = round
  scoreData.currentHalf = half === 'lower' ? 2 : 1
  const mode = auto ? 'auto' : half
  scoreData.scoreboardDisplay = {
    teamA: mode,
    teamB: mode
  }

  saveScoreData()
  updateScoreboardDisplayUI()
  renderBoList() // 重新渲染列表以更新选中态
}

// 打开单个比分板窗口
async function openScoreboardWindow(team) {
  try {
    await window.electronAPI.openScoreboard('local-bp', team)
  } catch (e) { alert('打开比分板失败: ' + e.message) }
}

// 一键打开两个比分板
async function openBothScoreboards() {
  try {
    await window.electronAPI.openScoreboard('local-bp', 'teamA')
    await window.electronAPI.openScoreboard('local-bp', 'teamB')
  } catch (e) { alert('打开比分板失败: ' + e.message) }
}

// 打开总览比分板
async function openScoreboardOverview() {
  try {
    const boCount = scoreData?.bos?.length || 5
    await window.electronAPI.openScoreboardOverview('local-bp', boCount)
  } catch (e) { alert('打开总览比分板失败: ' + e.message) }
}

// 一键打开所有前台窗口
async function openAllFrontendWindows() {
  try {
    // 1. 打开两个比分板
    window.electronAPI.openScoreboard('local-bp', 'teamA')
    window.electronAPI.openScoreboard('local-bp', 'teamB')
    // 2. 打开赛后数据
    window.electronAPI.openPostMatch('local-bp')
    // 3. 打开角色展示
    window.electronAPI.invoke('localBp:openCharacterDisplay')
  } catch (e) {
    console.error(e)
    alert('打开窗口失败: ' + e.message)
  }
}

// ========== 赛后数据功能 ==========
let postMatchData = {}
const POSTMATCH_OCR_WINDOW_STORAGE_KEY = 'localBp_postmatch_ocr_window_source_id'
let postMatchOcrWindowList = []
let postMatchOcrWindowSourceId = ''

function getDefaultPostMatchData() {
  if (!matchBase) loadMatchBase()
  return {
    title: '赛后数据',
    subTitle: 'MATCH STATS',
    gameLabel: 'GAME 1',
    mapName: matchBase.mapName || '',
    teamA: {
      name: matchBase.teamA.name || 'A队',
      meta: '',
      score: 0,
      logo: matchBase.teamA.logo || ''
    },
    teamB: {
      name: matchBase.teamB.name || 'B队',
      meta: '',
      score: 0,
      logo: matchBase.teamB.logo || ''
    },
    survivors: [
      { name: '选手1', decodeProgress: 0, palletHit: 0, rescue: 0, heal: 0, chaseSeconds: 0 },
      { name: '选手2', decodeProgress: 0, palletHit: 0, rescue: 0, heal: 0, chaseSeconds: 0 },
      { name: '选手3', decodeProgress: 0, palletHit: 0, rescue: 0, heal: 0, chaseSeconds: 0 },
      { name: '选手4', decodeProgress: 0, palletHit: 0, rescue: 0, heal: 0, chaseSeconds: 0 }
    ],
    hunter: {
      name: '监管者',
      roleName: '',
      remainingCiphers: 0,
      palletDestroy: 0,
      hit: 0,
      terrorShock: 0,
      down: 0
    }
  }
}

function normalizePostMatchData(raw) {
  const d = getDefaultPostMatchData()
  const r = raw && typeof raw === 'object' ? raw : {}
  const out = {
    title: typeof r.title === 'string' ? r.title : d.title,
    subTitle: typeof r.subTitle === 'string' ? r.subTitle : d.subTitle,
    gameLabel: typeof r.gameLabel === 'string' ? r.gameLabel : d.gameLabel,
    mapName: typeof r.mapName === 'string' ? r.mapName : d.mapName,
    teamA: {
      name: typeof r.teamA?.name === 'string' ? r.teamA.name : d.teamA.name,
      meta: typeof r.teamA?.meta === 'string' ? r.teamA.meta : d.teamA.meta,
      score: Number.isFinite(r.teamA?.score) ? r.teamA.score : (parseInt(r.teamA?.score, 10) || 0),
      logo: typeof r.teamA?.logo === 'string' ? r.teamA.logo : d.teamA.logo
    },
    teamB: {
      name: typeof r.teamB?.name === 'string' ? r.teamB.name : d.teamB.name,
      meta: typeof r.teamB?.meta === 'string' ? r.teamB.meta : d.teamB.meta,
      score: Number.isFinite(r.teamB?.score) ? r.teamB.score : (parseInt(r.teamB?.score, 10) || 0),
      logo: typeof r.teamB?.logo === 'string' ? r.teamB.logo : d.teamB.logo
    },
    survivors: Array.isArray(r.survivors) ? r.survivors : d.survivors,
    hunter: {
      name: typeof r.hunter?.name === 'string' ? r.hunter.name : d.hunter.name,
      roleName: typeof r.hunter?.roleName === 'string' ? r.hunter.roleName : d.hunter.roleName,
      remainingCiphers: parseInt(r.hunter?.remainingCiphers, 10) || 0,
      palletDestroy: parseInt(r.hunter?.palletDestroy, 10) || 0,
      hit: parseInt(r.hunter?.hit, 10) || 0,
      terrorShock: parseInt(r.hunter?.terrorShock, 10) || 0,
      down: parseInt(r.hunter?.down, 10) || 0
    }
  }
  return out
}

function loadPostMatchAny() {
  const a = tryParseJson(localStorage.getItem(POSTMATCH_STORAGE_KEY))
  if (a) return normalizePostMatchData(a)
  const b = tryParseJson(localStorage.getItem('localBp_postmatch'))
  if (b) return normalizePostMatchData(b)
  return normalizePostMatchData(null)
}

function getPostMatchLiveMapName() {
  let currentMatchBase = matchBase
  if (window.baseManager) {
    currentMatchBase = window.baseManager.state
  } else if (!currentMatchBase) {
    loadMatchBase()
    currentMatchBase = matchBase
  }
  return (currentMatchBase?.mapName || '').trim()
}

function getPostMatchLiveScores() {
  const currentScore = scoreData && typeof scoreData === 'object' ? scoreData : loadScoreDataAny()
  const smallScore = getCurrentDisplayedSmallScore(currentScore)
  return {
    teamAScore: smallScore.teamA,
    teamBScore: smallScore.teamB
  }
}

function setPostMatchMapDisplay(mapName) {
  const el = document.getElementById('pmMapNameDisplay')
  if (!el) return
  el.textContent = mapName || '未选择地图'
}

function syncPostMatchLiveHeaderToForm() {
  let currentMatchBase = matchBase
  if (window.baseManager) {
    currentMatchBase = window.baseManager.state
  } else if (!currentMatchBase) {
    loadMatchBase()
    currentMatchBase = matchBase
  }

  const mapName = (currentMatchBase?.mapName || '').trim()
  const teamAName = currentMatchBase?.teamA?.name || 'A队'
  const teamBName = currentMatchBase?.teamB?.name || 'B队'
  const teamALogo = currentMatchBase?.teamA?.logo || ''
  const teamBLogo = currentMatchBase?.teamB?.logo || ''
  const { teamAScore, teamBScore } = getPostMatchLiveScores()

  setPostMatchMapDisplay(mapName)

  const pmA = document.getElementById('pmTeamAName')
  const pmB = document.getElementById('pmTeamBName')
  const pmAScore = document.getElementById('pmTeamAScore')
  const pmBScore = document.getElementById('pmTeamBScore')
  if (pmA) pmA.value = teamAName
  if (pmB) pmB.value = teamBName
  if (pmAScore) pmAScore.value = teamAScore
  if (pmBScore) pmBScore.value = teamBScore

  postMatchData = normalizePostMatchData({
    ...postMatchData,
    mapName,
    teamA: { ...(postMatchData?.teamA || {}), name: teamAName, logo: teamALogo, score: teamAScore },
    teamB: { ...(postMatchData?.teamB || {}), name: teamBName, logo: teamBLogo, score: teamBScore }
  })
}

function syncPostMatchStorageBaseFields() {
  const data = normalizePostMatchData(postMatchData && typeof postMatchData === 'object' ? postMatchData : loadPostMatchAny())
  let currentMatchBase = matchBase
  if (window.baseManager) {
    currentMatchBase = window.baseManager.state
  } else if (!currentMatchBase) {
    loadMatchBase()
    currentMatchBase = matchBase
  }

  const { teamAScore, teamBScore } = getPostMatchLiveScores()
  data.mapName = currentMatchBase?.mapName || data.mapName || ''
  data.teamA.name = currentMatchBase?.teamA?.name || data.teamA.name || 'A队'
  data.teamB.name = currentMatchBase?.teamB?.name || data.teamB.name || 'B队'
  data.teamA.logo = currentMatchBase?.teamA?.logo || data.teamA.logo || ''
  data.teamB.logo = currentMatchBase?.teamB?.logo || data.teamB.logo || ''
  data.teamA.score = teamAScore
  data.teamB.score = teamBScore
  postMatchData = data
  localStorage.setItem(POSTMATCH_STORAGE_KEY, JSON.stringify(data))
  localStorage.setItem('localBp_postmatch', JSON.stringify(data))
}

function initPostMatchPage() {
  if (!matchBase) loadMatchBase()
  postMatchData = loadPostMatchAny()
  // 强制从 matchBase 统一队名/Logo/地图
  postMatchData.mapName = getPostMatchLiveMapName() || postMatchData.mapName || ''
  postMatchData.teamA.name = matchBase.teamA.name || postMatchData.teamA.name || 'A队'
  postMatchData.teamB.name = matchBase.teamB.name || postMatchData.teamB.name || 'B队'
  postMatchData.teamA.logo = matchBase.teamA.logo || postMatchData.teamA.logo || ''
  postMatchData.teamB.logo = matchBase.teamB.logo || postMatchData.teamB.logo || ''
  const { teamAScore, teamBScore } = getPostMatchLiveScores()
  postMatchData.teamA.score = teamAScore
  postMatchData.teamB.score = teamBScore
  populatePostMatchForm()
  syncPostMatchLiveHeaderToForm()
  syncPostMatchStorageBaseFields()
  initPostMatchOcrWindowPicker()
}

function populatePostMatchForm() {
  const d = normalizePostMatchData(postMatchData)
  document.getElementById('pmTitle').value = d.title
  document.getElementById('pmSubTitle').value = d.subTitle
  document.getElementById('pmGameLabel').value = d.gameLabel
  setPostMatchMapDisplay(d.mapName)

  document.getElementById('pmTeamAName').value = d.teamA.name
  document.getElementById('pmTeamAMeta').value = d.teamA.meta || ''
  document.getElementById('pmTeamAScore').value = d.teamA.score || 0
  document.getElementById('pmTeamBName').value = d.teamB.name
  document.getElementById('pmTeamBMeta').value = d.teamB.meta || ''
  document.getElementById('pmTeamBScore').value = d.teamB.score || 0

  for (let i = 0; i < 4; i++) {
    const s = d.survivors[i] || {}
    document.getElementById(`pmS${i + 1}Name`).value = s.name || ''
    document.getElementById(`pmS${i + 1}Decode`).value = s.decodeProgress || 0
    document.getElementById(`pmS${i + 1}Pallet`).value = s.palletHit || 0
    document.getElementById(`pmS${i + 1}Rescue`).value = s.rescue || 0
    document.getElementById(`pmS${i + 1}Heal`).value = s.heal || 0
    document.getElementById(`pmS${i + 1}Chase`).value = s.chaseSeconds || 0
  }

  document.getElementById('pmHunterName').value = d.hunter.name || ''
  document.getElementById('pmHunterRole').value = d.hunter.roleName || ''
  document.getElementById('pmHunterRemaining').value = d.hunter.remainingCiphers || 0
  document.getElementById('pmHunterPalletDestroy').value = d.hunter.palletDestroy || 0
  document.getElementById('pmHunterHit').value = d.hunter.hit || 0
  document.getElementById('pmHunterTerror').value = d.hunter.terrorShock || 0
  document.getElementById('pmHunterDown').value = d.hunter.down || 0
}

function collectPostMatchData() {
  if (!matchBase) loadMatchBase()
  const mapName = getPostMatchLiveMapName()
  const { teamAScore, teamBScore } = getPostMatchLiveScores()
  return {
    title: document.getElementById('pmTitle').value,
    subTitle: document.getElementById('pmSubTitle').value,
    gameLabel: document.getElementById('pmGameLabel').value,
    mapName,
    teamA: {
      name: matchBase.teamA.name || document.getElementById('pmTeamAName').value,
      meta: document.getElementById('pmTeamAMeta').value,
      score: teamAScore,
      logo: matchBase.teamA.logo || ''
    },
    teamB: {
      name: matchBase.teamB.name || document.getElementById('pmTeamBName').value,
      meta: document.getElementById('pmTeamBMeta').value,
      score: teamBScore,
      logo: matchBase.teamB.logo || ''
    },
    survivors: [1, 2, 3, 4].map(i => ({
      name: document.getElementById(`pmS${i}Name`).value,
      decodeProgress: parseInt(document.getElementById(`pmS${i}Decode`).value) || 0,
      palletHit: parseInt(document.getElementById(`pmS${i}Pallet`).value) || 0,
      rescue: parseInt(document.getElementById(`pmS${i}Rescue`).value) || 0,
      heal: parseInt(document.getElementById(`pmS${i}Heal`).value) || 0,
      chaseSeconds: parseInt(document.getElementById(`pmS${i}Chase`).value) || 0
    })),
    hunter: {
      name: document.getElementById('pmHunterName').value,
      roleName: document.getElementById('pmHunterRole').value,
      remainingCiphers: parseInt(document.getElementById('pmHunterRemaining').value) || 0,
      palletDestroy: parseInt(document.getElementById('pmHunterPalletDestroy').value) || 0,
      hit: parseInt(document.getElementById('pmHunterHit').value) || 0,
      terrorShock: parseInt(document.getElementById('pmHunterTerror').value) || 0,
      down: parseInt(document.getElementById('pmHunterDown').value) || 0
    }
  }
}

function savePostMatch() {
  postMatchData = normalizePostMatchData(collectPostMatchData())
  // 同步地图/队名到 matchBase（统一源）
  updateMatchBaseTeamName('A', postMatchData.teamA.name)
  updateMatchBaseTeamName('B', postMatchData.teamB.name)

  localStorage.setItem(POSTMATCH_STORAGE_KEY, JSON.stringify(postMatchData))
  localStorage.setItem('localBp_postmatch', JSON.stringify(postMatchData))
  alert('赛后数据已保存！')
}

function resetPostMatch() {
  if (confirm('确定重置赛后数据？')) {
    localStorage.removeItem(POSTMATCH_STORAGE_KEY)
    localStorage.removeItem('localBp_postmatch')
    postMatchData = normalizePostMatchData(null)
    // 清空表单
    document.getElementById('pmTitle').value = '赛后数据'
    document.getElementById('pmSubTitle').value = 'MATCH STATS'
    document.getElementById('pmGameLabel').value = 'GAME 1'
    setPostMatchMapDisplay(getPostMatchLiveMapName())
    document.getElementById('pmTeamAName').value = matchBase?.teamA?.name || ''
    document.getElementById('pmTeamAMeta').value = ''
    document.getElementById('pmTeamAScore').value = getPostMatchLiveScores().teamAScore
    document.getElementById('pmTeamBName').value = matchBase?.teamB?.name || ''
    document.getElementById('pmTeamBMeta').value = ''
    document.getElementById('pmTeamBScore').value = getPostMatchLiveScores().teamBScore
    for (let i = 1; i <= 4; i++) {
      document.getElementById(`pmS${i}Name`).value = ''
      document.getElementById(`pmS${i}Decode`).value = 0
      document.getElementById(`pmS${i}Pallet`).value = 0
      document.getElementById(`pmS${i}Rescue`).value = 0
      document.getElementById(`pmS${i}Heal`).value = 0
      document.getElementById(`pmS${i}Chase`).value = 0
    }
    document.getElementById('pmHunterName').value = ''
    document.getElementById('pmHunterRole').value = ''
    document.getElementById('pmHunterRemaining').value = 0
    document.getElementById('pmHunterPalletDestroy').value = 0
    document.getElementById('pmHunterHit').value = 0
    document.getElementById('pmHunterTerror').value = 0
    document.getElementById('pmHunterDown').value = 0
    syncPostMatchStorageBaseFields()
  }
}

// 打开赛后数据窗口
async function openPostMatchWindow() {
  try {
    await window.electronAPI.openPostMatch('local-bp')
  } catch (e) { alert('打开赛后数据窗口失败: ' + e.message) }
}

// ========== OCR 回填（从 backend 迁移） ==========
function parseIntSafe(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

function setValue(id, value) {
  const el = document.getElementById(id)
  if (el) el.value = value ?? ''
}

function normalizeOcrResponse(dto) {
  const mapName = dto?.mapName ?? dto?.MapName ?? ''
  const regulator = dto?.regulator ?? dto?.Regulator ?? null
  const survivors = dto?.survivors ?? dto?.Survivors ?? []
  return { mapName, regulator, survivors }
}

function normalizePlayer(p) {
  return {
    roleName: p?.roleName ?? p?.RoleName ?? '',
    kiteTime: parseIntSafe(p?.kiteTime ?? p?.KiteTime),
    rescueCount: parseIntSafe(p?.rescueCount ?? p?.RescueCount),
    decodeProgress: parseIntSafe(p?.decodeProgress ?? p?.DecodeProgress),
    palletStunCount: parseIntSafe(p?.palletStunCount ?? p?.PalletStunCount),
    terrorShockCount: parseIntSafe(p?.terrorShockCount ?? p?.TerrorShockCount),
    downCount: parseIntSafe(p?.downCount ?? p?.DownCount),
    hitSurvivorCount: parseIntSafe(p?.hitSurvivorCount ?? p?.HitSurvivorCount),
    palletDestroyCount: parseIntSafe(p?.palletDestroyCount ?? p?.PalletDestroyCount)
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

function setPostMatchOcrHint(text, isError = false) {
  const hintEl = document.getElementById('pmOcrWindowHint')
  if (!hintEl) return
  hintEl.textContent = text || ''
  hintEl.style.color = isError ? '#b42318' : '#666'
}

function setPostMatchOcrButtonsBusy(busy, activeBtnId = '') {
  const fileBtn = document.getElementById('pmOcrBtn')
  const captureBtn = document.getElementById('pmOcrCaptureBtn')

  if (fileBtn) {
    fileBtn.disabled = !!busy
    fileBtn.textContent = (busy && activeBtnId === 'pmOcrBtn') ? '识别中...' : '文件OCR'
  }
  if (captureBtn) {
    captureBtn.disabled = !!busy
    captureBtn.textContent = (busy && activeBtnId === 'pmOcrCaptureBtn') ? '截图中...' : '快速截图OCR'
  }
}

function renderPostMatchOcrWindowList() {
  const select = document.getElementById('pmOcrWindowSelect')
  if (!select) return

  const current = postMatchOcrWindowSourceId || ''
  select.innerHTML = ''

  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = '请选择要截图识别的窗口'
  select.appendChild(placeholder)

  for (const item of (Array.isArray(postMatchOcrWindowList) ? postMatchOcrWindowList : [])) {
    const option = document.createElement('option')
    option.value = item?.id || ''
    option.textContent = item?.name || option.value
    select.appendChild(option)
  }

  if (current) {
    select.value = current
  }
}

function onPostMatchOcrWindowChange() {
  const select = document.getElementById('pmOcrWindowSelect')
  postMatchOcrWindowSourceId = select?.value || ''
  localStorage.setItem(POSTMATCH_OCR_WINDOW_STORAGE_KEY, postMatchOcrWindowSourceId)
}

async function loadPostMatchOcrWindowSourceId() {
  const saved = localStorage.getItem(POSTMATCH_OCR_WINDOW_STORAGE_KEY)
  if (saved) return saved

  try {
    const result = await window.electronAPI.invoke('localBp:ocrGetConfig')
    if (result?.success && typeof result?.data?.config?.windowSourceId === 'string') {
      return result.data.config.windowSourceId
    }
  } catch {}

  return ''
}

async function refreshPostMatchOcrWindows(showFeedback = true) {
  const select = document.getElementById('pmOcrWindowSelect')
  if (!select) return

  if (showFeedback) setPostMatchOcrHint('正在加载窗口列表...')
  const result = await window.electronAPI.invoke('localBp:ocrListWindows')
  if (!result?.success || !Array.isArray(result?.data)) {
    const message = result?.error || '窗口列表加载失败'
    setPostMatchOcrHint(message, true)
    if (showFeedback) alert(message)
    return
  }

  postMatchOcrWindowList = result.data
  const exists = postMatchOcrWindowList.some(item => item?.id === postMatchOcrWindowSourceId)
  if (!exists) {
    postMatchOcrWindowSourceId = postMatchOcrWindowList[0]?.id || ''
    localStorage.setItem(POSTMATCH_OCR_WINDOW_STORAGE_KEY, postMatchOcrWindowSourceId)
  }

  renderPostMatchOcrWindowList()
  setPostMatchOcrHint(`已加载 ${postMatchOcrWindowList.length} 个窗口`)
}

async function initPostMatchOcrWindowPicker() {
  const select = document.getElementById('pmOcrWindowSelect')
  if (!select) return

  if (select.dataset.bound !== '1') {
    select.dataset.bound = '1'
    select.addEventListener('change', onPostMatchOcrWindowChange)
  }

  if (!postMatchOcrWindowSourceId) {
    postMatchOcrWindowSourceId = await loadPostMatchOcrWindowSourceId()
  }

  renderPostMatchOcrWindowList()
  refreshPostMatchOcrWindows(false)
}

async function requestPostMatchOcr(base64) {
  if (!window.electronAPI?.parseGameRecordImage) {
    throw new Error('当前版本不支持 OCR 调用')
  }
  const result = await window.electronAPI.parseGameRecordImage(base64)
  if (!result?.success) {
    throw new Error(result?.error || '识别失败')
  }
  const dto = result.data
  const ok = dto?.success ?? dto?.Success
  if (ok === false) {
    throw new Error(dto?.message ?? dto?.Message ?? '识别失败')
  }
  return dto
}

function applyPostMatchOcrResult(dto) {
  const normalized = normalizeOcrResponse(dto)
  if (normalized.mapName) {
    updateMatchBaseMapName(normalized.mapName)
    setPostMatchMapDisplay(normalized.mapName)
  }

  const reg = normalized.regulator ? normalizePlayer(normalized.regulator) : null
  if (reg?.roleName) setValue('pmHunterRole', reg.roleName)
  setValue('pmHunterHit', reg?.hitSurvivorCount || 0)
  setValue('pmHunterTerror', reg?.terrorShockCount || 0)
  setValue('pmHunterDown', reg?.downCount || 0)
  setValue('pmHunterPalletDestroy', reg?.palletDestroyCount || 0)

  const surv = Array.isArray(normalized.survivors) ? normalized.survivors.map(normalizePlayer) : []
  for (let i = 0; i < 4; i++) {
    const s = surv[i]
    if (!s) continue
    if (s.roleName) setValue(`pmS${i + 1}Name`, s.roleName)
    setValue(`pmS${i + 1}Decode`, s.decodeProgress)
    setValue(`pmS${i + 1}Pallet`, s.palletStunCount)
    setValue(`pmS${i + 1}Rescue`, s.rescueCount)
    // heal 无法从 OCR 获取，保持手填
    setValue(`pmS${i + 1}Chase`, s.kiteTime)
  }
}

async function ocrFillPostMatch() {
  try {
    const input = document.getElementById('pmOcrFile')
    const file = input?.files?.[0]
    if (!file) {
      alert('请先选择一张对局截图')
      return
    }

    setPostMatchOcrButtonsBusy(true, 'pmOcrBtn')
    setPostMatchOcrHint(`正在识别文件：${file.name}`)

    const dataUrl = await readFileAsDataUrl(file)
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
    const dto = await requestPostMatchOcr(base64)
    applyPostMatchOcrResult(dto)

    setPostMatchOcrHint(`文件识别完成：${file.name}`)
    alert('识别完成：已回填到表单（请确认后保存）')
  } catch (e) {
    console.error('OCR 回填失败:', e)
    setPostMatchOcrHint(e?.message || String(e), true)
    alert('OCR 回填失败: ' + (e?.message || e))
  } finally {
    setPostMatchOcrButtonsBusy(false)
  }
}

async function ocrFillPostMatchFromWindow() {
  try {
    const sourceId = postMatchOcrWindowSourceId || document.getElementById('pmOcrWindowSelect')?.value || ''
    if (!sourceId) {
      alert('请先选择要截图识别的窗口')
      return
    }

    setPostMatchOcrButtonsBusy(true, 'pmOcrCaptureBtn')
    setPostMatchOcrHint('正在抓取窗口截图...')

    const capture = await window.electronAPI.invoke('localBp:ocrCapturePreview', sourceId)
    if (!capture?.success || !capture?.data?.dataUrl) {
      throw new Error(capture?.error || '窗口截图失败')
    }

    postMatchOcrWindowSourceId = capture.data.sourceId || sourceId
    localStorage.setItem(POSTMATCH_OCR_WINDOW_STORAGE_KEY, postMatchOcrWindowSourceId)
    renderPostMatchOcrWindowList()

    setPostMatchOcrHint('截图成功，正在执行 OCR...')
    const dataUrl = String(capture.data.dataUrl || '')
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
    const dto = await requestPostMatchOcr(base64)
    applyPostMatchOcrResult(dto)

    const sourceName = capture?.data?.sourceName || '目标窗口'
    setPostMatchOcrHint(`窗口截图识别完成：${sourceName}`)
    alert('识别完成：已回填到表单（请确认后保存）')
  } catch (e) {
    console.error('窗口截图 OCR 回填失败:', e)
    setPostMatchOcrHint(e?.message || String(e), true)
    alert('窗口截图 OCR 回填失败: ' + (e?.message || e))
  } finally {
    setPostMatchOcrButtonsBusy(false)
  }
}

const LOCAL_BP_OCR_REGION_META = {
  survivors: { label: '求生者选择', css: 'survivors' },
  hunter: { label: '监管者选择', css: 'hunter' },
  survivorBans: { label: '求生者Ban', css: 'survivorBans' },
  hunterBans: { label: '监管者Ban', css: 'hunterBans' }
}

let localBpOcrConfig = null
let localBpOcrWindowList = []
let localBpOcrRunning = false
let localBpOcrBusy = false
let localBpOcrTimer = null
let localBpOcrActiveRegion = 'survivors'
let localBpOcrInstallPollTimer = null
let localBpOcrInitDone = false
let localBpOcrDrawState = null

function getDefaultLocalBpOcrConfig() {
  return {
    windowSourceId: '',
    windowName: '',
    intervalMs: 4000,
    preferredEngine: 'windows',
    fuzzyThreshold: 0.56,
    regions: {
      survivors: null,
      hunter: null,
      survivorBans: null,
      hunterBans: null
    }
  }
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  if (n < min) return min
  if (n > max) return max
  return n
}

function normalizeRegion(region) {
  if (!region || typeof region !== 'object') return null
  const x = clampNumber(region.x, 0, 1, 0)
  const y = clampNumber(region.y, 0, 1, 0)
  const width = clampNumber(region.width, 0, 1, 0)
  const height = clampNumber(region.height, 0, 1, 0)
  if (width <= 0 || height <= 0) return null
  if (x + width > 1 || y + height > 1) return null
  return { x, y, width, height }
}

function normalizeLocalBpOcrConfig(input) {
  const base = getDefaultLocalBpOcrConfig()
  const cfg = input && typeof input === 'object' ? input : {}
  const regions = cfg.regions && typeof cfg.regions === 'object' ? cfg.regions : {}
  return {
    windowSourceId: typeof cfg.windowSourceId === 'string' ? cfg.windowSourceId : base.windowSourceId,
    windowName: typeof cfg.windowName === 'string' ? cfg.windowName : base.windowName,
    intervalMs: Math.round(clampNumber(cfg.intervalMs, 1000, 30000, base.intervalMs)),
    preferredEngine: cfg.preferredEngine === 'paddleocr' ? 'paddleocr' : 'windows',
    fuzzyThreshold: clampNumber(cfg.fuzzyThreshold, 0.3, 0.95, base.fuzzyThreshold),
    regions: {
      survivors: normalizeRegion(regions.survivors),
      hunter: normalizeRegion(regions.hunter),
      survivorBans: normalizeRegion(regions.survivorBans),
      hunterBans: normalizeRegion(regions.hunterBans)
    }
  }
}

function setLocalBpOcrStatus(text, type = 'idle') {
  const el = document.getElementById('localBpOcrStatus')
  if (!el) return
  el.textContent = text || '待机'
  el.className = 'local-ocr-status'
  if (type === 'running') el.classList.add('running')
  else if (type === 'installing') el.classList.add('installing')
  else if (type === 'error') el.classList.add('error')
  else el.classList.add('idle')
}

function setLocalBpOcrResultText(text) {
  const el = document.getElementById('localBpOcrResult')
  if (!el) return
  el.textContent = text || '识别结果将显示在这里'
}

function formatLocalBpOcrResult(payload) {
  if (!payload || typeof payload !== 'object') return '识别结果为空'
  const matched = payload.matched || {}
  const raw = payload.raw || {}
  const applyResult = payload.applyResult || {}
  const meta = payload.recognitionMeta || {}
  const engineUsed = meta.engineUsed || {}
  const imageVariant = meta.imageVariant || {}
  const hasText = (v) => String(v || '').trim().length > 0
  const timeText = payload.timestamp ? new Date(payload.timestamp).toLocaleTimeString() : ''
  const lines = []
  const allRawEmpty = !hasText(raw.survivors) &&
    !hasText(raw.hunter) &&
    !hasText(raw.survivorBans) &&
    !hasText(raw.hunterBans)
  lines.push(`时间: ${timeText}`)
  lines.push(`窗口: ${payload.sourceName || '未知'}`)
  lines.push(`求生者: ${(matched.survivors || []).join(' / ') || '无'}`)
  lines.push(`监管者: ${matched.hunter || '无'}`)
  lines.push(`求生Ban: ${(matched.survivorBans || []).join(' / ') || '无'}`)
  lines.push(`监管Ban: ${(matched.hunterBans || []).join(' / ') || '无'}`)
  lines.push(`引擎: 求生=${engineUsed.survivors || '-'} 监管=${engineUsed.hunter || '-'} 求生Ban=${engineUsed.survivorBans || '-'} 监管Ban=${engineUsed.hunterBans || '-'}`)
  lines.push(`图像增强: 求生=${imageVariant.survivors || '-'} 监管=${imageVariant.hunter || '-'} 求生Ban=${imageVariant.survivorBans || '-'} 监管Ban=${imageVariant.hunterBans || '-'}`)
  if (meta.warning) {
    lines.push(`提示: ${meta.warning}`)
  }
  lines.push(`回填: ${applyResult.applied ? '已更新本地BP' : '无变更'}`)
  lines.push('')
  lines.push(`原始求生文本: ${raw.survivors || '-'}`)
  lines.push(`原始监管文本: ${raw.hunter || '-'}`)
  lines.push(`原始求生Ban文本: ${raw.survivorBans || '-'}`)
  lines.push(`原始监管Ban文本: ${raw.hunterBans || '-'}`)
  if (allRawEmpty) {
    lines.push('')
    lines.push('提示: 4个区域都未识别到文字。请确认目标窗口未最小化、文本在框内，并尝试切换到 PaddleOCR。')
  }
  return lines.join('\n')
}

async function loadLocalBpOcrConfig() {
  const result = await window.electronAPI.invoke('localBp:ocrGetConfig')
  if (!result || !result.success) {
    localBpOcrConfig = getDefaultLocalBpOcrConfig()
    return
  }
  localBpOcrConfig = normalizeLocalBpOcrConfig(result.data?.config || {})
  const runtime = result.data?.runtime || {}
  if (runtime.lastRecognition) {
    setLocalBpOcrResultText(formatLocalBpOcrResult(runtime.lastRecognition))
  }
  updateLocalBpOcrInstallHint(runtime.installStatus)
}

async function saveLocalBpOcrConfigPatch(patch) {
  if (!localBpOcrConfig) localBpOcrConfig = getDefaultLocalBpOcrConfig()
  const merged = {
    ...localBpOcrConfig,
    ...(patch && typeof patch === 'object' ? patch : {}),
    regions: {
      ...(localBpOcrConfig.regions || {}),
      ...((patch && patch.regions && typeof patch.regions === 'object') ? patch.regions : {})
    }
  }
  const normalized = normalizeLocalBpOcrConfig(merged)
  const result = await window.electronAPI.invoke('localBp:ocrSetConfig', normalized)
  if (result && result.success && result.data?.config) {
    localBpOcrConfig = normalizeLocalBpOcrConfig(result.data.config)
    updateLocalBpOcrInstallHint(result.data?.runtime?.installStatus)
  } else {
    localBpOcrConfig = normalized
  }
}

function updateLocalBpOcrInstallHint(status) {
  const hintEl = document.getElementById('localBpOcrInstallHint')
  if (!hintEl) return
  if (!status || typeof status !== 'object') {
    hintEl.textContent = '可选增强引擎，首次安装较慢。'
    return
  }
  if (status.running) {
    hintEl.textContent = status.message || 'PaddleOCR 安装中...'
    return
  }
  if (status.success && status.paddleReady) {
    hintEl.textContent = 'PaddleOCR 已可用。'
    return
  }
  if (!status.paddleReady && status.message) {
    hintEl.textContent = status.message
    return
  }
  hintEl.textContent = status.paddleReady ? 'PaddleOCR 已可用。' : '可选增强引擎，首次安装较慢。'
}

function renderLocalBpOcrConfigToUi() {
  if (!localBpOcrConfig) return
  const engineSelect = document.getElementById('localBpOcrEngine')
  if (engineSelect) engineSelect.value = localBpOcrConfig.preferredEngine
  const intervalInput = document.getElementById('localBpOcrInterval')
  if (intervalInput) intervalInput.value = String(Math.round((localBpOcrConfig.intervalMs || 4000) / 1000))
  const windowSelect = document.getElementById('localBpOcrWindowSelect')
  if (windowSelect) {
    windowSelect.value = localBpOcrConfig.windowSourceId || ''
  }
  setLocalBpOcrActiveRegion(localBpOcrActiveRegion)
  renderLocalBpOcrRegions()
}

function renderLocalBpOcrWindowList() {
  const select = document.getElementById('localBpOcrWindowSelect')
  if (!select) return
  const current = localBpOcrConfig?.windowSourceId || ''
  const options = ['<option value="">请选择游戏窗口</option>']
  for (const item of localBpOcrWindowList) {
    const value = item.id || ''
    const name = item.name || value
    const selected = current && current === value ? ' selected' : ''
    options.push(`<option value="${value}"${selected}>${name}</option>`)
  }
  select.innerHTML = options.join('')
  if (current) select.value = current
}

async function refreshLocalBpOcrWindowList() {
  const result = await window.electronAPI.invoke('localBp:ocrListWindows')
  if (!result || !result.success || !Array.isArray(result.data)) {
    setLocalBpOcrStatus(result?.error || '窗口列表获取失败', 'error')
    return
  }
  localBpOcrWindowList = result.data
  renderLocalBpOcrWindowList()
  if (localBpOcrRunning) {
    setLocalBpOcrStatus('识别中', 'running')
  } else {
    setLocalBpOcrStatus('待机', 'idle')
  }
}

function setLocalBpOcrPreviewData(previewData) {
  const stage = document.getElementById('localBpOcrPreviewStage')
  const image = document.getElementById('localBpOcrPreviewImage')
  const placeholder = document.getElementById('localBpOcrPreviewPlaceholder')
  if (!stage || !image || !placeholder) return

  if (!previewData || !previewData.dataUrl) {
    image.style.display = 'none'
    image.src = ''
    placeholder.style.display = 'flex'
    stage.classList.remove('active')
    renderLocalBpOcrRegions()
    return
  }

  const width = clampNumber(previewData.width, 100, 4000, 1280)
  const height = clampNumber(previewData.height, 80, 2500, 720)
  stage.style.width = `${width}px`
  stage.style.height = `${height}px`

  image.style.display = 'block'
  image.style.width = '100%'
  image.style.height = '100%'
  image.src = previewData.dataUrl
  placeholder.style.display = 'none'
  stage.classList.add('active')
  renderLocalBpOcrRegions()
}

async function captureLocalBpOcrPreview() {
  const sourceId = localBpOcrConfig?.windowSourceId || ''
  if (!sourceId) {
    setLocalBpOcrStatus('请先选择窗口', 'error')
    return
  }
  const result = await window.electronAPI.invoke('localBp:ocrCapturePreview', sourceId)
  if (!result || !result.success || !result.data) {
    setLocalBpOcrStatus(result?.error || '窗口预览失败', 'error')
    return
  }

  localBpOcrConfig.windowSourceId = result.data.sourceId || sourceId
  localBpOcrConfig.windowName = result.data.sourceName || ''
  await saveLocalBpOcrConfigPatch({
    windowSourceId: localBpOcrConfig.windowSourceId,
    windowName: localBpOcrConfig.windowName
  })
  renderLocalBpOcrWindowList()
  setLocalBpOcrPreviewData(result.data)
  if (localBpOcrRunning) setLocalBpOcrStatus('识别中', 'running')
  else setLocalBpOcrStatus('预览已更新', 'idle')
}

function setLocalBpOcrActiveRegion(regionKey) {
  localBpOcrActiveRegion = LOCAL_BP_OCR_REGION_META[regionKey] ? regionKey : 'survivors'
  const buttons = document.querySelectorAll('.local-ocr-region-btn')
  buttons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.region === localBpOcrActiveRegion)
  })
}

function renderLocalBpOcrRegions() {
  const stage = document.getElementById('localBpOcrPreviewStage')
  const overlay = document.getElementById('localBpOcrPreviewOverlay')
  if (!stage || !overlay) return
  const width = stage.clientWidth
  const height = stage.clientHeight
  overlay.innerHTML = ''
  if (!width || !height || !localBpOcrConfig) return

  for (const key of Object.keys(LOCAL_BP_OCR_REGION_META)) {
    const region = localBpOcrConfig.regions?.[key]
    if (!region) continue
    const meta = LOCAL_BP_OCR_REGION_META[key]
    const box = document.createElement('div')
    box.className = `local-ocr-region-box ${meta.css}`
    box.style.left = `${region.x * width}px`
    box.style.top = `${region.y * height}px`
    box.style.width = `${region.width * width}px`
    box.style.height = `${region.height * height}px`

    const label = document.createElement('div')
    label.className = 'local-ocr-region-label'
    label.textContent = meta.label
    box.appendChild(label)
    overlay.appendChild(box)
  }

  if (localBpOcrDrawState && localBpOcrDrawState.active) {
    const draw = localBpOcrDrawState
    const box = document.createElement('div')
    box.className = 'local-ocr-region-box drawing'
    box.style.left = `${draw.left}px`
    box.style.top = `${draw.top}px`
    box.style.width = `${draw.width}px`
    box.style.height = `${draw.height}px`
    overlay.appendChild(box)
  }
}

function getLocalBpOcrPointInStage(event) {
  const stage = document.getElementById('localBpOcrPreviewStage')
  if (!stage) return null
  const rect = stage.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const x = clampNumber(event.clientX - rect.left, 0, rect.width, 0)
  const y = clampNumber(event.clientY - rect.top, 0, rect.height, 0)
  return { x, y, width: rect.width, height: rect.height }
}

function bindLocalBpOcrDrawing() {
  const overlay = document.getElementById('localBpOcrPreviewOverlay')
  if (!overlay || overlay.dataset.bound === '1') return
  overlay.dataset.bound = '1'

  overlay.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return
    const stage = document.getElementById('localBpOcrPreviewStage')
    if (!stage || !stage.classList.contains('active')) return
    const point = getLocalBpOcrPointInStage(event)
    if (!point) return
    localBpOcrDrawState = {
      active: true,
      startX: point.x,
      startY: point.y,
      left: point.x,
      top: point.y,
      width: 0,
      height: 0,
      stageWidth: point.width,
      stageHeight: point.height
    }
    renderLocalBpOcrRegions()
  })

  window.addEventListener('mousemove', (event) => {
    if (!localBpOcrDrawState || !localBpOcrDrawState.active) return
    const point = getLocalBpOcrPointInStage(event)
    if (!point) return
    const left = Math.min(localBpOcrDrawState.startX, point.x)
    const top = Math.min(localBpOcrDrawState.startY, point.y)
    const width = Math.abs(point.x - localBpOcrDrawState.startX)
    const height = Math.abs(point.y - localBpOcrDrawState.startY)
    localBpOcrDrawState.left = left
    localBpOcrDrawState.top = top
    localBpOcrDrawState.width = width
    localBpOcrDrawState.height = height
    localBpOcrDrawState.stageWidth = point.width
    localBpOcrDrawState.stageHeight = point.height
    renderLocalBpOcrRegions()
  })

  window.addEventListener('mouseup', async (event) => {
    if (event.button !== 0) return
    if (!localBpOcrDrawState || !localBpOcrDrawState.active) return
    const draw = localBpOcrDrawState
    localBpOcrDrawState = null
    if (draw.width < 6 || draw.height < 6) {
      renderLocalBpOcrRegions()
      return
    }

    const nextRegion = {
      x: draw.left / draw.stageWidth,
      y: draw.top / draw.stageHeight,
      width: draw.width / draw.stageWidth,
      height: draw.height / draw.stageHeight
    }
    if (!localBpOcrConfig) localBpOcrConfig = getDefaultLocalBpOcrConfig()
    localBpOcrConfig.regions[localBpOcrActiveRegion] = normalizeRegion(nextRegion)
    await saveLocalBpOcrConfigPatch({
      regions: {
        [localBpOcrActiveRegion]: localBpOcrConfig.regions[localBpOcrActiveRegion]
      }
    })
    renderLocalBpOcrRegions()
  })
}

function stopLocalBpOcrLoop() {
  if (localBpOcrTimer) {
    clearInterval(localBpOcrTimer)
    localBpOcrTimer = null
  }
  localBpOcrRunning = false
  if (!localBpOcrBusy) {
    setLocalBpOcrStatus('待机', 'idle')
  }
}

async function runLocalBpOcrOnce() {
  if (localBpOcrBusy) return
  if (!localBpOcrConfig || !localBpOcrConfig.windowSourceId) {
    setLocalBpOcrStatus('请先选择窗口', 'error')
    return
  }
  const hasAnyRegion = Object.values(localBpOcrConfig.regions || {}).some(Boolean)
  if (!hasAnyRegion) {
    setLocalBpOcrStatus('请先在预览图上框选区域', 'error')
    return
  }
  localBpOcrBusy = true
  if (localBpOcrRunning) setLocalBpOcrStatus('识别中', 'running')
  else setLocalBpOcrStatus('识别中', 'installing')

  try {
    const result = await window.electronAPI.invoke('localBp:ocrRecognizeOnce', { apply: true })
    if (!result || !result.success || !result.data) {
      setLocalBpOcrStatus(result?.error || '识别失败', 'error')
      return
    }
    setLocalBpOcrResultText(formatLocalBpOcrResult(result.data))
    const warning = result.data?.recognitionMeta?.warning
    if (warning) {
      setLocalBpOcrStatus('识别为空，请看结果提示', 'error')
    } else if (localBpOcrRunning) {
      setLocalBpOcrStatus('识别中', 'running')
    } else {
      setLocalBpOcrStatus('识别完成', 'idle')
    }
  } catch (error) {
    setLocalBpOcrStatus(error?.message || '识别异常', 'error')
  } finally {
    localBpOcrBusy = false
  }
}

async function startLocalBpOcrLoop() {
  if (!localBpOcrConfig) localBpOcrConfig = getDefaultLocalBpOcrConfig()
  const intervalInput = document.getElementById('localBpOcrInterval')
  const seconds = clampNumber(intervalInput?.value, 1, 30, 4)
  localBpOcrConfig.intervalMs = Math.round(seconds * 1000)
  await saveLocalBpOcrConfigPatch({ intervalMs: localBpOcrConfig.intervalMs })
  if (intervalInput) intervalInput.value = String(seconds)

  stopLocalBpOcrLoop()
  localBpOcrRunning = true
  setLocalBpOcrStatus('识别中', 'running')
  runLocalBpOcrOnce()
  localBpOcrTimer = setInterval(() => {
    runLocalBpOcrOnce()
  }, localBpOcrConfig.intervalMs)
}

async function pollLocalBpOcrInstallStatus() {
  const result = await window.electronAPI.invoke('localBp:ocrInstallStatus')
  if (!result || !result.success || !result.data) return
  const status = result.data
  updateLocalBpOcrInstallHint(status)
  if (status.running) {
    setLocalBpOcrStatus(status.message || '安装 PaddleOCR 中', 'installing')
    return
  }
  if (status.success && status.paddleReady) {
    setLocalBpOcrStatus('PaddleOCR 已就绪', localBpOcrRunning ? 'running' : 'idle')
    if (localBpOcrInstallPollTimer) {
      clearInterval(localBpOcrInstallPollTimer)
      localBpOcrInstallPollTimer = null
    }
    return
  }
  if (!status.running && localBpOcrInstallPollTimer) {
    clearInterval(localBpOcrInstallPollTimer)
    localBpOcrInstallPollTimer = null
  }
}

async function installLocalBpOcrPaddle() {
  const btn = document.getElementById('localBpOcrInstallPaddleBtn')
  if (btn) btn.disabled = true
  try {
    const result = await window.electronAPI.invoke('localBp:ocrInstallPaddle')
    if (!result || !result.success) {
      setLocalBpOcrStatus(result?.error || '启动安装失败', 'error')
      return
    }
    setLocalBpOcrStatus('安装 PaddleOCR 中', 'installing')
    if (localBpOcrInstallPollTimer) clearInterval(localBpOcrInstallPollTimer)
    localBpOcrInstallPollTimer = setInterval(() => {
      pollLocalBpOcrInstallStatus()
    }, 2000)
    pollLocalBpOcrInstallStatus()
  } finally {
    if (btn) btn.disabled = false
  }
}

function bindLocalBpOcrEvents() {
  if (localBpOcrInitDone) return
  localBpOcrInitDone = true

  const refreshBtn = document.getElementById('localBpOcrRefreshWindowsBtn')
  const captureBtn = document.getElementById('localBpOcrCaptureBtn')
  const startBtn = document.getElementById('localBpOcrStartBtn')
  const stopBtn = document.getElementById('localBpOcrStopBtn')
  const runOnceBtn = document.getElementById('localBpOcrRunOnceBtn')
  const installBtn = document.getElementById('localBpOcrInstallPaddleBtn')
  const engineSelect = document.getElementById('localBpOcrEngine')
  const intervalInput = document.getElementById('localBpOcrInterval')
  const windowSelect = document.getElementById('localBpOcrWindowSelect')
  const regionBtns = document.querySelectorAll('.local-ocr-region-btn')

  refreshBtn?.addEventListener('click', () => {
    refreshLocalBpOcrWindowList()
  })

  captureBtn?.addEventListener('click', () => {
    captureLocalBpOcrPreview()
  })

  startBtn?.addEventListener('click', () => {
    startLocalBpOcrLoop()
  })

  stopBtn?.addEventListener('click', () => {
    stopLocalBpOcrLoop()
  })

  runOnceBtn?.addEventListener('click', () => {
    runLocalBpOcrOnce()
  })

  installBtn?.addEventListener('click', () => {
    installLocalBpOcrPaddle()
  })

  engineSelect?.addEventListener('change', async () => {
    const value = engineSelect.value === 'paddleocr' ? 'paddleocr' : 'windows'
    localBpOcrConfig.preferredEngine = value
    await saveLocalBpOcrConfigPatch({ preferredEngine: value })
  })

  intervalInput?.addEventListener('change', async () => {
    const seconds = clampNumber(intervalInput.value, 1, 30, 4)
    intervalInput.value = String(seconds)
    localBpOcrConfig.intervalMs = Math.round(seconds * 1000)
    await saveLocalBpOcrConfigPatch({ intervalMs: localBpOcrConfig.intervalMs })
    if (localBpOcrRunning) {
      startLocalBpOcrLoop()
    }
  })

  windowSelect?.addEventListener('change', async () => {
    localBpOcrConfig.windowSourceId = windowSelect.value || ''
    const selected = localBpOcrWindowList.find(item => item.id === localBpOcrConfig.windowSourceId)
    localBpOcrConfig.windowName = selected?.name || ''
    await saveLocalBpOcrConfigPatch({
      windowSourceId: localBpOcrConfig.windowSourceId,
      windowName: localBpOcrConfig.windowName
    })
  })

  regionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      setLocalBpOcrActiveRegion(btn.dataset.region || 'survivors')
    })
  })

  bindLocalBpOcrDrawing()
}

async function initLocalBpOcrPanel() {
  const panel = document.getElementById('localBpOcrStatus')
  if (!panel) return
  await loadLocalBpOcrConfig()
  bindLocalBpOcrEvents()
  await refreshLocalBpOcrWindowList()
  renderLocalBpOcrConfigToUi()
  setLocalBpOcrStatus('待机', 'idle')
}

window.bpGuideState = {
  active: false,
  started: false,
  stepIndex: 0,
  bo: 1,
  half: 'upper',
  steps: [],
  inheritGlobalNextBoSource: 'none',
  lastBoGlobalBans: {
    upper: { survivors: [], hunters: [] },
    lower: { survivors: [], hunters: [] }
  }
}
window.bpGuideLock = null

const isGuideOnly = new URLSearchParams(window.location.search || '').get('guide') === '1'
if (isGuideOnly && document.body) {
  document.body.classList.add('bp-guide-only')
}

let bpGuideOriginalParent = null
let bpGuideOriginalNext = null

function mountBpGuideWorkspace() {
  if (isGuideOnly) return
  const body = document.body
  const modalBody = document.querySelector('#bpGuideModal .bp-guide-body')
  const mainWrapper = document.querySelector('.main-wrapper')
  if (!body || !modalBody || !mainWrapper) return
  let sidebar = document.getElementById('bpGuideSidebar')
  if (!sidebar) {
    sidebar = document.createElement('div')
    sidebar.id = 'bpGuideSidebar'
    sidebar.className = 'bp-guide-sidebar'
    modalBody.insertBefore(sidebar, modalBody.firstChild)
  }
  const setup = document.getElementById('bpGuideSetup')
  const step = document.getElementById('bpGuideStep')
  if (setup && setup.parentElement !== sidebar) sidebar.appendChild(setup)
  if (step && step.parentElement !== sidebar) sidebar.appendChild(step)
  let workspace = document.getElementById('bpGuideWorkspace')
  if (!workspace) {
    workspace = document.createElement('div')
    workspace.id = 'bpGuideWorkspace'
    workspace.className = 'bp-guide-workspace'
    modalBody.appendChild(workspace)
  }
  if (!bpGuideOriginalParent) {
    bpGuideOriginalParent = mainWrapper.parentElement
    bpGuideOriginalNext = mainWrapper.nextSibling
  }
  if (mainWrapper.parentElement !== workspace) workspace.appendChild(mainWrapper)
  body.classList.add('bp-guide-embedded')
}

function unmountBpGuideWorkspace() {
  if (isGuideOnly) return
  const body = document.body
  const mainWrapper = document.querySelector('.main-wrapper')
  if (bpGuideOriginalParent && mainWrapper && mainWrapper.parentElement !== bpGuideOriginalParent) {
    if (bpGuideOriginalNext && bpGuideOriginalNext.parentElement === bpGuideOriginalParent) {
      bpGuideOriginalParent.insertBefore(mainWrapper, bpGuideOriginalNext)
    } else {
      bpGuideOriginalParent.appendChild(mainWrapper)
    }
  }
  if (body) body.classList.remove('bp-guide-embedded')
}

async function openBpGuideWindow() {
  openBpGuide()
}

function openBpGuide() {
  mountBpGuideWorkspace()
  const modal = document.getElementById('bpGuideModal')
  const setup = document.getElementById('bpGuideSetup')
  const step = document.getElementById('bpGuideStep')
  const footer = document.getElementById('bpGuideFooter')
  const boInput = document.getElementById('bpGuideBoInput')
  const halfInput = document.getElementById('bpGuideHalfInput')
  if (boInput) boInput.value = window.bpGuideState.bo || 1
  if (halfInput) halfInput.value = window.bpGuideState.half || 'upper'
  syncBpGuideInheritGlobalNextBoSource()
  if (window.bpGuideState.started) {
    if (setup) setup.style.display = 'none'
    if (step) step.style.display = 'flex'
    if (footer) footer.style.display = 'flex'
    renderBpGuideStep()
  } else {
    if (setup) setup.style.display = 'flex'
    if (step) step.style.display = 'none'
    if (footer) footer.style.display = 'none'
  }
  if (modal) modal.classList.add('show')
}

function closeBpGuide() {
  if (isGuideOnly) return
  const modal = document.getElementById('bpGuideModal')
  if (modal) modal.classList.remove('show')
  unmountBpGuideWorkspace()
}

function startBpGuide() {
  const boInput = document.getElementById('bpGuideBoInput')
  const halfInput = document.getElementById('bpGuideHalfInput')
  const inheritInput = document.getElementById('bpGuideInheritGlobalNextBoSource')
  const bo = Math.max(1, parseInt(boInput?.value) || 1)
  const half = halfInput?.value === 'lower' ? 'lower' : 'upper'
  window.bpGuideState.bo = bo
  window.bpGuideState.half = half
  window.bpGuideState.inheritGlobalNextBoSource = (inheritInput?.value === 'upper' || inheritInput?.value === 'lower') ? inheritInput.value : 'none'
  window.bpGuideState.stepIndex = 0
  window.bpGuideState.steps = buildBpGuideSteps(bo)
  window.bpGuideState.started = true
  window.bpGuideState.active = true
  const setup = document.getElementById('bpGuideSetup')
  const step = document.getElementById('bpGuideStep')
  const footer = document.getElementById('bpGuideFooter')
  if (setup) setup.style.display = 'none'
  if (step) step.style.display = 'flex'
  if (footer) footer.style.display = 'flex'
  syncBpGuideInheritGlobalNextBoSource()
  renderBpGuideStep()
}

function setBpGuideInheritGlobalNextBoSource(value) {
  const v = value === 'upper' || value === 'lower' ? value : 'none'
  window.bpGuideState.inheritGlobalNextBoSource = v
  syncBpGuideInheritGlobalNextBoSource()
}

function syncBpGuideInheritGlobalNextBoSource() {
  const setupInput = document.getElementById('bpGuideInheritGlobalNextBoSource')
  const footerInput = document.getElementById('bpGuideInheritGlobalNextBoSourceFooter')
  const v = window.bpGuideState.inheritGlobalNextBoSource || 'none'
  if (setupInput) setupInput.value = v
  if (footerInput) footerInput.value = v
}

function getBpGuideRules(bo) {
  const round = Math.max(1, parseInt(bo) || 1)
  const hunterBanCount = round === 1 ? 0 : (round === 2 ? 1 : 2)
  const globalSurvivorTotal = Math.max(0, (round - 1) * 3)
  const globalHunterTotal = Math.max(0, round - 1)
  return { round, hunterBanCount, globalSurvivorTotal, globalHunterTotal }
}

function getGuideActionFromPickAction(action) {
  if (action === 'slot-survivor') return 'pickSurvivor'
  if (action === 'slot-hunter') return 'pickHunter'
  if (action === 'ban-survivor') return 'banSurvivor'
  if (action === 'ban-hunter') return 'banHunter'
  if (action === 'global-survivor') return 'globalBanSurvivor'
  if (action === 'global-hunter') return 'globalBanHunter'
  return null
}

function getGuideActionCount(action) {
  switch (action) {
    case 'banSurvivor':
      return state.hunterBannedSurvivors.length
    case 'banHunter':
      return state.survivorBannedHunters.length
    case 'globalBanSurvivor':
      return state.globalBannedSurvivors.length
    case 'globalBanHunter':
      return state.globalBannedHunters.length
    case 'pickSurvivor':
      return state.survivors.filter(Boolean).length
    case 'pickHunter':
      return state.hunter ? 1 : 0
    default:
      return 0
  }
}

function getBpGuideLockStatus() {
  const lock = window.bpGuideLock
  if (!lock) return { active: false, done: true, remaining: 0 }
  const current = getGuideActionCount(lock.action)
  const progress = Math.max(0, current - lock.initial)
  const remaining = Math.max(0, lock.required - progress)
  return { active: true, done: remaining <= 0, remaining }
}

function startBpGuideLock(action, required) {
  if (!action || !required || required <= 0) {
    window.bpGuideLock = null
    return
  }
  window.bpGuideLock = {
    action,
    required,
    initial: getGuideActionCount(action)
  }
}

function clearBpGuideLock() {
  window.bpGuideLock = null
}

function updatePickModalTitle() {
  const title = document.getElementById('pickModalTitle')
  if (!title) return
  if (pickAction === 'slot-survivor') {
    title.textContent = `选择求生者（位置 ${pickIndex + 1}）`
  } else if (pickAction === 'slot-hunter') {
    title.textContent = '选择监管者'
  } else if (pickAction === 'ban-survivor') {
    title.textContent = '选择求生者（加入求生者Ban位）'
  } else if (pickAction === 'ban-hunter') {
    title.textContent = '选择监管者（加入监管者Ban位）'
  } else if (pickAction === 'global-survivor') {
    title.textContent = '选择求生者（加入全局禁选）'
  } else if (pickAction === 'global-hunter') {
    title.textContent = '选择监管者（加入全局禁选）'
  }
  const guideAction = getGuideActionFromPickAction(pickAction)
  const status = getBpGuideLockStatus()
  if (status.active && guideAction === window.bpGuideLock?.action && status.remaining > 0) {
    title.textContent = `${title.textContent}，还需 ${status.remaining} 个`
  }
}

function handleGuideLockAfterSelection(guideAction) {
  const lock = window.bpGuideLock
  if (!lock || lock.action !== guideAction) return false
  const status = getBpGuideLockStatus()
  if (!status.done) {
    if (guideAction === 'pickSurvivor') {
      pickIndex = getNextSurvivorSlot()
    }
    updatePickModalTitle()
    return true
  }
  clearBpGuideLock()
  closePickModal()
  nextBpGuideStep()
  return true
}

function buildBpGuideSteps(bo) {
  const rules = getBpGuideRules(bo)
  return [
    {
      key: 'map',
      title: '选图',
      body: () => `
        <div>请先选择本局地图。</div>
        <div class="bp-guide-hint">当前地图：<span class="bp-guide-count">${matchBase?.mapName || '未选择'}</span></div>
      `,
      actions: [{ label: '去选择地图', action: 'gotoMap' }]
    },
    {
      key: 'global',
      title: '全局BP禁用阶段',
      body: () => `
        <div>全局禁用会在整场比赛生效。</div>
        <div class="bp-guide-hint">
          <div>本BO累计全局禁用建议：求生者 <span class="bp-guide-count">${rules.globalSurvivorTotal}</span>，监管者 <span class="bp-guide-count">${rules.globalHunterTotal}</span></div>
          <div>当前已添加：求生者 <span class="bp-guide-count">${state.globalBannedSurvivors.length}</span>，监管者 <span class="bp-guide-count">${state.globalBannedHunters.length}</span></div>
        </div>
      `,
      actions: [
        { label: '全局Ban求生', action: 'globalBanSurvivor' },
        { label: '全局Ban监管', action: 'globalBanHunter' }
      ]
    },
    {
      key: 'hunter-ban-1',
      title: '监管者禁用第一阶段',
      body: () => `
        <div>固定禁用求生者 <span class="bp-guide-count">2</span> 名。</div>
        <div class="bp-guide-hint">当前求生者Ban：<span class="bp-guide-count">${state.hunterBannedSurvivors.length}</span></div>
      `,
      actions: [{ label: 'Ban求生者', action: 'banSurvivor' }],
      enforce: { action: 'banSurvivor', count: 2 }
    },
    {
      key: 'survivor-ban',
      title: '求生者禁用阶段',
      body: () => `
        <div>本局监管者Ban位数量：<span class="bp-guide-count">${rules.hunterBanCount}</span></div>
        <div class="bp-guide-hint">当前监管者Ban：<span class="bp-guide-count">${state.survivorBannedHunters.length}</span></div>
      `,
      actions: rules.hunterBanCount > 0 ? [{ label: 'Ban监管者', action: 'banHunter' }] : [],
      enforce: { action: 'banHunter', count: rules.hunterBanCount }
    },
    {
      key: 'survivor-pick-1',
      title: '求生者选择第一阶段',
      body: () => `
        <div>固定选择求生者 <span class="bp-guide-count">2</span> 名。</div>
        <div class="bp-guide-hint">当前已选求生者：<span class="bp-guide-count">${state.survivors.filter(Boolean).length}</span></div>
      `,
      actions: [{ label: '选择求生者', action: 'pickSurvivor' }],
      enforce: { action: 'pickSurvivor', count: 2 }
    },
    {
      key: 'hunter-ban-2',
      title: '监管者禁用第二阶段',
      body: () => `
        <div>固定禁用求生者 <span class="bp-guide-count">1</span> 名。</div>
        <div class="bp-guide-hint">当前求生者Ban：<span class="bp-guide-count">${state.hunterBannedSurvivors.length}</span></div>
      `,
      actions: [{ label: 'Ban求生者', action: 'banSurvivor' }],
      enforce: { action: 'banSurvivor', count: 1 }
    },
    {
      key: 'survivor-pick-2',
      title: '求生者选择第二阶段',
      body: () => `
        <div>固定选择求生者 <span class="bp-guide-count">1</span> 名。</div>
        <div class="bp-guide-hint">当前已选求生者：<span class="bp-guide-count">${state.survivors.filter(Boolean).length}</span></div>
      `,
      actions: [{ label: '选择求生者', action: 'pickSurvivor' }],
      enforce: { action: 'pickSurvivor', count: 1 }
    },
    {
      key: 'hunter-ban-3',
      title: '监管者禁用第三阶段',
      body: () => `
        <div>固定禁用求生者 <span class="bp-guide-count">1</span> 名。</div>
        <div class="bp-guide-hint">当前求生者Ban：<span class="bp-guide-count">${state.hunterBannedSurvivors.length}</span></div>
      `,
      actions: [{ label: 'Ban求生者', action: 'banSurvivor' }],
      enforce: { action: 'banSurvivor', count: 1 }
    },
    {
      key: 'survivor-pick-3',
      title: '求生者选择第三阶段',
      body: () => `
        <div>固定选择求生者 <span class="bp-guide-count">1</span> 名。</div>
        <div class="bp-guide-hint">当前已选求生者：<span class="bp-guide-count">${state.survivors.filter(Boolean).length}</span></div>
      `,
      actions: [{ label: '选择求生者', action: 'pickSurvivor' }],
      enforce: { action: 'pickSurvivor', count: 1 }
    },
    {
      key: 'survivor-talents',
      title: '求生者天赋选择阶段',
      body: () => `
        <div>为每位求生者配置天赋。</div>
        <div class="bp-guide-hint">已配置天赋求生者：<span class="bp-guide-count">${state.survivorTalents.filter(t => (t || []).length > 0).length}</span></div>
      `,
      actions: [{ label: '去配置天赋', action: 'gotoTalents' }]
    },
    {
      key: 'hunter-pick',
      title: '监管者选择阶段',
      body: () => `
        <div>固定选择监管者 <span class="bp-guide-count">1</span> 名。</div>
        <div class="bp-guide-hint">当前监管者：<span class="bp-guide-count">${state.hunter || '未选择'}</span></div>
      `,
      actions: [{ label: '选择监管者', action: 'pickHunter' }],
      enforce: { action: 'pickHunter', count: 1 }
    },
    {
      key: 'hunter-talents',
      title: '监管者天赋特质选择阶段',
      body: () => `
        <div>为监管者选择天赋与特质。</div>
        <div class="bp-guide-hint">已选择天赋：<span class="bp-guide-count">${state.hunterTalents.length}</span>，技能：<span class="bp-guide-count">${state.hunterSkills.length}</span></div>
      `,
      actions: [{ label: '去配置天赋', action: 'gotoTalents' }]
    },
    {
      key: 'showcase',
      title: '角色展示阶段',
      body: () => `
        <div>确认角色与天赋后同步到前端展示。</div>
        <div class="bp-guide-hint">可在本页点击“更新前端显示”进行推送。</div>
      `,
      actions: [{ label: '更新前端显示', action: 'updateFrontend' }]
    },
    {
      key: 'complete',
      title: '本半局完成',
      body: () => `
        <div>当前流程已完成。</div>
        <div class="bp-guide-hint">点击“下一步”进入${window.bpGuideState.half === 'upper' ? '下半局' : '下一BO'}。</div>
      `,
      actions: []
    }
  ]
}

function renderBpGuideStep() {
  const stateGuide = window.bpGuideState
  if (!stateGuide.active || !stateGuide.started) return
  const steps = stateGuide.steps || []
  const current = steps[stateGuide.stepIndex]
  if (!current) return
  syncBpGuideInheritGlobalNextBoSource()
  const titleEl = document.getElementById('bpGuideStepTitle')
  const bodyEl = document.getElementById('bpGuideStepBody')
  const progressEl = document.getElementById('bpGuideProgress')
  const actionsEl = document.getElementById('bpGuideActions')
  const titleHeader = document.getElementById('bpGuideTitle')
  if (titleHeader) {
    const halfText = stateGuide.half === 'upper' ? '上半局' : '下半局'
    titleHeader.textContent = `BP引导模式 · BO${stateGuide.bo} ${halfText}`
  }
  if (progressEl) {
    progressEl.textContent = `步骤 ${stateGuide.stepIndex + 1}/${steps.length}`
  }
  if (titleEl) titleEl.textContent = current.title
  if (bodyEl) bodyEl.innerHTML = typeof current.body === 'function' ? current.body() : (current.body || '')
  if (actionsEl) {
    const actions = Array.isArray(current.actions) ? current.actions : []
    actionsEl.innerHTML = actions.map(item => `
      <button class="btn btn-primary" onclick="runBpGuideAction('${item.action}')">${item.label}</button>
    `).join('')
    const modal = document.getElementById('bpGuideModal')
    const actionOnlySet = new Set([
      'banSurvivor',
      'banHunter',
      'globalBanSurvivor',
      'globalBanHunter',
      'pickSurvivor',
      'pickHunter'
    ])
    const isActionsOnly = actions.length > 0 && actions.every(item => actionOnlySet.has(item.action))
    if (modal) modal.classList.toggle('bp-guide-actions-only', isActionsOnly)
  }
  const prevBtn = document.querySelector('#bpGuideFooter .btn.btn-warning')
  const nextBtn = document.querySelector('#bpGuideFooter .btn.btn-success')
  if (prevBtn) prevBtn.disabled = stateGuide.stepIndex === 0
  if (nextBtn) {
    nextBtn.textContent = stateGuide.stepIndex === steps.length - 1 ? '进入下一步' : '下一步'
  }
}

function runBpGuideAction(action) {
  if (!action) return
  const step = window.bpGuideState?.steps?.[window.bpGuideState.stepIndex]
  if (step && step.enforce && step.enforce.action === action && step.enforce.count > 0) {
    startBpGuideLock(action, step.enforce.count)
  } else {
    clearBpGuideLock()
  }
  switch (action) {
    case 'gotoMap':
      switchPage('baseinfo')
      setTimeout(() => document.getElementById('baseMapName')?.focus(), 50)
      break
    case 'globalBanSurvivor':
      switchPage('bp')
      openBanModal('global-survivor')
      break
    case 'globalBanHunter':
      switchPage('bp')
      openBanModal('global-hunter')
      break
    case 'banSurvivor':
      switchPage('bp')
      openBanModal('ban-survivor')
      break
    case 'banHunter':
      switchPage('bp')
      openBanModal('ban-hunter')
      break
    case 'pickSurvivor':
      switchPage('bp')
      openPickModal('survivor', getNextSurvivorSlot())
      break
    case 'pickHunter':
      switchPage('bp')
      openPickModal('hunter', 4)
      break
    case 'gotoLineup':
      switchPage('baseinfo')
      setTimeout(() => document.getElementById('lineup-config-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      break
    case 'gotoTalents':
      switchPage('talents')
      break
    case 'updateFrontend':
      switchPage('bp')
      updateFrontend()
      break
  }
}

function getNextSurvivorSlot() {
  const idx = state.survivors.findIndex(s => !s)
  return idx === -1 ? 0 : idx
}

async function nextBpGuideStep() {
  const stateGuide = window.bpGuideState
  if (!stateGuide.started) return
  const status = getBpGuideLockStatus()
  if (status.active && !status.done) return
  clearBpGuideLock()
  closePickModal()
  if (stateGuide.stepIndex < stateGuide.steps.length - 1) {
    stateGuide.stepIndex += 1
    renderBpGuideStep()
    return
  }
  if (stateGuide.half === 'upper') {
    captureGuideGlobalBans('upper')
    await resetBpForGuideNextHalf()
    stateGuide.half = 'lower'
  } else {
    captureGuideGlobalBans('lower')
    await resetBpForGuideNextBo(stateGuide.inheritGlobalNextBoSource || 'none')
    stateGuide.bo += 1
    stateGuide.half = 'upper'
  }
  stateGuide.stepIndex = 0
  stateGuide.steps = buildBpGuideSteps(stateGuide.bo)
  renderBpGuideStep()
}

function prevBpGuideStep() {
  const stateGuide = window.bpGuideState
  if (!stateGuide.started) return
  clearBpGuideLock()
  closePickModal()
  if (stateGuide.stepIndex > 0) {
    stateGuide.stepIndex -= 1
    renderBpGuideStep()
  }
}

// 初始化
Promise.allSettled([loadCharacters(), loadState()]).then(() => {
  // Initialize Map Selects (External Data)
  initMapSelects().then(() => {
    // Initialize new Manager
    if (window.baseManager) {
      window.baseManager.init();
    }
    initLocalTeamManagerUI()
  });

  updateDisplay()
  updateCharacterStatus()
  if (autoGlobalBan.enabled) applyAutoGlobalBans()
})

if (window.electronAPI && typeof window.electronAPI.onLocalBpStateUpdate === 'function') {
  window.electronAPI.onLocalBpStateUpdate((nextState) => {
    applyLocalBpStateFromUpdateData(nextState)
  })
}

// 监听外部更新 (例如从main.html导入Idvevent数据)
window.addEventListener('storage', (e) => {
  if (e.key === MATCH_BASE_KEY) {
    console.log('[LocalBP] 检测到外部更新，刷新对局基础信息')
    if (window.baseManager) {
      window.baseManager.load();
      window.baseManager.render();
    }
  }
})

// 同一窗口下的自定义事件
window.addEventListener('local-bp-update', () => {
  console.log('[LocalBP] 收到更新事件，刷新表单')
  if (window.baseManager) {
    window.baseManager.load();
    window.baseManager.render();
  }
})

/* ========== 拼音搜索功能 ========== */
/* ========== 拼音搜索功能 ========== */
let CHAR_PY_MAP = {
  // 会从 roles.json 动态加载
};

function getSearchScore(name, query) {
  if (!query) return 0;
  const q = query.toLowerCase();
  // Name match
  if (name.includes(q)) return 100;
  // Pinyin match
  const entry = CHAR_PY_MAP[name];
  if (entry) {
    const initials = (entry.initials || '').toLowerCase();
    const full = (entry.full || '').toLowerCase();
    if (initials === q) return 90;
    if (initials.startsWith(q)) return 80;
    if (full.startsWith(q)) return 70;
  }
  return 0;
}

function handleSlotSearch(input, index, type) {
  const val = input.value.trim();
  const list = type === 'survivor' ? characters.survivors : characters.hunters;

  if (!val) {
    input.style.borderColor = '';
    input.title = '';
    return;
  }

  const best = list.map(c => ({ name: c, score: getSearchScore(c, val) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (best) {
    input.style.borderColor = '#48bb78';
    input.title = "匹配: " + best.name;
  } else {
    input.style.borderColor = '#f56565';
    input.title = "无匹配";
  }
}

async function handleSlotSearchKey(e, index, type) {
  // Stop propagation to avoid triggering parent click (open modal)
  e.stopPropagation();

  if (e.key === 'Enter') {
    const input = e.target;
    const val = input.value.trim();
    if (!val) return;

    const list = type === 'survivor' ? characters.survivors : characters.hunters;
    const best = list.map(c => ({ name: c, score: getSearchScore(c, val) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (best) {
      if (isBanned(best.name)) {
        input.style.borderColor = '#f56565';
        input.style.backgroundColor = '#fed7d7';
        setTimeout(() => {
          input.style.borderColor = '';
          input.style.backgroundColor = 'white';
        }, 500);
        return;
      }

      // Select
      if (type === 'survivor') {
        await window.electronAPI.invoke('localBp:setSurvivor', { index, character: best.name });
        state.survivors[index] = best.name;
      } else {
        await window.electronAPI.invoke('localBp:setHunter', best.name);
        state.hunter = best.name;
      }

      updateDisplay();
      updateCharacterStatus();
      input.value = '';
      input.blur();
    }
  }
}

function handleBanSearch(input, type) {
  const val = input.value.trim();
  let list;
  if (type.includes('survivor')) list = characters.survivors;
  else list = characters.hunters;

  if (!val) {
    input.style.borderColor = '';
    input.title = '';
    return;
  }

  const best = list.map(c => ({ name: c, score: getSearchScore(c, val) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (best) {
    input.style.borderColor = '#48bb78';
    input.title = "匹配: " + best.name;
  } else {
    input.style.borderColor = '#f56565';
    input.title = "无匹配";
  }
}

async function handleBanSearchKey(e, type) {
  if (e.key === 'Enter') {
    const input = e.target;
    const val = input.value.trim();
    if (!val) return;

    let list;
    if (type.includes('survivor')) list = characters.survivors;
    else list = characters.hunters;

    const best = list.map(c => ({ name: c, score: getSearchScore(c, val) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (best) {
      // Check if already banned (optional, depending on type)
      // Just add it directly
      if (type === 'ban-survivor') {
        await window.electronAPI.invoke('localBp:addBanSurvivor', best.name);
        if (!state.hunterBannedSurvivors.includes(best.name)) state.hunterBannedSurvivors.push(best.name);
      } else if (type === 'ban-hunter') {
        await window.electronAPI.invoke('localBp:addBanHunter', best.name);
        if (!state.survivorBannedHunters.includes(best.name)) state.survivorBannedHunters.push(best.name);
      } else if (type === 'global-survivor') {
        await window.electronAPI.invoke('localBp:addGlobalBanSurvivor', best.name);
        if (!state.globalBannedSurvivors.includes(best.name)) state.globalBannedSurvivors.push(best.name);
      } else if (type === 'global-hunter') {
        await window.electronAPI.invoke('localBp:addGlobalBanHunter', best.name);
        if (!state.globalBannedHunters.includes(best.name)) state.globalBannedHunters.push(best.name);
      }

      updateDisplay();
      updateCharacterStatus();
      input.value = '';
      input.blur();
    }
  }
}

// ========== 倒计时控制 (Local BP) ==========
let localTimerInterval = null
let localTimerRemaining = 0
let localTimerTotal = 60
let localTimerIndeterminate = false

function startLocalTimer() {
  const durationInput = document.getElementById('localTimerDuration')
  const duration = parseInt(durationInput.value) || 60

  if (localTimerInterval) {
    clearInterval(localTimerInterval)
  }

  if (localTimerRemaining <= 0) {
    localTimerRemaining = duration
    localTimerTotal = duration
  } else {
    // Resuming, ensure total is valid
    if (localTimerTotal < localTimerRemaining) localTimerTotal = duration
  }

  updateLocalTimerDisplay()

  localTimerInterval = setInterval(() => {
    localTimerRemaining--
    updateLocalTimerDisplay()

    if (localTimerRemaining <= 0) {
      clearInterval(localTimerInterval)
      localTimerInterval = null
    }
  }, 1000)
}

function pauseLocalTimer() {
  if (localTimerInterval) {
    clearInterval(localTimerInterval)
    localTimerInterval = null
  }
}

function resetLocalTimer() {
  if (localTimerInterval) {
    clearInterval(localTimerInterval)
    localTimerInterval = null
  }
  const durationInput = document.getElementById('localTimerDuration')
  localTimerRemaining = parseInt(durationInput.value) || 60
  localTimerTotal = localTimerRemaining
  updateLocalTimerDisplay()
}

function toggleTimerIndeterminate() {
  const checkbox = document.getElementById('localTimerIndeterminate')
  if (checkbox) {
    localTimerIndeterminate = checkbox.checked
    updateLocalTimerDisplay()
  }
}

function updateLocalTimerDisplay() {
  const display = document.getElementById('localTimerDisplay')
  if (!display) return

  // 防止负数
  if (localTimerRemaining < 0) localTimerRemaining = 0

  const minutes = Math.floor(localTimerRemaining / 60)
  const seconds = localTimerRemaining % 60
  display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`

  if (localTimerRemaining <= 10) {
    display.style.color = '#e53e3e' // Red for warning
  } else {
    display.style.color = '#2d3748'
  }

  // 同步到前台
  if (window.electronAPI && window.electronAPI.sendToFrontend) {
    window.electronAPI.sendToFrontend({
      type: 'timer',
      remaining: localTimerRemaining,
      total: localTimerTotal,
      indeterminate: localTimerIndeterminate
    })
  }
}

/**
 * 切换区域的展开/折叠状态
 * @param {string} id 区域ID
 */
function toggleCollapsible(id) {
  const element = document.getElementById(id);
  if (element) {
    element.classList.toggle('collapsed');
    const isCollapsed = element.classList.contains('collapsed');
    localStorage.setItem(`collapsed_${id}`, isCollapsed);
    console.log(`✨ [${id}] ${isCollapsed ? '收起来啦 (つ´ω`)つ' : '展开啦 (ﾉ>ω<)ﾉ'}`);
  }
}

// 页面加载初始化
window.addEventListener('DOMContentLoaded', () => {
  // 恢复折叠状态
  const sections = ['bp-top-section', 'baseinfo-top-section'];
  sections.forEach(id => {
    const isCollapsed = localStorage.getItem(`collapsed_${id}`) === 'true';
    const element = document.getElementById(id);
    if (element && isCollapsed) {
      element.classList.add('collapsed');
    }
  });

  if (!isGuideOnly) {
    initLocalBpModuleLayout()
    ensureLocalBpModulesOnPageReady('bp')
  }

  loadLocalBpConsoleBgSettings()
  syncDefaultImagesToMainProcess()
  updateDisplay()
  initGlobalShortcuts()
  renderAutoGlobalBanUI()
  initAutoGlobalBanDnD()
  if (isGuideOnly) {
    if (!matchBase) loadMatchBase()
    openBpGuide()
  } else {
    resetInteractionOverlays()
    resetSearchInputs()
    unlockAllInputs()
  }
})

window.addEventListener('beforeunload', () => {
  stopLocalBpOcrLoop()
  if (localBpConsoleBgSaveTimer) {
    clearTimeout(localBpConsoleBgSaveTimer)
    localBpConsoleBgSaveTimer = null
  }
  if (localBpOcrInstallPollTimer) {
    clearInterval(localBpOcrInstallPollTimer)
    localBpOcrInstallPollTimer = null
  }
})

// ==========================================
// Shortcut & Command Palette System
// ==========================================

function initGlobalShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+T: Toggle Command Palette
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') {
      e.preventDefault()
      toggleCommandPalette()
      return
    }

    // Command Palette Logic
    if (document.getElementById('commandPaletteOverlay').style.display === 'flex') {
      if (e.key === 'Enter') {
        const input = document.getElementById('commandInput')
        executeCommand(input.value)
      } else if (e.key === 'Escape') {
        toggleCommandPalette()
      }
      return // Block other shortcuts when palette is open
    }

    // Arrow Keys: Switch Tabs
    // Only if not focused on an input
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      if (e.key === 'ArrowLeft') {
        navigateTab(-1)
      } else if (e.key === 'ArrowRight') {
        navigateTab(1)
      }
    }
  })
}

function navigateTab(direction) {
  const pages = ['bp', 'ocr', 'baseinfo', 'talents', 'score', 'postmatch']
  // Find current active tab
  const activeTab = document.querySelector('.menu-tab.active')
  if (!activeTab) return

  const currentId = activeTab.dataset.page
  const currentIndex = pages.indexOf(currentId)
  if (currentIndex === -1) return

  let newIndex = currentIndex + direction
  if (newIndex < 0) newIndex = pages.length - 1
  if (newIndex >= pages.length) newIndex = 0

  switchPage(pages[newIndex])
}

function toggleCommandPalette() {
  const overlay = document.getElementById('commandPaletteOverlay')
  const input = document.getElementById('commandInput')
  if (overlay.style.display === 'none' || !overlay.style.display || overlay.style.display === '') {
    overlay.style.display = 'flex'
    input.value = ''
    input.focus()
  } else {
    overlay.style.display = 'none'
  }
}

async function executeCommand(rawCmd) {
  const cmd = rawCmd.trim().toLowerCase()
  if (!cmd) return

  // 1. Team/Map Commands
  if (cmd.startsWith('da')) {
    updateMatchBaseTeamName('A', rawCmd.substring(2).trim())
    toggleCommandPalette()
    return
  }
  if (cmd.startsWith('db')) {
    updateMatchBaseTeamName('B', rawCmd.substring(2).trim())
    toggleCommandPalette()
    return
  }
  if (cmd.startsWith('map')) {
    updateMatchBaseMapName(rawCmd.substring(3).trim())
    toggleCommandPalette()
    return
  }

  // 2. Parsers
  // We identify the action prefix first
  const actions = ['xq', 'xj', 'bq', 'bj', 'gq', 'gj']
  // Sort by length desc if we had variable length, but here all are 2.
  const action = actions.find(a => cmd.startsWith(a))

  if (!action) {
    alert('未知指令。可用: xq1mn, xjmn, bqmn, bjmn, gqmn, gjmn...')
    return
  }

  const remainder = cmd.slice(action.length)
  let index = -1
  let code = remainder

  // Special handling for xq (requires slot index)
  if (action === 'xq') {
    const idxMatch = remainder.match(/^(\d)(.+)$/)
    if (!idxMatch) {
      alert('选人指令需要指定位置 (1-4)。例: xq1mn')
      return
    }
    index = parseInt(idxMatch[1]) - 1 // 1-based to 0-based
    code = idxMatch[2]
  }

  // Determine Target Pool
  let targetList = []
  if (['xq', 'bq', 'gq'].includes(action)) {
    targetList = characters.survivors
  } else {
    targetList = characters.hunters
  }

  // Fuzzy Search Character
  let best = null
  let maxScore = 0
  for (const char of targetList) {
    const score = getSearchScore(char, code)
    if (score > maxScore) {
      maxScore = score
      best = char
    }
  }

  if (!best || maxScore <= 0) {
    alert('未找到角色: ' + code)
    return
  }

  // Execute Logic
  try {
    switch (action) {
      case 'xq': // Pick Survivor (Slot)
        if (index >= 0 && index <= 3) {
          await window.electronAPI.invoke('localBp:setSurvivor', { index, character: best })
          state.survivors[index] = best
        } else {
          alert('位置错误 (1-4)')
          return
        }
        break
      case 'xj': // Pick Hunter
        await window.electronAPI.invoke('localBp:setHunter', best)
        state.hunter = best
        break
      case 'bq': // Ban Survivor (Append)
        // User requested "bqmn" format (no index), implies adding to ban list
        await window.electronAPI.invoke('localBp:addBanSurvivor', best)
        if (!state.hunterBannedSurvivors.includes(best)) state.hunterBannedSurvivors.push(best)
        break
      case 'bj': // Ban Hunter (Append)
        await window.electronAPI.invoke('localBp:addBanHunter', best)
        if (!state.survivorBannedHunters.includes(best)) state.survivorBannedHunters.push(best)
        break
      case 'gq': // Global Ban Survivor
        await window.electronAPI.invoke('localBp:addGlobalBanSurvivor', best)
        if (!state.globalBannedSurvivors.includes(best)) state.globalBannedSurvivors.push(best)
        break
      case 'gj': // Global Ban Hunter
        await window.electronAPI.invoke('localBp:addGlobalBanHunter', best)
        if (!state.globalBannedHunters.includes(best)) state.globalBannedHunters.push(best)
        break
    }

    updateDisplay()
    updateCharacterStatus()
    toggleCommandPalette()

  } catch (e) {
    console.error(e)
    alert('执行失败: ' + e.message)
  }
}
