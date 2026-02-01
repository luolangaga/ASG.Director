// OBS浏览器模式兼容层
// 当页面通过本地服务器在OBS浏览器中打开时，window.electronAPI 不存在
// 需要提供兼容的 API 接口
if (!window.electronAPI) {
  console.log('[Frontend] OBS模式：创建兼容API层')

  // 标记为 OBS 模式
  window.__ASG_OBS_MODE__ = true

  // 图片/脚本路径重写函数（OBS模式下将相对路径转为绝对路径）
  window.__rewriteAssetPath__ = function (src) {
    if (!src) return src
    // ../assets/ -> /assets/
    if (src.startsWith('../assets/')) return src.replace('../assets/', '/assets/')
    // ./assets/ -> /assets/
    if (src.startsWith('./assets/')) return src.replace('./assets/', '/assets/')
    // ./js/ -> /js/
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

  // 重写 Image 对象的 src 属性setter（自动转换路径）
  const originalImageSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    set: function (value) {
      const rewritten = window.__rewriteAssetPath__(value)
      if (rewritten !== value) {
        console.log('[OBS Mode] 图片路径重写:', value, '->', rewritten)
      }
      originalImageSrcDescriptor.set.call(this, rewritten)
    },
    get: originalImageSrcDescriptor.get
  })

  // 重写 Script 对象的 src 属性setter（自动转换路径）
  const originalScriptSrcDescriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src')
  Object.defineProperty(HTMLScriptElement.prototype, 'src', {
    set: function (value) {
      const rewritten = window.__rewriteAssetPath__(value)
      if (rewritten !== value) {
        console.log('[OBS Mode] 脚本路径重写:', value, '->', rewritten)
      }
      originalScriptSrcDescriptor.set.call(this, rewritten)
    },
    get: originalScriptSrcDescriptor.get
  })

  // 创建兼容的 electronAPI
  window.electronAPI = {
    // 布局加载 - 从服务器获取已保存的布局
    loadLayout: async () => {
      try {
        console.log('[OBS Mode] 正在从服务器获取布局...')
        const resp = await fetch('/api/frontend-layout')
        const data = await resp.json()
        if (data && data.success && data.layout) {
          console.log('[OBS Mode] 成功获取布局:', data.layout)
          return { success: true, layout: data.layout }
        }
        console.log('[OBS Mode] 服务器无布局，使用默认布局')
        return { success: true, layout: null }
      } catch (e) {
        console.error('[OBS Mode] 获取布局失败:', e)
        return { success: true, layout: null }
      }
    },
    // 背景路径 - OBS模式下尝试获取背景
    getBackgroundPath: async () => {
      try {
        const resp = await fetch('/api/frontend-layout')
        const data = await resp.json()
        if (data && data.layout && data.layout.backgroundImage) {
          // 将本地路径转换为服务器路径
          let bgPath = data.layout.backgroundImage
          if (bgPath.includes('asg-director')) {
            const match = bgPath.match(/asg-director[\/\\]background[\/\\](.+)$/i)
            if (match) {
              bgPath = '/background/' + match[1].replace(/\\/g, '/')
              console.log('[OBS Mode] 背景路径转换:', data.layout.backgroundImage, '->', bgPath)
              return { success: true, path: bgPath }
            }
          }
        }
        return { success: true, path: null }
      } catch (e) {
        return { success: true, path: null }
      }
    },
    // 保存布局 - OBS模式下不保存
    saveLayout: async (layout) => {
      console.log('[OBS Mode] 保存布局被忽略')
      return { success: true }
    },
    // 获取官方模型映射
    getOfficialModelMap: async () => {
      try {
        const resp = await fetch('/api/official-model-map')
        const map = await resp.json()
        return map || {}
      } catch (e) {
        console.error('[OBS Mode] 获取官方模型映射失败:', e)
        return {}
      }
    },
    // 房间数据监听 - 通过SSE实现
    onRoomData: (callback) => {
      window.onRoomData = callback
      // 立即获取当前状态
      fetch('/api/current-state').then(r => r.json()).then(data => {
        if (data && data.roomData) {
          callback(data.roomData)
        }
      }).catch(() => { })
    },
    // 更新数据监听 - 通过SSE实现
    onUpdateData: (callback) => {
      window.onUpdateData = callback
    },
    // 编辑模式切换 - OBS模式下禁用
    onToggleEditMode: (callback) => {
      console.log('[OBS Mode] 编辑模式已禁用')
    },
    // 重新加载布局包 - OBS模式下不支持
    onReloadLayoutFromPack: (callback) => {
      console.log('[OBS Mode] 布局包热加载已禁用')
    },
    // 导出导入布局包 - OBS模式下不支持
    exportBpPack: async () => {
      console.log('[OBS Mode] 导出功能已禁用')
      return { success: false, error: 'OBS模式下不支持此功能' }
    },
    importBpPack: async () => {
      console.log('[OBS Mode] 导入功能已禁用')
      return { success: false, error: 'OBS模式下不支持此功能' }
    },
    // 选择背景 - OBS模式下不支持
    selectBackground: async () => {
      console.log('[OBS Mode] 选择背景功能已禁用')
      return { success: false, error: 'OBS模式下不支持此功能' }
    },
    // IPC调用 - OBS模式下模拟
    invoke: async (channel, ...args) => {
      console.log('[OBS Mode] invoke被忽略:', channel)
      return false
    },
    // 发送消息 - OBS模式下忽略
    send: (channel, ...args) => {
      console.log('[OBS Mode] send被忽略:', channel)
    }
  }
}

// 状态 (使用 var 使其成为全局变量，可被 executeJavaScript 访问)
var editMode = false
var roomData = null
var connection = null
var currentLayout = null
var timerInterval = null

// 默认布局
const defaultLayout = {
  // 左侧两列两行求生者
  survivor1: { x: 40, y: 120, width: 220, height: 260 },
  survivor2: { x: 280, y: 120, width: 220, height: 260 },
  survivor3: { x: 40, y: 400, width: 220, height: 260 },
  survivor4: { x: 280, y: 400, width: 220, height: 260 },
  // 监管者放右侧居中
  hunter: { x: 820, y: 200, width: 340, height: 420 },
  // Ban位靠近求生者/监管者下面
  survivorBans: { x: 40, y: 680, width: 360, height: 60 },
  hunterBans: { x: 820, y: 640, width: 340, height: 60 },
  // 全局禁选位
  globalBanSurvivors: { x: 40, y: 760, width: 400, height: 70 },
  globalBanHunters: { x: 820, y: 720, width: 340, height: 70 },
  // 顶部信息：地图/阶段/计时器
  mapInfo: { x: 420, y: 20, width: 300, height: 44 },
  mapImage: { x: 420, y: 70, width: 300, height: 180 },
  phaseInfo: { x: 740, y: 20, width: 280, height: 50 },
  timerBox: { x: 1080, y: 20, width: 160, height: 60 },
  timerProgressBar: { x: 1080, y: 90, width: 160, height: 10 },
  // 队伍logo
  teamALogo: { x: 40, y: 20, width: 120, height: 140 },
  teamBLogo: { x: 1100, y: 20, width: 120, height: 140 },
  // 队名（分离）
  teamAName: { x: 40, y: 165, width: 120, height: 30 },
  teamBName: { x: 1100, y: 165, width: 120, height: 30 },
  backgroundImage: null,
  globalBanConfig: {
    survivor: { maxPerRow: 4, itemGap: 8, rowGap: 8, itemSize: 50 },
    hunter: { maxPerRow: 1, itemGap: 8, rowGap: 8, itemSize: 50 }
  },
  localBanConfig: {
    survivor: { maxPerRow: 4, itemGap: 10, rowGap: 10, itemSize: 60 },
    hunter: { maxPerRow: 1, itemGap: 10, rowGap: 10, itemSize: 60 }
  },
  model3d: {
    enabled: false,
    useOfficialModels: false,
    targetFPS: 30,
    scaleCorrection: 1.6,
    verticalOffset: 0.08,
    survivorModelDir: null,
    hunterModelDir: null,
    survivorMotionDir: null,
    hunterMotionDir: null,
    defaultMotionVmd: null,

    // 渲染质量
    antialias: true,
    pixelRatio: 1,
    enableShadows: false,
    shadowQuality: 1024,

    // 风格化渲染
    enableOutline: true,
    outlineThickness: 0.003,
    outlineColor: '#000000',
    outlineAlpha: 1.0,
    enableToon: false,
    toonGradient: 5,

    // 光照
    ambientColor: '#ffffff',
    ambientIntensity: 0.5,
    directionalColor: '#ffffff',
    directionalIntensity: 0.7,
    lightPosX: 10,
    lightPosY: 20,
    lightPosZ: 10,

    // 3D 视口（相对父容器比例，允许超出 0..1 来实现“放大/平移”）
    // key: boxEl.id (survivor1..4/hunter)
    viewports: {}
  }
}

// ========= 自定义字体系统 =========
const loadedFonts = new Map() // 已加载的字体

function clearLoadedFonts() {
  try {
    for (const ff of loadedFonts.values()) {
      try {
        if (ff && document.fonts && typeof document.fonts.delete === 'function') {
          document.fonts.delete(ff)
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  loadedFonts.clear()
}

/**
 * 加载自定义字体并应用。现在不再依赖全局分类配置，而是支持组件级别的 fontFamily。
 */
async function loadCustomFonts() {
  try {
    console.log('[Frontend] 开始加载自定义字体')
    const fontsResult = await window.electronAPI.getCustomFonts()
    if (!fontsResult.success || !fontsResult.fonts.length) {
      console.log('[Frontend] 无自定义字体')
      return
    }

    for (const font of fontsResult.fonts) {
      try {
        const urlResult = await window.electronAPI.getFontUrl(font.fileName)
        if (urlResult.success) {
          await loadFontFace(font.fontFamily, urlResult.url)
        }
      } catch (e) {
        console.warn('[Frontend] 字体加载失败:', font.fileName, e)
      }
    }
  } catch (error) {
    console.error('[Frontend] 加载自定义字体失败:', error)
  }
}

/**
 * 加载单个字体
 */
async function loadFontFace(fontFamily, fontUrl) {
  if (loadedFonts.has(fontFamily)) {
    return loadedFonts.get(fontFamily)
  }

  const fontFace = new FontFace(fontFamily, `url(${fontUrl})`)
  await fontFace.load()
  document.fonts.add(fontFace)
  loadedFonts.set(fontFamily, fontFace)

  return fontFace
}

// 移除旧的全局映射 logic
async function applyFontConfig() { }
function updateFontStyles() { }

// ========= 新：组件级字体选择器 =========
let availableFonts = []
let activeFontContainerId = null

async function openFontSelector(containerId) {
  activeFontContainerId = containerId
  const modal = document.getElementById('fontSelectorModal')
  const list = document.getElementById('fontSelectorList')
  const container = document.getElementById(containerId)

  try {
    const res = await window.electronAPI.getCustomFonts()
    availableFonts = res.success ? res.fonts : []
  } catch (e) {
    console.error(e)
  }

  let html = '<div class="font-selector-item" onclick="selectFont(\'\')">系统默认</div>'
  html += availableFonts.map(f => `
        <div class="font-selector-item" style="font-family: '${f.fontFamily}';" onclick="selectFont('${f.fontFamily}')">
          ${f.fontFamily}
        </div>
      `).join('')

  list.innerHTML = html

  // 字体/颜色设置区域显示逻辑
  const progressBarSettings = document.getElementById('progressBarSettings')
  const standardSettings = document.querySelectorAll('.font-color-section:not(#progressBarSettings .font-color-section)')

  if (activeFontContainerId === 'timerProgressBar') {
    // 进度条：隐藏文字设置，显示进度条设置
    standardSettings.forEach(el => el.style.display = 'none')
    if (progressBarSettings) progressBarSettings.style.display = 'block'

    // 加载当前颜色
    const fill = container.querySelector('.progress-fill')
    const track = container.querySelector('.progress-track')

    if (fill) {
      const fillColor = fill.style.backgroundColor || getComputedStyle(fill).backgroundColor
      document.getElementById('progressColorPicker').value = rgbToHex(fillColor) || '#4caf50'
    }
    if (track) {
      const trackColor = track.style.backgroundColor || getComputedStyle(track).backgroundColor
      document.getElementById('trackColorPicker').value = rgbToHex(trackColor) || '#ffffff'
    }
  } else {
    // 普通组件：显示文字设置，隐藏进度条设置
    standardSettings.forEach(el => el.style.display = 'block')
    if (progressBarSettings) progressBarSettings.style.display = 'none'

    if (container) {
      const textElement = container.querySelector('span') ||
        container.querySelector('.team-name') ||
        container.querySelector('#mapName') ||
        container.querySelector('#phaseName') ||
        container.querySelector('#timerDisplay')

      if (textElement) {
        const style = window.getComputedStyle(textElement)
        const currentColor = style.color
        document.getElementById('textColorPicker').value = rgbToHex(currentColor) || '#ffffff'

        // 加载字号
        const currentFontSize = parseInt(style.fontSize) || 16
        document.getElementById('fontSizeInput').value = currentFontSize
        document.getElementById('fontSizeRange').value = currentFontSize
      }
    }
  }

  modal.classList.add('show')
}

function rgbToHex(color) {
  if (!color) return null
  if (color.startsWith('#')) return color
  const rgb = color.match(/\d+/g)
  if (rgb) {
    return '#' + rgb.map(x => {
      const hex = parseInt(x).toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }).join('')
  }
  return null
}

window.selectFont = async (fontFamily) => {
  if (!activeFontContainerId) return

  const container = document.getElementById(activeFontContainerId)
  if (container) {
    // 应用字体
    if (fontFamily) {
      container.style.fontFamily = `"${fontFamily}", sans-serif`
    } else {
      container.style.fontFamily = ''
    }

    if (!currentLayout[activeFontContainerId]) currentLayout[activeFontContainerId] = {}
    currentLayout[activeFontContainerId].fontFamily = fontFamily || null

    // 应用颜色（如果修改了）
    const color = document.getElementById('textColorPicker').value
    if (color) {
      const textElement = container.querySelector('span') ||
        container.querySelector('.team-name') ||
        container.querySelector('#mapName') ||
        container.querySelector('#phaseName') ||
        container.querySelector('#timerDisplay')
      if (textElement) {
        textElement.style.color = color
        currentLayout[activeFontContainerId].textColor = color
      }
    }

    try {
      await window.electronAPI.saveLayout(currentLayout)
      console.log('Font and color updated and layout saved')
    } catch (e) {
      console.error(e)
    }
  }

  closeFontSelector()
}

function closeFontSelector() {
  document.getElementById('fontSelectorModal').classList.remove('show')
  activeFontContainerId = null
}

// 点击外部关闭弹窗及样式监听
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('fontSelectorModal')
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeFontSelector()
    }
  })

  // 实时更新样式监听（字号、颜色）
  const sizeInput = document.getElementById('fontSizeInput')
  const sizeRange = document.getElementById('fontSizeRange')
  const colorInput = document.getElementById('textColorPicker')

  function updateStyle() {
    if (!activeFontContainerId) return
    const container = document.getElementById(activeFontContainerId)
    if (!container) return

    const textElement = container.querySelector('span') ||
      container.querySelector('.team-name') ||
      container.querySelector('#mapName') ||
      container.querySelector('#phaseName') ||
      container.querySelector('#timerDisplay')

    if (!textElement) return

    // 字号
    const size = sizeInput.value
    if (size) {
      textElement.style.fontSize = `${size}px`
      if (!currentLayout[activeFontContainerId]) currentLayout[activeFontContainerId] = {}
      currentLayout[activeFontContainerId].fontSize = size
    }

    // 颜色
    const color = colorInput.value
    if (color) {
      textElement.style.color = color
      if (!currentLayout[activeFontContainerId]) currentLayout[activeFontContainerId] = {}
      currentLayout[activeFontContainerId].textColor = color
    }

    // 保存
    window.electronAPI.saveLayout(currentLayout).catch(console.error)
  }

  // 进度条颜色监听
  const progressColorInput = document.getElementById('progressColorPicker')
  const trackColorInput = document.getElementById('trackColorPicker')

  function updateProgressStyle() {
    if (activeFontContainerId !== 'timerProgressBar') return
    const container = document.getElementById(activeFontContainerId)
    if (!container) return

    if (!currentLayout[activeFontContainerId]) currentLayout[activeFontContainerId] = {}

    if (progressColorInput) {
      const color = progressColorInput.value
      const fill = container.querySelector('.progress-fill')
      if (fill) fill.style.backgroundColor = color
      currentLayout[activeFontContainerId].progressColor = color
    }

    if (trackColorInput) {
      const color = trackColorInput.value
      const track = container.querySelector('.progress-track')
      if (track) track.style.backgroundColor = color
      currentLayout[activeFontContainerId].trackColor = color
    }

    // 保存
    window.electronAPI.saveLayout(currentLayout).catch(console.error)
  }

  if (progressColorInput) progressColorInput.addEventListener('input', updateProgressStyle)
  if (trackColorInput) trackColorInput.addEventListener('input', updateProgressStyle)

  if (sizeInput && sizeRange) {
    sizeInput.addEventListener('input', () => {
      sizeRange.value = sizeInput.value
      updateStyle()
    })
    sizeRange.addEventListener('input', () => {
      sizeInput.value = sizeRange.value
      updateStyle()
    })
  }

  if (colorInput) {
    colorInput.addEventListener('input', updateStyle)
  }

  // 预设颜色
  document.querySelectorAll('.color-preset-inline').forEach(preset => {
    preset.addEventListener('click', (e) => {
      if (colorInput) {
        colorInput.value = e.target.dataset.color
        updateStyle()
      }
    })
  })
})

// ========= Shift+Click 隐藏/显示控件 =========
document.addEventListener('click', async (e) => {
  if (!e.shiftKey || !editMode) return

  const container = e.target.closest('.draggable-container')
  if (!container || !container.id) return

  e.preventDefault()
  e.stopPropagation()

  // 切换隐藏状态
  const isHidden = container.classList.contains('layout-hidden')
  container.classList.toggle('layout-hidden', !isHidden)

  // 保存到布局
  if (!currentLayout[container.id]) {
    currentLayout[container.id] = {}
  }
  currentLayout[container.id].hidden = !isHidden

  try {
    await window.electronAPI.saveLayout(currentLayout)
    console.log(`[Frontend] ${container.id} 隐藏状态: ${!isHidden}`)
  } catch (e) {
    console.error('[Frontend] 保存隐藏状态失败:', e)
  }

  // 视觉反馈
  if (!isHidden) {
    container.style.opacity = '0.3'
  } else {
    container.style.opacity = ''
  }
})

// 监听字体配置更新
if (window.electronAPI && window.electronAPI.onFontConfigUpdated) {
  window.electronAPI.onFontConfigUpdated((config) => {
    console.log('[Frontend] 收到字体配置更新:', config)
    // No longer applying global font config, but we might need to re-apply per-component fonts
    // if the underlying font files changed. For now, just reload custom fonts.
    loadCustomFonts()
  })
}

// 监听字体文件变更（新增/删除/覆盖）并热重载
if (window.electronAPI && window.electronAPI.onCustomFontsChanged) {
  window.electronAPI.onCustomFontsChanged(async (payload) => {
    console.log('[Frontend] 收到字体文件变更通知:', payload)
    clearLoadedFonts()
    await loadCustomFonts()
    // Re-apply layout to ensure any component-specific fonts are re-rendered if needed
    applyLayout()
  })
}

// 初始化
async function init() {
  console.log('[Frontend] 前台页面初始化开始')

  // 注入样式修复：强制角色名字显示在底部
  const styleFix = document.createElement('style');
  styleFix.textContent = `
    .character-box .name, .hunter-box .name {
      position: absolute !important;
      bottom: 10px !important;
      left: 0 !important;
      width: 100% !important;
      text-align: center !important;
      top: auto !important;
      transform: none !important;
      z-index: 10;
      pointer-events: none;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.9);
      display: block; /* Ensure it is not hidden */
      color: #ffffff !important; /* Ensure text is white */
    }
    .placeholder {
        z-index: 1; /* Ensure placeholder is behind name if overlapped, though usually name hides placeholder */
    }
  `;
  document.head.appendChild(styleFix);

  // 加载布局
  const result = await window.electronAPI.loadLayout()
  console.log('[Frontend] 初始化时加载布局结果:', result)
  if (result.success && result.layout) {
    currentLayout = { ...defaultLayout, ...result.layout }
  } else {
    currentLayout = { ...defaultLayout }
  }
  console.log('[Frontend] 当前布局:', currentLayout)
  applyLayout()
  applyGlobalBanLayoutConfig()
  applyLocalBanLayoutConfig()

  // 加载背景
  if (currentLayout.backgroundImage) {
    console.log('[Frontend] 从布局加载背景:', currentLayout.backgroundImage)
    setBackground(currentLayout.backgroundImage)
  } else {
    const bgResult = await window.electronAPI.getBackgroundPath()
    console.log('[Frontend] 从背景目录获取背景:', bgResult)
    if (bgResult.success && bgResult.path) {
      setBackground(bgResult.path)
      currentLayout.backgroundImage = bgResult.path
    }
  }










  // 加载自定义字体
  await loadCustomFonts()

  // 初始化完成后自动保存一次布局，确保有默认布局可导出
  console.log('[Frontend] 初始化完成，自动保存布局')
  try {
    await window.electronAPI.saveLayout(currentLayout)
    console.log('[Frontend] 初始化时自动保存布局成功')
  } catch (error) {
    console.error('[Frontend] 初始化时自动保存失败:', error)
  }

  // 初始化拖拽
  initDraggable()

  // 初始化布局设置实时更新
  initLayoutSettingsLiveUpdate()

  // 监听房间数据
  window.electronAPI.onRoomData((data) => {
    console.log('收到房间数据:', data)
    roomData = data

    // 显示队伍名称和logo
    if (roomData.teamAName) {
      document.getElementById('teamALogoName').textContent = roomData.teamAName
    }
    if (roomData.teamBName) {
      document.getElementById('teamBLogoName').textContent = roomData.teamBName
    }
    if (roomData.teamALogo) {
      const teamALogoImg = document.getElementById('teamALogoImg')
      const normalizedPath = roomData.teamALogo.replace(/\\/g, '/')
      const fileUrl = normalizedPath.startsWith('/')
        ? `file://${encodeURI(normalizedPath)}`
        : `file:///${encodeURI(normalizedPath)}`
      teamALogoImg.src = fileUrl
      teamALogoImg.style.display = 'block'
      const teamAContainer = document.getElementById('teamALogo')
      applyImageFitToContainer(teamAContainer)
    } else {
      document.getElementById('teamALogoImg').style.display = 'none'
    }
    if (roomData.teamBLogo) {
      const teamBLogoImg = document.getElementById('teamBLogoImg')
      const normalizedPath = roomData.teamBLogo.replace(/\\/g, '/')
      const fileUrl = normalizedPath.startsWith('/')
        ? `file://${encodeURI(normalizedPath)}`
        : `file:///${encodeURI(normalizedPath)}`
      teamBLogoImg.src = fileUrl
      teamBLogoImg.style.display = 'block'
      const teamBContainer = document.getElementById('teamBLogo')
      applyImageFitToContainer(teamBContainer)
    } else {
      document.getElementById('teamBLogoImg').style.display = 'none'
    }

    // 本地BP模式：不连接服务器
    if (roomData && roomData.localMode) {
      console.log('[Frontend] localMode=true，跳过 connectToServer')
      return
    }

    connectToServer()
  })

  // 监听更新数据
  window.electronAPI.onUpdateData(async (data) => {
    console.log('收到更新数据:', data)
    if (data.type === 'timer') {
      // 更新计时器显示
      updateTimerFromBackend(data.remaining)
      updateTimerProgressBar(data.remaining, data.total, data.indeterminate)
    } else if (data.type === 'local-bp-blink') {
      triggerLocalBlink(data.index)
    } else if (data.type === 'state') {
      // 更新状态显示
      updateDisplay(data.state)
    } else if (data.type === 'layout-updated') {
      // 布局已更新，热更新加载
      console.log('布局已更新，执行热更新...')
      await reloadLayoutHot()
    } else if (data.type === 'layout-reset') {
      // 布局已重置，重新加载页面
      console.log('布局已重置，重新加载...')
      location.reload()
    } else if (data.type === 'open-layout-settings') {
      try {
        openLayoutSettings()
        setTimeout(() => {
          const el = document.getElementById('enable3dModels') || document.getElementById('model3dTargetFPS')
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          try { el?.focus() } catch { /* ignore */ }
        }, 60)
      } catch (e) {
        console.warn('[Frontend] open-layout-settings failed:', e?.message || e)
      }
    } else if (data.type === 'bp-reset') {
      // BP重置：恢复布局状态（例如恢复因动画显示的隐藏元素）
      console.log('[Frontend] 收到 BP Reset 信号，重新应用布局...')
      applyLayout()
    } else {
      // 兼容旧的直接传state的方式
      updateDisplay(data)
    }
  })

  // 热更新函数
  async function reloadLayoutHot() {
    console.log('[Frontend] 执行布局热更新...')
    const result = await window.electronAPI.loadLayout()
    if (result.success && result.layout) {
      currentLayout = { ...defaultLayout, ...result.layout }
      applyLayout()
      applyGlobalBanLayoutConfig()
      applyLocalBanLayoutConfig()
      if (currentLayout.backgroundImage) {
        setBackground(currentLayout.backgroundImage)
      }
      // 如果面板打开着，同步一下输入框内容
      if (document.getElementById('layoutSettingsPanel')?.classList.contains('show')) {
        openLayoutSettings()
      }
    }
  }

  function triggerLocalBlink(index) {
    const i = Number(index)
    const el = (i >= 0 && i <= 3)
      ? document.getElementById(`survivor${i + 1}`)
      : (i === 4 ? document.getElementById('hunter') : null)
    if (!el) return

    if (el.classList.contains('pending')) {
      el.classList.remove('pending')
      if (window.ASGAnimations && window.ASGAnimations.stopBlinkAnimation) {
        window.ASGAnimations.stopBlinkAnimation(el)
      }
    } else {
      el.classList.add('pending')
      if (window.ASGAnimations && window.ASGAnimations.playBlinkAnimation) {
        window.ASGAnimations.playBlinkAnimation(el)
      }
    }
  }

  // 监听编辑模式切换请求
  window.electronAPI.onToggleEditMode(() => {
    console.log('收到切换编辑模式请求')
    toggleEditMode()
  })

  // 监听从布局包重新加载的消息
  if (window.electronAPI && window.electronAPI.onReloadLayoutFromPack) {
    console.log('[Frontend] 正在注册 onReloadLayoutFromPack 监听器...')
    window.electronAPI.onReloadLayoutFromPack(async () => {
      console.log('[Frontend] ========== 收到重新加载布局包的消息 ==========')

      // 先退出编辑模式，确保布局能被应用
      if (editMode) {
        console.log('[Frontend] 退出编辑模式以应用新布局')
        exitEditMode()
      }

      await reloadLayoutHot()
      console.log('[Frontend] ========== 布局包已热更新完成 ==========')
    })
    console.log('[Frontend] onReloadLayoutFromPack 监听器已注册')
  } else {
    console.error('[Frontend] electronAPI.onReloadLayoutFromPack 不可用！')
  }

  // 加载插件前台组件
  await loadPluginWidgets()

  // 加载用户自定义组件
  await loadCustomComponents()

  console.log('前台页面初始化完成')

  // 播放开场动画序列
  if (window.ASGAnimations && typeof window.ASGAnimations.playEntranceSequence === 'function') {
    // 稍微延迟以确保DOM完全就绪
    setTimeout(() => {
      // [Fix] 执行一次完整的布局应用（类似重置BP），确保所有控件（包括未参与动画的）状态正确
      console.log('[Frontend] 初始化最终阶段：执行完整布局重置')
      applyLayout()

      // [Fix] 优化开场动画逻辑：
      const entranceTargets = []

      // 默认入场目标
      const defaultTargets = ['survivor1', 'survivor2', 'survivor3', 'survivor4', 'hunter']
      defaultTargets.forEach(id => {
        if (currentLayout[id] && !currentLayout[id].hidden) {
          entranceTargets.push(id)
        }
      })

      // 检查自定义动画中的入场目标
      if (currentLayout.customAnimations) {
        currentLayout.customAnimations.forEach(anim => {
          if (anim.category === 'entrance' && anim.targets) {
            anim.targets.forEach(t => {
              if (entranceTargets.includes(t)) return

              if (t === 'customComponents') {
                document.querySelectorAll('.custom-component').forEach(comp => {
                  if (comp.id && !entranceTargets.includes(comp.id)) {
                    if (currentLayout[comp.id] && !currentLayout[comp.id].hidden) {
                      entranceTargets.push(comp.id)
                    }
                  }
                })
              } else if (currentLayout[t]) {
                // [Fix] 即使在布局中被隐藏，如果被指定了入场动画，也应该加入播放列表
                // applyAnimation 会负责强制取消隐藏
                entranceTargets.push(t)
              } else if (t === 'background' || t === 'timerProgressBar') {
                entranceTargets.push(t)
              }
            })
          }
        })
      }

      // 预隐藏所有入口目标 (opacity: 0)
      entranceTargets.forEach(id => {
        const el = document.getElementById(id)
        if (el) el.style.opacity = '0'
      })

      // 仅对筛选出的有效目标播放动画
      if (entranceTargets.length > 0) {
        console.log('[Frontend] 开始播放筛选后的入场动画:', entranceTargets)
        window.ASGAnimations.playEntranceSequence(entranceTargets)

        // 动画播放指令已发出，立即移除手动隐藏的 opacity: 0
        requestAnimationFrame(() => {
          entranceTargets.forEach(id => {
            const el = document.getElementById(id)
            if (el) el.style.opacity = ''
          })
        })
      }

      // [Fix] 所有的布局恢复和动画预设都完成了，现在显示页面
      // 避免了窗口打开瞬间看到错误状态的"穿帮"
      requestAnimationFrame(() => {
        document.body.style.opacity = '1'
      })
    }, 500)
  }
}

// 加载插件前台组件
async function loadPluginWidgets() {
  try {
    if (!window.plugins || !window.plugins.getFrontendWidgets) {
      console.log('[Frontend] 插件 API 未就绪，跳过加载前台组件')
      return
    }

    const widgets = await window.plugins.getFrontendWidgets()
    console.log(`[Frontend] 获取到 ${widgets.length} 个插件前台组件`)

    widgets.forEach(widget => {
      createPluginWidget(widget)
    })

    // 监听组件变化
    if (window.plugins.onFrontendWidgetsChanged) {
      window.plugins.onFrontendWidgetsChanged(async () => {
        console.log('[Frontend] 插件前台组件已变化，重新加载...')
        // 移除旧的插件组件
        document.querySelectorAll('.plugin-widget').forEach(el => el.remove())
        // 重新加载
        const newWidgets = await window.plugins.getFrontendWidgets()
        newWidgets.forEach(widget => createPluginWidget(widget))
      })
    }

    // 监听单个组件更新
    if (window.plugins.onFrontendWidgetUpdated) {
      window.plugins.onFrontendWidgetUpdated((widgetId, widget) => {
        console.log(`[Frontend] 组件 ${widgetId} 已更新`)
        updatePluginWidget(widgetId, widget)
      })
    }
  } catch (e) {
    console.error('[Frontend] 加载插件前台组件失败:', e)
  }
}

// ========= 用户自定义组件系统 =========
let customComponentsLoaded = []

// 加载用户自定义组件
async function loadCustomComponents() {
  try {
    console.log('[Frontend] 开始加载用户自定义组件...')
    const result = await window.electronAPI.loadLayout()
    if (!result.success || !result.layout || !result.layout.customComponents) {
      console.log('[Frontend] 无用户自定义组件')
      return
    }

    const components = result.layout.customComponents
    customComponentsLoaded = components

    // 只渲染目标页面包含 frontend 的组件
    const frontendComponents = components.filter(c =>
      c.targetPages && c.targetPages.includes('frontend')
    )

    console.log(`[Frontend] 加载 ${frontendComponents.length} 个用户自定义组件`)

    frontendComponents.forEach(comp => {
      createCustomComponent(comp)
    })

    // 监听自定义组件更新事件
    if (window.electronAPI && window.electronAPI.on) {
      window.electronAPI.on('update-data', (data) => {
        if (data && data.type === 'custom-components-updated') {
          console.log('[Frontend] 收到自定义组件更新通知')
          refreshCustomComponents(data.components)
        }
      })
    }
  } catch (e) {
    console.error('[Frontend] 加载用户自定义组件失败:', e)
  }
}

// 刷新自定义组件
async function refreshCustomComponents(newComponents) {
  try {
    // 移除旧的自定义组件
    document.querySelectorAll('.custom-component').forEach(el => el.remove())

    if (!newComponents) {
      const result = await window.electronAPI.loadLayout()
      newComponents = result.layout?.customComponents || []
    }

    customComponentsLoaded = newComponents

    // 只渲染目标页面包含 frontend 的组件
    const frontendComponents = newComponents.filter(c =>
      c.targetPages && c.targetPages.includes('frontend')
    )

    frontendComponents.forEach(comp => {
      createCustomComponent(comp)
    })

    console.log(`[Frontend] 刷新了 ${frontendComponents.length} 个用户自定义组件`)
  } catch (e) {
    console.error('[Frontend] 刷新自定义组件失败:', e)
  }
}

// 创建自定义组件
function createCustomComponent(comp) {
  console.log(`[Frontend] createCustomComponent 被调用，组件ID: ${comp.id}, 类型: ${comp.type}`)
  console.log(`[Frontend] comp 数据:`, {
    id: comp.id,
    name: comp.name,
    type: comp.type,
    width: comp.width,
    height: comp.height,
    imageData: comp.imageData ? `base64(${comp.imageData.substring(0, 50)}...)` : 'null',
    imageUrl: comp.imageUrl,
    html: comp.html ? `${comp.html.substring(0, 100)}...` : 'null'
  })
  console.log(`[Frontend] currentLayout[${comp.id}]:`, currentLayout[comp.id])

  if (document.getElementById(comp.id)) {
    console.log(`[Frontend] 组件 ${comp.id} 已存在，更新内容`)
    const container = document.getElementById(comp.id)
    const content = container.querySelector('.custom-component-content')
    if (content) content.innerHTML = comp.html || ''

    // 更新布局位置
    const layoutPos = currentLayout[comp.id]
    if (layoutPos) {
      console.log(`[Frontend] 更新已存在组件的位置:`, layoutPos)
      container.style.left = layoutPos.x + 'px'
      container.style.top = layoutPos.y + 'px'
      container.style.width = layoutPos.width + 'px'
      if (layoutPos.height !== 'auto' && layoutPos.height) container.style.height = layoutPos.height + 'px'
    }
    return
  }

  const container = document.createElement('div')
  container.id = comp.id
  container.className = 'draggable-container custom-component'
  container.dataset.type = 'custom'
  container.dataset.componentType = comp.type

  // 应用位置和大小（优先从布局中获取）
  const layoutData = currentLayout[comp.id]
  let finalX, finalY, finalWidth, finalHeight

  if (layoutData && typeof layoutData.x === 'number') {
    // 布局中有保存的位置数据，优先使用
    finalX = layoutData.x
    finalY = layoutData.y
    finalWidth = layoutData.width
    finalHeight = layoutData.height
    console.log(`[Frontend] 使用 currentLayout 中的位置:`, { x: finalX, y: finalY, width: finalWidth, height: finalHeight })
  } else {
    // 使用默认位置
    finalX = 100
    finalY = 100
    finalWidth = comp.width || 200
    finalHeight = comp.height || 'auto'
    console.log(`[Frontend] 使用默认/组件定义位置:`, { x: finalX, y: finalY, width: finalWidth, height: finalHeight })
  }

  // 处理尺寸值
  if (!finalWidth || finalWidth === 'auto') finalWidth = 'auto'
  else if (typeof finalWidth === 'string') finalWidth = parseInt(finalWidth) + 'px'
  else finalWidth = finalWidth + 'px'

  if (!finalHeight || finalHeight === 'auto') finalHeight = 'auto'
  else if (typeof finalHeight === 'string') finalHeight = parseInt(finalHeight) + 'px'
  else finalHeight = finalHeight + 'px'

  container.style.cssText = `
        left: ${finalX}px;
        top: ${finalY}px;
        width: ${finalWidth};
        height: ${finalHeight};
        position: absolute;
        z-index: 15;
        min-width: 50px;
        min-height: 20px;
      `

  console.log(`[Frontend] 容器最终样式:`, container.style.cssText)

  // 添加标签（编辑模式显示）
  const label = document.createElement('div')
  label.className = 'control-label'
  label.textContent = comp.name || '自定义组件'
  container.appendChild(label)

  // 添加内容
  const content = document.createElement('div')
  content.className = 'custom-component-content'
  content.style.cssText = 'width: 100%; height: 100%; overflow: hidden;'

  // 如果有自定义CSS，添加到页面
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

  // 处理内容和图片修复
  let htmlContent = comp.html || '<div style="padding: 10px; color: #aaa;">空组件</div>'

  // 对于图片组件，进行更严格的检查和修复，并强制跟随容器大小
  if (comp.type === 'image') {
    console.log(`[Frontend] 处理图片组件，imageData 长度: ${comp.imageData ? comp.imageData.length : 0}`)

    // 强制使用 100% 宽高，跟随容器
    const imgWidth = '100%'
    const imgHeight = '100%'
    const imgFit = comp.objectFit || 'contain'

    // 检查是否需要修复 HTML
    const needsFix = !htmlContent.includes('<img') ||
      htmlContent.includes('src=""') ||
      htmlContent.includes('src="undefined"') ||
      htmlContent.includes('src="null"')

    // 哪怕不需要修复 HTML，我们也要强制修改 IMG 的样式
    // 创建一个临时容器来解析 HTML
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent
    const img = tempDiv.querySelector('img')

    if (img) {
      // 找到了 img 标签，重置其样式
      img.style.width = '100%'
      img.style.height = '100%'
      img.style.objectFit = imgFit
      img.style.display = 'block'
      // 如果 src 有问题且有 imageData，修复它
      if ((!img.src || img.src.includes('null') || img.src.includes('undefined')) && comp.imageData) {
        img.src = comp.imageData
      }
      htmlContent = tempDiv.innerHTML
    } else if (comp.imageData || comp.imageUrl) {
      // 没找到 img 标签（或者 needsFix 为 true），重建它
      const src = comp.imageData || comp.imageUrl
      htmlContent = `<img src="${src}" style="width: 100%; height: 100%; object-fit: ${imgFit}; display: block;" draggable="false" />`
    }
  }

  content.innerHTML = htmlContent
  container.appendChild(content)

  // 添加调整大小手柄
  const handles = ['nw', 'ne', 'sw', 'se']
  handles.forEach(dir => {
    const handle = document.createElement('div')
    handle.className = `resize-handle ${dir}`
    handle.dataset.dir = dir
    container.appendChild(handle)
  })

  document.body.appendChild(container)

  // 为这个容器添加拖拽支持
  setupContainerDraggable(container)

  console.log(`[Frontend] ✓ 自定义组件创建完成: ${comp.id} (${comp.name})`)
}

// 创建插件前台组件
function createPluginWidget(widget) {
  if (document.getElementById(widget.id)) {
    console.log(`[Frontend] 组件 ${widget.id} 已存在，跳过创建`)
    return
  }

  const container = document.createElement('div')
  container.id = widget.id
  container.className = 'draggable-container plugin-widget'
  container.dataset.type = 'plugin'
  container.dataset.pluginId = widget.pluginId

  // 应用位置和大小（优先从布局中获取）
  const layoutPos = currentLayout[widget.id] || widget.defaultPosition
  const layoutSize = currentLayout[widget.id] || widget.defaultSize

  container.style.cssText = `
        left: ${layoutPos.x}px;
        top: ${layoutPos.y}px;
        width: ${layoutSize.width}px;
        height: ${layoutSize.height}px;
        position: absolute;
      `

  // 应用自定义样式
  if (widget.style) {
    Object.assign(container.style, widget.style)
  }

  // 添加标签（编辑模式显示）
  const label = document.createElement('div')
  label.className = 'control-label'
  // use mapping if available, else fallback
  const idToLabel = {
    'survivor1': '求生者1',
    'survivor2': '求生者2',
    'survivor3': '求生者3',
    'survivor4': '求生者4',
    'hunter': '监管者',
    'survivorBanList': '求生者禁用',
    'hunterBanList': '监管者禁用',
    'globalBanSurvivorList': '全局求生者禁用',
    'globalBanHunterList': '全局监管者禁用',
    'mapInfo': '地图信息',
    'mapImage': '地图图片',
    'phaseInfo': '阶段信息',
    'timerBox': '倒计时',
    'teamALogo': '战队A Logo',
    'teamBLogo': '战队B Logo'
  };

  label.textContent = idToLabel[widget.id] || widget.label || widget.id
  container.appendChild(label)

  // 添加内容
  const content = document.createElement('div')
  content.className = 'plugin-widget-content'
  content.style.cssText = 'width: 100%; height: 100%; overflow: hidden;'
  content.innerHTML = widget.html || ''
  container.appendChild(content)

  // 添加调整大小手柄（如果可调整大小）
  if (widget.resizable) {
    const handles = ['nw', 'ne', 'sw', 'se']
    handles.forEach(dir => {
      const handle = document.createElement('div')
      handle.className = `resize-handle ${dir}`
      handle.dataset.dir = dir
      container.appendChild(handle)
    })
  }

  document.body.appendChild(container)

  // 为这个容器单独添加拖拽支持
  if (widget.draggable) {
    setupContainerDraggable(container)
  }

  console.log(`[Frontend] 创建插件组件: ${widget.id}`)
}

// 为单个容器设置拖拽功能
function setupContainerDraggable(container) {
  let isDragging = false
  let isResizing = false
  let resizeDir = null
  let startX, startY, startLeft, startTop, startWidth, startHeight
  let pendingUpdate = null
  let rafId = null

  let listenersAttached = false

  function updatePosition() {
    if (!pendingUpdate || !editMode) return

    const { dx, dy } = pendingUpdate

    if (isDragging) {
      // container.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      const curLeft = startLeft + dx
      const curTop = startTop + dy
      container.style.setProperty('left', `${curLeft}px`, 'important')
      container.style.setProperty('top', `${curTop}px`, 'important')
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

      if (newWidth > 50) {
        container.style.width = `${newWidth}px`
        if (resizeDir.includes('w')) {
          container.style.left = `${newLeft}px`
        }
      }
      if (newHeight > 50) {
        container.style.height = `${newHeight}px`
        if (resizeDir.includes('n')) {
          container.style.top = `${newTop}px`
        }
      }
    }

    pendingUpdate = null
    rafId = null
  }

  function attachDocListeners() {
    if (listenersAttached) return
    listenersAttached = true
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  function detachDocListeners() {
    if (!listenersAttached) return
    listenersAttached = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  const onMouseDown = (e) => {
    if (!editMode) return

    // 获取点击的实际目标
    let target = e.target
    let isHandleClick = false
    let isDragClick = false

    // 检查是否点击调整大小手柄
    if (target.classList.contains('resize-handle')) {
      isHandleClick = true
      isResizing = true
      resizeDir = target.dataset.dir
    } else {
      // 向上查找是否在容器内
      while (target && target !== document) {
        if (target === container) {
          isDragClick = true
          break
        }
        target = target.parentElement
      }
    }

    if (!isHandleClick && !isDragClick) return

    if (isDragClick && !isHandleClick) {
      isDragging = true
    }

    container.classList.toggle('dragging', isDragging)
    container.classList.toggle('resizing', isResizing)

    startX = e.clientX
    startY = e.clientY
    startLeft = container.offsetLeft
    startTop = container.offsetTop
    startWidth = container.offsetWidth
    startHeight = container.offsetHeight

    container.style.transform = ''
    // 禁用过渡效果以确保跟手
    container.style.transition = 'none'

    attachDocListeners()

    e.preventDefault()
    e.stopPropagation()
  }

  const onMouseMove = (e) => {
    if (!editMode || (!isDragging && !isResizing)) return

    const dx = e.clientX - startX
    const dy = e.clientY - startY

    pendingUpdate = { dx, dy }
    if (!rafId) {
      rafId = requestAnimationFrame(updatePosition)
    }
  }

  const onMouseUp = async () => {
    if ((isDragging || isResizing) && container) {
      console.log(`[Frontend] onMouseUp 触发，容器ID: ${container.id}`)
      console.log(`[Frontend] isDragging: ${isDragging}, isResizing: ${isResizing}`)

      // 将 transform 转换为 left/top
      // const transform = container.style.transform

      let newLeft = startLeft
      let newTop = startTop
      let newWidth = startWidth
      let newHeight = startHeight

      if (isDragging) {
        newLeft = parseFloat(container.style.left) || startLeft
        newTop = parseFloat(container.style.top) || startTop
        container.style.removeProperty('transition')

        container.style.setProperty('left', `${newLeft}px`, 'important')
        container.style.setProperty('top', `${newTop}px`, 'important')
      }

      if (isResizing) {
        // 如果是调整大小，从 style 读取最新的 width/height
        newWidth = parseInt(container.style.width) || startWidth
        newHeight = parseInt(container.style.height) || startHeight
        newLeft = parseInt(container.style.left) || startLeft
        newTop = parseInt(container.style.top) || startTop
        console.log(`[Frontend] 调整大小完成，新尺寸: width=${newWidth}, height=${newHeight}`)
      }

      // 更新 currentLayout 对象，防止位置闪回
      if (!currentLayout[container.id]) {
        currentLayout[container.id] = {}
        console.log(`[Frontend] 为 ${container.id} 创建新的布局条目`)
      }

      const oldLayout = { ...currentLayout[container.id] }
      currentLayout[container.id].x = newLeft
      currentLayout[container.id].y = newTop
      currentLayout[container.id].width = newWidth
      currentLayout[container.id].height = newHeight

      console.log(`[Frontend] currentLayout[${container.id}] 已更新:`)
      console.log(`[Frontend]   旧值:`, oldLayout)
      console.log(`[Frontend]   新值:`, currentLayout[container.id])

      // 如果是自定义组件，还需要确保 customComponents 数组中的尺寸同步（虽然主要用 id 索引的配置）
      // 但为了保险，如果它是自定义组件，也更新一下
      if (container.dataset.type === 'custom') {
        // 可选：如果组件编辑器也用这个宽高的话
      }

      // 保存布局 (saveLayout 内部已移除 alert)
      console.log(`[Frontend] 调用 saveLayout(true)...`)
      await saveLayout(true) // 传入 true 表示静默保存
      console.log(`[Frontend] saveLayout 完成`)
    }

    isDragging = false
    isResizing = false
    resizeDir = null

    container.classList.remove('dragging')
    container.classList.remove('resizing')
    detachDocListeners()
  }

  container.addEventListener('mousedown', onMouseDown)

  // 添加右键菜单支持 (修复自定义组件没有右键菜单的问题)
  container.addEventListener('contextmenu', (e) => {
    if (!editMode) return
    showUnifiedContextMenu(e, container)
  })
}

// 更新插件组件
function updatePluginWidget(widgetId, widget) {
  const container = document.getElementById(widgetId)
  if (!container) {
    console.warn(`[Frontend] 组件 ${widgetId} 不存在`)
    return
  }

  // 更新内容
  const content = container.querySelector('.plugin-widget-content')
  if (content && widget.html) {
    content.innerHTML = widget.html
  }

  // 更新样式
  if (widget.style) {
    Object.assign(container.style, widget.style)
  }
}

// 更新计时器进度条
function updateTimerProgressBar(remaining, total, indeterminate) {
  const fill = document.getElementById('timerProgressFill')
  if (!fill) return

  if (indeterminate) {
    fill.classList.add('indeterminate')
    fill.style.width = '' // let css animation handle it
    fill.classList.remove('warning')
  } else {
    fill.classList.remove('indeterminate')
    const t = total || 60 // fallback

    let percent = 0
    // 如果 remaining 是数字
    if (typeof remaining === 'number') {
      if (t > 0) {
        percent = (remaining / t) * 100
      }
      percent = Math.max(0, Math.min(100, percent))
    }

    fill.style.width = `${percent}%`

    if (remaining <= 10) {
      fill.classList.add('warning')
    } else {
      fill.classList.remove('warning')
    }
  }
}

// 辅助：应用单个元素布局
function applyElementLayout(el, layout) {
  if (!el || !layout) return;

  const { x, y, width, height, hidden, fontFamily, textColor, zIndex } = layout;

  // 清除可能存在的 transform
  el.style.transform = '';

  // 使用 setProperty 确保样式被应用
  el.style.setProperty('left', `${x}px`, 'important');
  el.style.setProperty('top', `${y}px`, 'important');
  el.style.setProperty('width', `${width}px`, 'important');
  el.style.setProperty('height', `${height}px`, 'important');
  el.style.setProperty('position', 'absolute', 'important');
  if (zIndex !== undefined && zIndex !== null) {
    el.style.setProperty('z-index', zIndex, 'important');
  }

  // 应用字体
  if (fontFamily) {
    el.style.setProperty('font-family', `"${fontFamily}", sans-serif`, 'important');
  } else {
    el.style.removeProperty('font-family');
  }

  // 应用文字颜色
  if (textColor) {
    const textElement = el.querySelector('span') ||
      el.querySelector('.team-name') ||
      el.querySelector('#mapName') ||
      el.querySelector('#phaseName') ||
      el.querySelector('#timerDisplay');
    if (textElement) {
      textElement.style.color = textColor;
    }
  }

  // 隐藏控制：非编辑模式隐藏；编辑模式保留但半透明
  const isHidden = (typeof hidden === 'boolean') ? hidden : false;
  el.classList.toggle('layout-hidden', isHidden);
  if (!editMode && isHidden) {
    el.style.display = 'none';
  } else {
    el.style.display = '';
  }

  // 验证样式是否被应用
  const computedStyle = window.getComputedStyle(el);
  console.log(`[Frontend] ${el.id} 应用后的实际样式: left=${computedStyle.left}, top=${computedStyle.top}, width=${computedStyle.width}, height=${computedStyle.height}, fontFamily=${computedStyle.fontFamily}`);

  // [Fix] 同步展示模式到 DOM 属性，确保右键菜单状态正确
  if (/^(survivor[1-4]|hunter)$/.test(el.id)) {
    const mode = layout.displayMode || 'half';
    el.setAttribute('data-display-mode', mode);
  }
  if (layout.imageFit) {
    applyImageFitToContainer(el, layout.imageFit);
  }
}

// 应用布局
function applyLayout() {
  console.log('[Frontend] applyLayout 开始执行')
  console.log('[Frontend] currentLayout 内容:', currentLayout)
  let appliedCount = 0
  let notFoundCount = 0

  // 处理透明背景设置
  if (currentLayout && currentLayout.transparentBackground) {
    document.body.classList.add('transparent-bg')
    console.log('[Frontend] 启用透明背景模式')
  } else {
    document.body.classList.remove('transparent-bg')
  }

  // 需要跳过的非DOM元素配置字段
  const skipFields = [
    'backgroundImage', 'windowBounds', 'globalBanConfig', 'localBanConfig',
    'model3d', 'transparentBackground', 'scoreboardLayouts', 'postMatchLayout', 'renderResolution',
    // BPUI 转换相关字段
    'version', 'convertedFrom', 'convertedAt', 'settings', 'elements',
    'frontendResolution', 'frontendTextSettings',
    'cutSceneResolution', 'cutSceneTextSettings', 'cutSceneSettings',
    'scoreboardResolution', 'scoreboardTextSettings', 'scoreboardImages', 'scoreboardSettings',
    'postMatchResolution', 'postMatchTextSettings', 'postMatchBackground',
    'widgetsSettings', 'widgetsTextSettings', 'widgetsImages',
    'timerProgressBar' // Skip timerProgressBar from generic loop, handle separately
  ]

  Object.keys(currentLayout).forEach(id => {
    // 跳过非元素配置的字段
    if (skipFields.includes(id)) {
      console.log(`[Frontend] 跳过配置字段: ${id}`)
      return
    }

    const el = document.getElementById(id)
    if (!el) {
      console.warn(`[Frontend] DOM元素未找到: ${id}`)
      notFoundCount++
      return
    }

    if (!currentLayout[id]) {
      console.warn(`[Frontend] 元素 ${id} 的布局配置为空`)
      return
    }

    applyElementLayout(el, currentLayout[id]);
    appliedCount++;
  })

  // 更新倒计时进度条布局及颜色
  const timerProgressBar = document.getElementById('timerProgressBar')
  if (timerProgressBar && currentLayout.timerProgressBar) {
    applyElementLayout(timerProgressBar, currentLayout.timerProgressBar)

    // 应用自定义颜色
    if (currentLayout.timerProgressBar.progressColor) {
      const fill = timerProgressBar.querySelector('.progress-fill')
      if (fill) fill.style.backgroundColor = currentLayout.timerProgressBar.progressColor
    }
    if (currentLayout.timerProgressBar.trackColor) {
      const track = timerProgressBar.querySelector('.progress-track')
      if (track) track.style.backgroundColor = currentLayout.timerProgressBar.trackColor
    }
    appliedCount++;
  }

  console.log(`[Frontend] 布局应用完成 - 成功: ${appliedCount}, 未找到: ${notFoundCount}`)
}

// ========= 颜色预设点击事件 =========
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.color-preset-inline').forEach(preset => {
    preset.addEventListener('click', () => {
      const color = preset.dataset.color
      document.getElementById('textColorPicker').value = color
    })
  })
})

function getGlobalBanConfig() {
  const def = {
    survivor: { maxPerRow: 4, itemGap: 8, rowGap: 8, itemSize: 50 },
    hunter: { maxPerRow: 1, itemGap: 8, rowGap: 8, itemSize: 50 }
  }
  const cfg = (currentLayout && currentLayout.globalBanConfig) ? currentLayout.globalBanConfig : {}
  return {
    survivor: Object.assign({}, def.survivor, cfg.survivor || {}),
    hunter: Object.assign({}, def.hunter, cfg.hunter || {})
  }
}

function applyGlobalBanLayoutConfig() {
  const cfg = getGlobalBanConfig()
  const sur = cfg.survivor
  const hun = cfg.hunter
  const surList = document.getElementById('globalBanSurvivorList')
  const hunList = document.getElementById('globalBanHunterList')
  if (surList) {
    surList.style.display = 'grid'
    surList.style.gridTemplateColumns = `repeat(${Math.max(1, Number(sur.maxPerRow))}, ${Number(sur.itemSize) || 50}px)`
    surList.style.gridAutoRows = `${Number(sur.itemSize) || 50}px`
    surList.style.columnGap = `${Number(sur.itemGap) || 8}px`
    surList.style.rowGap = `${Number(sur.rowGap) || 8}px`
    // 更新现有子元素尺寸
    Array.from(surList.children).forEach(child => {
      child.style.width = '100%'
      child.style.height = '100%'
    })
  }
  if (hunList) {
    hunList.style.display = 'grid'
    hunList.style.gridTemplateColumns = `repeat(${Math.max(1, Number(hun.maxPerRow))}, ${Number(hun.itemSize) || 50}px)`
    hunList.style.gridAutoRows = `${Number(hun.itemSize) || 50}px`
    hunList.style.columnGap = `${Number(hun.itemGap) || 8}px`
    hunList.style.rowGap = `${Number(hun.rowGap) || 8}px`
    // 更新现有子元素尺寸
    Array.from(hunList.children).forEach(child => {
      child.style.width = '100%'
      child.style.height = '100%'
    })
  }
}

function getLocalBanConfig() {
  const def = {
    survivor: { maxPerRow: 4, itemGap: 10, rowGap: 10, itemSize: 60 },
    hunter: { maxPerRow: 1, itemGap: 10, rowGap: 10, itemSize: 60 }
  }
  const cfg = (currentLayout && currentLayout.localBanConfig) ? currentLayout.localBanConfig : {}
  return {
    survivor: Object.assign({}, def.survivor, cfg.survivor || {}),
    hunter: Object.assign({}, def.hunter, cfg.hunter || {})
  }
}

function applyLocalBanLayoutConfig() {
  const cfg = getLocalBanConfig()
  const sur = cfg.survivor
  const hun = cfg.hunter
  const surList = document.getElementById('survivorBanList')
  const hunList = document.getElementById('hunterBanList')
  if (surList) {
    surList.style.display = 'grid'
    surList.style.gridTemplateColumns = `repeat(${Math.max(1, Number(sur.maxPerRow))}, ${Number(sur.itemSize) || 60}px)`
    surList.style.gridAutoRows = `${Number(sur.itemSize) || 60}px`
    surList.style.columnGap = `${Number(sur.itemGap) || 10}px`
    surList.style.rowGap = `${Number(sur.rowGap) || 10}px`
    // 更新现有子元素尺寸
    Array.from(surList.children).forEach(child => {
      child.style.width = '100%'
      child.style.height = '100%'
    })
  }
  if (hunList) {
    hunList.style.display = 'grid'
    hunList.style.gridTemplateColumns = `repeat(${Math.max(1, Number(hun.maxPerRow))}, ${Number(hun.itemSize) || 60}px)`
    hunList.style.gridAutoRows = `${Number(hun.itemSize) || 60}px`
    hunList.style.columnGap = `${Number(hun.itemGap) || 10}px`
    hunList.style.rowGap = `${Number(hun.rowGap) || 10}px`
    // 更新现有子元素尺寸
    Array.from(hunList.children).forEach(child => {
      child.style.width = '100%'
      child.style.height = '100%'
    })
  }
}

// 设置背景
function setBackground(path) {
  const bg = document.getElementById('background')
  if (!bg) {
    console.error('[Frontend] setBackground: 找不到background元素')
    return
  }

  if (!path) {
    console.warn('[Frontend] setBackground: 路径为空')
    bg.style.backgroundImage = 'none'
    // 清除可能存在的视频
    const existingVideo = bg.querySelector('video')
    if (existingVideo) existingVideo.remove()

    document.body.classList.remove('has-background')
    return
  }

  // 检测是否为视频 (根据扩展名)
  const isVideo = /\.(mp4|webm|mkv|avi|mov)(\?|$|#)/i.test(String(path))
  let finalUrl = ''

  // OBS 浏览器源禁止加载本地 file:/// 资源，必须改走 HTTP(/background/)
  if (window.__ASG_OBS_MODE__) {
    let url = String(path)
    // 已经是可用的 http/https 或站内绝对路径
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
      finalUrl = url
    } else {
      // 兼容 Windows 路径 / file:/// URL：统一映射到 /background/<basename>
      const normalized = url.replace(/\\/g, '/')
      const base = normalized.split('/').pop()
      finalUrl = '/background/' + encodeURIComponent(base)
    }
    console.log(`[Frontend] setBackground(OBS, ${isVideo ? 'Video' : 'Image'}):`, path, '->', finalUrl)
  } else {
    // Electron 本地窗口：优先使用 http/file/data 等可直接用的 URL
    const asStr = String(path)
    if (asStr.startsWith('http://') || asStr.startsWith('https://') || asStr.startsWith('file:') || asStr.startsWith('data:') || asStr.startsWith('blob:')) {
      finalUrl = asStr
    } else {
      const normalizedPath = asStr.replace(/\\/g, '/')
      finalUrl = normalizedPath.startsWith('/')
        ? `file://${encodeURI(normalizedPath)}`
        : `file:///${encodeURI(normalizedPath)}`
    }
    console.log(`[Frontend] setBackground(Local, ${isVideo ? 'Video' : 'Image'}):`, path, '->', finalUrl)
  }

  if (isVideo) {
    // 视频模式
    bg.style.backgroundImage = 'none'

    let videoEl = bg.querySelector('video')
    if (!videoEl) {
      videoEl = document.createElement('video')
      videoEl.style.position = 'absolute'
      videoEl.style.top = '0'
      videoEl.style.left = '0'
      videoEl.style.width = '100%'
      videoEl.style.height = '100%'
      videoEl.style.objectFit = 'cover'
      videoEl.style.zIndex = '0' // 确保在背景容器内
      videoEl.autoplay = true
      videoEl.loop = true
      videoEl.muted = true
      videoEl.playsInline = true
      videoEl.removeAttribute('controls') // 确保无控件
      bg.appendChild(videoEl)
    }

    // 转换 URL 如果是 file 协议且包含 # (即使 encodeURI 也可能需要处理，但 file url 通常 ok)
    // 只有当 src 真正改变时才更新，避免闪烁
    // 注意：finalUrl 对本地文件是 file:///...
    if (videoEl.src !== finalUrl && videoEl.src !== encodeURI(finalUrl)) {
      videoEl.src = finalUrl
    }
  } else {
    // 图片模式：清除视频
    const existingVideo = bg.querySelector('video')
    if (existingVideo) existingVideo.remove()

    // 使用双引号包裹URL，并转义可能的双引号字符
    const safeUrl = finalUrl.replace(/"/g, '\\"')
    bg.style.backgroundImage = `url("${safeUrl}")`
    bg.style.backgroundSize = 'cover'
    bg.style.backgroundPosition = 'center'
    bg.style.backgroundRepeat = 'no-repeat'
  }

  document.body.classList.add('has-background')
}

function isImageFitContainer(container) {
  if (!container || !container.id) return false;
  return /^(survivor[1-4]|hunter|survivorBans|hunterBans|globalBanSurvivors|globalBanHunters|mapImage|teamALogo|teamBLogo)$/.test(container.id);
}

function getImageFitForContainer(container) {
  if (!container || !container.id) return null;
  const layout = currentLayout && currentLayout[container.id] ? currentLayout[container.id] : null;
  return layout && layout.imageFit ? layout.imageFit : null;
}

function applyImageFitToContainer(container, fit) {
  if (!container) return;
  const resolved = fit || getImageFitForContainer(container);
  if (!resolved) return;
  const images = container.querySelectorAll('img');
  const shouldStretch = !/^(survivorBans|hunterBans|globalBanSurvivors|globalBanHunters)$/.test(container.id || '');
  images.forEach(img => {
    img.style.objectFit = resolved;
    if (shouldStretch) {
      img.style.width = '100%';
      img.style.height = '100%';
    }
  });
}

async function setImageFitForContainer(container, fit) {
  if (!container || !fit) return;
  if (!currentLayout[container.id]) currentLayout[container.id] = {};
  currentLayout[container.id] = Object.assign({}, currentLayout[container.id], { imageFit: fit });
  applyImageFitToContainer(container, fit);
  applyLayout();
  try { await window.electronAPI.saveLayout(currentLayout) } catch (error) { console.error(error) }
}

// 统一右键菜单
function showUnifiedContextMenu(e, container) {
  e.preventDefault();
  e.stopPropagation();

  // 移除旧菜单
  const existing = document.getElementById('unified-context-menu');
  if (existing) existing.remove();

  const menu = document.createElement('div');
  menu.id = 'unified-context-menu';
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
  });

  const createItem = (label, icon, onClick) => {
    const item = document.createElement('div');
    item.style.padding = '8px 16px';
    item.style.cursor = 'pointer';
    item.style.display = 'flex';
    item.style.alignItems = 'center';
    item.style.gap = '8px';
    item.style.transition = 'background 0.2s';

    const iconSpan = document.createElement('span');
    iconSpan.textContent = icon;
    item.appendChild(iconSpan);

    const textSpan = document.createElement('span');
    textSpan.textContent = label;
    item.appendChild(textSpan);

    item.onmouseenter = () => item.style.backgroundColor = 'rgba(255,255,255,0.1)';
    item.onmouseleave = () => item.style.backgroundColor = 'transparent';
    item.onclick = (ev) => {
      ev.stopPropagation();
      menu.remove();
      onClick();
    };
    return item;
  };

  const id = container.id;
  const prev = (currentLayout && currentLayout[id]) ? currentLayout[id] : {};
  const isHidden = prev.hidden === true;

  // 1. 隐藏/显示
  menu.appendChild(createItem(isHidden ? '显示组件' : '隐藏组件', isHidden ? '👁️' : '🚫', async () => {
    const nextHidden = !isHidden;
    currentLayout[id] = Object.assign({}, prev, {
      x: Number.isFinite(prev.x) ? prev.x : container.offsetLeft,
      y: Number.isFinite(prev.y) ? prev.y : container.offsetTop,
      width: Number.isFinite(prev.width) ? prev.width : container.offsetWidth,
      height: Number.isFinite(prev.height) ? prev.height : container.offsetHeight,
      hidden: nextHidden
    });
    applyLayout();
    try { await window.electronAPI.saveLayout(currentLayout) } catch (error) { console.error(error) }
  }));

  // 2. 修改文字属性
  // 检查是否有文字可改（通过 ID 或内容）
  // 这里简略判断，所有可拖拽组件通常都允许尝试修改字体/颜色
  menu.appendChild(createItem('修改字体/颜色', '🎨', () => {
    openFontSelector(container.id);
  }));

  // 2.5 切换展示模式（仅限角色组件：survivor1-4 和 hunter）
  const isCharacterBox = /^(survivor[1-4]|hunter)$/.test(id);
  if (isCharacterBox) {
    // 每次打开菜单时重新读取当前模式
    const currentMode = getCharacterDisplayMode(id);
    const modeLabel = currentMode === 'half' ? '切换为全身立绘' : '切换为半身立绘';
    menu.appendChild(createItem(modeLabel, '🖼️', async () => {
      await toggleCharacterDisplayMode(id);
    }));
  }

  if (isImageFitContainer(container) || container.querySelector('img')) {
    const currentFit = getImageFitForContainer(container) || 'contain';
    const fitOptions = [
      { label: '图片填充：适应', value: 'contain' },
      { label: '图片填充：覆盖', value: 'cover' },
      { label: '图片填充：拉伸', value: 'fill' },
      { label: '图片填充：原始', value: 'none' }
    ];
    fitOptions.forEach(opt => {
      const label = `${currentFit === opt.value ? '✓ ' : ''}${opt.label}`;
      menu.appendChild(createItem(label, '🧩', async () => {
        await setImageFitForContainer(container, opt.value);
      }));
    });
  }

  // 3. 图层顺序
  const layerMenu = document.createElement('div');
  layerMenu.style.display = 'flex';
  layerMenu.style.flexDirection = 'column';
  layerMenu.style.borderTop = '1px solid #333';
  layerMenu.style.marginTop = '4px';
  layerMenu.style.paddingTop = '4px';

  const updateZIndex = async (newIdx) => {
    container.style.zIndex = newIdx;
    if (!currentLayout[id]) currentLayout[id] = {};
    currentLayout[id] = Object.assign({}, (currentLayout[id] || {}), { zIndex: newIdx });
    applyLayout();
    try { await window.electronAPI.saveLayout(currentLayout) } catch (err) { console.error(err) }
  };

  const getCurrentZ = () => {
    const s = window.getComputedStyle(container);
    const z = parseInt(s.zIndex);
    return isNaN(z) ? 0 : z;
  };

  layerMenu.appendChild(createItem('置于顶层', '⬆️', () => {
    // Find max z-index
    let maxZ = 0;
    document.querySelectorAll('.draggable-container').forEach(el => {
      const z = parseInt(window.getComputedStyle(el).zIndex) || 0;
      if (z > maxZ) maxZ = z;
    });
    updateZIndex(maxZ + 1);
  }));

  layerMenu.appendChild(createItem('上移一层', '🔼', () => {
    updateZIndex(getCurrentZ() + 1);
  }));

  layerMenu.appendChild(createItem('下移一层', '🔽', () => {
    updateZIndex(Math.max(1, getCurrentZ() - 1));
  }));

  layerMenu.appendChild(createItem('置于底层', '⬇️', () => {
    // Find min z-index but ensure result is >= 1
    let minZ = 100;
    document.querySelectorAll('.draggable-container').forEach(el => {
      const z = parseInt(window.getComputedStyle(el).zIndex) || 0;
      if (z > 0 && z < minZ) minZ = z;
    });
    // If no positive z-index found, use 1
    if (minZ === 100) minZ = 1;
    const target = minZ - 1;
    updateZIndex(target < 1 ? 1 : target);
  }));

  menu.appendChild(layerMenu);

  document.body.appendChild(menu);

  // 点击外部关闭
  setTimeout(() => {
    const closeMenu = (ev) => {
      if (!menu.contains(ev.target)) {
        menu.remove();
        removeListeners();
      }
    };
    const removeListeners = () => {
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('contextmenu', closeMenu);
    };
    document.addEventListener('click', closeMenu);
    document.addEventListener('contextmenu', closeMenu);
  }, 10);
}

// 拖拽功能（优化性能 + 吸附 + 坐标显示）
function initDraggable() {
  const containers = document.querySelectorAll('.draggable-container')
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

  // 使用 requestAnimationFrame 优化性能
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

    // Snap Logic (仅在拖拽时启用)
    let snappedX = false
    let snappedY = false

    if (isDragging) {
      // X Axis Snap
      let centerX = newLeft + startWidth / 2
      let rightX = newLeft + startWidth

      let targetX = null
      // Check Left
      for (let snap of snapLinesX) { if (Math.abs(newLeft - snap) < SNAP_THRESHOLD) { targetX = snap; break; } }
      // Check Center (visual center snap)
      if (targetX === null) for (let snap of snapLinesX) { if (Math.abs(centerX - snap) < SNAP_THRESHOLD) { targetX = snap - startWidth / 2; break; } }
      // Check Right
      if (targetX === null) for (let snap of snapLinesX) { if (Math.abs(rightX - snap) < SNAP_THRESHOLD) { targetX = snap - startWidth; break; } }

      if (targetX !== null) {
        dx = targetX - startLeft
        newLeft = targetX
        snappedX = true
        // Show Guide
        let guideX = targetX;
        if (Math.abs(newLeft - (targetX)) < 1) guideX = newLeft; // Left edge
        else if (Math.abs(rightX - (targetX + startWidth)) < 1) guideX = rightX; // Right edge
        else guideX = centerX; // Center

        snapLineV.style.left = `${Math.round(guideX)}px`
        snapLineV.style.display = 'block'
      } else {
        snapLineV.style.display = 'none'
      }

      // Y Axis Snap
      let centerY = newTop + startHeight / 2
      let bottomY = newTop + startHeight

      let targetY = null
      // Check Top
      for (let snap of snapLinesY) { if (Math.abs(newTop - snap) < SNAP_THRESHOLD) { targetY = snap; break; } }
      // Check Center
      if (targetY === null) for (let snap of snapLinesY) { if (Math.abs(centerY - snap) < SNAP_THRESHOLD) { targetY = snap - startHeight / 2; break; } }
      // Check Bottom
      if (targetY === null) for (let snap of snapLinesY) { if (Math.abs(bottomY - snap) < SNAP_THRESHOLD) { targetY = snap - startHeight; break; } }

      if (targetY !== null) {
        dy = targetY - startTop
        newTop = targetY
        snappedY = true
        // Show Guide
        let guideY = targetY; // Actually visual pos
        if (Math.abs(newTop - targetY) < 1) guideY = newTop;
        else if (Math.abs(bottomY - (targetY + startHeight)) < 1) guideY = bottomY;
        else guideY = centerY;

        snapLineH.style.top = `${Math.round(guideY)}px`
        snapLineH.style.display = 'block'
      } else {
        snapLineH.style.display = 'none'
      }
    }
    else {
      snapLineV.style.display = 'none'
      snapLineH.style.display = 'none'
    }

    lastDx = dx
    lastDy = dy

    if (isDragging) {
      // 使用 direct updates 代替 transform，避免 GPU 崩溃导致的显示问题
      // activeContainer.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
      activeContainer.style.setProperty('left', `${newLeft}px`, 'important')
      activeContainer.style.setProperty('top', `${newTop}px`, 'important')
      updateCoordDisplay(newLeft, newTop)
    } else if (isResizing) {
      // Resizing logic (No Snap implemented for simplicity, or add if requested)
      // Just update coords
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

      if (tempWidth > 10) { // Reduced min width
        activeContainer.style.width = `${tempWidth}px`
        if (resizeDir.includes('w')) activeContainer.style.left = `${tempLeft}px`
      }
      if (tempHeight > 2) { // Reduced min height for progress bar (was 50)
        activeContainer.style.height = `${tempHeight}px`
        if (resizeDir.includes('n')) activeContainer.style.top = `${tempTop}px`
      }
      updateCoordDisplay(tempLeft, tempTop)
    }

    pendingUpdate = null
    rafId = null
  }

  containers.forEach(container => {
    // 统一右键菜单
    container.addEventListener('contextmenu', (e) => {
      if (!editMode) return
      showUnifiedContextMenu(e, container)
    })

    // 双击事件已移除，统一到右键菜单 "修改字体/颜色"
    // 如果需要双击仍然打开，可以保留，但用户要求统一。
    // 为了体验，双击可以作为修改文字的快捷方式，但也作为菜单项存在。
    // 但用户说 "把...统一进去"，通常暗示移除旧的独立交互。
    // 这里我们保留双击快捷键，但也放入菜单，这样更灵活。
    container.addEventListener('dblclick', (e) => {
      if (!editMode) return
      e.preventDefault()
      e.stopPropagation()
      openFontSelector(container.id) // Corrected function call
    })

    container.addEventListener('mousedown', (e) => {
      if (!editMode) return

      // 检查是否点击调整大小手柄
      if (e.target.classList.contains('resize-handle')) {
        isResizing = true
        resizeDir = e.target.dataset.dir
      } else {
        // 使用 closest 查找容器，确保内层元素也能触发拖拽
        const targetContainer = e.target.closest('.draggable-container')
        if (targetContainer === container) {
          isDragging = true
        } else {
          return
        }
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

      // Calculate Snap Lines
      snapLinesX = []
      snapLinesY = []
      if (isDragging) {
        // Screen Center
        snapLinesX.push(window.innerWidth / 2)
        snapLinesY.push(window.innerHeight / 2)
        // Other Containers
        document.querySelectorAll('.draggable-container').forEach(other => {
          if (other !== container && other.style.display !== 'none') {
            const rect = other.getBoundingClientRect()
            snapLinesX.push(rect.left, rect.left + rect.width / 2, rect.right)
            snapLinesY.push(rect.top, rect.top + rect.height / 2, rect.bottom)
          }
        })
      }

      container.style.transform = ''
      container.style.transition = 'none' // 禁用过渡
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
    if (!rafId) {
      rafId = requestAnimationFrame(updatePosition)
    }
  })

  document.addEventListener('mouseup', async () => {
    if ((isDragging || isResizing) && activeContainer) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null }

      // Convert transform to actual left/top
      if (isDragging) {
        activeContainer.style.transform = ''
        activeContainer.style.removeProperty('transition') // 恢复过渡

        // 直接读取 style 的值
        const finalLeft = parseFloat(activeContainer.style.left) || activeContainer.offsetLeft
        const finalTop = parseFloat(activeContainer.style.top) || activeContainer.offsetTop

        activeContainer.style.setProperty('left', `${finalLeft}px`, 'important')
        activeContainer.style.setProperty('top', `${finalTop}px`, 'important')
      }

      const prev = (currentLayout && currentLayout[activeContainer.id]) ? currentLayout[activeContainer.id] : {}
      currentLayout[activeContainer.id] = {
        x: parseInt(activeContainer.style.left) || activeContainer.offsetLeft,
        y: parseInt(activeContainer.style.top) || activeContainer.offsetTop,
        width: activeContainer.offsetWidth,
        height: activeContainer.offsetHeight,
        hidden: (typeof prev.hidden === 'boolean') ? prev.hidden : false,
        fontFamily: prev.fontFamily || null // Preserve existing font family
      }

      // Special handling for timerProgressBar colors
      if (activeContainer.id === 'timerProgressBar') {
        const fill = activeContainer.querySelector('.progress-fill');
        const track = activeContainer.querySelector('.progress-track');
        currentLayout[activeContainer.id].progressColor = fill ? fill.style.backgroundColor : null;
        currentLayout[activeContainer.id].trackColor = track ? track.style.backgroundColor : null;
      }

      console.log(`[Frontend] End drag: ${activeContainer.id}`, currentLayout[activeContainer.id])

      if (window.saveLayoutTimeout) clearTimeout(window.saveLayoutTimeout)
      window.saveLayoutTimeout = setTimeout(async () => {
        try { await window.electronAPI.saveLayout(currentLayout); console.log('Auto Saved'); } catch (e) { console.error(e) }
      }, 500)

      if (isResizing && activeContainer && (activeContainer.id === 'hunter' || /^survivor[1-4]$/.test(activeContainer.id))) {
        refit3DModelForBox(activeContainer)
      }
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

    // Hide guides
    if (snapLineV) snapLineV.style.display = 'none'
    if (snapLineH) snapLineH.style.display = 'none'
    hideCoordDisplay()
  })

  // 为文字控件添加双击编辑颜色功能
  document.addEventListener('dblclick', (e) => {
    if (!editMode) return

    const container = e.target.closest('.draggable-container')
    if (!container) return

    // 检查是否是可编辑颜色的控件
    const editableColor = container.dataset.editableColor === 'true'
    const isTextElement = container.id === 'mapInfo' ||
      container.id === 'phaseInfo' ||
      container.id === 'timerBox' ||
      container.id === 'teamAName' ||
      container.id === 'teamBName' ||
      container.classList.contains('team-name-text')

    if (editableColor || isTextElement) {
      // 找到实际的文本元素
      const textElement = container.querySelector('span') ||
        container.querySelector('.team-name') ||
        container.querySelector('#mapName') ||
        container.querySelector('#phaseName') ||
        container.querySelector('#timerDisplay')

      if (textElement) {
        e.stopPropagation()
        openColorPicker(textElement)
      }
    } else if (container.id === 'timerProgressBar') {
      // Special handling for timerProgressBar to open color picker for fill/track
      e.stopPropagation();
      openTimerProgressBarColorPicker(container);
    }
  })
}

// 编辑模式
function toggleEditMode() {
  editMode = !editMode
  const toolbar = document.getElementById('editToolbar')
  const hint = document.getElementById('editHint')
  const containers = document.querySelectorAll('.draggable-container')

  console.log('切换编辑模式:', editMode)

  if (editMode) {
    toolbar.classList.add('show')
    hint.classList.add('show')
    containers.forEach(c => c.classList.add('editing'))
    document.body.classList.add('editing')
  } else {
    toolbar.classList.remove('show')
    hint.classList.remove('show')
    containers.forEach(c => c.classList.remove('editing'))
    document.body.classList.remove('editing')
  }

  // 让 hidden 在退出编辑模式时立即生效
  applyLayout()
}

function openEditMode() {
  console.log('openEditMode被调用')
  if (!editMode) {
    toggleEditMode()
  }
}

function exitEditMode() {
  editMode = false
  document.getElementById('editToolbar').classList.remove('show')
  document.getElementById('editHint').classList.remove('show')
  document.querySelectorAll('.draggable-container').forEach(c => c.classList.remove('editing'))
  document.body.classList.remove('editing')
}

function openLayoutSettings() {
  const panel = document.getElementById('layoutSettingsPanel')
  const g = getGlobalBanConfig()
  const l = getLocalBanConfig()
  document.getElementById('gsMaxPerRow').value = g.survivor.maxPerRow
  document.getElementById('gsItemGap').value = g.survivor.itemGap
  document.getElementById('gsRowGap').value = g.survivor.rowGap
  document.getElementById('gsItemSize').value = g.survivor.itemSize
  document.getElementById('ghMaxPerRow').value = g.hunter.maxPerRow
  document.getElementById('ghItemGap').value = g.hunter.itemGap
  document.getElementById('ghRowGap').value = g.hunter.rowGap
  document.getElementById('ghItemSize').value = g.hunter.itemSize
  document.getElementById('lsMaxPerRow').value = l.survivor.maxPerRow
  document.getElementById('lsItemGap').value = l.survivor.itemGap
  document.getElementById('lsRowGap').value = l.survivor.rowGap
  document.getElementById('lsItemSize').value = l.survivor.itemSize
  document.getElementById('lhMaxPerRow').value = l.hunter.maxPerRow
  document.getElementById('lhItemGap').value = l.hunter.itemGap
  document.getElementById('lhRowGap').value = l.hunter.rowGap
  document.getElementById('lhItemSize').value = l.hunter.itemSize
    ; (function () {
      const m = currentLayout && currentLayout.model3d ? currentLayout.model3d : { enabled: false, targetFPS: 30 }
      const enableEl = document.getElementById('enable3dModels')
      const fpsEl = document.getElementById('model3dTargetFPS')
      const officialEl = document.getElementById('useOfficialModels')
      const surDirEl = document.getElementById('survivorModelDir')
      const hunDirEl = document.getElementById('hunterModelDir')
      const surMotionEl = document.getElementById('survivorMotionDir')
      const hunMotionEl = document.getElementById('hunterMotionDir')
      const defaultVmdEl = document.getElementById('defaultMotionVmd')

      // 新增渲染设置控件
      const aaEl = document.getElementById('render3dAntialias')
      const prEl = document.getElementById('render3dPixelRatio')
      const shadowEl = document.getElementById('render3dEnableShadows')
      const shadowQEl = document.getElementById('render3dShadowQuality')

      const outlineEl = document.getElementById('render3dEnableOutline')
      const outlineThEl = document.getElementById('render3dOutlineThickness')
      const outlineColorEl = document.getElementById('render3dOutlineColor')
      const outlineAlphaEl = document.getElementById('render3dOutlineAlpha')
      const toonEl = document.getElementById('render3dEnableToon')
      const toonGradEl = document.getElementById('render3dToonGradient')

      const ambColorEl = document.getElementById('render3dAmbientColor')
      const ambIntEl = document.getElementById('render3dAmbientIntensity')
      const dirColorEl = document.getElementById('render3dDirectionalColor')
      const dirIntEl = document.getElementById('render3dDirectionalIntensity')
      const lpXEl = document.getElementById('render3dLightPosX')
      const lpYEl = document.getElementById('render3dLightPosY')
      const lpZEl = document.getElementById('render3dLightPosZ')

      if (enableEl) enableEl.checked = !!m.enabled
      if (fpsEl) fpsEl.value = Number(m.targetFPS || 30)
      if (officialEl) officialEl.checked = !!m.useOfficialModels
      if (surDirEl) surDirEl.value = m.survivorModelDir || ''
      if (hunDirEl) hunDirEl.value = m.hunterModelDir || ''
      if (surMotionEl) surMotionEl.value = m.survivorMotionDir || ''
      if (hunMotionEl) hunMotionEl.value = m.hunterMotionDir || ''
      if (defaultVmdEl) defaultVmdEl.value = m.defaultMotionVmd || ''
      
      const scaleCorrEl = document.getElementById('model3dScaleCorrection')
      if (scaleCorrEl) scaleCorrEl.value = String(Number(m.scaleCorrection ?? 1.0))

      const verticalOffsetEl = document.getElementById('model3dVerticalOffset')
      if (verticalOffsetEl) verticalOffsetEl.value = String(Number(m.verticalOffset ?? 0))
      
      const rotCorrEl = document.getElementById('model3dRotationCorrection')
      if (rotCorrEl) rotCorrEl.value = String(Number(m.rotationCorrection ?? 0))

      if (aaEl) aaEl.value = String(m.antialias !== false)
      if (prEl) prEl.value = String(Number(m.pixelRatio ?? 1))
      if (shadowEl) shadowEl.checked = !!m.enableShadows
      if (shadowQEl) shadowQEl.value = String(Number(m.shadowQuality || 1024))

      if (outlineEl) outlineEl.checked = m.enableOutline !== false
      if (outlineThEl) outlineThEl.value = String(Number(m.outlineThickness || 0.003))
      if (outlineColorEl) outlineColorEl.value = m.outlineColor || '#000000'
      if (outlineAlphaEl) outlineAlphaEl.value = String(Number(m.outlineAlpha ?? 1.0))
      if (toonEl) toonEl.checked = !!m.enableToon
      if (toonGradEl) toonGradEl.value = String(Number(m.toonGradient || 5))

      if (ambColorEl) ambColorEl.value = m.ambientColor || '#ffffff'
      if (ambIntEl) ambIntEl.value = String(Number(m.ambientIntensity ?? 0.5))
      if (dirColorEl) dirColorEl.value = m.directionalColor || '#ffffff'
      if (dirIntEl) dirIntEl.value = String(Number(m.directionalIntensity ?? 0.7))
      if (lpXEl) lpXEl.value = String(Number(m.lightPosX ?? 10))
      if (lpYEl) lpYEl.value = String(Number(m.lightPosY ?? 20))
      if (lpZEl) lpZEl.value = String(Number(m.lightPosZ ?? 10))
    })()
  panel.classList.add('show')
}

function closeLayoutSettings() {
  document.getElementById('layoutSettingsPanel').classList.remove('show')
}

// 同步 UI 设置到布局对象并应用
async function syncLayoutSettingsFromUI() {
  const g = {
    survivor: {
      maxPerRow: Number(document.getElementById('gsMaxPerRow')?.value) || 4,
      itemGap: Number(document.getElementById('gsItemGap')?.value) || 8,
      rowGap: Number(document.getElementById('gsRowGap')?.value) || 8,
      itemSize: Number(document.getElementById('gsItemSize')?.value) || 50
    },
    hunter: {
      maxPerRow: Number(document.getElementById('ghMaxPerRow')?.value) || 1,
      itemGap: Number(document.getElementById('ghItemGap')?.value) || 8,
      rowGap: Number(document.getElementById('ghRowGap')?.value) || 8,
      itemSize: Number(document.getElementById('ghItemSize')?.value) || 50
    }
  }
  const l = {
    survivor: {
      maxPerRow: Number(document.getElementById('lsMaxPerRow')?.value) || 4,
      itemGap: Number(document.getElementById('lsItemGap')?.value) || 10,
      rowGap: Number(document.getElementById('lsRowGap')?.value) || 10,
      itemSize: Number(document.getElementById('lsItemSize')?.value) || 60
    },
    hunter: {
      maxPerRow: Number(document.getElementById('lhMaxPerRow')?.value) || 1,
      itemGap: Number(document.getElementById('lhItemGap')?.value) || 10,
      rowGap: Number(document.getElementById('lhRowGap')?.value) || 10,
      itemSize: Number(document.getElementById('lhItemSize')?.value) || 60
    }
  }
  currentLayout.globalBanConfig = g
  currentLayout.localBanConfig = l

  const useOfficialEl = document.getElementById('useOfficialModels')
  const useOfficialValue = useOfficialEl ? !!useOfficialEl.checked : !!(currentLayout && currentLayout.model3d && currentLayout.model3d.useOfficialModels)
  const prevOfficial = !!(currentLayout && currentLayout.model3d && currentLayout.model3d.useOfficialModels)
  if (useOfficialValue && !prevOfficial && window.electronAPI && typeof window.electronAPI.prepareOfficialModels === 'function') {
    const status = await window.electronAPI.getOfficialModelsDownloadStatus?.()
    if (!status || !status.complete) {
      const ok = confirm('将开始下载官方模型资源，下载完成后才会启用。是否继续？')
      if (!ok) {
        if (useOfficialEl) useOfficialEl.checked = false
        return false
      }
      if (useOfficialEl) useOfficialEl.disabled = true
      try {
        const res = await window.electronAPI.prepareOfficialModels()
        if (!res || !res.success) {
          throw new Error(res?.error || '下载失败')
        }
        _officialModelMap = null
        _officialModelMapPromise = null
      } catch {
        if (useOfficialEl) useOfficialEl.checked = false
        return false
      } finally {
        if (useOfficialEl) useOfficialEl.disabled = false
      }
    }
  }
  const m = {
    enabled: !!document.getElementById('enable3dModels')?.checked,
    useOfficialModels: useOfficialValue,
    targetFPS: Number(document.getElementById('model3dTargetFPS')?.value) || 30,
    survivorModelDir: document.getElementById('survivorModelDir')?.value || null,
    hunterModelDir: document.getElementById('hunterModelDir')?.value || null,
    survivorMotionDir: document.getElementById('survivorMotionDir')?.value || null,
    hunterMotionDir: document.getElementById('hunterMotionDir')?.value || null,
    defaultMotionVmd: document.getElementById('defaultMotionVmd')?.value || null,
    scaleCorrection: Number(document.getElementById('model3dScaleCorrection')?.value ?? 1.0),
    verticalOffset: Number(document.getElementById('model3dVerticalOffset')?.value ?? 0),
    rotationCorrection: Number(document.getElementById('model3dRotationCorrection')?.value ?? 0),

    // 渲染质量
    antialias: document.getElementById('render3dAntialias')?.value === 'true',
    pixelRatio: Number(document.getElementById('render3dPixelRatio')?.value) || 1,
    enableShadows: !!document.getElementById('render3dEnableShadows')?.checked,
    shadowQuality: Number(document.getElementById('render3dShadowQuality')?.value) || 1024,

    // 风格化渲染
    enableOutline: document.getElementById('render3dEnableOutline')?.checked !== false,
    outlineThickness: Number(document.getElementById('render3dOutlineThickness')?.value) || 0.003,
    outlineColor: document.getElementById('render3dOutlineColor')?.value || '#000000',
    outlineAlpha: Number(document.getElementById('render3dOutlineAlpha')?.value ?? 1.0),
    enableToon: !!document.getElementById('render3dEnableToon')?.checked,
    toonGradient: Number(document.getElementById('render3dToonGradient')?.value) || 5,

    // 光照
    ambientColor: document.getElementById('render3dAmbientColor')?.value || '#ffffff',
    ambientIntensity: Number(document.getElementById('render3dAmbientIntensity')?.value ?? 0.5),
    directionalColor: document.getElementById('render3dDirectionalColor')?.value || '#ffffff',
    directionalIntensity: Number(document.getElementById('render3dDirectionalIntensity')?.value ?? 0.7),
    lightPosX: Number(document.getElementById('render3dLightPosX')?.value ?? 10),
    lightPosY: Number(document.getElementById('render3dLightPosY')?.value ?? 20),
    lightPosZ: Number(document.getElementById('render3dLightPosZ')?.value ?? 10),

    // 保留已存在的视口设置
    viewports: (currentLayout && currentLayout.model3d && currentLayout.model3d.viewports) ? currentLayout.model3d.viewports : {}
  }
  currentLayout.model3d = m

  // 立即应用配置到前台
  applyGlobalBanLayoutConfig()
  applyLocalBanLayoutConfig()

  // 如果有 3DRenderer，则更新它
  if (window.update3DRenderingParams) {
    window.update3DRenderingParams(m)
  }
  return true
}

let liveUpdateTimeout = null;
function initLayoutSettingsLiveUpdate() {
  const panel = document.getElementById('layoutSettingsPanel');
  if (!panel) return;

  panel.addEventListener('input', async (e) => {
    // 只有在修改设置项时才触发
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
      console.log('[Frontend] 检测到设置修改, 执行热实时更新...');
      const ok = await syncLayoutSettingsFromUI();
      if (ok === false) return

      // 防抖保存，避免过快写入文件
      if (liveUpdateTimeout) clearTimeout(liveUpdateTimeout);
      liveUpdateTimeout = setTimeout(async () => {
        try {
          await window.electronAPI.saveLayout(currentLayout);
          console.log('[Frontend] 实时更新已自动保存');
        } catch (err) {
          console.error('[Frontend] 自动保存失败:', err);
        }
      }, 1000);
    }
  });
}

async function saveLayoutSettings() {
  const ok = await syncLayoutSettingsFromUI();
  if (ok === false) return
  try {
    await window.electronAPI.saveLayout(currentLayout)
    console.log('[Frontend] 布局设置已手动保存')
  } catch (err) {
    console.error('[Frontend] 手动保存失败:', err)
  }
  closeLayoutSettings()
}

// 保存布局
async function saveLayout(silent = false) {
  console.log('[Frontend] 手动保存布局', silent ? '(静默)' : '')
  // console.log('[Frontend] 当前布局:', currentLayout) // 减少日志噪音
  const result = await window.electronAPI.saveLayout(currentLayout)
  if (result.success) {
    console.log('[Frontend] 布局保存成功')
    if (!silent) {
      // alert('布局已保存！') // 禁用恼人的弹窗，改为 Toast 或什么都不做
      // 可以考虑显示一个不显眼的提示
    }
  } else {
    console.error('[Frontend] 保存失败:', result.error)
    if (!silent) alert('保存失败: ' + result.error)
  }
}

// 导出布局包
async function exportLayoutPack() {
  const result = await window.electronAPI.exportBpPack()
  if (result.success) {
    alert('布局包已导出')
  } else if (!result.canceled) {
    alert('导出失败: ' + result.error)
  }
}

// 导入布局包
async function importLayoutPack() {
  const result = await window.electronAPI.importBpPack()
  if (result.success) {
    alert('布局包已导入')
    // 导入后 packManager 会广播 reload-layout-from-pack，这里不重复手动 apply
  } else if (!result.canceled) {
    alert('导入失败: ' + result.error)
  }
}

// 选择背景
async function selectBackground() {
  const result = await window.electronAPI.selectBackground()
  if (result.success) {
    // 添加时间戳参数破坏缓存，确保立即更新
    const timestamp = Date.now()
    const pathWithCacheBuster = result.path.includes('?')
      ? `${result.path}&_t=${timestamp}`
      : `${result.path}?_t=${timestamp}`

    currentLayout.backgroundImage = result.path  // 保存原始路径
    setBackground(pathWithCacheBuster)  // 使用带时间戳的路径显示

    // 背景更新后自动保存
    console.log('[Frontend] 背景图片已更新，自动保存布局')
    try {
      await window.electronAPI.saveLayout(currentLayout)
      console.log('[Frontend] 背景更新后自动保存成功')
    } catch (error) {
      console.error('[Frontend] 背景更新后自动保存失败:', error)
    }
  }
}

// 连接服务器
async function connectToServer() {
  if (!roomData || !roomData.serverUrl) return

  try {
    connection = new signalR.HubConnectionBuilder()
      .withUrl(`${roomData.serverUrl}/hubs/bp`)
      .withAutomaticReconnect()
      .build()

    // 注册事件处理器
    connection.on('RoomStateUpdated', (state) => {
      updateDisplay(state)
    })

    connection.on('CharacterPicked', (data) => {
      // 会通过RoomStateUpdated更新
    })

    connection.on('CharacterBanned', (data) => {
      // 会通过RoomStateUpdated更新
    })

    connection.on('PhaseChanged', (state) => {
      updateDisplay(state)
    })

    // 监听抽签结果
    connection.on('CoinTossResult', (data) => {
      const homeTeamName = data.homeTeam === 'teamA' ? (roomData.teamAName || 'A队') : (roomData.teamBName || 'B队')
      const awayTeamName = data.awayTeam === 'teamA' ? (roomData.teamAName || 'A队') : (roomData.teamBName || 'B队')
      showPopup('coin-toss', '🎲', '主客场抽签结果',
        `主场: ${homeTeamName}\n客场: ${awayTeamName}`,
        '', 5)
    })

    // 监听地图禁用
    connection.on('MapBanned', (data) => {
      const teamName = data.team === 'teamA' ? (roomData.teamAName || 'A队') : (roomData.teamBName || 'B队')
      showPopup('ban', '🚫', '地图已禁用', data.mapId, `${teamName} 禁用`, 3)
    })

    // 监听地图选择
    connection.on('MapPicked', (data) => {
      const teamName = data.team === 'teamA' ? (roomData.teamAName || 'A队') : (roomData.teamBName || 'B队')
      showPopup('pick', '✅', '地图已选择', data.mapId, `${teamName} 选择`, 3)
    })

    // 监听阵营选择
    connection.on('SidePicked', (data) => {
      const teamName = data.team === 'teamA' ? (roomData.teamAName || 'A队') : (roomData.teamBName || 'B队')
      const sideName = data.sideChoice === 'survivor' ? '求生者' : '监管者'
      showPopup('side-pick', '⚔️', '阵营已选择', sideName, `${teamName} 选择`, 3)
    })

    await connection.start()

    // 以观众身份加入房间
    const state = await connection.invoke('JoinRoom', roomData.roomId, '', 'spectator')
    if (state) {
      updateDisplay(state)
    }

  } catch (error) {
    console.error('连接失败:', error)
  }
}

// 显示弹窗
let popupTimer = null
let popupCountdownInterval = null

function showPopup(type, icon, title, text, team, duration = 3) {
  const overlay = document.getElementById('popupOverlay')
  const content = document.getElementById('popupContent')
  const iconEl = document.getElementById('popupIcon')
  const titleEl = document.getElementById('popupTitle')
  const textEl = document.getElementById('popupText')
  const teamEl = document.getElementById('popupTeam')
  const countdownEl = document.getElementById('popupCountdown')

  // 清除之前的计时器
  if (popupTimer) clearTimeout(popupTimer)
  if (popupCountdownInterval) clearInterval(popupCountdownInterval)

  // 设置内容
  content.className = `popup-content ${type}`
  iconEl.textContent = icon
  titleEl.textContent = title
  textEl.textContent = text
  teamEl.textContent = team

  // 显示弹窗
  overlay.classList.add('show')

  // 倒计时
  let countdown = duration
  countdownEl.textContent = `${countdown}秒后关闭`
  popupCountdownInterval = setInterval(() => {
    countdown--
    countdownEl.textContent = `${countdown}秒后关闭`
    if (countdown <= 0) {
      clearInterval(popupCountdownInterval)
    }
  }, 1000)

  // 自动关闭
  popupTimer = setTimeout(() => {
    overlay.classList.remove('show')
    if (popupCountdownInterval) clearInterval(popupCountdownInterval)
  }, duration * 1000)
}

// 更新显示
let isFirstDisplayUpdate = true
function updateDisplay(state) {
  if (!state) return

  // 地图图片资源列表（异步加载一次，用于更稳健的匹配）
  if (__mapAssetNames == null) {
    // 不阻塞渲染；加载完成后对当前地图再尝试一次（避免首次匹配失败后一直隐藏）
    loadMapAssetsOnce().then(() => {
      try { updateMapImage(state.currentMap) } catch { /* ignore */ }
    })
  }

  // 更新地图
  const mapName = document.getElementById('mapName')
  mapName.textContent = state.currentMap || '等待选择地图'

  // 更新地图图片
  updateMapImage(state.currentMap)

  // 更新队伍名称与 Logo（本地BP需要随状态实时更新）
  try {
    const setTeam = (teamKey, nameElId, imgElId) => {
      const team = state && state[teamKey] ? state[teamKey] : null
      const nameEl = document.getElementById(nameElId)
      const imgEl = document.getElementById(imgElId)

      if (nameEl && team && typeof team.name === 'string' && team.name.trim()) {
        nameEl.textContent = team.name
      }

      if (!imgEl) return
      const logo = team && typeof team.logo === 'string' ? team.logo.trim() : ''
      if (!logo) {
        imgEl.style.display = 'none'
        return
      }

      if (logo.startsWith('file://') || logo.startsWith('data:')) {
        imgEl.src = logo
      } else {
        const normalizedPath = logo.replace(/\\/g, '/')
        imgEl.src = normalizedPath.startsWith('/')
          ? `file://${encodeURI(normalizedPath)}`
          : `file:///${encodeURI(normalizedPath)}`
      }
      imgEl.style.display = 'block'
      const containerId = teamKey === 'teamA' ? 'teamALogo' : 'teamBLogo'
      const containerEl = document.getElementById(containerId)
      applyImageFitToContainer(containerEl)
    }

    setTeam('teamA', 'teamANameText', 'teamALogoImg')
    setTeam('teamB', 'teamBNameText', 'teamBLogoImg')
  } catch {
    // ignore
  }

  // 更新阶段
  const phaseName = document.getElementById('phaseName')
  phaseName.textContent = state.phaseName || '等待开始'

  // 更新计时器
  updateTimer(state)

  // 判断当前阶段和待选角色类型
  const phaseAction = state.phaseAction || ''
  const isPickingSurvivor = phaseAction.includes('pick_survivor')
  const isPickingHunter = phaseAction.includes('pick_hunter')

  // 更新求生者
  const roundData = state.currentRoundData
  if (roundData) {
    const survivors = roundData.selectedSurvivors || []
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`survivor${i + 1}`)
      const nameEl = el.querySelector('.name')
      const placeholder = el.querySelector('.placeholder')
      let imgEl = el.querySelector('img')

      const currentCharacter = survivors[i]
      const previousCharacter = imgEl ? imgEl.getAttribute('data-character') : null
      const hasChanged = currentCharacter !== previousCharacter

      if (currentCharacter) {
        // 只有在角色改变时才更新文本和显示逻辑
        if (hasChanged) {
          nameEl.textContent = currentCharacter
          placeholder.style.display = 'none'
          el.classList.remove('pending') // 移除闪烁
          if (!isFirstDisplayUpdate && window.ASGAnimations && window.ASGAnimations.playSelectAnimation) {
            window.ASGAnimations.playSelectAnimation(el, 'survivor')
          }

          // OBS模式下禁用3D模型（file:///资源无法访问）
          const use3d = !window.__ASG_OBS_MODE__ && currentLayout && currentLayout.model3d && currentLayout.model3d.enabled
          const surDir = currentLayout && currentLayout.model3d ? currentLayout.model3d.survivorModelDir : null
          const modelPath = (use3d && surDir) ? `${surDir}/${currentCharacter}/${currentCharacter}.pmx` : null
          if (use3d && modelPath) {
            hideImage(el)
            show3DModelForBox(el, modelPath, 'survivor')
          } else {
            dispose3DForBox(el.id)
            showImageForCharacter(el, 'survivor', currentCharacter)
          }
        } else {
          // 角色没有改变，只更新闪烁状态
          el.classList.remove('pending')
        }
      } else {
        // 位置清空 - 检查是否有默认图片
        const defaultImage = state.defaultImages?.[`slot${i}`]

        if (defaultImage) {
          // 有默认图片：显示默认图片
          // 获取当前选手名字
          const playerName = (state.playerNames && state.playerNames[i]) || ''

          if (hasChanged || !imgEl || imgEl.src !== defaultImage || nameEl.textContent !== playerName) {
            nameEl.textContent = playerName
            placeholder.style.display = 'none'
            dispose3DForBox(el.id)

            if (!imgEl) {
              imgEl = document.createElement('img')
              el.appendChild(imgEl)
            }
            imgEl.src = defaultImage
            imgEl.style.display = 'block'
            imgEl.style.width = '100%'
            imgEl.style.height = '100%'
            applyImageFitToContainer(el)
            imgEl.classList.add('dissolve-in')
            imgEl.setAttribute('data-character', '')
          }
        } else {
          // 无默认图片：显示问号
          // 获取当前选手名字
          const playerName = (state.playerNames && state.playerNames[i]) || ''

          if (hasChanged || nameEl.textContent !== playerName) {
            nameEl.textContent = playerName
            placeholder.style.display = 'block'
            if (imgEl) {
              imgEl.style.display = 'none'
              imgEl.classList.remove('dissolve-in')
              imgEl.removeAttribute('data-character')
            }
            dispose3DForBox(el.id)
          }
        }

        // 如果正在选求生者且此位置为空，添加闪烁效果
        if (isPickingSurvivor) {
          el.classList.add('pending')
        } else {
          el.classList.remove('pending')
        }
      }
    }

    // 更新监管者
    const hunterEl = document.getElementById('hunter')
    const hunterName = hunterEl.querySelector('.name')
    const hunterPlaceholder = hunterEl.querySelector('.placeholder')
    let hunterImgEl = hunterEl.querySelector('img')

    const currentHunter = roundData.selectedHunter
    const previousHunter = hunterImgEl ? hunterImgEl.getAttribute('data-character') : null
    const hunterChanged = currentHunter !== previousHunter

    if (currentHunter) {
      if (hunterChanged) {
        hunterName.textContent = currentHunter
        hunterPlaceholder.style.display = 'none'
        hunterEl.classList.remove('pending') // 移除闪烁
        if (!isFirstDisplayUpdate && window.ASGAnimations && window.ASGAnimations.playSelectAnimation) {
          window.ASGAnimations.playSelectAnimation(hunterEl, 'hunter')
        }

        // OBS模式下禁用3D模型（file:///资源无法访问）
        const use3dHun = !window.__ASG_OBS_MODE__ && currentLayout && currentLayout.model3d && currentLayout.model3d.enabled
        const hunDir = currentLayout && currentLayout.model3d ? currentLayout.model3d.hunterModelDir : null
        const modelPathHun = (use3dHun && hunDir) ? `${hunDir}/${currentHunter}/${currentHunter}.pmx` : null
        if (use3dHun && modelPathHun) {
          hideImage(hunterEl)
          show3DModelForBox(hunterEl, modelPathHun, 'hunter')
        } else {
          dispose3DForBox(hunterEl.id)
          showImageForCharacter(hunterEl, 'hunter', currentHunter)
        }
      } else {
        // 监管者没有改变，只更新闪烁状态
        hunterEl.classList.remove('pending')
      }
    } else {
      // 监管者位置清空 - 检查是否有默认图片
      const hunterDefaultImage = state.defaultImages?.hunter

      // 获取当前选手名字 (监管者索引为4)
      const playerName = (state.playerNames && state.playerNames[4]) || ''

      // 调试日志
      console.log('[Frontend] 监管者显示 - playerNames:', state.playerNames, 'playerName:', playerName, 'hunterChanged:', hunterChanged)

      if (hunterDefaultImage) {
        // 有默认图片：显示默认图片
        if (hunterChanged || !hunterImgEl || hunterImgEl.src !== hunterDefaultImage || hunterName.textContent !== playerName) {
          hunterName.textContent = playerName
          hunterPlaceholder.style.display = 'none'
          dispose3DForBox(hunterEl.id)

          if (!hunterImgEl) {
            hunterImgEl = document.createElement('img')
            hunterEl.appendChild(hunterImgEl)
          }
          hunterImgEl.src = hunterDefaultImage
          hunterImgEl.style.display = 'block'
          hunterImgEl.style.width = '100%'
          hunterImgEl.style.height = '100%'
          applyImageFitToContainer(hunterEl)
          hunterImgEl.classList.add('dissolve-in')
          hunterImgEl.setAttribute('data-character', '')
        }
      } else {
        // 无默认图片：显示问号或选手名字
        if (hunterChanged || hunterName.textContent !== playerName) {
          hunterName.textContent = playerName
          // 只有当没有名字且没有角色时才显示问号 placeholder
          hunterPlaceholder.style.display = playerName ? 'none' : 'block'

          if (hunterImgEl) {
            hunterImgEl.style.display = 'none'
            hunterImgEl.classList.remove('dissolve-in')
            hunterImgEl.removeAttribute('data-character')
          }
          dispose3DForBox(hunterEl.id)
        }
      }

      // 如果正在选监管者且位置为空，添加闪烁效果
      if (isPickingHunter) {
        hunterEl.classList.add('pending')
      } else {
        hunterEl.classList.remove('pending')
      }
    }

    // 更新求生者Ban位（使用头像）
    const survivorBanList = document.getElementById('survivorBanList')
    survivorBanList.innerHTML = ''
    const lbc = getLocalBanConfig()
    const hunterBannedSurvivors = roundData.hunterBannedSurvivors || []
    hunterBannedSurvivors.forEach(name => {
      const item = document.createElement('div')
      item.className = 'ban-item'
      // item.style.width/height is now handled by CSS and Grid container
      const img = document.createElement('img')
      img.src = `../assets/surHeader/${name}.png`
      img.alt = name
      img.title = name
      img.onerror = function () {
        this.style.display = 'none'
        this.parentElement.innerHTML = `<span style="font-size: 10px; color: #fff;">${name}</span>`
      }
      item.appendChild(img)
      survivorBanList.appendChild(item)
    })
    const survivorBansContainer = document.getElementById('survivorBans')
    applyImageFitToContainer(survivorBansContainer)

    // 更新监管者Ban位（使用头像）
    const hunterBanList = document.getElementById('hunterBanList')
    hunterBanList.innerHTML = ''
    const survivorBannedHunters = roundData.survivorBannedHunters || []
    survivorBannedHunters.forEach(name => {
      const item = document.createElement('div')
      item.className = 'ban-item'
      // item.style.width/height is now handled by CSS and Grid container
      const img = document.createElement('img')
      img.src = `../assets/hunHeader/${name}.png`
      img.alt = name
      img.title = name
      img.onerror = function () {
        this.style.display = 'none'
        this.parentElement.innerHTML = `<span style="font-size: 10px; color: #fff;">${name}</span>`
      }
      item.appendChild(img)
      hunterBanList.appendChild(item)
    })
    const hunterBansContainer = document.getElementById('hunterBans')
    applyImageFitToContainer(hunterBansContainer)
  }

  const gbc = getGlobalBanConfig()
  applyGlobalBanLayoutConfig()

  // 更新全局禁选求生者（使用头像）
  const globalBanSurvivorList = document.getElementById('globalBanSurvivorList')
  if (globalBanSurvivorList) {
    globalBanSurvivorList.innerHTML = ''
    const globalBannedSurvivors = state.globalBannedSurvivors || []
    globalBannedSurvivors.forEach(name => {
      const item = document.createElement('div')
      item.className = 'global-ban-item'
      // item.style.width/height is now handled by CSS and Grid container
      const img = document.createElement('img')
      img.src = `../assets/surHeader/${name}.png`
      img.alt = name
      img.title = name
      img.onerror = function () {
        this.style.display = 'none'
        this.parentElement.innerHTML = `<span style="font-size: 8px; color: #fff; text-align: center;">${name}</span>`
      }
      item.appendChild(img)
      globalBanSurvivorList.appendChild(item)
    })
    const globalBanSurvivorsContainer = document.getElementById('globalBanSurvivors')
    applyImageFitToContainer(globalBanSurvivorsContainer)
  }

  // 更新全局禁选监管者（使用头像）
  const globalBanHunterList = document.getElementById('globalBanHunterList')
  if (globalBanHunterList) {
    globalBanHunterList.innerHTML = ''
    const globalBannedHunters = state.globalBannedHunters || []
    globalBannedHunters.forEach(name => {
      const item = document.createElement('div')
      item.className = 'global-ban-item'
      // item.style.width/height is now handled by CSS and Grid container
      const img = document.createElement('img')
      img.src = `../assets/hunHeader/${name}.png`
      img.alt = name
      img.title = name
      img.onerror = function () {
        this.style.display = 'none'
        this.parentElement.innerHTML = `<span style="font-size: 8px; color: #fff; text-align: center;">${name}</span>`
      }
      item.appendChild(img)
      globalBanHunterList.appendChild(item)
    })
    const globalBanHuntersContainer = document.getElementById('globalBanHunters')
    applyImageFitToContainer(globalBanHuntersContainer)
  }
  isFirstDisplayUpdate = false
}

// ========= 地图图片展示（assets/map） =========
var __mapAssetNames = null

async function loadMapAssetsOnce() {
  if (Array.isArray(__mapAssetNames)) return __mapAssetNames
  try {
    const res = await window.electronAPI.listMapAssets()
    if (res && res.success && Array.isArray(res.maps)) {
      __mapAssetNames = res.maps
      return __mapAssetNames
    }
  } catch {
    // ignore
  }
  __mapAssetNames = []
  return __mapAssetNames
}

function resolveMapAssetName(mapName) {
  const raw = (mapName || '').trim()
  if (!raw) return null

  const list = Array.isArray(__mapAssetNames) ? __mapAssetNames : []
  if (list.length > 0) {
    if (list.includes(raw)) return raw
    const hit = list.find(n => n && raw.includes(n)) || list.find(n => n && n.includes(raw))
    if (hit) return hit
  }

  // 允许直接按名称尝试加载（找不到会 onerror 隐藏）
  return raw
}

function updateMapImage(mapName) {
  const container = document.getElementById('mapImage')
  const img = document.getElementById('mapImageImg')
  if (!container || !img) return

  const resolved = resolveMapAssetName(mapName)

  // 清除/隐藏逻辑
  const clear = () => {
    img.style.display = 'none'
    img.removeAttribute('src')
    // 如果不在编辑模式，隐藏整个容器
    if (typeof editMode === 'undefined' || !editMode) {
      container.style.display = 'none'
    }
  }

  // 如果没有解析出地图名，或者地图名是默认提示文本，直接隐藏
  if (!resolved || resolved === '等待选择地图') {
    clear()
    return
  }

  // 开始加载：先隐藏图片，防止显示裂图
  img.style.display = 'none'
  // 容器本身显示（为了布局），但内容（图片）隐藏
  container.style.display = ''

  const encoded = encodeURIComponent(resolved) + '.png'
  const url = (() => {
    try {
      return new URL(`../assets/map/${encoded}`, location.href).href
    } catch {
      return `../assets/map/${encoded}`
    }
  })()

  img.onerror = () => {
    console.warn('[Frontend] 地图图片加载失败:', { mapName, resolved, url })
    clear()
  }

  img.onload = () => {
    // 加载成功，显示图片
    img.style.display = 'block'
    container.style.display = ''
    applyImageFitToContainer(container)
  }

  img.src = url
}

function updateFromLocalBp(state) {
  if (!state) return
  const mapped = Object.assign({}, state)
  if (mapped.selectedMap && !mapped.currentMap) mapped.currentMap = mapped.selectedMap
  updateDisplay(mapped)
  const idx = Number(state.blinkingSurvivorIndex)
  if (!isNaN(idx) && idx >= 0 && idx <= 3) {
    triggerLocalBlink(idx)
  }
  if (state.blinkingHunter) {
    triggerLocalBlink(4)
  }
}

function hideImage(boxEl) {
  const img = boxEl.querySelector('img')
  if (img) img.style.display = 'none'
}

// ========= 角色展示模式切换功能 =========
/**
 * 获取角色组件的展示模式（半身/全身），默认为半身
 * @param {string} boxId - 组件ID（survivor1-4或hunter）
 * @returns {string} 'half' 或 'full'
 */
function getCharacterDisplayMode(boxId) {
  // [Fix] 优先从 DOM 读取以确保状态实时性
  const el = document.getElementById(boxId);
  if (el && el.hasAttribute('data-display-mode')) {
    return el.getAttribute('data-display-mode');
  }

  if (!currentLayout || !currentLayout[boxId]) {
    return 'half'; // 默认半身
  }
  return currentLayout[boxId].displayMode || 'half';
}

/**
 * 切换角色组件的展示模式
 * @param {string} boxId - 组件ID（survivor1-4或hunter）
 */
async function toggleCharacterDisplayMode(boxId) {
  const currentMode = getCharacterDisplayMode(boxId);
  const newMode = currentMode === 'half' ? 'full' : 'half';

  // [Fix] 立即更新 DOM 属性
  const el = document.getElementById(boxId);
  if (el) {
    el.setAttribute('data-display-mode', newMode);
  }

  // 保存到布局
  if (!currentLayout[boxId]) {
    currentLayout[boxId] = {};
  }
  currentLayout[boxId].displayMode = newMode;

  try {
    await window.electronAPI.saveLayout(currentLayout);
    console.log(`[Frontend] ${boxId} 展示模式已切换为: ${newMode}`);

    // 强制刷新当前显示的角色图片
    refreshCharacterImage(boxId);
  } catch (e) {
    console.error(`[Frontend] 保存展示模式失败:`, e);
  }
}

/**
 * 刷新角色图片（应用新的展示模式）
 * @param {string} boxId - 组件ID
 */
function refreshCharacterImage(boxId) {
  const boxEl = document.getElementById(boxId);
  if (!boxEl) return;

  const imgEl = boxEl.querySelector('img');
  if (!imgEl || imgEl.style.display === 'none') return;

  const characterName = imgEl.getAttribute('data-character');
  if (!characterName) return;

  const roleType = boxId.startsWith('survivor') ? 'survivor' : 'hunter';
  const displayMode = getCharacterDisplayMode(boxId);
  // 使用surBig/hunBig作为全身立绘资源
  const folder = roleType === 'survivor'
    ? (displayMode === 'full' ? 'surBig' : 'surHalf')
    : (displayMode === 'full' ? 'hunBig' : 'hunHalf');

  const newSrc = `../assets/${folder}/${characterName}.png`;

  // 使用淡入淡出效果
  imgEl.style.opacity = '0';
  setTimeout(() => {
    imgEl.src = newSrc;
    imgEl.onload = () => {
      imgEl.style.opacity = '1';
    };
    imgEl.onerror = function () {
      console.warn(`[Frontend] 图片加载失败: ${newSrc}`);
      // 如果全身图加载失败，尝试降级到半身图
      if (displayMode === 'full') {
        const fallbackFolder = roleType === 'survivor' ? 'surHalf' : 'hunHalf';
        const fallbackSrc = `../assets/${fallbackFolder}/${characterName}.png`;
        console.log(`[Frontend] 尝试降级到半身图: ${fallbackSrc}`);
        this.src = fallbackSrc;
        this.onerror = function () {
          console.warn(`[Frontend] 半身图也加载失败，显示占位符`);
          this.style.display = 'none';
          const placeholder = boxEl.querySelector('.placeholder');
          if (placeholder) {
            placeholder.style.display = 'block';
            placeholder.textContent = characterName || '?';
          }
        };
      } else {
        this.style.display = 'none';
        const placeholder = boxEl.querySelector('.placeholder');
        if (placeholder) {
          placeholder.style.display = 'block';
          placeholder.textContent = characterName || '?';
        }
      }
    };
  }, 150);
}

function showImageForCharacter(boxEl, roleType, name) {
  const nameEl = boxEl.querySelector('.name')
  const placeholder = boxEl.querySelector('.placeholder')
  let imgEl = boxEl.querySelector('img')
  if (!imgEl) {
    imgEl = document.createElement('img')
    boxEl.insertBefore(imgEl, nameEl)
  }

  // 根据展示模式选择资源文件夹 - 使用surBig/hunBig作为全身立绘
  const displayMode = getCharacterDisplayMode(boxEl.id);
  const folder = roleType === 'survivor'
    ? (displayMode === 'full' ? 'surBig' : 'surHalf')
    : (displayMode === 'full' ? 'hunBig' : 'hunHalf');
  const src = `../assets/${folder}/${name}.png`;

  const previousName = imgEl.getAttribute('data-character')
  const wasVisible = imgEl.style.display !== 'none'

  const isContentChanged = previousName !== String(name)
  const needsAnimation = isContentChanged || !wasVisible

  // 如果完全没变且已经显示，直接返回，避免任何DOM操作导致的重绘或动画重置
  if (!isContentChanged && wasVisible && imgEl.src.endsWith(encodeURI(name) + '.png')) {
    return
  }

  imgEl.setAttribute('data-character', name)
  imgEl.src = src
  imgEl.style.display = 'block'
  applyImageFitToContainer(boxEl)

  if (needsAnimation) {
    imgEl.classList.remove('dissolve-in')
    void imgEl.offsetWidth
    imgEl.classList.add('dissolve-in')
  } else {
    // Double check opacity
    imgEl.style.opacity = '1'
    // Ensure class is present if it should be (though usually we don't need to re-add if not animating)
    // But if we want steady state, opacity 1 is enough.
  }

  imgEl.onerror = function () {
    this.style.display = 'none'
    if (placeholder) {
      placeholder.style.display = 'block'
      placeholder.textContent = name || '?'
    }
  }
  const three = boxEl.querySelector('.three-view')
  if (three) three.style.display = 'none'
}

const _modelViewers = {}
let _officialModelMap = null
let _officialModelMapPromise = null

function get3DBoxFitOptions(boxEl, baseHeightRatio = 1.0) {
  const boxWidth = Math.max(1, boxEl?.clientWidth || 1)
  const boxHeight = Math.max(1, boxEl?.clientHeight || 1)
  const viewEl = boxEl ? boxEl.querySelector('.three-view') : null
  const renderWidth = Math.max(1, viewEl?.clientWidth || boxWidth)
  const renderHeight = Math.max(1, viewEl?.clientHeight || boxHeight)
  const nameEl = boxEl ? boxEl.querySelector('.name') : null
  const nameHeight = nameEl ? Math.max(0, nameEl.offsetHeight || 0) : 0
  const reserved = Math.min(boxHeight * 0.35, nameHeight)
  const availableHeight = Math.max(1, boxHeight - reserved)
  const heightRatioRaw = baseHeightRatio * (availableHeight / renderHeight)
  const widthRatioRaw = 0.98 * (boxWidth / renderWidth)
  const heightRatio = Math.max(0.2, Math.min(1.2, heightRatioRaw))
  const widthRatio = Math.max(0.2, Math.min(1.2, widthRatioRaw))
  return { heightRatio, widthRatio, boxWidth, boxHeight }
}

async function getOfficialModelUrl(roleName) {
  const allowOfficial = !!(currentLayout && currentLayout.model3d && currentLayout.model3d.useOfficialModels)
  if (!allowOfficial) return null
  if (!roleName) return null
  if (_officialModelMap && _officialModelMap[roleName]) return _officialModelMap[roleName]
  if (!_officialModelMapPromise && window.electronAPI && typeof window.electronAPI.getOfficialModelMap === 'function') {
    _officialModelMapPromise = window.electronAPI.getOfficialModelMap()
      .then((map) => {
        _officialModelMap = map || {}
        return _officialModelMap
      })
      .catch(() => {
        _officialModelMap = {}
        return _officialModelMap
      })
  }
  const map = _officialModelMapPromise ? await _officialModelMapPromise : _officialModelMap
  if (!map) return null
  
  // 1. 尝试直接匹配
  if (map[roleName]) return map[roleName]
  
  // 2. 尝试去除引号后匹配 (针对 "噩梦" 这种情况)
  const cleanName = roleName.replace(/["'“”‘’]/g, '').trim()
  if (map[cleanName]) return map[cleanName]
  
  return null
}

// 全局错误捕获
window.onerror = function (msg, url, lineNo, columnNo, error) {
  console.error('[Global Error]', msg, 'at', url, 'line:', lineNo, 'col:', columnNo, error)
  return false
}

window.onunhandledrejection = function (event) {
  console.error('[Unhandled Promise Rejection]', event.reason)
}

async function ensureThree() {
  if (window.THREE && window.THREE.MMDLoader) {
    console.log('[3D] Three.js already loaded, version:', window.THREE.REVISION)
    return true
  }
  const localPrefix = './js/three/'
  const cdnPrefix = 'https://unpkg.com/three@0.147.0/'
  const examplesPrefix = 'https://unpkg.com/three@0.147.0/examples/js/'

  // 1. 加载 THREE 核心库
  if (!window.THREE) {
    console.log('[3D] Loading THREE core...')
    let loaded = await loadScript(localPrefix + 'three.min.js')
    if (!loaded) {
      console.warn('Local three.min.js load failed, trying CDN...')
      loaded = await loadScript(cdnPrefix + 'build/three.min.js')
    }
    if (!loaded) return false
  }

  // 2. 加载 MMDParser (MMDLoader 的必要依赖) - 注意是全局变量 MMDParser
  if (typeof window.MMDParser === 'undefined') {
    console.log('[3D] Loading MMDParser...')
    let loaded = await loadScript(localPrefix + 'mmdparser.js')
    if (!loaded) {
      console.warn('Local mmdparser.js load failed, trying CDN...')
      loaded = await loadScript('https://fastly.jsdelivr.net/npm/mmd-parser@1.0.4/build/mmdparser.js')
    }
  }

  // 2.5 加载 Ammo.js (MMDPhysics 的必要依赖)
  if (!window.Ammo) {
    console.log('[3D] Loading Ammo.js...')
    let loaded = await loadScript(localPrefix + 'ammo.js')
    if (!loaded) {
      console.warn('Local ammo.js load failed, trying CDN...')
      loaded = await loadScript('https://fastly.jsdelivr.net/npm/ammo.js@0.0.10/ammo.js')
    }
  }

  // 3. 按顺序加载插件和组件
  const components = [
    { name: 'TGALoader', file: 'TGALoader.js', path: 'loaders/' },
    { name: 'GLTFLoader', file: 'GLTFLoader.js', path: 'loaders/' },
    { name: 'MMDToonShader', file: 'MMDToonShader.js', path: 'shaders/' },
    { name: 'MMDLoader', file: 'MMDLoader.js', path: 'loaders/' },
    { name: 'OutlineEffect', file: 'OutlineEffect.js', path: 'effects/' },
    { name: 'CCDIKSolver', file: 'CCDIKSolver.js', path: 'animation/' },
    { name: 'MMDPhysics', file: 'MMDPhysics.js', path: 'animation/' },
    { name: 'MMDAnimationHelper', file: 'MMDAnimationHelper.js', path: 'animation/' }
  ]

  for (const comp of components) {
    // 更加严格的检查：不仅检查是否存在，还检查关键属性是否存在
    let needsLoad = !window.THREE[comp.name]
    if (comp.name === 'MMDToonShader' && window.THREE.MMDToonShader && !window.THREE.MMDToonShader.vertexShader) {
      needsLoad = true
    }

    if (needsLoad) {
      console.log(`[3D] Loading component: ${comp.name}...`)
      let loaded = await loadScript(localPrefix + comp.file + '?v=' + Date.now()) // 强制刷新缓存
      if (!loaded) {
        console.warn(`Local ${comp.file} load failed, trying CDN...`)
        loaded = await loadScript(examplesPrefix + comp.path + comp.file)
      }
    }
  }

  const ok = !!(window.THREE && window.THREE.MMDLoader && window.THREE.MMDToonShader && window.THREE.MMDToonShader.vertexShader)
  console.log('[3D] Dependencies check:', ok ? 'OK' : 'FAILED')
  return ok
}

function loadScript(src) {
  return new Promise((resolve) => {
    const s = document.createElement('script')
    s.src = src
    s.async = false // 禁用异步以确保顺序加载
    s.onload = () => {
      console.log(`Successfully loaded: ${src}`)
      resolve(true)
    }
    s.onerror = () => {
      console.error(`Failed to load: ${src}`)
      resolve(false)
    }
    document.head.appendChild(s)
  })
}

function toFileUrl(p) {
  if (!p) return ''
  let normalized = String(p).replace(/\\/g, '/')
  if (normalized.startsWith('http') || normalized.startsWith('file:')) return normalized

  // OBS模式下的特殊处理 (使用本地服务器 HTTP 协议替代 file 协议)
  if (window.__ASG_OBS_MODE__) {
    // 检查是否是官方模型路径
    if (normalized.includes('/official-models/')) {
      const parts = normalized.split('/official-models/')
      if (parts.length > 1) {
        const relativePath = parts[1]
        // 使用绝对HTTP路径，确保被识别为远程路径(isRemotePath=true)，跳过IPC文件存在检查
        return window.location.origin + '/official-models/' + encodeURI(relativePath).replace(/#/g, '%23').replace(/\?/g, '%3F')
      }
    }
  }

  // 处理 Windows 盘符
  if (/^[a-zA-Z]:/.test(normalized)) {
    normalized = '/' + normalized
  }

  // 使用 encodeURI 处理中文字符和空格
  return 'file://' + encodeURI(normalized).replace(/#/g, '%23').replace(/\?/g, '%3F')
}

async function show3DModelForBox(boxEl, modelPath, roleType) {
  if (!boxEl) return
  console.log(`[3D] Starting load for ${roleType}: ${modelPath}`)

  const charName = boxEl.querySelector('.name')?.textContent || ''
  const allowOfficial = !!(currentLayout && currentLayout.model3d && currentLayout.model3d.useOfficialModels)
  let isOfficialModel = false
  if (allowOfficial) {
    const officialUrl = await getOfficialModelUrl(charName)
    if (officialUrl) {
      modelPath = officialUrl
      isOfficialModel = true
    }
  }

  let isRemotePath = typeof modelPath === 'string' && (/^https?:\/\//i.test(modelPath) || modelPath.startsWith('file:'))
  if (window.electronAPI && window.electronAPI.invoke && !isRemotePath) {
    let exists = await window.electronAPI.invoke('check-file-exists', modelPath)
    if (!exists && /\.pmx$/i.test(modelPath)) {
      const gltfPath = modelPath.replace(/\.pmx$/i, '.gltf')
      const glbPath = modelPath.replace(/\.pmx$/i, '.glb')
      if (await window.electronAPI.invoke('check-file-exists', gltfPath)) {
        modelPath = gltfPath
        exists = true
      } else if (await window.electronAPI.invoke('check-file-exists', glbPath)) {
        modelPath = glbPath
        exists = true
      }
    }
    if (!exists) {
      if (!isRemotePath) {
        console.error(`[3D] Model file not found: ${modelPath}`)
        showImageForCharacter(boxEl, roleType, charName)
        return
      }
    }
  }

  const ok = await ensureThree()
  if (!ok) {
    console.error('[3D] Three.js dependencies failed to load')
    showImageForCharacter(boxEl, roleType, charName)
    return
  }

  const id = boxEl.id
  const cfg = currentLayout && currentLayout.model3d ? currentLayout.model3d : { targetFPS: 30 }
  const pixelRatio = Number(cfg.pixelRatio ?? 1)
  const antialias = cfg.antialias !== false
  const targetFPS = Number(cfg.targetFPS || 30)

  // 读取渲染配置
  const renderConfig = {
    pixelRatio,
    antialias,
    targetFPS,
    // 渲染质量
    enableShadows: cfg.enableShadows || false,
    shadowQuality: Number(cfg.shadowQuality || 1024),
    // 风格化渲染
    enableOutline: cfg.enableOutline !== false,
    outlineThickness: Number(cfg.outlineThickness || 0.003),
    outlineColor: cfg.outlineColor || '#000000',
    outlineAlpha: Number(cfg.outlineAlpha ?? 1.0),
    enableToon: cfg.enableToon || false,
    toonGradient: Number(cfg.toonGradient || 5),
    // 光照设置
    ambientColor: cfg.ambientColor || '#ffffff',
    ambientIntensity: Number(cfg.ambientIntensity ?? 0.5),
    directionalColor: cfg.directionalColor || '#ffffff',
    directionalIntensity: Number(cfg.directionalIntensity ?? 0.7),
    lightPosX: Number(cfg.lightPosX ?? 10),
    lightPosY: Number(cfg.lightPosY ?? 20),
    lightPosZ: Number(cfg.lightPosZ ?? 10)
  }

  let motionPath = null
  if (roleType === 'survivor') {
    const dir = cfg.survivorMotionDir
    const name = boxEl.querySelector('.name')?.textContent || ''
    if (dir && name) motionPath = `${dir}/${name}.vmd`
  } else {
    const dir = cfg.hunterMotionDir
    const name = boxEl.querySelector('.name')?.textContent || ''
    if (dir && name) motionPath = `${dir}/${name}.vmd`
  }
  if (!motionPath && cfg.defaultMotionVmd) motionPath = cfg.defaultMotionVmd
  const isGltfModel = typeof modelPath === 'string' && /\.(gltf|glb)(\?|#|$)/i.test(modelPath)
  if (isGltfModel) motionPath = null

  let container = boxEl.querySelector('.three-view')
  if (!container) {
    container = document.createElement('div')
    container.className = 'three-view'
    boxEl.appendChild(container)
  }

  // 应用该槽位的 3D 视口（用于放大/平移/缩放）
  apply3DViewport(container, id)

  // 确保容器在加载期间不可见，但占位
  container.style.display = 'block'
  container.style.opacity = '0'

  const width = boxEl.clientWidth || 200
  const height = boxEl.clientHeight || 400
  const scaleCorrection = Number(cfg.scaleCorrection ?? 1.0)
  const verticalOffset = Number(cfg.verticalOffset ?? 0)
  const defaultRatio = isOfficialModel ? 0.9 : 0.85
  const baseHeightRatio = defaultRatio
  const fitOptions = get3DBoxFitOptions(boxEl, baseHeightRatio)
  fitOptions.scaleCorrection = scaleCorrection
  fitOptions.verticalOffset = verticalOffset
  fitOptions.forceFaceFlip = isOfficialModel

  let viewer = _modelViewers[id]
  const modelChanged = !viewer || viewer.modelPath !== modelPath
  const motionChanged = !viewer || viewer.motionPath !== motionPath

  if (!viewer || modelChanged || motionChanged) {
    if (viewer) { try { viewer.dispose() } catch { } }

    console.log(`[3D] Creating new viewer for ${id}`)
    viewer = createModelViewer(container, renderConfig)
    _modelViewers[id] = viewer
    viewer.modelPath = modelPath
    viewer.motionPath = motionPath
    viewer.isOfficialModel = isOfficialModel

    let loadTimeout = setTimeout(() => {
      console.warn(`[3D] Load timeout for ${modelPath}`)
      if (container.style.opacity === '0') {
        container.style.display = 'none'
        showImageForCharacter(boxEl, roleType, charName)
      }
    }, 10000) // 10秒超时

    const onReady = () => {
      console.log(`[3D] Ready: ${modelPath}`)
      clearTimeout(loadTimeout)
      container.style.opacity = '1'
      container.style.display = 'block'
      hideImage(boxEl) // 成功后再隐藏图片
    }

    const onError = (err) => {
      console.error(`[3D] Failed to load: ${modelPath}`, err)
      clearTimeout(loadTimeout)
      container.style.display = 'none'
      showImageForCharacter(boxEl, roleType, charName)
    }

    if (motionPath) {
      // 检查动作文件
      if (window.electronAPI && window.electronAPI.invoke) {
        const vmdExists = await window.electronAPI.invoke('check-file-exists', motionPath)
        if (!vmdExists) {
          console.warn(`[3D] VMD file not found: ${motionPath}, falling back to model only`)
          motionPath = null
        }
      }
    }

    if (isGltfModel) viewer.loadGLTF(modelPath, onReady, onError, fitOptions)
    else if (motionPath) viewer.loadMMDWithVMD(modelPath, motionPath, onReady, onError, cfg.defaultMotionVmd || null, fitOptions)
    else viewer.loadMMD(modelPath, onReady, onError, fitOptions)
  } else {
    container.style.opacity = '1'
    container.style.display = 'block'
    viewer.setSize(width, height)
  }
}

function refit3DModelForBox(boxEl) {
  if (!boxEl) return
  const id = boxEl.id
  const viewer = _modelViewers[id]
  if (!viewer || typeof viewer.refit !== 'function') return
  const cfg = currentLayout && currentLayout.model3d ? currentLayout.model3d : {}
  const scaleCorrection = Number(cfg.scaleCorrection ?? 1.0)
  const verticalOffset = Number(cfg.verticalOffset ?? 0)
  const defaultRatio = viewer.isOfficialModel ? 0.9 : 0.85
  const baseHeightRatio = defaultRatio
  const fitOptions = get3DBoxFitOptions(boxEl, baseHeightRatio)
  fitOptions.scaleCorrection = scaleCorrection
  fitOptions.verticalOffset = verticalOffset
  viewer.refit(fitOptions)
}

function get3DViewport(id) {
  const def = { x: 0, y: 0, w: 1, h: 1 }
  const m = (currentLayout && currentLayout.model3d) ? currentLayout.model3d : null
  const vps = m && m.viewports ? m.viewports : null
  const raw = vps && vps[id] ? vps[id] : def
  const x = Number(raw.x)
  const y = Number(raw.y)
  const w = Number(raw.w)
  const h = Number(raw.h)
  return {
    x: Number.isFinite(x) ? x : def.x,
    y: Number.isFinite(y) ? y : def.y,
    w: Number.isFinite(w) ? w : def.w,
    h: Number.isFinite(h) ? h : def.h
  }
}

function set3DViewport(id, vp) {
  if (!currentLayout) currentLayout = { ...defaultLayout }
  if (!currentLayout.model3d) currentLayout.model3d = { ...defaultLayout.model3d }
  if (!currentLayout.model3d.viewports) currentLayout.model3d.viewports = {}
  currentLayout.model3d.viewports[id] = vp
}

function apply3DViewport(container, id) {
  if (!container || !id) return
  const vp = get3DViewport(id)
  container.style.left = `${vp.x * 100}%`
  container.style.top = `${vp.y * 100}%`
  container.style.width = `${vp.w * 100}%`
  container.style.height = `${vp.h * 100}%`
  container.dataset.viewportFor = id
}

// Tab 按住：调整 3D 视口（移动/缩放）
; (function enableTabAdjust3DViewport() {
  let tabDown = false
  let active = null
  let raf = null
  let pending = null

  function isFormFocused() {
    const ae = document.activeElement
    if (!ae) return false
    const tag = String(ae.tagName || '').toUpperCase()
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }

  function setTabMode(on) {
    tabDown = on
    if (on) document.body.classList.add('tab3d-adjust')
    else document.body.classList.remove('tab3d-adjust')
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return
    if (e.repeat) return
    if (isFormFocused()) return
    setTabMode(true)
    try { e.preventDefault() } catch { }
  }, true)

  document.addEventListener('keyup', (e) => {
    if (e.key !== 'Tab') return
    setTabMode(false)
  }, true)

  window.addEventListener('blur', () => {
    setTabMode(false)
    active = null
  })

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n))
  }

  function applyPending() {
    if (!pending) return
    const { view, id, vp } = pending
    set3DViewport(id, vp)
    apply3DViewport(view, id)
    pending = null
    raf = null
  }

  function onDown(e) {
    if (!tabDown) return
    const view = e.target && e.target.closest ? e.target.closest('.three-view') : null
    if (!view) return
    const boxEl = view.parentElement
    const id = boxEl && boxEl.id ? boxEl.id : view.dataset.viewportFor
    if (!id) return

    // 只允许在角色盒子里调整（避免误触其它插件组件）
    if (!/^survivor[1-4]$/.test(id) && id !== 'hunter') return

    const parentRect = boxEl.getBoundingClientRect()
    const viewRect = view.getBoundingClientRect()
    const nearResize = (e.clientX >= viewRect.right - 18) && (e.clientY >= viewRect.bottom - 18)

    const startVp = get3DViewport(id)
    active = {
      view,
      boxEl,
      id,
      mode: nearResize ? 'resize' : 'move',
      startX: e.clientX,
      startY: e.clientY,
      startVp,
      parentW: Math.max(1, parentRect.width),
      parentH: Math.max(1, parentRect.height)
    }

    try { e.preventDefault() } catch { }
    try { e.stopPropagation() } catch { }
  }

  function onMove(e) {
    if (!active) return
    const dx = e.clientX - active.startX
    const dy = e.clientY - active.startY

    let vp = { ...active.startVp }
    if (active.mode === 'move') {
      vp.x = active.startVp.x + (dx / active.parentW)
      vp.y = active.startVp.y + (dy / active.parentH)
    } else {
      vp.w = active.startVp.w + (dx / active.parentW)
      vp.h = active.startVp.h + (dy / active.parentH)
    }

    // 允许超出 0..1 来实现“放大/平移”，但限制在合理范围
    vp.w = clamp(vp.w, 0.2, 3)
    vp.h = clamp(vp.h, 0.2, 3)
    vp.x = clamp(vp.x, -2, 2)
    vp.y = clamp(vp.y, -2, 2)

    pending = { view: active.view, id: active.id, vp }
    if (!raf) raf = requestAnimationFrame(applyPending)
  }

  function onUp() {
    if (!active) return
    const id = active.id
    const vp = get3DViewport(id)

    // 自动保存（与拖拽布局一致的 500ms 防抖）
    if (window.saveLayoutTimeout) clearTimeout(window.saveLayoutTimeout)
    window.saveLayoutTimeout = setTimeout(async () => {
      try {
        await window.electronAPI.saveLayout(currentLayout)
      } catch { }
    }, 500)

    active = null
  }

  document.addEventListener('mousedown', onDown, true)
  document.addEventListener('mousemove', onMove, true)
  document.addEventListener('mouseup', onUp, true)
})()

function dispose3DForBox(id) {
  const viewer = _modelViewers[id]
  if (viewer) {
    try { viewer.dispose() } catch { }
    delete _modelViewers[id]
  }
  const el = document.getElementById(id)
  if (el) {
    const v = el.querySelector('.three-view')
    if (v) v.remove()
  }
}

function createModelViewer(container, {
  pixelRatio = 1,
  antialias = true,
  targetFPS = 30,
  // 渲染质量
  enableShadows = false,
  shadowQuality = 1024,
  // 风格化渲染
  enableOutline = true,
  outlineThickness = 0.003,
  outlineColor = '#000000',
  outlineAlpha = 1.0,
  enableToon = false,
  toonGradient = 5,
  // 光照设置
  ambientColor = '#ffffff',
  ambientIntensity = 0.5,
  directionalColor = '#ffffff',
  directionalIntensity = 0.7,
  lightPosX = 10,
  lightPosY = 20,
  lightPosZ = 10
} = {}) {
  const THREE = window.THREE
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias })
  renderer.setPixelRatio(pixelRatio)

  // 阴影设置
  if (enableShadows) {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
  }

  const w = container.clientWidth || 400
  const h = container.clientHeight || 600
  renderer.setSize(w, h)
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 2000)
  camera.position.set(0, 10, 50)

  // 环境光（支持颜色和强度设置）
  const amb = new THREE.AmbientLight(new THREE.Color(ambientColor), ambientIntensity)
  scene.add(amb)

  // 方向光（支持颜色、强度和位置设置）
  const dir = new THREE.DirectionalLight(new THREE.Color(directionalColor), directionalIntensity)
  dir.position.set(lightPosX, lightPosY, lightPosZ)
  if (enableShadows) {
    dir.castShadow = true
    dir.shadow.mapSize.width = shadowQuality
    dir.shadow.mapSize.height = shadowQuality
    dir.shadow.camera.near = 0.5
    dir.shadow.camera.far = 500
    dir.shadow.camera.left = -50
    dir.shadow.camera.right = 50
    dir.shadow.camera.top = 50
    dir.shadow.camera.bottom = -50
  }
  scene.add(dir)

  // OutlineEffect 初始化（卡通描边）
  let outlineEffect = null
  if (enableOutline && THREE.OutlineEffect) {
    const colorArr = [
      parseInt(outlineColor.slice(1, 3), 16) / 255,
      parseInt(outlineColor.slice(3, 5), 16) / 255,
      parseInt(outlineColor.slice(5, 7), 16) / 255
    ]
    outlineEffect = new THREE.OutlineEffect(renderer, {
      defaultThickness: outlineThickness,
      defaultColor: colorArr,
      defaultAlpha: outlineAlpha
    })
  }

  const helper = new THREE.MMDAnimationHelper({ afterglow: 2.0 })
  const clock = new THREE.Clock()

  let mesh = null
  let animation = null
  let animationMixer = null
  let rafId = null
  let lastTime = 0
  const minDelta = 1000 / Math.max(15, targetFPS)

  function animate(ts) {
    if (!renderer) return
    if (ts - lastTime >= minDelta) {
      lastTime = ts
      const delta = clock.getDelta()
      try { helper.update(delta) } catch { }
      if (animationMixer) {
        try { animationMixer.update(delta) } catch { }
      }
      // 使用 OutlineEffect 或普通渲染
      if (outlineEffect) {
        outlineEffect.render(scene, camera)
      } else {
        renderer.render(scene, camera)
      }
    }
    rafId = requestAnimationFrame(animate)
  }

  rafId = requestAnimationFrame(animate)

  // 更新光照设置
  function updateLighting(options) {
    if (options.ambientColor !== undefined) amb.color.set(options.ambientColor)
    if (options.ambientIntensity !== undefined) amb.intensity = options.ambientIntensity
    if (options.directionalColor !== undefined) dir.color.set(options.directionalColor)
    if (options.directionalIntensity !== undefined) dir.intensity = options.directionalIntensity
    if (options.lightPosX !== undefined) dir.position.x = options.lightPosX
    if (options.lightPosY !== undefined) dir.position.y = options.lightPosY
    if (options.lightPosZ !== undefined) dir.position.z = options.lightPosZ
  }

  // 更新描边设置
  function updateOutline(options) {
    if (!outlineEffect) return
    // OutlineEffect 需要重新创建以更新参数
    if (options.outlineThickness !== undefined || options.outlineColor !== undefined || options.outlineAlpha !== undefined) {
      const colorArr = options.outlineColor ? [
        parseInt(options.outlineColor.slice(1, 3), 16) / 255,
        parseInt(options.outlineColor.slice(3, 5), 16) / 255,
        parseInt(options.outlineColor.slice(5, 7), 16) / 255
      ] : null
      // 更新材质的 userData
      scene.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          mats.forEach(m => {
            if (!m.userData.outlineParameters) m.userData.outlineParameters = {}
            if (options.outlineThickness !== undefined) m.userData.outlineParameters.thickness = options.outlineThickness
            if (colorArr) m.userData.outlineParameters.color = colorArr
            if (options.outlineAlpha !== undefined) m.userData.outlineParameters.alpha = options.outlineAlpha
          })
        }
      })
    }
  }

  function fitModelToView(targetMesh, options = {}) {
    if (!targetMesh) return
    try {
      const heightRatioRaw = options.heightRatio
      const widthRatioRaw = options.widthRatio
      const heightRatio = Number.isFinite(heightRatioRaw) ? Math.min(1, Math.max(0.2, heightRatioRaw)) : 1.0
      const widthRatio = Number.isFinite(widthRatioRaw) ? Math.min(1, Math.max(0.2, widthRatioRaw)) : 1.0
      const baseScale = targetMesh.userData.__fitBaseScale || targetMesh.scale.clone()
      const basePos = targetMesh.userData.__fitBasePos || targetMesh.position.clone()
      const baseRot = targetMesh.userData.__fitBaseRot || targetMesh.rotation.clone()
      if (!targetMesh.userData.__fitBaseScale) targetMesh.userData.__fitBaseScale = baseScale.clone()
      if (!targetMesh.userData.__fitBasePos) targetMesh.userData.__fitBasePos = basePos.clone()
      if (!targetMesh.userData.__fitBaseRot) targetMesh.userData.__fitBaseRot = baseRot.clone()
      targetMesh.scale.copy(baseScale)
      targetMesh.position.copy(basePos)
      targetMesh.rotation.copy(baseRot)
      if (options.forceFaceFlip !== undefined) {
        targetMesh.userData.__forceFaceFlip = !!options.forceFaceFlip
      }
      targetMesh.updateMatrixWorld(true)
      const modelPos = new THREE.Vector3()
      const toCameraXZ = new THREE.Vector3()
      const forward = new THREE.Vector3()
      const toCamera = new THREE.Vector3()
      targetMesh.getWorldPosition(modelPos)
      toCameraXZ.set(camera.position.x - modelPos.x, 0, camera.position.z - modelPos.z)
      if (toCameraXZ.lengthSq() > 1e-6) {
        targetMesh.lookAt(camera.position.x, modelPos.y, camera.position.z)
      }
      if (targetMesh.userData.__forceFaceFlip) {
        targetMesh.rotation.y += Math.PI
      } else {
        targetMesh.getWorldDirection(forward)
        toCamera.copy(camera.position).sub(modelPos).normalize()
        if (forward.dot(toCamera) < 0) {
          targetMesh.rotation.y += Math.PI
        }
      }
      targetMesh.updateMatrixWorld(true)
      const box = new THREE.Box3()
      const tempVec = new THREE.Vector3()
      const expandBox = () => {
        box.setFromObject(targetMesh)
        targetMesh.traverse(node => {
          if (node.isBone) {
            node.getWorldPosition(tempVec)
            box.expandByPoint(tempVec)
          }
        })
        return box
      }
      expandBox()
      const size = box.getSize(new THREE.Vector3())

      if (size.y === 0) {
        console.warn('[3D] Model size is 0, skipping fit')
        return
      }

      const scaleCorrection = Number.isFinite(options.scaleCorrection) ? options.scaleCorrection : 1.0
      const verticalOffset = Number.isFinite(options.verticalOffset) ? options.verticalOffset : 0
      targetMesh.scale.copy(baseScale).multiplyScalar(scaleCorrection)

      // Apply rotation correction if needed (Y-axis)
      if (options.rotationCorrection && Number.isFinite(options.rotationCorrection)) {
        const rad = THREE.MathUtils.degToRad(options.rotationCorrection)
        targetMesh.rotation.y = rad
      }

      targetMesh.updateMatrixWorld(true)
      expandBox()
      const newCenter = box.getCenter(new THREE.Vector3())
      const newSize = box.getSize(new THREE.Vector3())

      targetMesh.position.x += (basePos.x - newCenter.x)
      targetMesh.position.z += (basePos.z - newCenter.z)

      const fov = camera.fov
      const dist = Math.abs(camera.position.z - newCenter.z)
      const viewHeight = 2 * Math.tan((fov / 2) * Math.PI / 180) * dist
      const targetTopY = (viewHeight / 2) * heightRatio
      const currentTopY = newCenter.y + (newSize.y / 2)
      targetMesh.position.y += (targetTopY - currentTopY) + (verticalOffset * viewHeight)

      console.log('[3D] Model fitted. Scale:', scaleCorrection.toFixed(4))
    } catch (e) {
      console.error('[3D] Error fitting model:', e)
    }
  }

  function fixBoneNames(mesh) {
    if (!mesh || !mesh.skeleton || !mesh.skeleton.bones) return

    const boneMap = {
      'Center': 'センター',
      'Master': '全ての親',
      'Hips': '下半身',
      'Spine': '上半身',
      'Chest': '上半身2',
      'Neck': '首',
      'Head': '頭',
      'LeftShoulder': '左肩',
      'LeftArm': '左腕',
      'LeftElbow': '左ひじ',
      'LeftWrist': '左手首',
      'RightShoulder': '右肩',
      'RightArm': '右腕',
      'RightElbow': '右ひじ',
      'RightWrist': '右手首',
      'LeftLeg': '左足',
      'LeftKnee': '左ひざ',
      'LeftAnkle': '左足首',
      'RightLeg': '右足',
      'RightKnee': '右ひざ',
      'RightAnkle': '右足首',
      'Left Shoulder': '左肩',
      'Left Arm': '左腕',
      'Left Elbow': '左ひじ',
      'Left Wrist': '左手首',
      'Right Shoulder': '右肩',
      'Right Arm': '右腕',
      'Right Elbow': '右ひじ',
      'Right Wrist': '右手首',
      'Left Leg': '左足',
      'Left Knee': '左ひざ',
      'Left Ankle': '左足首',
      'Right Leg': '右足',
      'Right Knee': '右ひざ',
      'Right Ankle': '右足首'
    }

    let fixedCount = 0
    mesh.skeleton.bones.forEach(bone => {
      if (boneMap[bone.name]) {
        bone.name = boneMap[bone.name]
        fixedCount++
      }
    })
    if (fixedCount > 0) {
      console.log(`[3D] Fixed ${fixedCount} English bone names to Japanese`)
    }
  }

  async function loadMMD(modelPath, onReady, onError, options = {}) {
    console.log('[3D] Loading MMD model:', modelPath)
    animationMixer = null
    const loader = new THREE.MMDLoader()
    const url = toFileUrl(modelPath)

    // 设置资源路径，确保贴图能相对于模型路径加载
    let basePath = url.substring(0, url.lastIndexOf('/') + 1)

    // 智能查找贴图目录
    if (window.electronAPI && window.electronAPI.invoke) {
      try {
        const bestDir = await window.electronAPI.invoke('find-texture-dir', modelPath)
        if (bestDir) {
          console.log('[3D] Found texture dir:', bestDir)
          let newBase = toFileUrl(bestDir)
          if (!newBase.endsWith('/')) newBase += '/'
          
          const dirName = bestDir.split(/[/\\]/).pop().toLowerCase()
          if (dirName === 'textures' || dirName === 'tex' || dirName === 'image') {
            console.log('[3D] Found standard texture dir name, keeping original base path to avoid duplication')
            // Don't update basePath
          } else {
            basePath = newBase
          }
        }
      } catch (e) { console.warn('[3D] Failed to find texture dir', e) }
    }

    loader.setResourcePath(basePath)

    console.log('[3D] Final model URL:', url)
    console.log('[3D] Resource base path:', basePath)

    try {
      loader.load(url, (object) => {
        console.log('[3D] MMD model parsed successfully:', modelPath)
        mesh = object

        fixBoneNames(mesh)

        // 调试日志：检查材质和贴图状态
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          console.log(`[3D] Model has ${mats.length} materials`)
          mats.forEach((m, i) => {
            // Sanitize materials to prevent WebGL errors
            if (m.gradientMap === undefined) m.gradientMap = null
            if (m.emissiveMap === undefined) m.emissiveMap = null
            // Disable gradientMap if no image to avoid uniform errors
            if (m.gradientMap && !m.gradientMap.image) m.gradientMap = null
            
            console.log(`[3D] Mat ${i}: map=${!!m.map}, defines=${JSON.stringify(m.defines)}`)
          })
        }

        fitModelToView(mesh, options)
        scene.add(mesh)

        if (typeof onReady === 'function') onReady()
      }, (xhr) => {
        if (xhr.lengthComputable) {
          const percentComplete = xhr.loaded / xhr.total * 100
          console.log('[3D] Download progress:', Math.round(percentComplete, 2) + '%')
        }
      }, (err) => {
        console.error('[3D] Error loading MMD model:', modelPath, err)
        if (typeof onError === 'function') onError(err)
      })
    } catch (e) {
      console.error('[3D] Fatal error in loader.load:', e)
      if (typeof onError === 'function') onError(e)
    }
  }

  async function loadMMDWithVMD(modelPath, vmdPath, onReady, onError, fallbackVmd, options = {}) {
    console.log('[3D] Loading MMD with VMD:', modelPath, vmdPath)
    animationMixer = null
    const loader = new THREE.MMDLoader()
    const modelUrl = toFileUrl(modelPath)
    const vmdUrl = toFileUrl(vmdPath)

    // 设置资源路径
    let basePath = modelUrl.substring(0, modelUrl.lastIndexOf('/') + 1)

    // 智能查找贴图目录
    if (window.electronAPI && window.electronAPI.invoke) {
      try {
        const bestDir = await window.electronAPI.invoke('find-texture-dir', modelPath)
        if (bestDir) {
          console.log('[3D] Found texture dir:', bestDir)
          let newBase = toFileUrl(bestDir)
          if (!newBase.endsWith('/')) newBase += '/'

          const dirName = bestDir.split(/[/\\]/).pop().toLowerCase()
          if (dirName === 'textures' || dirName === 'tex' || dirName === 'image') {
            console.log('[3D] Found standard texture dir name, keeping original base path to avoid duplication')
            // Don't update basePath
          } else {
            basePath = newBase
          }
        }
      } catch (e) { console.warn('[3D] Failed to find texture dir', e) }
    }

    loader.setResourcePath(basePath)

    console.log('[3D] Final model URL:', modelUrl)
    console.log('[3D] Final VMD URL:', vmdUrl)

    try {
      loader.loadWithAnimation(modelUrl, [vmdUrl], (res) => {
        console.log('[3D] MMD with VMD parsed successfully')
        const m = res.mesh || res
        const a = res.animation || res.animations?.[0] || null
        mesh = m
        animation = a

        fixBoneNames(mesh)

        // Sanitize materials
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach(mat => {
             if (mat.gradientMap === undefined) mat.gradientMap = null
             if (mat.emissiveMap === undefined) mat.emissiveMap = null
             if (mat.gradientMap && !mat.gradientMap.image) mat.gradientMap = null
          })
        }

        fitModelToView(mesh, options)
        scene.add(mesh)

        if (animation) {
          helper.add(mesh, { animation, physics: true })
        }

        if (typeof onReady === 'function') onReady()
      }, (xhr) => {
        if (xhr.lengthComputable) {
          const percentComplete = xhr.loaded / xhr.total * 100
          console.log('[3D] Loading progress:', Math.round(percentComplete, 2) + '%')
        }
      }, (err) => {
        console.error('[3D] Error loading MMD with VMD:', modelPath, err)
        if (fallbackVmd && fallbackVmd !== vmdPath) {
          console.log('[3D] Trying fallback VMD:', fallbackVmd)
          loadMMDWithVMD(modelPath, fallbackVmd, onReady, onError, null, options)
        } else {
          console.log('[3D] Falling back to model only load')
          loadMMD(modelPath, onReady, onError, options)
        }
      })
    } catch (e) {
      console.error('[3D] Fatal error in loader.loadWithAnimation:', e)
      if (typeof onError === 'function') onError(e)
    }
  }

  function loadGLTF(modelPath, onReady, onError, options = {}) {
    console.log('[3D] Loading GLTF model:', modelPath)
    const loader = new THREE.GLTFLoader()
    const url = toFileUrl(modelPath)
    try {
      loader.load(url, (gltf) => {
        mesh = gltf.scene
        mesh.userData.__forceFaceFlip = !!options.forceFaceFlip
        fitModelToView(mesh, options)
        scene.add(mesh)
        if (animationMixer) {
          try { animationMixer.stopAllAction() } catch { }
        }
        animationMixer = null
        if (gltf.animations && gltf.animations.length) {
          animationMixer = new THREE.AnimationMixer(mesh)
          gltf.animations.forEach((clip) => {
            try { animationMixer.clipAction(clip).play() } catch { }
          })
        }
        if (typeof onReady === 'function') onReady()
      }, (xhr) => {
        if (xhr.lengthComputable) {
          const percentComplete = xhr.loaded / xhr.total * 100
          console.log('[3D] Download progress:', Math.round(percentComplete, 2) + '%')
        }
      }, (err) => {
        console.error('[3D] Error loading GLTF model:', modelPath, err)
        if (typeof onError === 'function') onError(err)
      })
    } catch (e) {
      console.error('[3D] Fatal error in GLTF loader:', e)
      if (typeof onError === 'function') onError(e)
    }
  }

  function setSize(width, height) {
    const w = Math.max(1, width)
    const h = Math.max(1, height)
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  function dispose() {
    try { cancelAnimationFrame(rafId) } catch { }
    try { if (mesh) helper.remove(mesh) } catch { }
    try { if (animationMixer) { animationMixer.stopAllAction(); animationMixer.uncacheRoot(mesh) } } catch { }
    try { renderer.dispose() } catch { }
    try { while (scene.children.length) { scene.remove(scene.children[0]) } } catch { }
    try { container.innerHTML = '' } catch { }
  }

  const ro = new ResizeObserver(entries => {
    for (const entry of entries) {
      const cr = entry.contentRect
      setSize(cr.width, cr.height)
    }
  })
  try { ro.observe(container) } catch { }

  return {
    renderer, scene, camera, helper, clock, mesh,
    setSize, dispose, loadMMD, loadMMDWithVMD, loadGLTF,
    updateLighting, updateOutline,
    refit: (options) => {
      if (mesh) fitModelToView(mesh, options)
    },
    modelPath: null, motionPath: null
  }
}

// 更新计时器
function updateTimer(state) {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }

  const timerDisplay = document.getElementById('timerDisplay')
  const timerBox = document.getElementById('timerBox')

  if (!state.phaseDuration || state.phaseDuration <= 0) {
    timerDisplay.textContent = '0:00'
    timerBox.classList.remove('warning')
    return
  }

  const startTime = new Date(state.phaseStartTime).getTime()
  const duration = state.phaseDuration

  function updateTime() {
    const elapsed = (Date.now() - startTime) / 1000
    const remaining = Math.max(0, Math.floor(duration - elapsed))

    const minutes = Math.floor(remaining / 60)
    const seconds = remaining % 60
    timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`

    if (remaining <= 10) {
      timerBox.classList.add('warning')
    } else {
      timerBox.classList.remove('warning')
    }

    if (remaining <= 0) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  updateTime()
  timerInterval = setInterval(updateTime, 1000)
}

// 从后台更新计时器
function updateTimerFromBackend(remaining) {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }

  const timerDisplay = document.getElementById('timerDisplay')
  const timerBox = document.getElementById('timerBox')

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`

  if (remaining <= 10) {
    timerBox.classList.add('warning')
  } else {
    timerBox.classList.remove('warning')
  }
}

// 暴露重新加载函数到window对象，在所有函数定义之后
window.forceReloadLayout = async function () {
  console.log('[Frontend] ========== forceReloadLayout 被调用 ==========')
  console.log('[Frontend] currentLayout 类型:', typeof currentLayout)
  console.log('[Frontend] applyLayout 类型:', typeof applyLayout)
  console.log('[Frontend] setBackground 类型:', typeof setBackground)
  console.log('[Frontend] defaultLayout 类型:', typeof defaultLayout)

  try {
    if (typeof applyLayout !== 'function') {
      console.error('[Frontend] applyLayout 未定义！')
      return false
    }

    if (typeof setBackground !== 'function') {
      console.error('[Frontend] setBackground 未定义！')
      return false
    }

    const result = await window.electronAPI.loadLayout()
    console.log('[Frontend] 强制加载布局结果:', JSON.stringify(result))

    if (result.success && result.layout) {
      currentLayout = Object.assign({}, defaultLayout, result.layout)
      console.log('[Frontend] 强制应用新布局，元素数量:', Object.keys(currentLayout).length)
      console.log('[Frontend] 新布局内容:', JSON.stringify(currentLayout, null, 2))

      applyLayout()
      console.log('[Frontend] applyLayout 执行完成')

      if (result.layout.backgroundImage) {
        console.log('[Frontend] 强制设置背景图片:', result.layout.backgroundImage)
        setBackground(result.layout.backgroundImage)
      } else {
        const bgResult = await window.electronAPI.getBackgroundPath()
        console.log('[Frontend] 获取背景路径结果:', JSON.stringify(bgResult))
        if (bgResult.success && bgResult.path) {
          console.log('[Frontend] 强制设置背景图片:', bgResult.path)
          setBackground(bgResult.path)
          currentLayout.backgroundImage = bgResult.path
        }
      }
      console.log('[Frontend] ========== 强制重新加载完成 ==========')
      return true
    } else {
      console.error('[Frontend] 加载布局失败，result:', JSON.stringify(result))
      return false
    }
  } catch (error) {
    console.error('[Frontend] forceReloadLayout 错误:', error.message)
    console.error('[Frontend] 错误堆栈:', error.stack)
    return false
  }
}

// 启动
// 立即注册键盘监听（不等待init），确保F12能立即工作
document.addEventListener('keydown', (e) => {
  // F12 / Ctrl+Shift+I 打开开发者工具
  if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
    console.log('[Frontend] 按下F12或Ctrl+Shift+I，尝试打开开发者工具...')
    if (window.electronAPI && window.electronAPI.send) {
      window.electronAPI.send('open-devtools')
    } else {
      console.error('[Frontend] electronAPI.send 不可用')
    }
    e.preventDefault()
  }

  // F2: Electron模式下进入/退出编辑模式；OBS模式下禁用并拦截
  if (e.key === 'F2') {
    if (window.__ASG_OBS_MODE__) {
      console.log('[Frontend] OBS模式下F2编辑已禁用')
      e.preventDefault()
      e.stopPropagation()
      return
    }

    e.preventDefault()
    e.stopPropagation()

    // 直接在当前窗口切换编辑模式（最可靠）
    if (typeof toggleEditMode === 'function') {
      toggleEditMode()
    } else if (window.electronAPI && typeof window.electronAPI.toggleFrontendEditMode === 'function') {
      // 兜底：极端情况下函数未挂载
      window.electronAPI.toggleFrontendEditMode()
    }
  }

  // F3: 仅在编辑模式且非OBS时可用
  if (e.key === 'F3') {
    e.preventDefault() // 防止触发浏览器搜索
    if (editMode && !window.__ASG_OBS_MODE__) {
      selectBackground()
    } else if (window.__ASG_OBS_MODE__) {
      console.log('[Frontend] OBS模式下F3选择背景已禁用')
    }
  }
}, true) // 使用捕获阶段确保能拦截

init()
