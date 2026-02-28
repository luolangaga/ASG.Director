// OBS浏览器模式兼容层
if (!window.electronAPI) {
  console.log('[Scoreboard] OBS模式：创建兼容API层')
  window.__ASG_OBS_MODE__ = true
  function encodePathSegments(pathValue) {
    return String(pathValue || '')
      .split('/')
      .map(seg => encodeURIComponent(seg))
      .join('/')
  }
  window.__rewriteAssetPath__ = function (src) {
    if (!src) return src
    const raw = String(src).trim()
    if (raw.startsWith('../assets/')) return raw.replace('../assets/', '/assets/')
    if (raw.startsWith('./assets/')) return raw.replace('./assets/', '/assets/')
    if (raw.startsWith('./js/')) return raw.replace('./js/', '/js/')
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw

    let normalized = raw
    if (/^file:\/\//i.test(normalized)) {
      normalized = normalized.replace(/^file:\/\/\/?/i, '')
      try { normalized = decodeURIComponent(normalized) } catch {}
    }
    normalized = normalized.replace(/^\/([a-zA-Z]:[\\/])/, '$1')
    normalized = normalized.replace(/\//g, '\\')

    const bgMatch = normalized.match(/[\\/]background[\\/](.+)$/i)
    if (bgMatch && bgMatch[1]) {
      const relative = bgMatch[1].replace(/\\/g, '/')
      return '/background/' + encodePathSegments(relative)
    }

    const userDataMatch = normalized.match(/[\\/](asg[.-]director)[\\/](.+)$/i)
    if (userDataMatch && userDataMatch[2]) {
      const relative = userDataMatch[2].replace(/\\/g, '/')
      return '/userdata/' + encodePathSegments(relative)
    }

    if (/^[a-zA-Z]:[\\/]/.test(normalized) || normalized.startsWith('\\')) {
      const fileStyle = normalized.replace(/\\/g, '/')
      return fileStyle.startsWith('/') ? `file://${encodeURI(fileStyle)}` : `file:///${encodeURI(fileStyle)}`
    }

    return src
  }
  const originalImageSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    set: function (value) {
      const rewritten = window.__rewriteAssetPath__(value)
      originalImageSrcDescriptor.set.call(this, rewritten)
    },
    get: originalImageSrcDescriptor.get
  })
  window.electronAPI = {
    getScoreboardLayout: async (team) => {
      try {
        const resp = await fetch(`/api/scoreboard-layout?team=${team}`)
        const data = await resp.json()
        return data && data.success ? { success: true, layout: data.layout } : { success: true, layout: null }
      } catch (e) { return { success: true, layout: null } }
    },
    saveScoreboardLayout: async () => ({ success: true }),
    getCustomFonts: async () => ({ success: true, fonts: [] }),
    getFontUrl: async () => ({ success: false }),
    onReloadLayoutFromPack: () => { }
  }
}

let team = 'teamA', roomId = '', scoreData = { bos: [] }, editMode = false, layout = {}, availableFonts = [], activeFontContainerId = null
const DEFAULT_LAYOUT_BASE_SIZE = { width: 1280, height: 720 }

function getLayoutBaseSize() {
  const base = layout?.baseResolution || layout?.canvasSize || layout?.baseSize || {}
  const width = Number(base.width)
  const height = Number(base.height)
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height }
  }
  return { ...DEFAULT_LAYOUT_BASE_SIZE }
}

function getRenderScale() {
  if (!window.__ASG_OBS_MODE__ || editMode) {
    return { x: 1, y: 1, font: 1 }
  }
  const base = getLayoutBaseSize()
  const x = Math.max(0.01, window.innerWidth / base.width)
  const y = Math.max(0.01, window.innerHeight / base.height)
  return { x, y, font: Math.min(x, y) }
}

async function init() {
  const urlParams = new URLSearchParams(window.location.search)
  team = urlParams.get('team') || 'teamA'
  roomId = urlParams.get('roomId') || ''

  await loadLayout()
  await loadCustomFonts()
  await loadCustomComponents() // 加载自定义组件
  loadScoreData()
  setInterval(loadScoreData, 1000)
  initDraggable()
  setupOBSMode()
  if (window.electronAPI && window.electronAPI.onUpdateData) {
    window.electronAPI.onUpdateData(handleUpdateData)
  }

  // 监听字体配置更新
  if (window.electronAPI && window.electronAPI.onFontConfigUpdated) {
    window.electronAPI.onFontConfigUpdated(async () => {
      await loadCustomFonts()
      applyLayout()
    })
  }

  // 监听自定义字体文件导入/删除（全局字体）
  if (window.electronAPI && window.electronAPI.onCustomFontsChanged) {
    window.electronAPI.onCustomFontsChanged(async () => {
      await loadCustomFonts()
      applyLayout()
    })
  }

  // 监听字体文件变更
  if (window.electronAPI && window.electronAPI.onFontFilesChanged) {
    window.electronAPI.onFontFilesChanged(async () => {
      await loadCustomFonts()
      applyLayout()
    })
  }
  window.addEventListener('keydown', e => {
    if (e.key === 'F2') toggleEditMode()
    if (e.key === 'F3' && editMode && !window.__ASG_OBS_MODE__) selectBackground()
  })
  window.addEventListener('resize', () => {
    if (window.__ASG_OBS_MODE__ && !editMode) {
      applyLayout()
    }
  })

  // 样式监听
  const sizeInput = document.getElementById('fontSizeInput')
  const sizeRange = document.getElementById('fontSizeRange')
  const colorInput = document.getElementById('textColorPicker')

  function updateStyle() {
    if (!activeFontContainerId) return
    const container = document.getElementById(activeFontContainerId)
    if (!container) return
    const inner = container.querySelector('#bigScore, #record, #teamName') || container

    if (sizeInput) {
      inner.style.fontSize = sizeInput.value + 'px'
    }
    if (colorInput) {
      inner.style.color = colorInput.value
    }
    saveLayout()
  }

  if (sizeInput && sizeRange) {
    sizeInput.addEventListener('input', () => { sizeRange.value = sizeInput.value; updateStyle(); })
    sizeRange.addEventListener('input', () => { sizeInput.value = sizeRange.value; updateStyle(); })
  }

  // 加载自定义组件 (修复版)
  async function loadCustomComponents() {
    try {
      // 获取完整布局以读取 customComponents 定义
      const res = await window.electronAPI.loadLayout()
      if (res.success && res.layout && res.layout.customComponents) {
        const comps = res.layout.customComponents.filter(c => c.targetPages && c.targetPages.includes('scoreboard'))
        console.log(`[Scoreboard] 加载 ${comps.length} 个自定义组件`)
        comps.forEach(c => createCustomComponent(c, res.layout))
      }
    } catch (e) { console.error('[Scoreboard] 加载自定义组件失败:', e) }
  }

  function createCustomComponent(comp, fullLayout) {
    if (document.getElementById(comp.id)) return

    const container = document.createElement('div')
    container.id = comp.id
    container.className = 'draggable custom-component'
    container.dataset.type = 'custom'

    // 确定位置和尺寸优先级：
    // 1. 当前比分板布局中的 elements (layout.elements[comp.id])
    // 2. 也是保存时写入的位置
    const localPos = layout.elements && layout.elements[comp.id]

    // 默认位置
    let x = 100, y = 100, w = 200, h = 100

    if (localPos) {
      x = localPos.x || 0
      y = localPos.y || 0
      w = localPos.width || 200
      h = localPos.height || 'auto'
    } else if (fullLayout && fullLayout[comp.id]) {
      // 如果比分板没存过，尝试读取全局位置作为初始值
      x = fullLayout[comp.id].x || 100
      y = fullLayout[comp.id].y || 100
      w = fullLayout[comp.id].width || 200
      h = fullLayout[comp.id].height || 'auto'
    } else {
      w = comp.width || 200
      h = comp.height || 'auto'
    }

    if (w !== 'auto') w = parseInt(w) + 'px'
    if (h !== 'auto') h = parseInt(h) + 'px'

    container.style.left = x + 'px'
    container.style.top = y + 'px'
    container.style.width = w
    container.style.height = h

    // 构造内容
    const content = document.createElement('div')
    content.className = 'custom-component-content'
    content.style.width = '100%'
    content.style.height = '100%'
    content.style.overflow = 'hidden'

    if (comp.customCss) {
      const styleId = `custom-css-${comp.id}`
      if (!document.getElementById(styleId)) {
        const s = document.createElement('style')
        s.id = styleId
        s.textContent = comp.customCss
        document.head.appendChild(s)
      }
    }

    let htmlContent = comp.html || ''

    // 图片组件特殊处理：强制拉伸
    if (comp.type === 'image') {
      // 强制使用 100% 宽高
      const imgFit = comp.objectFit || 'contain'

      // 如果 html 里的 img 标签存在，重写样式
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = htmlContent
      const img = tempDiv.querySelector('img')
      if (img) {
        img.style.width = '100%'
        img.style.height = '100%'
        img.style.objectFit = imgFit
        img.style.display = 'block'
        if ((!img.src || img.src.includes('null')) && comp.imageData) {
          img.src = comp.imageData
        }
        htmlContent = tempDiv.innerHTML
      } else if (comp.imageData || comp.imageUrl) {
        const src = comp.imageData || comp.imageUrl
        htmlContent = `<img src="${src}" style="width: 100%; height: 100%; object-fit: ${imgFit}; display: block;" draggable="false" />`
      }
    }

    content.innerHTML = htmlContent
    container.appendChild(content)

    // 添加resize handles
    const dirs = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
    dirs.forEach(d => {
      const h = document.createElement('div')
      h.className = `resize-handle ${d}`
      h.dataset.dir = d
      container.appendChild(h)
    })

    document.body.appendChild(container)

    // 注意：initDraggable 会遍历所有 .draggable，如果是后添加的，可能需要手动初始化
    // 但 scoreboard 的 initDraggable 是写死的 querySelectorAll，只运行一次。
    // 所以我们不能依赖 initDraggable 来让新添加的元素可拖拽，除非我们在 initDraggable 之前就添加好，或者重新运行 initDraggable。
    // 现在的 loadCustomComponents 是在 init() 里调用的，也就是在 initDraggable() 之前。
    // 所以只要这里 appendChild 了，后面的 initDraggable() 就能扫描到它。
  }
  if (colorInput) colorInput.addEventListener('input', updateStyle)
  document.querySelectorAll('.color-preset-inline').forEach(preset => {
    preset.addEventListener('click', (e) => {
      if (colorInput) {
        colorInput.value = e.target.dataset.color
        updateStyle()
      }
    })
  })
}

// ========= 自定义组件加载 =========
async function loadCustomComponents() {
  try {
    if (!window.electronAPI || !window.electronAPI.loadLayout) return
    const result = await window.electronAPI.loadLayout()
    if (!result.success || !result.layout || !result.layout.customComponents) return

    const components = result.layout.customComponents
    const scoreboardComponents = components.filter(c =>
      c.targetPages && c.targetPages.includes('scoreboard')
    )

    scoreboardComponents.forEach(comp => createCustomComponent(comp))
    console.log(`[Scoreboard] 加载了 ${scoreboardComponents.length} 个自定义组件`)
  } catch (e) {
    console.error('[Scoreboard] 加载自定义组件失败:', e)
  }
}

function createCustomComponent(comp) {
  if (document.getElementById(comp.id)) return

  const container = document.createElement('div')
  container.id = comp.id
  container.className = 'draggable custom-component'
  container.dataset.type = 'custom'

  const layoutEl = layout.elements?.find(el => el.id === comp.id)
  const left = layoutEl?.left || 100
  const top = layoutEl?.top || 100
  const width = layoutEl?.width || parseInt(comp.width) || 200

  container.style.cssText = `
        left: ${left}px;
        top: ${top}px;
        width: ${width}px;
        position: absolute;
        z-index: 15;
      `

  // 添加调整大小手柄
  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  handles.forEach(dir => {
    const handle = document.createElement('div')
    handle.className = `resize-handle ${dir}`
    handle.dataset.dir = dir
    container.appendChild(handle)
  })

  // 添加内容
  const content = document.createElement('div')
  content.className = 'custom-component-content'
  content.style.cssText = 'width: 100%; height: 100%; overflow: hidden;'
  if (comp.customCss) {
    const styleId = `custom-css-${comp.id}`
    let styleEl = document.getElementById(styleId)
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = comp.customCss
  }
  content.innerHTML = comp.html || ''
  container.appendChild(content)

  document.body.appendChild(container)
}

async function loadLayout() {
  if (window.electronAPI.getScoreboardLayout) {
    const res = await window.electronAPI.getScoreboardLayout(team)
    if (res.success && res.layout) {
      layout = res.layout
      applyLayout()
    }
  }
}

async function loadCustomFonts() {
  try {
    if (!window.electronAPI || !window.electronAPI.getCustomFonts) return
    const res = await window.electronAPI.getCustomFonts()
    if (!res || !res.success || !Array.isArray(res.fonts)) {
      availableFonts = []
      return
    }

    availableFonts = res.fonts
    if (!availableFonts.length) return

    for (const f of availableFonts) {
      try {
        const u = await window.electronAPI.getFontUrl(f.fileName)
        if (!u || !u.success || !u.url) continue
        const ff = new FontFace(f.fontFamily, `url(${u.url})`)
        await ff.load()
        document.fonts.add(ff)
      } catch (e) {
        console.warn('[Scoreboard] Load one custom font failed:', f?.fileName, e?.message || e)
      }
    }
  } catch (e) { console.warn('Load fonts failed', e) }
}

function applyLayout() {
  const elements = Array.isArray(layout.elements) ? layout.elements : []
  const scale = getRenderScale()
  elements.forEach(el => {
    const container = document.getElementById(el.id)
    if (container) {
      container.style.left = Math.round(el.left * scale.x) + 'px'
      container.style.top = Math.round(el.top * scale.y) + 'px'
      container.style.width = Math.round(el.width * scale.x) + 'px'
      if (el.height) container.style.height = Math.round(el.height * scale.y) + 'px'
      container.style.display = (el.hidden && !editMode) ? 'none' : 'block'
      container.classList.toggle('layout-hidden', !!el.hidden)
      if (el.fontFamily) container.style.fontFamily = `"${el.fontFamily}", sans-serif`
      else container.style.fontFamily = ''

      if (el.fontSize) {
        const inner = container.querySelector('#bigScore, #record, #teamName')
        if (inner) inner.style.fontSize = Math.max(8, Math.round(el.fontSize * scale.font)) + 'px'
      }
      if (el.textColor) {
        const inner = container.querySelector('#bigScore, #record, #teamName')
        if (inner) inner.style.color = el.textColor
      }
      if (el.zIndex !== undefined) {
        container.style.zIndex = el.zIndex
      }
      if (el.zIndex !== undefined) container.style.zIndex = el.zIndex
    }
  })
  if (layout.backgroundImage) {
    const bg = document.getElementById('backgroundImage')
    let src = layout.backgroundImage
    if (window.__ASG_OBS_MODE__ && typeof window.__rewriteAssetPath__ === 'function') {
      src = window.__rewriteAssetPath__(src)
    } else if (!src.startsWith('file:')) {
      const normalized = src.replace(/\\/g, '/')
      src = normalized.startsWith('/') ? `file://${encodeURI(normalized)}` : `file:///${encodeURI(normalized)}`
    }
    bg.src = src
    bg.style.display = 'block'
  }
}

async function saveLayout() {
  const elements = []
  document.querySelectorAll('.draggable').forEach(el => {
    const fontSize = el.querySelector('#bigScore, #record, #teamName')?.style.fontSize
    elements.push({
      id: el.id,
      left: parseInt(el.style.left) || 0,
      top: parseInt(el.style.top) || 0,
      width: parseInt(el.style.width) || 0,
      height: parseInt(el.style.height) || 0,
      fontSize: fontSize ? parseInt(fontSize) : null,
      textColor: el.querySelector('#bigScore, #record, #teamName')?.style.color || null,
      fontFamily: el.style.fontFamily ? el.style.fontFamily.replace(/"/g, '').split(',')[0].trim() : null,
      hidden: el.classList.contains('layout-hidden'),
      zIndex: parseInt(el.style.zIndex) || 0
    })
  })
  layout.elements = elements
  layout.baseResolution = {
    width: Math.max(1, Math.round(window.innerWidth || DEFAULT_LAYOUT_BASE_SIZE.width)),
    height: Math.max(1, Math.round(window.innerHeight || DEFAULT_LAYOUT_BASE_SIZE.height))
  }
  await window.electronAPI.saveScoreboardLayout(team, layout)
}

function toggleEditMode() {
  editMode = !editMode
  document.body.classList.toggle('edit-mode', editMode)
  if (!editMode) saveLayout()
  applyLayout()
}

async function selectBackground() {
  const res = await window.electronAPI.selectScoreboardBackground(team)
  if (res.success && res.path) {
    layout.backgroundImage = res.path
    applyLayout()
    await saveLayout()
  }
}

// Font selection
async function openFontSelector(containerId) {
  // 每次打开字体面板都刷新一次字体列表，避免“导入后不显示”
  await loadCustomFonts()
  activeFontContainerId = containerId
  const list = document.getElementById('fontSelectorList')
  let html = '<div class="font-selector-item" onclick="selectFont(\'\')">系统默认</div>'
  html += availableFonts.map(f => `<div class="font-selector-item" style="font-family:'${f.fontFamily}';" onclick="selectFont('${f.fontFamily}')">${f.fontFamily}</div>`).join('')
  list.innerHTML = html

  const container = document.getElementById(containerId)
  if (container) {
    const inner = container.querySelector('#bigScore, #record, #teamName') || container
    const style = window.getComputedStyle(inner)
    const fontSize = parseInt(style.fontSize) || 20
    const sizeInput = document.getElementById('fontSizeInput')
    const sizeRange = document.getElementById('fontSizeRange')
    if (sizeInput) sizeInput.value = fontSize
    if (sizeRange) sizeRange.value = fontSize

    let hex = '#ffffff'
    const rgb = style.color.match(/\d+/g)
    if (rgb) {
      hex = '#' + rgb.map(x => parseInt(x).toString(16).padStart(2, '0')).join('')
    }
    const picker = document.getElementById('textColorPicker')
    if (picker) picker.value = hex
  }

  document.getElementById('fontSelectorModal').classList.add('show')
}
window.selectFont = async (fontFamily) => {
  const el = document.getElementById(activeFontContainerId)
  if (el) {
    el.style.fontFamily = fontFamily ? `"${fontFamily}", sans-serif` : ''
    await saveLayout()
  }
  closeFontSelector()
}
function closeFontSelector() {
  document.getElementById('fontSelectorModal').classList.remove('show')
  activeFontContainerId = null
}

// 统一右键菜单
function showUnifiedContextMenu(e, container) {
  e.preventDefault()
  e.stopPropagation()
  const existing = document.getElementById('unified-context-menu')
  if (existing) existing.remove()

  const menu = document.createElement('div')
  menu.id = 'unified-context-menu'
  Object.assign(menu.style, {
    position: 'fixed',
    left: `${e.clientX}px`,
    top: `${e.clientY}px`,
    backgroundColor: '#1f1f1f',
    border: '1px solid #333',
    borderRadius: '6px',
    padding: '6px 0',
    zIndex: '100000',
    boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
    minWidth: '160px',
    fontFamily: "'Segoe UI', 'Microsoft YaHei', sans-serif",
    fontSize: '14px',
    backdropFilter: 'blur(10px)',
    color: '#e0e0e0'
  })

  const createItem = (label, icon, onClick) => {
    const item = document.createElement('div')
    item.style.padding = '8px 16px'
    item.style.cursor = 'pointer'
    item.style.display = 'flex'
    item.style.alignItems = 'center'
    item.style.gap = '8px'
    item.style.transition = 'background 0.2s'

    const iconSpan = document.createElement('span')
    iconSpan.textContent = icon
    item.appendChild(iconSpan)

    const textSpan = document.createElement('span')
    textSpan.textContent = label
    item.appendChild(textSpan)

    item.onmouseenter = () => item.style.backgroundColor = 'rgba(255,255,255,0.1)'
    item.onmouseleave = () => item.style.backgroundColor = 'transparent'
    item.onclick = (ev) => {
      ev.stopPropagation()
      menu.remove()
      onClick()
    }
    return item
  }

  const isHidden = container.classList.contains('layout-hidden')

  // 1. 隐藏/显示
  menu.appendChild(createItem(isHidden ? '显示组件' : '隐藏组件', isHidden ? '👁️' : '🚫', () => {
    container.classList.toggle('layout-hidden')
    saveLayout()
  }))

  // 2. 修改文字属性
  menu.appendChild(createItem('修改字体/颜色', '🎨', () => {
    openFontSelector(container.id)
  }))

  // 3. 图层顺序
  const layerMenu = document.createElement('div')
  layerMenu.style.display = 'flex'
  layerMenu.style.flexDirection = 'column'
  layerMenu.style.borderTop = '1px solid #333'
  layerMenu.style.marginTop = '4px'
  layerMenu.style.paddingTop = '4px'

  const updateZIndex = (newIdx) => {
    container.style.zIndex = newIdx
    saveLayout()
  }

  const getCurrentZ = () => {
    const s = window.getComputedStyle(container)
    const z = parseInt(s.zIndex)
    return isNaN(z) ? 0 : z
  }

  layerMenu.appendChild(createItem('置于顶层', '⬆️', () => {
    let maxZ = 0
    document.querySelectorAll('.draggable').forEach(el => {
      const z = parseInt(window.getComputedStyle(el).zIndex) || 0
      if (z > maxZ) maxZ = z
    })
    updateZIndex(maxZ + 1)
  }))

  layerMenu.appendChild(createItem('上移一层', '🔼', () => { updateZIndex(getCurrentZ() + 1) }))
  layerMenu.appendChild(createItem('下移一层', '🔽', () => { updateZIndex(Math.max(1, getCurrentZ() - 1)) }))

  layerMenu.appendChild(createItem('置于底层', '⬇️', () => {
    let minZ = 100
    document.querySelectorAll('.draggable').forEach(el => {
      const z = parseInt(window.getComputedStyle(el).zIndex) || 0
      if (z > 0 && z < minZ) minZ = z
    })
    if (minZ === 100) minZ = 1
    const target = minZ - 1
    updateZIndex(target < 1 ? 1 : target)
  }))
  menu.appendChild(layerMenu)

  document.body.appendChild(menu)

  setTimeout(() => {
    const closeMenu = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove()
        removeListeners()
      }
    }
    const removeListeners = () => {
      document.removeEventListener('click', closeMenu)
      document.removeEventListener('contextmenu', closeMenu)
    }
    document.addEventListener('click', closeMenu)
    document.addEventListener('contextmenu', closeMenu)
  }, 10)
}

function initDraggable() {
  const containers = document.querySelectorAll('.draggable')
  let activeContainer = null, isDragging = false, isResizing = false, resizeDir = null
  let startX, startY, startLeft, startTop, startWidth, startHeight, lastDx, lastDy
  const SNAP = 10, snapLineV = document.getElementById('snapLineV'), snapLineH = document.getElementById('snapLineH'), coordDisplay = document.getElementById('coordDisplay')
  let rafId = null, pendingUpdate = null

  function updatePosition() {
    if (!pendingUpdate || !activeContainer) return
    let { dx, dy } = pendingUpdate
    let newLeft = startLeft + dx, newTop = startTop + dy
    if (isDragging) {
      let snapLinesX = [window.innerWidth / 2], snapLinesY = [window.innerHeight / 2]
      document.querySelectorAll('.draggable').forEach(other => {
        if (other !== activeContainer && other.style.display !== 'none') {
          const r = other.getBoundingClientRect()
          snapLinesX.push(r.left, r.left + r.width / 2, r.right)
          snapLinesY.push(r.top, r.top + r.height / 2, r.bottom)
        }
      })
      let tx = null; for (let s of snapLinesX) if (Math.abs(newLeft - s) < SNAP) { tx = s; break }
      if (tx !== null) { dx = tx - startLeft; newLeft = tx; snapLineV.style.left = tx + 'px'; snapLineV.style.display = 'block' } else snapLineV.style.display = 'none'
      let ty = null; for (let s of snapLinesY) if (Math.abs(newTop - s) < SNAP) { ty = s; break }
      if (ty !== null) { dy = ty - startTop; newTop = ty; snapLineH.style.top = ty + 'px'; snapLineH.style.display = 'block' } else snapLineH.style.display = 'none'
    }
    lastDx = dx; lastDy = dy
    if (isDragging) {
      activeContainer.style.left = `${newLeft}px`
      activeContainer.style.top = `${newTop}px`
      coordDisplay.textContent = `X: ${Math.round(newLeft)} | Y: ${Math.round(newTop)}`
      coordDisplay.classList.add('show')
    } else if (isResizing) {
      let w = startWidth, h = startHeight, l = startLeft, t = startTop
      if (resizeDir.includes('e')) w += dx; if (resizeDir.includes('w')) { w -= dx; l += dx }
      if (resizeDir.includes('s')) h += dy; if (resizeDir.includes('n')) { h -= dy; t += dy }
      if (w > 50) { activeContainer.style.width = w + 'px'; if (resizeDir.includes('w')) activeContainer.style.left = l + 'px' }
      if (h > 50) { activeContainer.style.height = h + 'px'; if (resizeDir.includes('n')) activeContainer.style.top = t + 'px' }
    }
    pendingUpdate = null; rafId = null
  }

  document.addEventListener('mousedown', e => {
    if (!editMode) return
    if (e.button !== 0) return

    const draggable = e.target.closest('.draggable')
    if (!draggable) return

    if (e.target.classList.contains('resize-handle')) {
      isResizing = true
      resizeDir = e.target.dataset.dir
    } else {
      isDragging = true
    }

    activeContainer = draggable
    startX = e.clientX
    startY = e.clientY
    startLeft = draggable.offsetLeft
    startTop = draggable.offsetTop
    startWidth = draggable.offsetWidth
    startHeight = draggable.offsetHeight
    lastDx = 0
    lastDy = 0
    draggable.style.transform = ''
    document.body.classList.add('is-dragging')
    e.preventDefault()
    e.stopPropagation()
  })

  containers.forEach(c => {
    c.addEventListener('dblclick', e => {
      if (!editMode) return
      e.preventDefault()
      e.stopPropagation()
      openFontSelector(c.id)
    })
    c.addEventListener('contextmenu', e => {
      if (!editMode) return
      showUnifiedContextMenu(e, c)
    })
  })

  document.addEventListener('mousemove', e => {
    if (!editMode || (!isDragging && !isResizing) || !activeContainer) return
    pendingUpdate = { dx: e.clientX - startX, dy: e.clientY - startY }
    if (!rafId) rafId = requestAnimationFrame(updatePosition)
  })

  document.addEventListener('mouseup', () => {
    if (activeContainer && (isDragging || isResizing)) {
      saveLayout()
    }
    isDragging = isResizing = false
    activeContainer = null
    snapLineV.style.display = snapLineH.style.display = 'none'
    coordDisplay.classList.remove('show')
    document.body.classList.remove('is-dragging')
  })
}

function handleUpdateData(data) {
  if (!data) return
  if (data.type === 'score' && data.scoreData) {
    scoreData = data.scoreData
    updateDisplay()
    return
  }
  if (data.scoreData) {
    scoreData = data.scoreData
    updateDisplay()
    return
  }
  if (data.state && data.state.bos) {
    scoreData = data.state
    updateDisplay()
  }
}
function loadScoreData() { if (roomId) { const s = localStorage.getItem('score_' + roomId); if (s) { scoreData = JSON.parse(s); updateDisplay() } } }

function normalizeDisplayHalf(value) {
  return value === 'lower' ? 'lower' : 'upper'
}

function resolveDisplayConfig(raw) {
  const modeLegacy = raw?.scoreboardDisplay?.[team] || raw?.scoreboardDisplay?.teamA || 'auto'
  const cfg = (raw?.displayConfig && typeof raw.displayConfig === 'object') ? raw.displayConfig : null
  const auto = (typeof cfg?.auto === 'boolean') ? cfg.auto : (modeLegacy === 'auto')
  const round = parseInt(cfg?.round, 10) || parseInt(raw?.currentRound, 10) || 1
  const halfFromLegacy = modeLegacy === 'upper' || modeLegacy === 'lower'
    ? modeLegacy
    : ((parseInt(raw?.currentHalf, 10) || 1) === 2 ? 'lower' : 'upper')
  const half = normalizeDisplayHalf(cfg?.half || halfFromLegacy)
  return { auto, round, half }
}

function resolveTargetBoAndHalf(raw) {
  const bos = Array.isArray(raw?.bos) ? raw.bos : []
  if (!bos.length) return { bo: null, half: 'upper' }
  const cfg = resolveDisplayConfig(raw)

  if (cfg.auto) {
    for (let i = bos.length - 1; i >= 0; i--) {
      const bo = bos[i]
      const hasLower = (parseInt(bo?.lower?.teamA, 10) || 0) > 0 || (parseInt(bo?.lower?.teamB, 10) || 0) > 0
      const hasUpper = (parseInt(bo?.upper?.teamA, 10) || 0) > 0 || (parseInt(bo?.upper?.teamB, 10) || 0) > 0
      if (hasLower) return { bo, half: 'lower' }
      if (hasUpper) return { bo, half: 'upper' }
    }
    return { bo: bos[0], half: 'upper' }
  }

  const idx = Math.min(bos.length - 1, Math.max(0, cfg.round - 1))
  return { bo: bos[idx], half: cfg.half }
}

function updateDisplay() {
  const isA = team === 'teamA'
  let s = 0
  const target = resolveTargetBoAndHalf(scoreData)
  const targetBo = target.bo
  const targetHalf = target.half

  if (targetBo) {
    const halfData = targetBo[targetHalf] || {}
    s = isA ? (parseInt(halfData.teamA, 10) || 0) : (parseInt(halfData.teamB, 10) || 0)
  }

  document.getElementById('bigScore').textContent = s
  document.getElementById('teamName').textContent = isA ? (scoreData.teamAName || 'A队') : (scoreData.teamBName || 'B队')
  const logo = isA ? scoreData.teamALogo : scoreData.teamBLogo; if (logo) { const l = document.getElementById('teamLogo'); const rev = scoreData.__assetRev ? `?rev=${scoreData.__assetRev}` : ''; l.src = logo + rev; l.style.display = 'block' } else { document.getElementById('teamLogo').style.display = 'none' }
  const wins = isA ? scoreData.teamAWins : scoreData.teamBWins, draws = isA ? scoreData.teamADraws : scoreData.teamBDraws, comp = scoreData.bos.filter(b => (b.upper.teamA > 0 || b.upper.teamB > 0) && (b.lower.teamA > 0 || b.lower.teamB > 0)).length
  document.getElementById('record').textContent = `${wins}胜 ${draws}平 ${comp - wins - draws}负`

  const list = document.getElementById('boList'); list.innerHTML = ''
  const currentActiveIdx = scoreData.bos.indexOf(targetBo)
  scoreData.bos.forEach((b, i) => {
    const item = document.createElement('div'); item.className = 'bo-item';
    if (i === currentActiveIdx) {
      item.style.borderColor = '#ffd700';
      item.style.boxShadow = '0 0 10px rgba(255,215,0,0.5)';
    }
    const myU = isA ? b.upper.teamA : b.upper.teamB, opU = isA ? b.upper.teamB : b.upper.teamA, myL = isA ? b.lower.teamA : b.lower.teamB, opL = isA ? b.lower.teamB : b.lower.teamA, myT = myU + myL, opT = opU + opL
    let res = '待定', cls = 'pending'; if (myT > 0 || opT > 0) { if (myT > opT) { res = '胜'; cls = 'win' } else if (myT < opT) { res = '负'; cls = 'lose' } else { res = '平'; cls = 'draw' } }
    item.innerHTML = `<div class="bo-header">第${i + 1}个BO</div><div class="bo-half"><span class="bo-half-label">上半局:</span><span class="bo-half-score ${myU > opU ? 'win' : myU < opU ? 'lose' : myU ? 'draw' : ''}">${myU} : ${opU}</span></div><div class="bo-half"><span class="bo-half-label">下半局:</span><span class="bo-half-score ${myL > opL ? 'win' : myL < opL ? 'lose' : myL ? 'draw' : ''}">${myL} : ${opL}</span></div><div class="bo-result ${cls}">${res}</div>`
    list.appendChild(item)
  })
}
function setupOBSMode() {
  if (window.__ASG_OBS_MODE__) {
    window.addEventListener('asg-state-update', e => {
      handleUpdateData(e.detail)
    })
  }
}

init()
