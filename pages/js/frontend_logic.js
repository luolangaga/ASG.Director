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
  // 队名
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
    targetFPS: 30,
    survivorModelDir: null,
    hunterModelDir: null,
    survivorMotionDir: null,
    hunterMotionDir: null,
    defaultMotionVmd: null,
    antialias: true,
    pixelRatio: 1,
    enableShadows: false,
    shadowQuality: 1024,
    enableOutline: true,
    outlineThickness: 0.003,
    outlineColor: '#000000',
    outlineAlpha: 1.0,
    enableToon: false,
    toonGradient: 5,
    ambientColor: '#ffffff',
    ambientIntensity: 0.5,
    directionalColor: '#ffffff',
    directionalIntensity: 0.7,
    lightPosX: 10,
    lightPosY: 20,
    lightPosZ: 10,
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

  // 加载当前颜色
  if (container) {
    const textElement = container.querySelector('span') ||
      container.querySelector('.team-name') ||
      container.querySelector('#mapName') ||
      container.querySelector('#phaseName') ||
      container.querySelector('#timerDisplay')

    if (textElement) {
      const style = window.getComputedStyle(textElement)
      const currentColor = style.color
      // 将 rgb() 转换为 hex
      const rgb = currentColor.match(/\d+/g)
      if (rgb) {
        const hex = '#' + rgb.map(x => {
          const hex = parseInt(x).toString(16)
          return hex.length === 1 ? '0' + hex : hex
        }).join('')
        document.getElementById('textColorPicker').value = hex
      }

      // 加载字号
      const currentFontSize = parseInt(style.fontSize) || 16
      document.getElementById('fontSizeInput').value = currentFontSize
      document.getElementById('fontSizeRange').value = currentFontSize
    }
  }

  modal.classList.add('show')
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
      // 将Windows路径转换为file协议
      const normalizedPath = roomData.teamALogo.replace(/\\/g, '/')
      teamALogoImg.src = `file:///${normalizedPath}`
      teamALogoImg.style.display = 'block'
    } else {
      document.getElementById('teamALogoImg').style.display = 'none'
    }
    if (roomData.teamBLogo) {
      const teamBLogoImg = document.getElementById('teamBLogoImg')
      // 将Windows路径转换为file协议
      const normalizedPath = roomData.teamBLogo.replace(/\\/g, '/')
      teamBLogoImg.src = `file:///${normalizedPath}`
      teamBLogoImg.style.display = 'block'
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
  window.electronAPI.onUpdateData((data) => {
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
      // 布局已更新，重新加载布局
      console.log('布局已更新，重新加载...')
      location.reload()
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
    } else {
      // 兼容旧的直接传state的方式
      updateDisplay(data)
    }
  })

  function triggerLocalBlink(index) {
    const i = Number(index)
    const el = (i >= 0 && i <= 3)
      ? document.getElementById(`survivor${i + 1}`)
      : (i === 4 ? document.getElementById('hunter') : null)
    if (!el) return

    el.classList.add('pending')
    setTimeout(() => {
      try { el.classList.remove('pending') } catch { /* ignore */ }
    }, 3000)
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

      const result = await window.electronAPI.loadLayout()
      console.log('[Frontend] 加载布局结果:', result)
      if (result.success && result.layout) {
        currentLayout = { ...defaultLayout, ...result.layout }
        console.log('[Frontend] 新的布局对象:', JSON.stringify(currentLayout, null, 2))

        // 强制应用布局
        applyLayout()
        applyGlobalBanLayoutConfig()
        applyLocalBanLayoutConfig()

        // 加载背景图片
        if (result.layout.backgroundImage) {
          console.log('[Frontend] 从布局设置背景图片:', result.layout.backgroundImage)
          setBackground(result.layout.backgroundImage)
        } else {
          // 如果布局中没有背景，尝试从背景目录加载
          const bgResult = await window.electronAPI.getBackgroundPath()
          console.log('[Frontend] 从背景目录获取背景路径结果:', bgResult)
          if (bgResult.success && bgResult.path) {
            console.log('[Frontend] 设置背景图片:', bgResult.path)
            setBackground(bgResult.path)
            currentLayout.backgroundImage = bgResult.path
          } else {
            console.warn('[Frontend] 没有找到背景图片')
          }
        }

        console.log('[Frontend] ========== 布局和背景已更新 ==========')
      } else {
        console.error('[Frontend] 加载布局失败:', result.error)
      }
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
      container.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
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
      const transform = container.style.transform
      // 兼容 translate 和 translate3d，忽略可能的第三个参数和单位差异
      // 只要能提取出前两个数字即可
      const match = transform.match(/translate(?:3d)?\(\s*(-?[\d\.]+)(?:px)?\s*,\s*(-?[\d\.]+)(?:px)?/)

      let newLeft = startLeft
      let newTop = startTop
      let newWidth = startWidth
      let newHeight = startHeight

      if (match) {
        const dx = parseFloat(match[1])
        const dy = parseFloat(match[2])
        newLeft = startLeft + dx
        newTop = startTop + dy

        container.style.transform = ''
        container.style.left = `${newLeft}px`
        container.style.top = `${newTop}px`
        console.log(`[Frontend] 拖拽完成，新位置: left=${newLeft}, top=${newTop}`)
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
  const skipFields = ['backgroundImage', 'windowBounds', 'globalBanConfig', 'localBanConfig', 'model3d', 'transparentBackground', 'scoreboardLayouts', 'postMatchLayout', 'renderResolution']

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

    const { x, y, width, height, hidden, fontFamily, textColor } = currentLayout[id]
    console.log(`[Frontend] 应用布局到 ${id}: x=${x}, y=${y}, width=${width}, height=${height}, fontFamily=${fontFamily}, textColor=${textColor}`)

    // 清除可能存在的 transform
    el.style.transform = ''

    // 使用 setProperty 确保样式被应用
    el.style.setProperty('left', `${x}px`, 'important')
    el.style.setProperty('top', `${y}px`, 'important')
    el.style.setProperty('width', `${width}px`, 'important')
    el.style.setProperty('height', `${height}px`, 'important')
    el.style.setProperty('position', 'absolute', 'important')

    // 应用字体
    if (fontFamily) {
      el.style.setProperty('font-family', `"${fontFamily}", sans-serif`, 'important')
    } else {
      el.style.removeProperty('font-family')
    }

    // 应用文字颜色
    if (textColor) {
      const textElement = el.querySelector('span') ||
        el.querySelector('.team-name') ||
        el.querySelector('#mapName') ||
        el.querySelector('#phaseName') ||
        el.querySelector('#timerDisplay')
      if (textElement) {
        textElement.style.color = textColor
      }
    }

    // 隐藏控制：非编辑模式隐藏；编辑模式保留但半透明
    const isHidden = (typeof hidden === 'boolean') ? hidden : false
    el.classList.toggle('layout-hidden', isHidden)
    if (!editMode && isHidden) {
      el.style.display = 'none'
    } else {
      el.style.display = ''
    }

    // 验证样式是否被应用
    const computedStyle = window.getComputedStyle(el)
    console.log(`[Frontend] ${id} 应用后的实际样式: left=${computedStyle.left}, top=${computedStyle.top}, width=${computedStyle.width}, height=${computedStyle.height}, fontFamily=${computedStyle.fontFamily}`)

    appliedCount++
  })

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
    surList.style.columnGap = `${Number(sur.itemGap) || 8}px`
    surList.style.rowGap = `${Number(sur.rowGap) || 8}px`
  }
  if (hunList) {
    hunList.style.display = 'grid'
    hunList.style.gridTemplateColumns = `repeat(${Math.max(1, Number(hun.maxPerRow))}, ${Number(hun.itemSize) || 50}px)`
    hunList.style.columnGap = `${Number(hun.itemGap) || 8}px`
    hunList.style.rowGap = `${Number(hun.rowGap) || 8}px`
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
    surList.style.columnGap = `${Number(sur.itemGap) || 10}px`
    surList.style.rowGap = `${Number(sur.rowGap) || 10}px`
  }
  if (hunList) {
    hunList.style.display = 'grid'
    hunList.style.gridTemplateColumns = `repeat(${Math.max(1, Number(hun.maxPerRow))}, ${Number(hun.itemSize) || 60}px)`
    hunList.style.columnGap = `${Number(hun.itemGap) || 10}px`
    hunList.style.rowGap = `${Number(hun.rowGap) || 10}px`
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
    document.body.classList.remove('has-background')
    return
  }

  // OBS 浏览器源禁止加载本地 file:/// 资源，必须改走 HTTP(/background/)
  if (window.__ASG_OBS_MODE__) {
    let url = String(path)
    // 已经是可用的 http/https 或站内绝对路径
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
      // keep
    } else {
      // 兼容 Windows 路径 / file:/// URL：统一映射到 /background/<basename>
      const normalized = url.replace(/\\/g, '/')
      const base = normalized.split('/').pop()
      url = '/background/' + encodeURIComponent(base)
    }
    console.log('[Frontend] setBackground(OBS):', path, '->', url)
    bg.style.backgroundImage = `url('${url}')`
    bg.style.backgroundSize = 'cover'
    bg.style.backgroundPosition = 'center'
    bg.style.backgroundRepeat = 'no-repeat'
    return
  }

  // Electron 本地窗口：优先使用 http/file/data 等可直接用的 URL
  const asStr = String(path)
  if (asStr.startsWith('http://') || asStr.startsWith('https://') || asStr.startsWith('file:') || asStr.startsWith('data:') || asStr.startsWith('blob:')) {
    console.log('[Frontend] setBackground: 设置背景URL(直连):', asStr)
    bg.style.backgroundImage = `url('${asStr}')`
  } else {
    const normalizedPath = asStr.replace(/\\/g, '/')
    const fileUrl = normalizedPath.startsWith('/')
      ? `file://${encodeURI(normalizedPath)}`
      : `file:///${encodeURI(normalizedPath)}`
    console.log('[Frontend] setBackground: 设置背景URL(file):', fileUrl)
    bg.style.backgroundImage = `url('${fileUrl}')`
  }

  bg.style.backgroundSize = 'cover'
  bg.style.backgroundPosition = 'center'
  bg.style.backgroundRepeat = 'no-repeat'
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
      // 使用 transform 代替 left/top，性能更好
      activeContainer.style.transform = `translate3d(${dx}px, ${dy}px, 0)`
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

  containers.forEach(container => {
    // 编辑模式：右键切换隐藏/显示
    container.addEventListener('contextmenu', async (e) => {
      if (!editMode) return
      e.preventDefault()
      e.stopPropagation()

      const id = container.id
      if (!id) return
      const prev = (currentLayout && currentLayout[id]) ? currentLayout[id] : {}
      const nextHidden = !(prev.hidden === true)
      currentLayout[id] = Object.assign({}, prev, {
        x: Number.isFinite(prev.x) ? prev.x : container.offsetLeft,
        y: Number.isFinite(prev.y) ? prev.y : container.offsetTop,
        width: Number.isFinite(prev.width) ? prev.width : container.offsetWidth,
        height: Number.isFinite(prev.height) ? prev.height : container.offsetHeight,
        hidden: nextHidden
      })

      applyLayout()
      try { await window.electronAPI.saveLayout(currentLayout) } catch (error) { console.error(error) }
    })

    container.addEventListener('dblclick', (e) => {
      if (!editMode) return
      e.preventDefault()
      e.stopPropagation()
      openFontSelector(container.id)
    })

    container.addEventListener('mousedown', (e) => {
      if (!editMode) return

      // 检查是否点击调整大小手柄
      if (e.target.classList.contains('resize-handle')) {
        isResizing = true
        resizeDir = e.target.dataset.dir
      } else if (e.target.classList.contains('draggable-container') ||
        e.target.parentElement.classList.contains('draggable-container')) {
        isDragging = true
      } else {
        return
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
        const finalLeft = startLeft + (Number.isFinite(lastDx) ? lastDx : 0)
        const finalTop = startTop + (Number.isFinite(lastDy) ? lastDy : 0)
        activeContainer.style.left = `${finalLeft}px`
        activeContainer.style.top = `${finalTop}px`
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

      console.log(`[Frontend] End drag: ${activeContainer.id}`, currentLayout[activeContainer.id])

      if (window.saveLayoutTimeout) clearTimeout(window.saveLayoutTimeout)
      window.saveLayoutTimeout = setTimeout(async () => {
        try { await window.electronAPI.saveLayout(currentLayout); console.log('Auto Saved'); } catch (e) { console.error(e) }
      }, 500)
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
      if (surDirEl) surDirEl.value = m.survivorModelDir || ''
      if (hunDirEl) hunDirEl.value = m.hunterModelDir || ''
      if (surMotionEl) surMotionEl.value = m.survivorMotionDir || ''
      if (hunMotionEl) hunMotionEl.value = m.hunterMotionDir || ''
      if (defaultVmdEl) defaultVmdEl.value = m.defaultMotionVmd || ''

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

async function saveLayoutSettings() {
  const g = {
    survivor: {
      maxPerRow: Number(document.getElementById('gsMaxPerRow').value) || 4,
      itemGap: Number(document.getElementById('gsItemGap').value) || 8,
      rowGap: Number(document.getElementById('gsRowGap').value) || 8,
      itemSize: Number(document.getElementById('gsItemSize').value) || 50
    },
    hunter: {
      maxPerRow: Number(document.getElementById('ghMaxPerRow').value) || 1,
      itemGap: Number(document.getElementById('ghItemGap').value) || 8,
      rowGap: Number(document.getElementById('ghRowGap').value) || 8,
      itemSize: Number(document.getElementById('ghItemSize').value) || 50
    }
  }
  const l = {
    survivor: {
      maxPerRow: Number(document.getElementById('lsMaxPerRow').value) || 4,
      itemGap: Number(document.getElementById('lsItemGap').value) || 10,
      rowGap: Number(document.getElementById('lsRowGap').value) || 10,
      itemSize: Number(document.getElementById('lsItemSize').value) || 60
    },
    hunter: {
      maxPerRow: Number(document.getElementById('lhMaxPerRow').value) || 1,
      itemGap: Number(document.getElementById('lhItemGap').value) || 10,
      rowGap: Number(document.getElementById('lhRowGap').value) || 10,
      itemSize: Number(document.getElementById('lhItemSize').value) || 60
    }
  }
  currentLayout.globalBanConfig = g
  currentLayout.localBanConfig = l
  const m = {
    enabled: !!document.getElementById('enable3dModels')?.checked,
    targetFPS: Number(document.getElementById('model3dTargetFPS')?.value) || 30,
    survivorModelDir: document.getElementById('survivorModelDir')?.value || null,
    hunterModelDir: document.getElementById('hunterModelDir')?.value || null,
    survivorMotionDir: document.getElementById('survivorMotionDir')?.value || null,
    hunterMotionDir: document.getElementById('hunterMotionDir')?.value || null,
    defaultMotionVmd: document.getElementById('defaultMotionVmd')?.value || null,

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
  applyGlobalBanLayoutConfig()
  applyLocalBanLayoutConfig()
  try {
    await window.electronAPI.saveLayout(currentLayout)
  } catch { }
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
    currentLayout.backgroundImage = result.path
    setBackground(result.path)

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
        const rev = state && state.assetRev ? `?rev=${state.assetRev}` : ''
        imgEl.src = logo + rev
      } else {
        const normalizedPath = logo.replace(/\\/g, '/')
        const baseUrl = `file:///${normalizedPath}`
        const rev = state && state.assetRev ? `?rev=${state.assetRev}` : ''
        imgEl.src = baseUrl + rev
      }
      imgEl.style.display = 'block'
    }

    setTeam('teamA', 'teamALogoName', 'teamALogoImg')
    setTeam('teamB', 'teamBLogoName', 'teamBLogoImg')
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

          // OBS模式下禁用3D模型（file:///资源无法访问）
          const use3d = !window.__ASG_OBS_MODE__ && currentLayout && currentLayout.model3d && currentLayout.model3d.enabled
          const surDir = currentLayout && currentLayout.model3d ? currentLayout.model3d.survivorModelDir : null
          const modelPath = (use3d && surDir && currentCharacter) ? `${surDir}/${currentCharacter}/${currentCharacter}.pmx` : null
          if (use3d && modelPath) {
            hideImage(el)
            show3DModelForBox(el, modelPath, 'survivor', surDir, currentCharacter)
          } else {
            dispose3DForBox(el.id)
            showImageForCharacter(el, 'survivor', currentCharacter)
          }
        } else {
          // 角色没有改变，只更新闪烁状态
          el.classList.remove('pending')
        }
      } else {
        // 位置清空
        if (hasChanged || nameEl.textContent !== '') {
          nameEl.textContent = ''
          placeholder.style.display = 'block'
          if (imgEl) {
            imgEl.style.display = 'none'
            imgEl.classList.remove('dissolve-in')
            imgEl.removeAttribute('data-character')
          }
          dispose3DForBox(el.id)
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

        // OBS模式下禁用3D模型（file:///资源无法访问）
        const use3dHun = !window.__ASG_OBS_MODE__ && currentLayout && currentLayout.model3d && currentLayout.model3d.enabled
        const hunDir = currentLayout && currentLayout.model3d ? currentLayout.model3d.hunterModelDir : null
        const modelPathHun = (use3dHun && hunDir && currentHunter) ? `${hunDir}/${currentHunter}/${currentHunter}.pmx` : null
        if (use3dHun && modelPathHun) {
          hideImage(hunterEl)
          show3DModelForBox(hunterEl, modelPathHun, 'hunter', hunDir, currentHunter)
        } else {
          dispose3DForBox(hunterEl.id)
          showImageForCharacter(hunterEl, 'hunter', currentHunter)
        }
      } else {
        // 监管者没有改变，只更新闪烁状态
        hunterEl.classList.remove('pending')
      }
    } else {
      if (hunterChanged || hunterName.textContent !== '') {
        hunterName.textContent = ''
        hunterPlaceholder.style.display = 'block'
        if (hunterImgEl) {
          hunterImgEl.style.display = 'none'
          hunterImgEl.classList.remove('dissolve-in')
          hunterImgEl.removeAttribute('data-character')
        }
        dispose3DForBox(hunterEl.id)
      }

      // 如果正在选监管者且位置为空，添加闪烁效果
      if (isPickingHunter) {
        hunterEl.classList.add('pending')
      } else {
        hunterEl.classList.remove('pending')
      }
    }

    // 更新求生者Ban位（使用图片）
    const survivorBanList = document.getElementById('survivorBanList')
    survivorBanList.innerHTML = ''
    const lbc = getLocalBanConfig()
    const hunterBannedSurvivors = roundData.hunterBannedSurvivors || []
    hunterBannedSurvivors.forEach(name => {
      const item = document.createElement('div')
      item.className = 'ban-item'
      item.style.width = `${Number(lbc.survivor.itemSize) || 60}px`
      item.style.height = `${Number(lbc.survivor.itemSize) || 60}px`
      const img = document.createElement('img')
      img.src = `../assets/surHalf/${name}.png`
      img.alt = name
      img.title = name
      img.onerror = function () {
        this.style.display = 'none'
        this.parentElement.innerHTML = `<span style="font-size: 10px; color: #fff;">${name}</span>`
      }
      item.appendChild(img)
      survivorBanList.appendChild(item)
    })

    // 更新监管者Ban位（使用图片）
    const hunterBanList = document.getElementById('hunterBanList')
    hunterBanList.innerHTML = ''
    const survivorBannedHunters = roundData.survivorBannedHunters || []
    survivorBannedHunters.forEach(name => {
      const item = document.createElement('div')
      item.className = 'ban-item'
      item.style.width = `${Number(lbc.hunter.itemSize) || 60}px`
      item.style.height = `${Number(lbc.hunter.itemSize) || 60}px`
      const img = document.createElement('img')
      img.src = `../assets/hunHalf/${name}.png`
      img.alt = name
      img.title = name
      img.onerror = function () {
        this.style.display = 'none'
        this.parentElement.innerHTML = `<span style="font-size: 10px; color: #fff;">${name}</span>`
      }
      item.appendChild(img)
      hunterBanList.appendChild(item)
    })
  }

  const gbc = getGlobalBanConfig()
  applyGlobalBanLayoutConfig()

  // 更新全局禁选求生者（使用图片）
  const globalBanSurvivorList = document.getElementById('globalBanSurvivorList')
  if (globalBanSurvivorList) {
    globalBanSurvivorList.innerHTML = ''
    const globalBannedSurvivors = state.globalBannedSurvivors || []
    globalBannedSurvivors.forEach(name => {
      const item = document.createElement('div')
      item.className = 'global-ban-item'
      item.style.width = `${Number(gbc.survivor.itemSize) || 50}px`
      item.style.height = `${Number(gbc.survivor.itemSize) || 50}px`
      const img = document.createElement('img')
      img.src = `../assets/surHalf/${name}.png`
      img.alt = name
      img.title = name
      img.onerror = function () {
        this.style.display = 'none'
        this.parentElement.innerHTML = `<span style="font-size: 8px; color: #fff; text-align: center;">${name}</span>`
      }
      item.appendChild(img)
      globalBanSurvivorList.appendChild(item)
    })
  }

  // 更新全局禁选监管者（使用图片）
  const globalBanHunterList = document.getElementById('globalBanHunterList')
  if (globalBanHunterList) {
    globalBanHunterList.innerHTML = ''
    const globalBannedHunters = state.globalBannedHunters || []
    globalBannedHunters.forEach(name => {
      const item = document.createElement('div')
      item.className = 'global-ban-item'
      item.style.width = `${Number(gbc.hunter.itemSize) || 50}px`
      item.style.height = `${Number(gbc.hunter.itemSize) || 50}px`
      const img = document.createElement('img')
      img.src = `../assets/hunHalf/${name}.png`
      img.alt = name
      img.title = name
      img.onerror = function () {
        this.style.display = 'none'
        this.parentElement.innerHTML = `<span style="font-size: 8px; color: #fff; text-align: center;">${name}</span>`
      }
      item.appendChild(img)
      globalBanHunterList.appendChild(item)
    })
  }
}

// ========= 地图图片展示（assets/map） =========
var __mapAssetNames = null
var __lastMapResolved = null
var __lastMapUrl = null

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
  if (!resolved) {
    container.style.display = 'none'
    __lastMapResolved = null
    __lastMapUrl = null
    return
  }

  container.style.display = ''
  const encoded = encodeURIComponent(resolved) + '.png'
  const url = (() => {
    try {
      return new URL(`../assets/map/${encoded}`, location.href).href
    } catch {
      return `../assets/map/${encoded}`
    }
  })()

  if (__lastMapResolved === resolved && __lastMapUrl === url && container.style.display !== 'none' && img.src === url) {
    return
  }

  __lastMapResolved = resolved
  __lastMapUrl = url

  img.onerror = () => {
    console.warn('[Frontend] 地图图片加载失败:', { mapName, resolved, url })
    container.style.display = 'none'
  }
  img.onload = () => {
    // 仅用于调试：确认实际加载到了图片
    // console.log('[Frontend] 地图图片已加载:', { mapName, resolved, url })
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

function showImageForCharacter(boxEl, roleType, name) {
  const nameEl = boxEl.querySelector('.name')
  const placeholder = boxEl.querySelector('.placeholder')
  let imgEl = boxEl.querySelector('img')
  if (!imgEl) {
    imgEl = document.createElement('img')
    boxEl.insertBefore(imgEl, nameEl)
  }
  const src = roleType === 'survivor' ? `../assets/surHalf/${name}.png` : `../assets/hunHalf/${name}.png`
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

async function getOfficialModelUrl(roleName) {
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
  return map && map[roleName] ? map[roleName] : null
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

  // 处理 Windows 盘符
  if (/^[a-zA-Z]:/.test(normalized)) {
    normalized = '/' + normalized
  }

  // 使用 encodeURI 处理中文字符和空格
  return 'file://' + encodeURI(normalized).replace(/#/g, '%23').replace(/\?/g, '%3F')
}

async function show3DModelForBox(boxEl, modelPath, roleType, modelDir, modelName) {
  if (!boxEl) return
  console.log(`[3D] Starting load for ${roleType}: ${modelPath}`)

  const charName = boxEl.querySelector('.name')?.textContent || ''

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
      const officialUrl = await getOfficialModelUrl(charName)
      if (officialUrl) {
        modelPath = officialUrl
        isRemotePath = true
      } else {
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
  const fitOptions = { scaleCorrection, verticalOffset }

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
      const baseScale = targetMesh.userData.__fitBaseScale || targetMesh.scale.clone()
      const basePos = targetMesh.userData.__fitBasePos || targetMesh.position.clone()
      const baseRot = targetMesh.userData.__fitBaseRot || targetMesh.rotation.clone()
      if (!targetMesh.userData.__fitBaseScale) targetMesh.userData.__fitBaseScale = baseScale.clone()
      if (!targetMesh.userData.__fitBasePos) targetMesh.userData.__fitBasePos = basePos.clone()
      if (!targetMesh.userData.__fitBaseRot) targetMesh.userData.__fitBaseRot = baseRot.clone()
      targetMesh.scale.copy(baseScale)
      targetMesh.position.copy(basePos)
      targetMesh.rotation.copy(baseRot)

      const scaleCorrection = Number.isFinite(options.scaleCorrection) ? options.scaleCorrection : 1.0
      const verticalOffset = Number.isFinite(options.verticalOffset) ? options.verticalOffset : 0
      targetMesh.scale.multiplyScalar(scaleCorrection)

      targetMesh.updateMatrixWorld(true)
      const box = new THREE.Box3().setFromObject(targetMesh)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())

      if (size.y === 0) {
        console.warn('[3D] Model size is 0, skipping fit')
        return
      }

      // 计算相机视野高度 (PerspectiveCamera)
      const fov = camera.fov
      const dist = Math.abs(camera.position.z - center.z)
      const viewHeight = 2 * Math.tan((fov / 2) * Math.PI / 180) * dist

      targetMesh.updateMatrixWorld(true)
      box.setFromObject(targetMesh)
      const newSize = box.getSize(new THREE.Vector3())
      const newCenter = box.getCenter(new THREE.Vector3())

      // 设置位置：顶部对齐到视野顶部
      const viewTopY = viewHeight / 2
      const targetTopY = viewTopY
      const currentTopY = newCenter.y + (newSize.y / 2)

      targetMesh.position.y += (targetTopY - currentTopY) + (verticalOffset * viewHeight)
      targetMesh.position.x = -newCenter.x
      targetMesh.position.z = 0 // 确保在原点平面

      console.log('[3D] Model fitted. Scale:', scaleCorrection.toFixed(4), 'TopY:', targetTopY.toFixed(2))
    } catch (e) {
      console.error('[3D] Error fitting model:', e)
    }
  }

  function loadMMD(modelPath, onReady, onError, options = {}) {
    console.log('[3D] Loading MMD model:', modelPath)
    animationMixer = null
    const loader = new THREE.MMDLoader()
    const url = toFileUrl(modelPath)

    // 设置资源路径，确保贴图能相对于模型路径加载
    const basePath = url.substring(0, url.lastIndexOf('/') + 1)
    loader.setResourcePath(basePath)

    console.log('[3D] Final model URL:', url)
    console.log('[3D] Resource base path:', basePath)

    try {
      loader.load(url, (object) => {
        console.log('[3D] MMD model parsed successfully:', modelPath)
        mesh = object

        // 调试日志：检查材质和贴图状态
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          console.log(`[3D] Model has ${mats.length} materials`)
          mats.forEach((m, i) => {
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

  function loadMMDWithVMD(modelPath, vmdPath, onReady, onError, fallbackVmd, options = {}) {
    console.log('[3D] Loading MMD with VMD:', modelPath, vmdPath)
    animationMixer = null
    const loader = new THREE.MMDLoader()
    const modelUrl = toFileUrl(modelPath)
    const vmdUrl = toFileUrl(vmdPath)

    // 设置资源路径
    const basePath = modelUrl.substring(0, modelUrl.lastIndexOf('/') + 1)
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
    if (typeof remaining !== 'number') return

    let percent = 0
    if (t > 0) {
      percent = (remaining / t) * 100
    }
    percent = Math.max(0, Math.min(100, percent))

    fill.style.width = `${percent}%`

    if (remaining <= 10) {
      fill.classList.add('warning')
    } else {
      fill.classList.remove('warning')
    }
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
  ; (function inject3DSettings() {
    const panel = document.querySelector('#layoutSettingsPanel .settings-modal')
    if (!panel) return
    const section = document.createElement('div')
    section.className = 'settings-section'
    section.innerHTML = `
        <h4>3D角色展示</h4>
        <div class="settings-grid">
          <div class="settings-item"><label>启用3D模型</label><input id="enable3dModels" type="checkbox"></div>
          <div class="settings-item"><label>目标帧率</label><input id="model3dTargetFPS" type="number" min="15" max="60" value="30"></div>
          <div class="settings-item"><label>求生者模型目录</label><input id="survivorModelDir" type="text" placeholder="例如 C:/Models/Survivor"></div>
          <div class="settings-item"><label>监管者模型目录</label><input id="hunterModelDir" type="text" placeholder="例如 C:/Models/Hunter"></div>
          <div class="settings-item"><label>求生者动作目录</label><input id="survivorMotionDir" type="text" placeholder="例如 C:/Motions/Survivor"></div>
          <div class="settings-item"><label>监管者动作目录</label><input id="hunterMotionDir" type="text" placeholder="例如 C:/Motions/Hunter"></div>
          <div class="settings-item"><label>默认VMD动作</label><input id="defaultMotionVmd" type="text" placeholder="例如 C:/Motions/default.vmd"></div>
        </div>
        
        <h4 style="margin-top:16px;">渲染质量</h4>
        <div class="settings-grid">
          <div class="settings-item"><label>抗锯齿</label>
            <select id="render3dAntialias">
              <option value="false">关闭</option>
              <option value="true" selected>开启</option>
            </select>
          </div>
          <div class="settings-item"><label>像素比</label>
            <select id="render3dPixelRatio">
              <option value="0.5">0.5x (低)</option>
              <option value="1" selected>1x (标准)</option>
              <option value="1.5">1.5x (高)</option>
              <option value="2">2x (超高)</option>
            </select>
          </div>
          <div class="settings-item"><label>启用阴影</label><input id="render3dEnableShadows" type="checkbox"></div>
          <div class="settings-item"><label>阴影质量</label>
            <select id="render3dShadowQuality">
              <option value="512">低 (512)</option>
              <option value="1024" selected>中 (1024)</option>
              <option value="2048">高 (2048)</option>
            </select>
          </div>
        </div>
        
        <h4 style="margin-top:16px;">风格化渲染</h4>
        <div class="settings-grid">
          <div class="settings-item"><label>卡通描边</label><input id="render3dEnableOutline" type="checkbox" checked></div>
          <div class="settings-item"><label>描边粗细</label><input id="render3dOutlineThickness" type="range" min="0.001" max="0.02" step="0.001" value="0.003"></div>
          <div class="settings-item"><label>描边颜色</label><input id="render3dOutlineColor" type="color" value="#000000"></div>
          <div class="settings-item"><label>描边透明度</label><input id="render3dOutlineAlpha" type="range" min="0" max="1" step="0.1" value="1"></div>
          <div class="settings-item"><label>Toon着色</label><input id="render3dEnableToon" type="checkbox"></div>
          <div class="settings-item"><label>Toon渐变级数</label>
            <select id="render3dToonGradient">
              <option value="3">3级 (硬边)</option>
              <option value="5" selected>5级 (标准)</option>
              <option value="8">8级 (柔和)</option>
            </select>
          </div>
        </div>
        
        <h4 style="margin-top:16px;">光照设置</h4>
        <div class="settings-grid">
          <div class="settings-item"><label>环境光颜色</label><input id="render3dAmbientColor" type="color" value="#ffffff"></div>
          <div class="settings-item"><label>环境光强度</label><input id="render3dAmbientIntensity" type="range" min="0" max="2" step="0.1" value="0.5"></div>
          <div class="settings-item"><label>方向光颜色</label><input id="render3dDirectionalColor" type="color" value="#ffffff"></div>
          <div class="settings-item"><label>方向光强度</label><input id="render3dDirectionalIntensity" type="range" min="0" max="3" step="0.1" value="0.7"></div>
          <div class="settings-item"><label>光源位置 X</label><input id="render3dLightPosX" type="range" min="-50" max="50" value="10"></div>
          <div class="settings-item"><label>光源位置 Y</label><input id="render3dLightPosY" type="range" min="-50" max="50" value="20"></div>
          <div class="settings-item"><label>光源位置 Z</label><input id="render3dLightPosZ" type="range" min="-50" max="50" value="10"></div>
        </div>
      `
    panel.appendChild(section)
  })()
