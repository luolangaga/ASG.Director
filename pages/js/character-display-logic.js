// OBS浏览器模式兼容层
if (!window.electronAPI) {
  console.log('[CharacterDisplay] OBS模式：创建兼容API层')
  window.__ASG_OBS_MODE__ = true

  window.__rewriteAssetPath__ = function (src) {
    if (!src) return src
    if (src.startsWith('../assets/')) return src.replace('../assets/', '/assets/')
    if (src.startsWith('./assets/')) return src.replace('./assets/', '/assets/')
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
    invoke: async (channel, ...args) => {
      if (channel === 'localBp:getState') {
        try {
          const resp = await fetch('/api/local-bp-state')
          const data = await resp.json()
          return data
        } catch (e) {
          return { success: false }
        }
      }
      return { success: false }
    },
    onLocalBpStateUpdate: (callback) => {
      // SSE 更新
      window.addEventListener('asg-local-bp-update', (e) => {
        callback(e.detail)
      })
    }
  }
}

let state = {
  survivors: [null, null, null, null],
  hunter: null,
  // 每个求生者单独的天赋数组
  survivorTalents: [[], [], [], []],
  hunterTalents: [],
  hunterSkills: [],
  playerNames: ['', '', '', '', ''],
  teamA: { name: '求生者队', logo: '', meta: 'W0 D0' },
  teamB: { name: '监管者队', logo: '', meta: 'W0 D0' },
  gameLabel: 'GAME 1',
  mapName: ''
}

let editMode = false
let layoutPositions = {}
let saveLayoutTimer = null

// ========= 自定义字体系统 =========
let availableFonts = []
let activeFontContainerId = null
const __loadedFonts = new Map()

function __clearLoadedFonts() {
  try {
    for (const ff of __loadedFonts.values()) {
      try {
        if (ff && document.fonts && typeof document.fonts.delete === 'function') document.fonts.delete(ff)
      } catch { }
    }
  } catch { }
  __loadedFonts.clear()
}

async function __loadFontFace(family, url) {
  if (!family || !url) return
  if (__loadedFonts.has(family)) return
  try {
    const ff = new FontFace(family, `url(${url})`)
    await ff.load()
    document.fonts.add(ff)
    __loadedFonts.set(family, ff)
  } catch (e) {
    console.warn('加载字体失败:', family, e)
  }
}

async function __loadCustomFonts() {
  try {
    if (!window.electronAPI || !window.electronAPI.getCustomFonts || !window.electronAPI.getFontUrl) return

    const list = await window.electronAPI.getCustomFonts()
    if (!list || !list.success || !list.fonts) return

    availableFonts = list.fonts
    for (const f of list.fonts) {
      const u = await window.electronAPI.getFontUrl(f.fileName)
      if (u.success) {
        await __loadFontFace(f.fontFamily, u.url)
      }
    }
  } catch (e) {
    console.warn('__loadCustomFonts 失败:', e)
  }
}

// 字体选择器
function openFontSelector(containerId) {
  activeFontContainerId = containerId
  const list = document.getElementById('fontSelectorList')
  let html = '<div class="font-selector-item" onclick="selectFont(\'\')">系统默认</div>'
  html += availableFonts.map(f => `
        <div class="font-selector-item" style="font-family:'${f.fontFamily}';" onclick="selectFont('${f.fontFamily}')">
          ${f.fontFamily}
        </div>
      `).join('')
  list.innerHTML = html

  // 读取当前样式
  const container = document.getElementById(containerId)
  if (container) {
    const style = window.getComputedStyle(container)
    // 字号
    const fontSize = parseInt(style.fontSize) || 16
    const sizeInput = document.getElementById('fontSizeInput')
    const sizeRange = document.getElementById('fontSizeRange')
    if (sizeInput) sizeInput.value = fontSize
    if (sizeRange) sizeRange.value = fontSize

    // 颜色
    const currentColor = style.color
    const rgb = currentColor.match(/\d+/g)
    if (rgb) {
      const hex = '#' + rgb.map(x => {
        const hex = parseInt(x).toString(16)
        return hex.length === 1 ? '0' + hex : hex
      }).join('')
      const picker = document.getElementById('textColorPicker')
      if (picker) picker.value = hex
    }
  }

  document.getElementById('fontSelectorModal').classList.add('show')
}

window.selectFont = async (fontFamily) => {
  const el = document.getElementById(activeFontContainerId)
  if (el) {
    el.style.fontFamily = fontFamily ? `"${fontFamily}", sans-serif` : ''

    // 记录到布局中
    if (layoutPositions && layoutPositions[activeFontContainerId]) {
      layoutPositions[activeFontContainerId].fontFamily = fontFamily || null
    }

    const rect = {
      x: parseInt(el.style.left) || el.offsetLeft,
      y: parseInt(el.style.top) || el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
      fontFamily: fontFamily || null
    }
    scheduleSaveLayout({ [activeFontContainerId]: rect })
  }
  closeFontSelector()
}

function closeFontSelector() {
  document.getElementById('fontSelectorModal').classList.remove('show')
  activeFontContainerId = null
}

function normalizeFileSrc(src) {
  if (!src || typeof src !== 'string') return ''
  if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) return src
  // OBS 本地页面服务器可能返回 /userdata/xxx
  if (src.startsWith('/')) return src
  if (src.startsWith('file:///')) return src
  const normalized = src.replace(/\\/g, '/')
  return `file:///${normalized}`
}

// 加载状态
async function loadState() {
  try {
    const result = await window.electronAPI.invoke('localBp:getState')
    if (result && result.success && result.data) {
      const data = result.data
      state.survivors = data.survivors || [null, null, null, null]
      state.hunter = data.hunter || null
      // 每个求生者单独的天赋
      state.survivorTalents = Array.isArray(data.survivorTalents) && data.survivorTalents.length === 4
        ? data.survivorTalents.map(t => Array.isArray(t) ? t : [])
        : [[], [], [], []]
      state.hunterTalents = Array.isArray(data.hunterTalents) ? data.hunterTalents : []
      state.hunterSkills = data.hunterSkills || []
      state.playerNames = data.playerNames || ['', '', '', '', '']

      // 加载队伍信息
      if (data.teamA) state.teamA = data.teamA
      if (data.teamB) state.teamB = data.teamB
      if (data.gameLabel) state.gameLabel = data.gameLabel
      if (data.mapName) state.mapName = data.mapName
    }
  } catch (e) {
    console.error('加载状态失败:', e)
  }
  render()
}

function setEditMode(next) {
  editMode = !!next
  document.body.classList.toggle('edit-mode', editMode)
  render()
}

function setWidgetVisible(id, visible) {
  const el = document.getElementById(id)
  if (!el) return

  const hiddenByLayout = !!(layoutPositions && layoutPositions[id] && layoutPositions[id].hidden)
  el.classList.toggle('layout-hidden', hiddenByLayout)
  if (!editMode && hiddenByLayout) visible = false

  if (visible) {
    el.style.display = ''
  } else {
    el.style.display = 'none'
  }
}

function setWidgetContent(id, html) {
  const el = document.getElementById(id)
  if (!el) return
  const content = el.querySelector('.widget-content')
  if (!content) return
  content.innerHTML = html
}

function getDefaultLayoutForViewport() {
  const W = window.innerWidth || 1366
  const H = window.innerHeight || 768
  const margin = 24
  const survivorAreaW = Math.floor(W * 0.74)
  const slotW = Math.max(180, Math.floor(survivorAreaW / 4))
  const imgW = Math.floor(slotW * 0.85)
  const imgH = Math.floor(H * 0.72)
  const imgTop = Math.max(margin, H - imgH - margin)
  const nameH = Math.max(40, Math.floor(H * 0.08))
  const talentsH = Math.max(30, Math.floor(H * 0.05))
  const gap = Math.max(10, Math.floor((survivorAreaW - slotW * 4) / 5))

  const defaults = {}

  // 队伍 logo + 比分
  const teamLogoSize = Math.max(64, Math.floor(Math.min(W, H) * 0.10))
  const teamScoreW = Math.max(160, Math.floor(teamLogoSize * 2.2))
  const teamScoreH = Math.max(44, Math.floor(teamLogoSize * 0.55))
  defaults['teamA-logo'] = { x: margin, y: margin, width: teamLogoSize, height: teamLogoSize }
  defaults['teamA-score'] = { x: margin + teamLogoSize + 12, y: margin + Math.floor((teamLogoSize - teamScoreH) / 2), width: teamScoreW, height: teamScoreH, fontSize: 36 }
  defaults['teamB-logo'] = { x: W - margin - teamLogoSize, y: margin, width: teamLogoSize, height: teamLogoSize }
  defaults['teamB-score'] = { x: W - margin - teamLogoSize - 12 - teamScoreW, y: margin + Math.floor((teamLogoSize - teamScoreH) / 2), width: teamScoreW, height: teamScoreH, fontSize: 36 }

  for (let i = 0; i < 4; i++) {
    const x = margin + gap + i * (slotW + gap)
    defaults[`survivor${i}-img`] = { x, y: imgTop, width: imgW, height: imgH }
    defaults[`survivor${i}-name`] = { x, y: Math.max(margin, imgTop - nameH - 8), width: imgW, height: nameH, fontSize: 13 }
    defaults[`survivor${i}-talents`] = { x, y: Math.min(H - margin - talentsH, imgTop + imgH - talentsH - 10), width: imgW, height: talentsH }
  }

  const hunterW = Math.max(220, Math.floor(W * 0.22))
  const hunterH = Math.floor(H * 0.82)
  const hunterX = W - hunterW - margin
  const hunterY = Math.max(margin, H - hunterH - margin)
  const hunterNameH = Math.max(46, Math.floor(H * 0.09))
  const hunterTalentsH = Math.max(30, Math.floor(H * 0.05))
  const hunterSkillsH = Math.max(34, Math.floor(H * 0.055))

  defaults['hunter-img'] = { x: hunterX, y: hunterY, width: hunterW, height: hunterH }
  defaults['hunter-name'] = { x: hunterX, y: Math.max(margin, hunterY - hunterNameH - 8), width: hunterW, height: hunterNameH, fontSize: 13 }
  defaults['hunter-talents'] = { x: hunterX, y: Math.min(H - margin - hunterTalentsH, hunterY + hunterH - hunterTalentsH - hunterSkillsH - 14), width: hunterW, height: hunterTalentsH }
  defaults['hunter-skills'] = { x: hunterX, y: Math.min(H - margin - hunterSkillsH, hunterY + hunterH - hunterSkillsH - 8), width: hunterW, height: hunterSkillsH }

  return defaults
}

function applyWidgetRect(id, rect) {
  const el = document.getElementById(id)
  if (!el || !rect) return
  const x = Number.isFinite(rect.x) ? rect.x : Number.isFinite(rect.left) ? rect.left : null
  const y = Number.isFinite(rect.y) ? rect.y : Number.isFinite(rect.top) ? rect.top : null
  const width = Number.isFinite(rect.width) ? rect.width : null
  const height = Number.isFinite(rect.height) ? rect.height : null
  const zIndex = Number.isFinite(rect.zIndex) ? rect.zIndex : null
  if (x !== null) el.style.left = `${Math.round(x)}px`
  if (y !== null) el.style.top = `${Math.round(y)}px`
  if (width !== null) el.style.width = `${Math.max(30, Math.round(width))}px`
  if (height !== null) el.style.height = `${Math.max(30, Math.round(height))}px`
  if (zIndex !== null) el.style.zIndex = zIndex
}

function applyInitialLayout(savedPositions) {
  const defaults = getDefaultLayoutForViewport()
  const merged = { ...defaults, ...(savedPositions || {}) }
  layoutPositions = merged
  Object.keys(merged).forEach(id => {
    applyWidgetRect(id, merged[id])
    // 应用字体
    const el = document.getElementById(id)
    if (el && merged[id].fontFamily) {
      el.style.fontFamily = `"${merged[id].fontFamily}", sans-serif`
    }

    // 字体大小：优先使用保存的，若无则使用默认的
    let fontSize = merged[id].fontSize
    if (!fontSize && defaults[id] && defaults[id].fontSize) {
      fontSize = defaults[id].fontSize
    }
    if (el && fontSize) {
      el.style.fontSize = `${fontSize}px`
    }
    if (el && merged[id].textColor) {
      el.style.color = merged[id].textColor
    }
    // 展示模式（半身/全身）
    if (el && merged[id].displayMode) {
      el.setAttribute('data-display-mode', merged[id].displayMode === 'full' ? 'full' : 'half')
    }
  })
}

function scheduleSaveLayout(delta) {
  if (!window.electronAPI || !window.electronAPI.invoke) return
  if (!delta || typeof delta !== 'object') return
  if (saveLayoutTimer) clearTimeout(saveLayoutTimer)
  saveLayoutTimer = setTimeout(async () => {
    try {
      await window.electronAPI.invoke('localBp:saveCharacterDisplayLayout', delta)
    } catch (e) {
      console.error('保存布局失败:', e)
    }
  }, 300)
}

function render() {
  // 队伍 Logo / 比分
  const aLogo = state.teamA && state.teamA.logo ? String(state.teamA.logo) : ''
  const bLogo = state.teamB && state.teamB.logo ? String(state.teamB.logo) : ''
  const aScore = state.teamA && typeof state.teamA.meta === 'string' ? state.teamA.meta : ''
  const bScore = state.teamB && typeof state.teamB.meta === 'string' ? state.teamB.meta : ''

  setWidgetVisible('teamA-logo', !!aLogo || editMode)
  setWidgetVisible('teamA-score', !!aScore || editMode)
  setWidgetVisible('teamB-logo', !!bLogo || editMode)
  setWidgetVisible('teamB-score', !!bScore || editMode)

  if (aLogo) {
    setWidgetContent('teamA-logo', `<img class="team-logo-img" src="${normalizeFileSrc(aLogo)}" onerror="this.style.display='none'" alt="A">`)
  } else if (editMode) {
    setWidgetContent('teamA-logo', `<div class="empty-character">?</div>`)
  }
  if (bLogo) {
    setWidgetContent('teamB-logo', `<img class="team-logo-img" src="${normalizeFileSrc(bLogo)}" onerror="this.style.display='none'" alt="B">`)
  } else if (editMode) {
    setWidgetContent('teamB-logo', `<div class="empty-character">?</div>`)
  }
  setWidgetContent('teamA-score', aScore ? `<div class="score-text" style="font-size: 100%">${escapeHtml(aScore)}</div>` : (editMode ? `<div class="empty-character">?</div>` : ''))
  setWidgetContent('teamB-score', bScore ? `<div class="score-text" style="font-size: 100%">${escapeHtml(bScore)}</div>` : (editMode ? `<div class="empty-character">?</div>` : ''))

  for (let i = 0; i < 4; i++) {
    const character = state.survivors[i]
    const playerName = state.playerNames[i] || ''
    const talents = state.survivorTalents[i] || []

    const hasCharacter = !!character

    setWidgetVisible(`survivor${i}-img`, hasCharacter || editMode)
    setWidgetVisible(`survivor${i}-name`, (hasCharacter && (playerName || character)) || editMode)
    setWidgetVisible(`survivor${i}-talents`, (hasCharacter && talents.length > 0) || editMode)

    if (!hasCharacter) {
      if (editMode) {
        setWidgetContent(`survivor${i}-img`, `<div class="empty-character">?</div>`)
        setWidgetContent(`survivor${i}-name`, `<div class="empty-character">?</div>`)
        setWidgetContent(`survivor${i}-talents`, `<div class="empty-character">?</div>`)
      }
      continue
    }

    // 根据展示模式选择资源文件夹
    const imgContainer = document.getElementById(`survivor${i}-img`)
    const mode = imgContainer?.getAttribute('data-display-mode') === 'full' ? 'full' : 'half'
    const folder = mode === 'full' ? 'surBig' : 'surHalf'
    setWidgetContent(
      `survivor${i}-img`,
      `<img class="character-image" src="../assets/${folder}/${character}.png" onerror="if(this.dataset.fallback){this.style.display='none';}else{this.dataset.fallback='1';this.src='../assets/surHalf/${character}.png';}" alt="${escapeHtml(character)}">`
    )

    setWidgetContent(
      `survivor${i}-name`,
      `<div class="name-box">
            ${playerName ? `<div class=\"player-name\" style="font-size: 1.5em">${escapeHtml(playerName)}</div>` : ''}
            <div class="character-name" style="font-size: 1em">${escapeHtml(character)}</div>
          </div>`
    )

    const talentsHtml = talents.length > 0
      ? talents.map(talent => `<img class="ability-icon" src="../assets/talents/${talent}.png" title="${escapeHtml(talent)}" onerror="this.style.display='none'">`).join('')
      : ''
    setWidgetContent(
      `survivor${i}-talents`,
      talentsHtml
        ? `<div class="abilities-row">${talentsHtml}</div>`
        : (editMode ? `<div class="empty-character">?</div>` : '')
    )
  }

  const hunterCharacter = state.hunter
  const hunterPlayerName = state.playerNames[4] || ''
  const hasHunter = !!hunterCharacter

  setWidgetVisible('hunter-img', hasHunter || editMode)
  setWidgetVisible('hunter-name', (hasHunter && (hunterPlayerName || hunterCharacter)) || editMode)
  setWidgetVisible('hunter-talents', (hasHunter && (state.hunterTalents || []).length > 0) || editMode)
  setWidgetVisible('hunter-skills', (hasHunter && (state.hunterSkills || []).length > 0) || editMode)

  if (!hasHunter) {
    if (editMode) {
      setWidgetContent('hunter-img', `<div class="empty-character">?</div>`)
      setWidgetContent('hunter-name', `<div class="empty-character">?</div>`)
      setWidgetContent('hunter-talents', `<div class="empty-character">?</div>`)
      setWidgetContent('hunter-skills', `<div class="empty-character">?</div>`)
    }
    return
  }

  // 根据展示模式选择资源文件夹
  const hunterContainer = document.getElementById('hunter-img')
  const hunterMode = hunterContainer?.getAttribute('data-display-mode') === 'full' ? 'full' : 'half'
  const hunterFolder = hunterMode === 'full' ? 'hunBig' : 'hunHalf'
  setWidgetContent(
    'hunter-img',
    `<img class="character-image" src="../assets/${hunterFolder}/${hunterCharacter}.png" onerror="if(this.dataset.fallback){this.style.display='none';}else{this.dataset.fallback='1';this.src='../assets/hunHalf/${hunterCharacter}.png';}" alt="${escapeHtml(hunterCharacter)}">`
  )

  setWidgetContent(
    'hunter-name',
    `<div class="name-box">
          ${hunterPlayerName ? `<div class=\"player-name\">${escapeHtml(hunterPlayerName)}</div>` : ''}
          <div class="character-name">${escapeHtml(hunterCharacter)}</div>
        </div>`
  )

  const hunterTalents = Array.isArray(state.hunterTalents) ? state.hunterTalents : []
  const hunterTalentsHtml = hunterTalents.length > 0
    ? hunterTalents.map(talent => `<img class="ability-icon" src="../assets/talents/${talent}.png" title="${escapeHtml(talent)}" onerror="this.style.display='none'">`).join('')
    : ''
  setWidgetContent(
    'hunter-talents',
    hunterTalentsHtml
      ? `<div class="abilities-row">${hunterTalentsHtml}</div>`
      : (editMode ? `<div class="empty-character">?</div>` : '')
  )

  const hunterSkills = Array.isArray(state.hunterSkills) ? state.hunterSkills : []
  const hunterSkillsHtml = hunterSkills.length > 0
    ? hunterSkills.map(skill => `<img class="ability-icon skill-icon" src="../assets/skills/${skill}.png" title="${escapeHtml(skill)}" onerror="this.style.display='none'">`).join('')
    : ''
  setWidgetContent(
    'hunter-skills',
    hunterSkillsHtml
      ? `<div class="abilities-row hunter-skills">${hunterSkillsHtml}</div>`
      : (editMode ? `<div class="empty-character">?</div>` : '')
  )
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// 监听状态更新
if (window.electronAPI && window.electronAPI.onLocalBpStateUpdate) {
  window.electronAPI.onLocalBpStateUpdate((data) => {
    if (data) {
      // 兼容两种结构：raw localBpState（survivors/hunter）或 buildLocalBpFrontendState（currentRoundData.selected*）
      const selectedSurvivors = data.currentRoundData && Array.isArray(data.currentRoundData.selectedSurvivors)
        ? data.currentRoundData.selectedSurvivors
        : data.survivors
      const selectedHunter = data.currentRoundData && Object.prototype.hasOwnProperty.call(data.currentRoundData, 'selectedHunter')
        ? data.currentRoundData.selectedHunter
        : data.hunter

      state.survivors = selectedSurvivors || state.survivors
      state.hunter = selectedHunter || state.hunter
      // 每个求生者单独的天赋
      state.survivorTalents = Array.isArray(data.survivorTalents) && data.survivorTalents.length === 4
        ? data.survivorTalents.map(t => Array.isArray(t) ? t : [])
        : state.survivorTalents
      state.hunterTalents = Array.isArray(data.hunterTalents) ? data.hunterTalents : state.hunterTalents
      state.hunterSkills = data.hunterSkills || state.hunterSkills
      state.playerNames = data.playerNames || state.playerNames
      if (data.teamA) state.teamA = data.teamA
      if (data.teamB) state.teamB = data.teamB
      if (data.gameLabel) state.gameLabel = data.gameLabel
      if (data.mapName) state.mapName = data.mapName

      // 收到角色展示布局时应用（导入布局包/其他窗口更新时会走这里）
      if (data.characterDisplayLayout && typeof data.characterDisplayLayout === 'object') {
        const layout = data.characterDisplayLayout

        if (typeof layout.transparentBackground === 'boolean') {
          document.body.classList.toggle('transparent-bg', layout.transparentBackground)
        }

        if (layout.backgroundImage) {
          const bg = document.getElementById('backgroundImage')
          if (bg) bg.src = layout.backgroundImage
        }

        if (!editMode && layout.positions) {
          applyInitialLayout(layout.positions)
        }

        updateBackgroundVisibility()
      }
      render()
    }
  })
}

// OBS模式下的SSE监听
function setupOBSMode() {
  if (window.__ASG_OBS_MODE__) {
    console.log('[CharacterDisplay] 启用OBS模式数据同步')

    // 通过SSE更新
    const eventSource = new EventSource('/api/sse')
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'local-bp-update' && data.payload) {
          state = { ...state, ...data.payload }
          render()
        }
      } catch (e) {
        console.warn('SSE解析错误:', e)
      }
    }
  }
}

// 键盘快捷键
document.addEventListener('keydown', async (e) => {
  if (e.key === 'Escape') {
    window.close()
    return
  }
  if (e.key === 'F2') {
    setEditMode(!editMode)
  }
  if (e.key === 'F3' && window.electronAPI && window.electronAPI.selectCharacterDisplayBackground) {
    const result = await window.electronAPI.selectCharacterDisplayBackground()
    if (result && result.success && result.path) {
      const bg = document.getElementById('backgroundImage')
      bg.src = result.path
      bg.style.display = 'block'
      updateBackgroundVisibility()
    }
  }
  if (e.key === 'F4') {
    document.body.classList.toggle('transparent-bg')
    updateBackgroundVisibility()

    // 持久化透明背景设置
    try {
      if (window.electronAPI && window.electronAPI.invoke) {
        await window.electronAPI.invoke(
          'localBp:setCharacterDisplayTransparentBackground',
          document.body.classList.contains('transparent-bg')
        )
      }
    } catch (err) {
      console.warn('保存透明背景设置失败:', err)
    }
  }
})

function updateBackgroundVisibility() {
  const bg = document.getElementById('backgroundImage')
  if (!bg) return
  const transparent = document.body.classList.contains('transparent-bg')
  if (transparent) {
    bg.style.display = 'none'
    return
  }
  if (bg.src) {
    bg.style.display = 'block'
  } else {
    bg.style.display = 'none'
  }
}

// 从状态中加载背景图片和布局
async function loadLayoutFromState() {
  try {
    const result = await window.electronAPI.invoke('localBp:getState')
    if (result && result.success && result.data && result.data.characterDisplayLayout) {
      const layout = result.data.characterDisplayLayout

      // 透明背景设置（持久化）
      if (typeof layout.transparentBackground === 'boolean') {
        document.body.classList.toggle('transparent-bg', layout.transparentBackground)
      }

      // 加载背景图片
      if (layout.backgroundImage) {
        const bg = document.getElementById('backgroundImage')
        bg.src = layout.backgroundImage
        bg.style.display = 'block'
        updateBackgroundVisibility()
      }

      // 加载控件位置
      if (layout.positions) {
        applyInitialLayout(layout.positions)
      } else {
        applyInitialLayout(null)
      }

      updateBackgroundVisibility()
    }
  } catch (e) {
    console.error('加载背景失败:', e)
  }
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

  const id = container.id
  const existingPos = (layoutPositions && layoutPositions[id] && typeof layoutPositions[id] === 'object')
    ? layoutPositions[id]
    : {
      x: container.offsetLeft,
      y: container.offsetTop,
      width: container.offsetWidth,
      height: container.offsetHeight
    }
  const isHidden = existingPos.hidden === true

  // 1. 隐藏/显示
  menu.appendChild(createItem(isHidden ? '显示组件' : '隐藏组件', isHidden ? '👁️' : '🚫', () => {
    const nextHidden = !isHidden
    layoutPositions[id] = { ...existingPos, hidden: nextHidden }
    container.classList.toggle('layout-hidden', nextHidden)
    scheduleSaveLayout({ [id]: { hidden: nextHidden } })
  }))

  // 2. 修改文字属性
  menu.appendChild(createItem('修改字体/颜色', '🎨', () => {
    openFontSelector(container.id)
  }))

  // 2.5 切换展示模式（仅用于立绘容器）
  const role = container.dataset.role || ''
  const isCharacterImage = role === 'survivor-img' || container.id === 'hunter-img'
  if (isCharacterImage) {
    const currentMode = (container.getAttribute('data-display-mode') === 'full') ? 'full' : 'half'
    const modeLabel = currentMode === 'half' ? '切换为全身立绘' : '切换为半身立绘'
    menu.appendChild(createItem(modeLabel, '🖼️', () => {
      const next = currentMode === 'half' ? 'full' : 'half'
      container.setAttribute('data-display-mode', next)
      const id = container.id
      const existingPos = (layoutPositions && layoutPositions[id]) ? layoutPositions[id] : {
        x: container.offsetLeft,
        y: container.offsetTop,
        width: container.offsetWidth,
        height: container.offsetHeight
      }
      layoutPositions[id] = { ...existingPos, displayMode: next }
      scheduleSaveLayout({ [id]: { displayMode: next } })
      render()
    }))
  }

  // 3. 图层顺序
  const layerMenu = document.createElement('div');
  layerMenu.style.display = 'flex';
  layerMenu.style.flexDirection = 'column';
  layerMenu.style.borderTop = '1px solid #333';
  layerMenu.style.marginTop = '4px';
  layerMenu.style.paddingTop = '4px';

  const updateZIndex = (newIdx) => {
    container.style.zIndex = newIdx;
    layoutPositions[id] = { ...existingPos, zIndex: newIdx };
    scheduleSaveLayout({ [id]: { zIndex: newIdx } });
  };

  const getCurrentZ = () => {
    const s = window.getComputedStyle(container);
    const z = parseInt(s.zIndex);
    return isNaN(z) ? 0 : z;
  };

  layerMenu.appendChild(createItem('置于顶层', '⬆️', () => {
    let maxZ = 0;
    document.querySelectorAll('.draggable-container').forEach(el => {
      const z = parseInt(window.getComputedStyle(el).zIndex) || 0;
      if (z > maxZ) maxZ = z;
    });
    updateZIndex(maxZ + 1);
  }));

  layerMenu.appendChild(createItem('上移一层', '🔼', () => { updateZIndex(getCurrentZ() + 1); }));
  layerMenu.appendChild(createItem('下移一层', '🔽', () => { updateZIndex(Math.max(1, getCurrentZ() - 1)); }));

  layerMenu.appendChild(createItem('置于底层', '⬇️', () => {
    let minZ = 100;
    document.querySelectorAll('.draggable-container').forEach(el => {
      const z = parseInt(window.getComputedStyle(el).zIndex) || 0;
      if (z > 0 && z < minZ) minZ = z;
    });
    if (minZ === 100) minZ = 1;
    const target = minZ - 1;
    updateZIndex(target < 1 ? 1 : target);
  }));

  menu.appendChild(layerMenu);

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

// 拖拽/缩放（与 BP 前台同一套交互模型）
function initDraggable() {
  const containers = document.querySelectorAll('.draggable-container')
  let activeContainer = null
  let isDragging = false
  let isResizing = false
  let resizeDir = null
  let startX, startY, startLeft, startTop, startWidth, startHeight
  let lastDx = 0
  let lastDy = 0

  let rafId = null
  let pendingUpdate = null

  function updatePosition() {
    if (!pendingUpdate || !activeContainer) return

    const { dx, dy } = pendingUpdate
    lastDx = dx
    lastDy = dy
    if (isDragging) {
      activeContainer.style.left = `${startLeft + dx}px`
      activeContainer.style.top = `${startTop + dy}px`
    } else if (isResizing) {
      let newWidth = startWidth
      let newHeight = startHeight
      let newLeft = startLeft
      let newTop = startTop

      if (resizeDir.includes('e')) newWidth = startWidth + dx
      if (resizeDir.includes('w')) {
        newWidth = startWidth - dx
        newLeft = startLeft + dx
      }
      if (resizeDir.includes('s')) newHeight = startHeight + dy
      if (resizeDir.includes('n')) {
        newHeight = startHeight - dy
        newTop = startTop + dy
      }

      if (newWidth > 30) {
        activeContainer.style.width = `${newWidth}px`
        if (resizeDir.includes('w')) activeContainer.style.left = `${newLeft}px`
      }
      if (newHeight > 30) {
        activeContainer.style.height = `${newHeight}px`
        if (resizeDir.includes('n')) activeContainer.style.top = `${newTop}px`
      }
    }

    pendingUpdate = null
    rafId = null
  }

  containers.forEach(container => {
    container.addEventListener('contextmenu', (e) => {
      if (!editMode) return
      showUnifiedContextMenu(e, container)
    })

    container.addEventListener('dblclick', (e) => {
      if (!editMode) return
      e.preventDefault()
      e.stopPropagation()
      openFontSelector(container.id)
    })

    container.addEventListener('mousedown', (e) => {
      if (!editMode) return

      if (e.target && e.target.classList && e.target.classList.contains('resize-handle')) {
        isResizing = true
        resizeDir = e.target.dataset.dir
      } else {
        isDragging = true
      }

      activeContainer = container
      startX = e.clientX
      startY = e.clientY
      startLeft = container.offsetLeft
      startTop = container.offsetTop
      startWidth = container.offsetWidth
      startHeight = container.offsetHeight
      lastDx = 0
      lastDy = 0

      container.style.transform = ''
      container.classList.toggle('dragging', isDragging)
      container.classList.toggle('resizing', isResizing)

      e.preventDefault()
      e.stopPropagation()
    })
  })

  document.addEventListener('mousemove', (e) => {
    if (!editMode || (!isDragging && !isResizing) || !activeContainer) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    lastDx = dx
    lastDy = dy
    pendingUpdate = { dx, dy }
    if (!rafId) rafId = requestAnimationFrame(updatePosition)
  })

  document.addEventListener('mouseup', () => {
    if ((isDragging || isResizing) && activeContainer) {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }

      // 不要依赖 pendingUpdate：它会在 rAF 中被清空
      if (isDragging) {
        // 已在 updatePosition 中实时更新
      } else {
        // 缩放时也确保清掉 transform
        activeContainer.style.transform = ''
      }

      const id = activeContainer.id
      const rect = {
        x: parseInt(activeContainer.style.left) || activeContainer.offsetLeft,
        y: parseInt(activeContainer.style.top) || activeContainer.offsetTop,
        width: activeContainer.offsetWidth,
        height: activeContainer.offsetHeight
      }
      // 保留隐藏状态
      if (layoutPositions && layoutPositions[id] && typeof layoutPositions[id] === 'object' && typeof layoutPositions[id].hidden === 'boolean') {
        rect.hidden = layoutPositions[id].hidden
      }
      layoutPositions[id] = rect
      scheduleSaveLayout({ [id]: rect })
    }

    isDragging = false
    isResizing = false
    resizeDir = null
    if (activeContainer) {
      activeContainer.classList.remove('dragging')
      activeContainer.classList.remove('resizing')
    }
    activeContainer = null
    pendingUpdate = null
    lastDx = 0
    lastDy = 0
  })
}

// 自定义组件支持
async function loadCustomComponents() {
  try {
    if (!window.electronAPI || !window.electronAPI.loadLayout) return
    const res = await window.electronAPI.loadLayout()
    if (res.success && res.layout && res.layout.customComponents) {
      const components = res.layout.customComponents.filter(c => c.targetPages && c.targetPages.includes('characterDisplay'))
      components.forEach(c => createCustomComponent(c, res.layout))
      console.log('[CharacterDisplay] 已加载自定义组件:', components.length)
    }
  } catch (e) { console.error('[CharacterDisplay] 加载自定义组件失败', e) }
}

function createCustomComponent(comp, fullLayout) {
  if (document.getElementById(comp.id)) return

  const container = document.createElement('div')
  container.id = comp.id
  container.className = 'draggable-container custom-component'
  container.dataset.type = 'custom'

  // 位置优先级:
  // 1. layoutPositions (当前页面的本地存储)
  // 2. fullLayout[comp.id] (全局布局默认值)
  // 3. 组件定义默认值

  let x = 100, y = 100, w = 200, h = 'auto'

  const localPos = layoutPositions && layoutPositions[comp.id]
  if (localPos) {
    x = localPos.x || localPos.left || 0
    y = localPos.y || localPos.top || 0
    w = localPos.width || 200
    h = localPos.height || 'auto'
  } else if (fullLayout && fullLayout[comp.id]) {
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
      `

  // 调整大小手柄
  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  handles.forEach(dir => {
    const h = document.createElement('div')
    h.className = `resize-handle ${dir}`
    h.dataset.dir = dir
    container.appendChild(h)
  })

  // 内容
  const content = document.createElement('div')
  content.className = 'widget-content custom-component-content' // 使用 widget-content 以保持一致性
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

  // 图片优化
  if (comp.type === 'image') {
    const imgFit = comp.objectFit || 'contain'
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

  // 注册到 layoutPositions 如果不存在
  if (!layoutPositions) layoutPositions = {}
  if (!layoutPositions[comp.id]) {
    layoutPositions[comp.id] = { x, y, width: parseInt(w), height: h === 'auto' ? 'auto' : parseInt(h) }
  }
}

// 初始化
loadLayoutFromState().then(async () => {
  // 在加载完状态布局后，加载自定义组件
  await loadCustomComponents()

  // 没有 layout.positions 时也要有默认布局
  if (!Object.keys(layoutPositions || {}).length) {
    applyInitialLayout(null)
  }

  // 由于是异步加载，需要重新初始化拖拽，或者手动为新组件添加事件
  // 这里我们在所有组件加载完后调用 initDraggable
  // 注意：initDraggable 会给所有 .draggable-container 绑定事件。
  // 为了防止重复绑定，initDraggable 最好支持幂等性（先移除再添加，或者检查标记）。
  // 现在的 code 并没有这样，所以我们确保只调用一次。
  initDraggable()
}).catch(e => {
  console.error(e)
  // 出错也要初始化拖拽
  initDraggable()
})

loadState()
setupOBSMode()
// initDraggable() // 移入 promise chain

// 样式监听
document.addEventListener('DOMContentLoaded', () => {
  const sizeInput = document.getElementById('fontSizeInput')
  const sizeRange = document.getElementById('fontSizeRange')
  const colorInput = document.getElementById('textColorPicker')

  function updateStyle() {
    if (!activeFontContainerId) return
    const container = document.getElementById(activeFontContainerId)
    if (!container) return

    // 字号
    if (sizeInput) {
      const val = sizeInput.value
      container.style.fontSize = `${val}px`
      if (!layoutPositions[activeFontContainerId]) layoutPositions[activeFontContainerId] = {}
      layoutPositions[activeFontContainerId].fontSize = val
    }

    // 颜色
    if (colorInput) {
      const val = colorInput.value
      container.style.color = val
      if (!layoutPositions[activeFontContainerId]) layoutPositions[activeFontContainerId] = {}
      layoutPositions[activeFontContainerId].textColor = val
    }

    // 保存
    scheduleSaveLayout({ [activeFontContainerId]: layoutPositions[activeFontContainerId] })
  }

  if (sizeInput && sizeRange) {
    sizeInput.addEventListener('input', () => { sizeRange.value = sizeInput.value; updateStyle(); })
    sizeRange.addEventListener('input', () => { sizeInput.value = sizeRange.value; updateStyle(); })
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
})

// 监听字体配置更新
if (window.electronAPI && window.electronAPI.onFontConfigUpdated) {
  window.electronAPI.onFontConfigUpdated(() => {
    __loadCustomFonts()
  })
}
// 监听字体文件变更
if (window.electronAPI && window.electronAPI.onFontFilesChanged) {
  window.electronAPI.onFontFilesChanged(() => {
    __loadCustomFonts()
  })
}

// 定时刷新（备用）
setInterval(loadState, 3000)
