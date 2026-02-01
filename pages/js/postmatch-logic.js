// OBS浏览器模式兼容层
if (!window.electronAPI) {
  console.log('[PostMatch] OBS模式：创建兼容API层')

  // 标记为 OBS 模式
  window.__ASG_OBS_MODE__ = true

  // 图片路径重写函数（OBS模式下将相对路径转为绝对路径）
  window.__rewriteAssetPath__ = function (src) {
    if (!src) return src
    if (src.startsWith('../assets/')) return src.replace('../assets/', '/assets/')
    if (src.startsWith('./assets/')) return src.replace('./assets/', '/assets/')
    if (src.startsWith('./js/')) return src.replace('./js/', '/js/')

    // file:///C:/.../asg-director/background/xxx.png -> /background/xxx.png
    if (src.startsWith('file:///')) {
      const bgMatch = src.match(/asg-director[\/\\]background[\/\\](.+)$/i)
      if (bgMatch) return '/background/' + bgMatch[1].replace(/\\/g, '/')

      const match = src.match(/asg-director[\/\\](.+)$/i)
      if (match) return '/userdata/' + match[1].replace(/\\/g, '/')
    }

    return src
  }

  // 重写 Image 对象的 src 属性setter
  const originalImageSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    set: function (value) {
      const rewritten = window.__rewriteAssetPath__(value)
      if (rewritten !== value) console.log('[OBS Mode] 图片路径重写:', value, '->', rewritten)
      originalImageSrcDescriptor.set.call(this, rewritten)
    },
    get: originalImageSrcDescriptor.get
  })

  window.electronAPI = {
    getPostMatchLayout: async () => {
      try {
        console.log('[OBS Mode] 正在从服务器获取赛后数据布局...')
        const resp = await fetch('/api/postmatch-layout')
        const data = await resp.json()

        // 同时获取透明背景设置
        try {
          const tbResp = await fetch('/api/transparent-background')
          const tbData = await tbResp.json()
          if (tbData && tbData.success && tbData.transparentBackground) {
            if (data && data.layout) {
              data.layout.transparentBackground = true
            } else if (data) {
              data.layout = { transparentBackground: true }
            }
          }
        } catch (e) {
          console.warn('[OBS Mode] 获取透明背景设置失败:', e)
        }

        if (data && data.success && data.layout) {
          console.log('[OBS Mode] 成功获取赛后数据布局:', data.layout)
          return { success: true, layout: data.layout }
        }
        return { success: true, layout: null }
      } catch (e) {
        console.error('[OBS Mode] 获取赛后数据布局失败:', e)
        return { success: true, layout: null }
      }
    },
    savePostMatchLayout: async (layout) => ({ success: true }),
    selectPostMatchBackground: async () => ({ success: false, error: 'OBS模式下不支持' }),
    onReloadLayoutFromPack: (callback) => { },
    invoke: async () => false,
    send: () => { }
  }
}

let roomId = ''
let editMode = false
let layout = {}
let availableFonts = []
let activeFontContainerId = null

function rgbToHex(color) {
  if (!color) return '#ffffff'
  if (color.startsWith('#')) return color
  const rgb = color.match(/\d+/g)
  if (!rgb) return '#ffffff'
  return '#' + rgb.slice(0, 3).map(x => {
    const hex = parseInt(x, 10).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

// Font selection logic
async function openFontSelector(containerId) {
  activeFontContainerId = containerId
  const list = document.getElementById('fontSelectorList')
  let html = '<div class="font-selector-item" onclick="selectFont(\'\')">系统默认</div>'
  html += availableFonts.map(f => `<div class="font-selector-item" style="font-family:'${f.fontFamily}';" onclick="selectFont('${f.fontFamily}')">${f.fontFamily}</div>`).join('')
  list.innerHTML = html
  const container = document.getElementById(containerId)
  if (container) {
    const style = window.getComputedStyle(container)
    const fontSize = parseInt(style.fontSize) || 16
    const sizeInput = document.getElementById('fontSizeInput')
    const sizeRange = document.getElementById('fontSizeRange')
    if (sizeInput) sizeInput.value = fontSize
    if (sizeRange) sizeRange.value = fontSize
    const picker = document.getElementById('textColorPicker')
    if (picker) picker.value = rgbToHex(style.color)
  }
  document.getElementById('fontSelectorModal').classList.add('show')
}
window.selectFont = async (fontFamily) => {
  const el = document.getElementById(activeFontContainerId)
  if (el) {
    el.style.fontFamily = fontFamily ? `"${fontFamily}", sans-serif` : ''
    if (!layout.components) layout.components = {}
    const prev = layout.components[activeFontContainerId] || {}
    layout.components[activeFontContainerId] = Object.assign({}, prev, {
      fontFamily: fontFamily || null
    })
    await saveLayout()
  }
  closeFontSelector()
}
function closeFontSelector() {
  document.getElementById('fontSelectorModal').classList.remove('show')
  activeFontContainerId = null
}

function initFontStyleControls() {
  const sizeInput = document.getElementById('fontSizeInput')
  const sizeRange = document.getElementById('fontSizeRange')
  const colorInput = document.getElementById('textColorPicker')

  const updateStyle = async () => {
    if (!activeFontContainerId) return
    const container = document.getElementById(activeFontContainerId)
    if (!container) return
    if (!layout.components) layout.components = {}
    const prev = layout.components[activeFontContainerId] || {}

    if (sizeInput) {
      const val = sizeInput.value
      container.style.fontSize = `${val}px`
      layout.components[activeFontContainerId] = Object.assign({}, prev, { fontSize: val })
    }

    if (colorInput) {
      const val = colorInput.value
      container.style.color = val
      layout.components[activeFontContainerId] = Object.assign({}, layout.components[activeFontContainerId] || prev, { textColor: val })
    }

    await saveLayout()
  }

  if (sizeInput && sizeRange) {
    sizeInput.addEventListener('input', () => { sizeRange.value = sizeInput.value; updateStyle() })
    sizeRange.addEventListener('input', () => { sizeInput.value = sizeRange.value; updateStyle() })
  }
  if (colorInput) {
    colorInput.addEventListener('input', updateStyle)
  }
  document.querySelectorAll('.color-preset-inline').forEach(preset => {
    preset.addEventListener('click', (e) => {
      if (colorInput) {
        colorInput.value = e.target.dataset.color
        updateStyle()
      }
    })
  })
}

// ========= 自定义字体（支持热重载） =========
const __loadedFonts = new Map()

function __clearLoadedFonts() {
  try {
    for (const ff of __loadedFonts.values()) {
      try {
        if (ff && document.fonts && typeof document.fonts.delete === 'function') document.fonts.delete(ff)
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  __loadedFonts.clear()
}

async function __loadFontFace(family, url) {
  if (!family || !url) return
  if (__loadedFonts.has(family)) return
  const ff = new FontFace(family, `url(${url})`)
  await ff.load()
  document.fonts.add(ff)
  __loadedFonts.set(family, ff)
}

async function __applyFontConfig() {
  try {
    if (!window.electronAPI || !window.electronAPI.getFontConfig) return
    const r = await window.electronAPI.getFontConfig()
    if (!r || !r.success || !r.config) return
    const c = r.config

    let css = ''
    if (c.defaultFont) {
      css += `body{font-family:"${c.defaultFont}",'Microsoft YaHei',sans-serif !important;}`
    }
    const titleFont = c.titleFont || c.phaseFont
    if (titleFont) {
      css += `.title,.subtitle{font-family:"${titleFont}",'Microsoft YaHei',sans-serif !important;}`
    }
    if (c.teamNameFont) {
      css += `.team-name{font-family:"${c.teamNameFont}",'Microsoft YaHei',sans-serif !important;}`
    }
    if (c.characterNameFont) {
      css += `.player-name,.hunter-name{font-family:"${c.characterNameFont}",'Microsoft YaHei',sans-serif !important;}`
    }
    const numberFont = c.numberFont || c.timerFont
    if (numberFont) {
      css += `.team-score,.stat,.kv .v{font-family:"${numberFont}",'Microsoft YaHei',sans-serif !important;}`
    }
    if (c.mapFont) {
      css += `.center-card .map{font-family:"${c.mapFont}",'Microsoft YaHei',sans-serif !important;}`
    }
    const labelFont = c.labelFont || c.controlLabelFont
    if (labelFont) {
      css += `.table th,.k,.center-card .label{font-family:"${labelFont}",'Microsoft YaHei',sans-serif !important;}`
    }
    if (c.elements) {
      for (const sel in c.elements) {
        const fam = c.elements[sel]
        css += `${sel}{font-family:"${fam}",'Microsoft YaHei',sans-serif !important;}`
      }
    }

    let styleEl = document.getElementById('custom-font-styles')
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = 'custom-font-styles'
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = css
  } catch (e) {
    console.warn('[PostMatch] applyFontConfig failed:', e?.message || e)
  }
}

async function __loadCustomFonts() {
  try {
    if (!window.electronAPI || !window.electronAPI.getCustomFonts || !window.electronAPI.getFontUrl) {
      await __applyFontConfig()
      return
    }

    const list = await window.electronAPI.getCustomFonts()
    if (!list || !list.success || !list.fonts || !list.fonts.length) {
      await __applyFontConfig()
      return
    }

    availableFonts = list.fonts
    for (const f of list.fonts) {
      try {
        const u = await window.electronAPI.getFontUrl(f.fileName)
        if (u && u.success && u.url) await __loadFontFace(f.fontFamily, u.url)
      } catch {
        // ignore
      }
    }

    await __applyFontConfig()
  } catch (e) {
    console.warn('[PostMatch] loadCustomFonts failed:', e?.message || e)
  }
}

if (window.electronAPI && window.electronAPI.onFontConfigUpdated) {
  window.electronAPI.onFontConfigUpdated(() => __applyFontConfig())
}
if (window.electronAPI && window.electronAPI.onCustomFontsChanged) {
  window.electronAPI.onCustomFontsChanged(async () => {
    __clearLoadedFonts()
    await __loadCustomFonts()
  })
}

// OBS模式下通过SSE接收数据更新
function setupOBSMode() {
  if (window.__ASG_OBS_MODE__) {
    console.log('[PostMatch] 启用OBS模式数据同步')

    // 从SSE事件更新数据
    window.addEventListener('asg-state-update', (e) => {
      const data = e.detail
      if (data && data.postMatchData) {
        render(data.postMatchData)
      }
    })

    // 初始获取状态
    fetch('/api/current-state').then(r => r.json()).then(data => {
      if (data && data.roomData && data.roomData.roomId) {
        roomId = data.roomData.roomId
        loadData()
      }
    }).catch(() => { })
  }
}



// === 脚本启动调试 ===
try {
  if (window.electronAPI) {
    window.electronAPI.send('DEBUG_LOG', '[PostMatch] 页面脚本开始执行')
  } else {
    console.error('[PostMatch] window.electronAPI 不存在！Preload 可能失败')
  }
} catch (e) { console.error(e) }

function getDefaultData() {
  return {
    title: '赛后数据',
    subTitle: 'MATCH STATS',
    gameLabel: 'GAME 1',
    mapName: '地图',
    teamA: { name: 'A队', meta: 'W 0  D 0', score: 0, logo: '' },
    teamB: { name: 'B队', meta: 'W 0  D 0', score: 0, logo: '' },
    survivors: [
      { name: '选手1', decodeProgress: 0, palletHit: 0, rescue: 0, heal: 0, chaseSeconds: 0 },
      { name: '选手2', decodeProgress: 0, palletHit: 0, rescue: 0, heal: 0, chaseSeconds: 0 },
      { name: '选手3', decodeProgress: 0, palletHit: 0, rescue: 0, heal: 0, chaseSeconds: 0 },
      { name: '选手4', decodeProgress: 0, palletHit: 0, rescue: 0, heal: 0, chaseSeconds: 0 }
    ],
    hunter: {
      name: '监管者',
      roleName: '角色',
      remainingCiphers: 0,
      palletDestroy: 0,
      hit: 0,
      terrorShock: 0,
      down: 0
    }
  }
}

function loadData() {
  // 尝试多个可能的key
  let raw = null
  let usedKey = null

  const keys = []
  if (roomId) {
    keys.push(`postmatch_${roomId}`)
  }
  keys.push('localBp_postmatch')

  // 尝试每个key
  for (const key of keys) {
    const data = localStorage.getItem(key)
    if (data) {
      raw = data
      usedKey = key
      break
    }
  }

  if (!raw) {
    // 第一次启动时输出警告
    if (!window.__pmDataWarningShown) {
      console.warn('[PostMatch] ⚠️ 未找到赛后数据')
      console.warn('[PostMatch] 尝试的keys:', keys)
      console.warn('[PostMatch] 请在"本地BP控制台 > 赛后数据"页面填写并保存数据')
      window.__pmDataWarningShown = true
    }
  } else {
    console.log('[PostMatch] ✓ 从localStorage读取数据成功, key =', usedKey)
  }

  let data = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch (e) {
    console.error('[PostMatch] ❌ JSON解析失败:', e)
    data = null
  }

  if (!data) {
    data = getDefaultData()
  }

  render(data)
}

function render(data) {
  document.getElementById('titleText').textContent = data.title || '赛后数据'
  document.getElementById('subTitleText').textContent = data.subTitle || 'MATCH STATS'
  document.getElementById('gameLabel').textContent = data.gameLabel || ''
  document.getElementById('mapName').textContent = data.mapName || ''

  const teamA = data.teamA || {}
  const teamB = data.teamB || {}

  document.getElementById('teamAName').textContent = teamA.name || 'A队'
  document.getElementById('teamAMeta').textContent = teamA.meta || ''
  document.getElementById('teamAScore').textContent = Number.isFinite(teamA.score) ? String(teamA.score) : String(teamA.score || 0)

  document.getElementById('teamBName').textContent = teamB.name || 'B队'
  document.getElementById('teamBMeta').textContent = teamB.meta || ''
  document.getElementById('teamBScore').textContent = Number.isFinite(teamB.score) ? String(teamB.score) : String(teamB.score || 0)

  const teamALogo = document.getElementById('teamALogo')
  if (teamA.logo) {
    teamALogo.src = teamA.logo
    teamALogo.style.display = 'block'
  } else {
    teamALogo.style.display = 'none'
  }

  const teamBLogo = document.getElementById('teamBLogo')
  if (teamB.logo) {
    teamBLogo.src = teamB.logo
    teamBLogo.style.display = 'block'
  } else {
    teamBLogo.style.display = 'none'
  }

  const body = document.getElementById('survivorTableBody')
  body.innerHTML = ''

  const survivors = Array.isArray(data.survivors) ? data.survivors : []
  const list = survivors.length ? survivors : getDefaultData().survivors

  for (const s of list) {
    const tr = document.createElement('tr')
    tr.innerHTML = `
          <td class="player-name">${escapeHtml(s.name || '')}</td>
          <td class="stat">${formatPercent(s.decodeProgress)}</td>
          <td class="stat">${formatInt(s.palletHit)}</td>
          <td class="stat">${formatInt(s.rescue)}</td>
          <td class="stat">${formatInt(s.heal)}</td>
          <td class="stat">${formatSeconds(s.chaseSeconds)}</td>
        `
    body.appendChild(tr)
  }

  const hunter = data.hunter || {}
  document.getElementById('hunterName').textContent = hunter.name || '监管者'
  document.getElementById('hunterRole').textContent = hunter.roleName || ''
  document.getElementById('hunterRemainingCiphers').textContent = formatInt(hunter.remainingCiphers)
  document.getElementById('hunterPalletDestroy').textContent = formatInt(hunter.palletDestroy)
  document.getElementById('hunterHit').textContent = formatInt(hunter.hit)
  document.getElementById('hunterTerrorShock').textContent = formatInt(hunter.terrorShock)
  document.getElementById('hunterDown').textContent = formatInt(hunter.down)
}

function formatInt(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? String(n) : '0'
}

function formatPercent(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? `${n}%` : '0%'
}

function formatSeconds(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? `${n}s` : '0s'
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

async function loadLayout() {
  try {
    if (window.electronAPI && window.electronAPI.getPostMatchLayout) {
      const result = await window.electronAPI.getPostMatchLayout()
      if (result && result.success && result.layout) {
        layout = result.layout
        applyLayout()
        return
      }
    }
  } catch (e) {
    console.warn('读取赛后数据布局失败:', e && e.message ? e.message : e)
  }

  const legacy = localStorage.getItem('postmatch_layout')
  if (legacy) {
    try {
      layout = JSON.parse(legacy)
      applyLayout()
      if (window.electronAPI && window.electronAPI.savePostMatchLayout) {
        await window.electronAPI.savePostMatchLayout(layout)
      }
      localStorage.removeItem('postmatch_layout')
    } catch (e) {
      console.warn('旧版赛后数据布局迁移失败:', e && e.message ? e.message : e)
    }
  }
}

async function loadBackgroundFromPack() {
  try {
    if (layout && layout.backgroundImage) return
    const result = await window.electronAPI.getBackgroundPath()
    if (result.success && result.path) {
      layout.backgroundImage = result.path
      if (window.electronAPI && window.electronAPI.savePostMatchLayout) {
        await window.electronAPI.savePostMatchLayout(layout)
      }
      applyLayout()
    }
  } catch (e) {
    console.error('加载背景失败:', e)
  }
}

async function selectBackground() {
  try {
    if (window.electronAPI && window.electronAPI.selectPostMatchBackground) {
      const result = await window.electronAPI.selectPostMatchBackground()
      if (result && result.success && result.path) {
        layout.backgroundImage = result.path
        if (window.electronAPI && window.electronAPI.savePostMatchLayout) {
          await window.electronAPI.savePostMatchLayout(layout)
        }
        applyLayout()
      }
    }
  } catch (e) {
    console.error('选择背景失败:', e)
  }
}

function applyLayout() {
  // 处理透明背景设置
  if (layout && layout.transparentBackground) {
    document.body.classList.add('transparent-bg')
  } else {
    document.body.classList.remove('transparent-bg')
  }

  // 背景
  const bg = document.getElementById('backgroundImage')
  if (layout && layout.backgroundImage) {
    let imgSrc = layout.backgroundImage.replace(/\\/g, '/')

    // OBS模式下转换 file:/// 路径为 HTTP 路径
    if (window.__ASG_OBS_MODE__) {
      if (imgSrc.startsWith('file:///') || layout.backgroundImage.includes(':\\') || layout.backgroundImage.includes(':/')) {
        const bgMatch = imgSrc.match(/asg-director[\/]background[\/](.+)$/i)
        if (bgMatch) {
          imgSrc = '/background/' + bgMatch[1]
        } else {
          const udMatch = imgSrc.match(/asg-director[\/](.+)$/i)
          if (udMatch) {
            imgSrc = '/userdata/' + udMatch[1]
          }
        }
      }
      console.log('[PostMatch] OBS模式背景路径:', layout.backgroundImage, '->', imgSrc)
    } else {
      if (!imgSrc.startsWith('file:')) {
        imgSrc = imgSrc.startsWith('/') ? `file://${imgSrc}` : `file:///${imgSrc}`
      }
    }

    bg.src = imgSrc
    bg.style.display = 'block'
    document.body.classList.add('has-background')
  } else {
    bg.style.display = 'none'
    document.body.classList.remove('has-background')
  }

  // 组件
  const applyOne = (id) => {
    const conf = layout && layout.components ? layout.components[id] : null
    if (!conf) return
    const el = document.getElementById(id)
    if (!el) return
    if (typeof conf.left === 'number') el.style.left = conf.left + 'px'
    if (typeof conf.top === 'number') el.style.top = conf.top + 'px'
    if (typeof conf.width === 'number') el.style.width = conf.width + 'px'
    if (typeof conf.height === 'number') el.style.height = conf.height + 'px'

    if (conf.fontFamily) {
      el.style.fontFamily = `"${conf.fontFamily}", sans-serif`
    } else {
      el.style.fontFamily = ''
    }
    if (conf.fontSize) {
      el.style.fontSize = `${conf.fontSize}px`
    }
    if (conf.textColor) {
      el.style.color = conf.textColor
    }

    if (conf.zIndex !== undefined) {
      el.style.setProperty('position', 'absolute') // draggable usually sets absolute, ensure it
      el.style.zIndex = conf.zIndex
    }

    const isHidden = conf.hidden === true
    el.classList.toggle('layout-hidden', isHidden)
    if (!editMode && isHidden) {
      el.style.display = 'none'
    } else {
      el.style.display = ''
    }
  }
  applyOne('titleContainer')
  applyOne('teamBarContainer')
  applyOne('statsContainer')
}

async function saveLayout() {
  try {
    if (!window.electronAPI || !window.electronAPI.savePostMatchLayout) return
    await window.electronAPI.savePostMatchLayout(layout)
  } catch (e) {
    console.warn('保存布局失败:', e && e.message ? e.message : e)
  }
}

function toggleEditMode() {
  editMode = !editMode
  document.body.classList.toggle('edit-mode', editMode)
  applyLayout()
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

  if (!layout.components) layout.components = {}
  const prev = layout.components[container.id] || {}
  const isHidden = prev.hidden === true

  // 1. 隐藏/显示
  menu.appendChild(createItem(isHidden ? '显示组件' : '隐藏组件', isHidden ? '👁️' : '🚫', async () => {
    const nextHidden = !isHidden
    const computed = window.getComputedStyle(container)
    const fontSize = parseInt(computed.fontSize) || null
    const textColor = rgbToHex(computed.color)
    layout.components[container.id] = Object.assign({}, prev, {
      left: parseInt(container.style.left) || 0,
      top: parseInt(container.style.top) || 0,
      width: container.offsetWidth,
      height: container.offsetHeight,
      fontFamily: container.style.fontFamily ? container.style.fontFamily.replace(/"/g, '').split(',')[0].trim() : (prev.fontFamily || null),
      fontSize: fontSize || prev.fontSize || null,
      textColor: textColor || prev.textColor || null,
      hidden: nextHidden
    })
    applyLayout()
    await saveLayout()
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

  const updateZIndex = async (newIdx) => {
    container.style.zIndex = newIdx
    layout.components[container.id] = Object.assign({}, prev, { zIndex: newIdx })
    applyLayout()
    await saveLayout()
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
  const draggables = Array.from(document.querySelectorAll('.draggable'))
  let activeContainer = null
  let isDragging = false
  let isResizing = false
  let resizeDir = null
  let startX, startY, startLeft, startTop, startWidth, startHeight
  let lastDx = 0
  let lastDy = 0

  // Snap logic vars
  const SNAP_THRESHOLD = 10
  let snapLinesX = []
  let snapLinesY = []
  const snapLineV = document.getElementById('snapLineV')
  const snapLineH = document.getElementById('snapLineH')
  const coordDisplay = document.getElementById('coordDisplay')

  let rafId = null
  let pendingUpdate = null

  function updateCoordDisplay(x, y) {
    if (coordDisplay) {
      coordDisplay.textContent = `X: ${Math.round(x)} | Y: ${Math.round(y)}`
      coordDisplay.classList.add('show')
    }
  }

  function hideCoordDisplay() {
    if (coordDisplay) coordDisplay.classList.remove('show')
  }

  function updatePosition() {
    if (!pendingUpdate || !activeContainer) return

    let { dx, dy } = pendingUpdate

    let newLeft = startLeft + dx
    let newTop = startTop + dy
    let newWidth = startWidth
    let newHeight = startHeight

    // Snap Logic
    if (isDragging) {
      let centerX = newLeft + startWidth / 2
      let rightX = newLeft + startWidth

      let targetX = null
      for (let snap of snapLinesX) { if (Math.abs(newLeft - snap) < SNAP_THRESHOLD) { targetX = snap; break; } }
      if (targetX === null) for (let snap of snapLinesX) { if (Math.abs(centerX - snap) < SNAP_THRESHOLD) { targetX = snap - startWidth / 2; break; } }
      if (targetX === null) for (let snap of snapLinesX) { if (Math.abs(rightX - snap) < SNAP_THRESHOLD) { targetX = snap - startWidth; break; } }

      if (targetX !== null) {
        dx = targetX - startLeft
        newLeft = targetX
        let guideX = targetX;
        if (Math.abs(newLeft - targetX) < 1) guideX = newLeft;
        else if (Math.abs(rightX - (targetX + startWidth)) < 1) guideX = rightX;
        else guideX = centerX;
        snapLineV.style.left = `${Math.round(guideX)}px`
        snapLineV.style.display = 'block'
      } else {
        snapLineV.style.display = 'none'
      }

      let centerY = newTop + startHeight / 2
      let bottomY = newTop + startHeight
      let targetY = null
      for (let snap of snapLinesY) { if (Math.abs(newTop - snap) < SNAP_THRESHOLD) { targetY = snap; break; } }
      if (targetY === null) for (let snap of snapLinesY) { if (Math.abs(centerY - snap) < SNAP_THRESHOLD) { targetY = snap - startHeight / 2; break; } }
      if (targetY === null) for (let snap of snapLinesY) { if (Math.abs(bottomY - snap) < SNAP_THRESHOLD) { targetY = snap - startHeight; break; } }

      if (targetY !== null) {
        dy = targetY - startTop
        newTop = targetY
        let guideY = targetY;
        if (Math.abs(newTop - targetY) < 1) guideY = newTop;
        else if (Math.abs(bottomY - (targetY + startHeight)) < 1) guideY = bottomY;
        else guideY = centerY;
        snapLineH.style.top = `${Math.round(guideY)}px`
        snapLineH.style.display = 'block'
      } else {
        snapLineH.style.display = 'none'
      }
    } else {
      snapLineV.style.display = 'none'
      snapLineH.style.display = 'none'
    }

    lastDx = dx
    lastDy = dy

    if (isDragging) {
      activeContainer.style.left = `${newLeft}px`
      activeContainer.style.top = `${newTop}px`
      updateCoordDisplay(newLeft, newTop)
    } else if (isResizing) {
      let tempWidth = startWidth
      let tempHeight = startHeight
      let tempLeft = startLeft
      let tempTop = startTop

      if (resizeDir.includes('e')) tempWidth = startWidth + dx
      if (resizeDir.includes('w')) {
        tempWidth = startWidth - dx
        tempLeft = startLeft + dx
      }
      if (resizeDir.includes('s')) tempHeight = startHeight + dy
      if (resizeDir.includes('n')) {
        tempHeight = startHeight - dy
        tempTop = startTop + dy
      }

      if (tempWidth > 50) {
        activeContainer.style.width = `${tempWidth}px`
        if (resizeDir.includes('w')) activeContainer.style.left = `${tempLeft}px`
      }
      if (tempHeight > 50) {
        activeContainer.style.height = `${tempHeight}px`
        if (resizeDir.includes('n')) activeContainer.style.top = `${tempTop}px`
      }
      updateCoordDisplay(tempLeft, tempTop)
    }

    pendingUpdate = null
    rafId = null
  }

  for (const el of draggables) {
    el.addEventListener('contextmenu', async (e) => {
      if (!editMode) return
      showUnifiedContextMenu(e, el)
    })

    el.addEventListener('dblclick', (e) => {
      if (!editMode) return
      e.preventDefault()
      e.stopPropagation()
      openFontSelector(el.id)
    })

    document.addEventListener('mousedown', (e) => {
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

      snapLinesX = []
      snapLinesY = []
      if (isDragging) {
        snapLinesX.push(window.innerWidth / 2)
        snapLinesY.push(window.innerHeight / 2)
        document.querySelectorAll('.draggable').forEach(other => {
          if (other !== draggable && other.style.display !== 'none') {
            const r = other.getBoundingClientRect()
            snapLinesX.push(r.left, r.left + r.width / 2, r.right)
            snapLinesY.push(r.top, r.top + r.height / 2, r.bottom)
          }
        })
      }

      e.preventDefault()
      e.stopPropagation()
    })
  }

  document.addEventListener('mousemove', (e) => {
    if (!editMode || (!isDragging && !isResizing) || !activeContainer) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    lastDx = dx
    lastDy = dy
    pendingUpdate = { dx, dy }
    if (!rafId) rafId = requestAnimationFrame(updatePosition)
  })

  document.addEventListener('mouseup', async () => {
    if ((isDragging || isResizing) && activeContainer) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null }

      if (!layout.components) layout.components = {}
      const prev = layout.components[activeContainer.id] || {}
      const computed = window.getComputedStyle(activeContainer)
      const fontSize = parseInt(computed.fontSize) || null
      const textColor = rgbToHex(computed.color)
      layout.components[activeContainer.id] = {
        left: parseInt(activeContainer.style.left) || activeContainer.offsetLeft,
        top: parseInt(activeContainer.style.top) || activeContainer.offsetTop,
        width: activeContainer.offsetWidth,
        height: activeContainer.offsetHeight,
        height: activeContainer.offsetHeight,
        fontFamily: activeContainer.style.fontFamily ? activeContainer.style.fontFamily.replace(/"/g, '').split(',')[0].trim() : (prev.fontFamily || null),
        fontSize: fontSize || prev.fontSize || null,
        textColor: textColor || prev.textColor || null,
        hidden: (typeof prev.hidden === 'boolean') ? prev.hidden : false,
        zIndex: parseInt(activeContainer.style.zIndex) || 0
      }
      await saveLayout()
    }

    isDragging = false
    isResizing = false
    resizeDir = null
    activeContainer = null
    pendingUpdate = null
    lastDx = 0
    lastDy = 0
    document.body.classList.remove('is-dragging')
    if (snapLineV) snapLineV.style.display = 'none'
    if (snapLineH) snapLineH.style.display = 'none'
    hideCoordDisplay()
  })
}

function init() {
  const params = new URLSearchParams(window.location.search)
  roomId = params.get('roomId') || ''

  console.log('='.repeat(60))
  console.log('[PostMatch] 初始化开始')
  console.log('[PostMatch] 完整URL:', window.location.href)
  console.log('[PostMatch] roomId:', roomId)
  console.log('[PostMatch] electronAPI:', !!window.electronAPI)
  console.log('='.repeat(60))

  __loadCustomFonts()
  initFontStyleControls()

  loadLayout()

  // 首次加载数据
  console.log('[PostMatch] 首次加载数据...')
  loadData()

  // 加载自定义组件
  loadCustomComponents()

  // 每秒轮询数据更新（不依赖storage事件）
  let pollCount = 0
  setInterval(() => {
    pollCount++
    if (pollCount % 10 === 0) {
      console.log(`[PostMatch] 轮询更新数据 (第${pollCount}次)`)
    }
    loadData()
  }, 1000)

  // OBS模式支持
  setupOBSMode()

  // Storage事件（跨窗口时可用，但不可靠）
  window.addEventListener('storage', (e) => {
    console.log('[PostMatch] Storage事件触发, key =', e.key)
    if (e.key === `postmatch_${roomId}` || e.key === 'localBp_postmatch') {
      console.log('[PostMatch] 检测到数据更新，重新加载')
      loadData()
    }
  })

  // F2: 切换编辑模式
  window.addEventListener('keydown', (e) => {
    console.log('[PostMatch] 按键:', e.key, '| Ctrl:', e.ctrlKey, '| Alt:', e.altKey)

    if (e.key === 'F2') {
      e.preventDefault()
      console.log('[PostMatch] F2 - 切换编辑模式')
      toggleEditMode()
      return
    }

    // F3: 选择背景（仅编辑模式）
    if (e.key === 'F3' && editMode) {
      e.preventDefault()
      console.log('[PostMatch] F3 - 选择背景')
      if (!window.__ASG_OBS_MODE__) {
        selectBackground()
      }
      return
    }

    // F5: 强制刷新数据
    if (e.key === 'F5') {
      e.preventDefault()
      console.log('[PostMatch] F5 - 强制刷新数据')
      loadData()
      return
    }
  })

  initDraggable()

  if (window.electronAPI && window.electronAPI.onReloadLayoutFromPack) {
    window.electronAPI.onReloadLayoutFromPack(async () => {
      await loadLayout()
      await loadBackgroundFromPack()
    })
  }

  // 监听字体配置更新
  if (window.electronAPI && window.electronAPI.onFontConfigUpdated) {
    window.electronAPI.onFontConfigUpdated(async (config) => {
      console.log('[PostMatch] 收到字体配置更新')
      await __loadCustomFonts()
    })
  }

  // 监听字体文件变更
  if (window.electronAPI && window.electronAPI.onFontFilesChanged) {
    window.electronAPI.onFontFilesChanged(async () => {
      console.log('[PostMatch] 收到字体文件变更')
      await __loadCustomFonts()
    })
  }
}

// ========= 自定义组件加载 =========
async function loadCustomComponents() {
  try {
    if (!window.electronAPI || !window.electronAPI.loadLayout) return
    const result = await window.electronAPI.loadLayout()
    if (!result.success || !result.layout || !result.layout.customComponents) return

    const components = result.layout.customComponents
    const postmatchComponents = components.filter(c =>
      c.targetPages && c.targetPages.includes('postmatch')
    )

    postmatchComponents.forEach(comp => createCustomComponent(comp, result.layout))
    console.log(`[PostMatch] 加载了 ${postmatchComponents.length} 个自定义组件`)
  } catch (e) {
    console.error('[PostMatch] 加载自定义组件失败:', e)
  }
}

function createCustomComponent(comp, fullLayout) {
  if (document.getElementById(comp.id)) return

  const container = document.createElement('div')
  container.id = comp.id
  container.className = 'draggable custom-component'
  container.dataset.type = 'custom'

  // 获取位置
  // 1. 优先从 postmatch 专属 layout 获取
  // layout 变量在 loadLayout() 中被赋值为 postMatchLayout
  let layoutComp = layout.components?.[comp.id]

  let x = 100, y = 100, w = 200, h = 'auto'

  if (layoutComp) {
    x = layoutComp.left || 0
    y = layoutComp.top || 0
    w = layoutComp.width || 200
    h = layoutComp.height || 'auto'
  } else if (fullLayout && fullLayout[comp.id]) {
    // 2. 尝试从全局布局获取默认值
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

  container.style.cssText = `
        left: ${x}px;
        top: ${y}px;
        width: ${w};
        height: ${h};
        position: absolute;
        z-index: 15;
        background: transparent;
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

  let htmlContent = comp.html || ''

  // 图片组件特殊处理：强制拉伸
  if (comp.type === 'image') {
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

  document.body.appendChild(container)
}

init()
