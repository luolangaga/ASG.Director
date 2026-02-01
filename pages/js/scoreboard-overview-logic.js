// OBS浏览器模式兼容层
if (!window.electronAPI) {
    console.log('[ScoreboardOverview] OBS模式：创建兼容API层')
    window.__ASG_OBS_MODE__ = true
    window.__rewriteAssetPath__ = function (src) {
        if (!src) return src
        if (src.startsWith('../assets/')) return src.replace('../assets/', '/assets/')
        if (src.startsWith('./assets/')) return src.replace('./assets/', '/assets/')
        if (src.startsWith('./js/')) return src.replace('./js/', '/js/')
        if (src.startsWith('file:///')) {
            const bgMatch = src.match(/asg-director[\/\\]background[\/\\](.+)$/i)
            if (bgMatch) return '/background/' + bgMatch[1].replace(/\\/g, '/')
            const match = src.match(/asg-director[\/\\](.+)$/i)
            if (match) return '/userdata/' + match[1].replace(/\\/g, '/')
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
        getScoreboardOverviewLayout: async () => {
            try {
                const resp = await fetch('/api/scoreboard-overview-layout')
                const data = await resp.json()
                return data && data.success ? { success: true, layout: data.layout } : { success: true, layout: null }
            } catch (e) { return { success: true, layout: null } }
        },
        saveScoreboardOverviewLayout: async () => ({ success: true }),
        getCustomFonts: async () => ({ success: true, fonts: [] }),
        getFontUrl: async () => ({ success: false }),
        selectOverviewTexture: async () => ({ success: false }),
        selectBackground: async () => ({ success: false })
    }
}

// 全局状态
let roomId = ''
let boCount = 5 // 默认BO5
let scoreData = { bos: [] }
let editMode = false
let layout = {}
let availableFonts = []

function toFileUrl(src) {
    const normalized = String(src || '').replace(/\\/g, '/')
    if (normalized.startsWith('/')) return `file://${encodeURI(normalized)}`
    return `file:///${encodeURI(normalized)}`
}

// 初始化
async function init() {
    const urlParams = new URLSearchParams(window.location.search)
    roomId = urlParams.get('roomId') || ''
    boCount = parseInt(urlParams.get('bo')) || 5

    await loadLayout()
    await loadCustomFonts()
    generateGameColumns()
    loadScoreData()
    applyLayout()
    applyFontSettings()

    // 定时刷新比分数据
    setInterval(loadScoreData, 1000)

    setupKeyboardShortcuts()

    // 监听字体配置更新
    if (window.electronAPI && window.electronAPI.onFontConfigUpdated) {
        window.electronAPI.onFontConfigUpdated(async () => {
            await loadCustomFonts()
            populateFontSelects()
            applyFontSettings()
        })
    }

    // 监听布局包导入事件
    if (window.electronAPI && window.electronAPI.onReloadLayoutFromPack) {
        window.electronAPI.onReloadLayoutFromPack(async () => {
            console.log('[ScoreboardOverview] 收到布局包重新加载通知')
            await loadLayout()
            await loadCustomFonts()
            applyLayout()
            populateFontSelects()
            applyFontSettings()
        })
    }
}

// 加载布局配置
async function loadLayout() {
    if (window.electronAPI.getScoreboardOverviewLayout) {
        try {
            const res = await window.electronAPI.getScoreboardOverviewLayout()
            if (res.success && res.layout) {
                layout = res.layout
            }
        } catch (e) {
            console.warn('[ScoreboardOverview] 加载布局失败:', e)
        }
    }
}

// 保存布局配置
async function saveLayout() {
    try {
        if (window.electronAPI.saveScoreboardOverviewLayout) {
            await window.electronAPI.saveScoreboardOverviewLayout(layout)
        }
    } catch (e) {
        console.warn('[ScoreboardOverview] 保存布局失败:', e)
    }
}

// 加载自定义字体
async function loadCustomFonts() {
    try {
        if (!window.electronAPI || !window.electronAPI.getCustomFonts) return
        const res = await window.electronAPI.getCustomFonts()
        if (res.success && res.fonts.length) {
            availableFonts = res.fonts
            for (const f of res.fonts) {
                if (window.electronAPI.getFontUrl) {
                    const u = await window.electronAPI.getFontUrl(f.fileName)
                    if (u.success) {
                        const ff = new FontFace(f.fontFamily, `url(${u.url})`)
                        await ff.load()
                        document.fonts.add(ff)
                    }
                }
            }
            populateFontSelects()
        }
    } catch (e) { console.warn('Load fonts failed', e) }
}

// 填充字体选择器
function populateFontSelects() {
    const selects = ['headerFont', 'teamNameFont', 'scoreFont', 'totalFont']
    selects.forEach(id => {
        const select = document.getElementById(id)
        if (!select) return
        // 清除已有选项（保留第一个"系统默认"）
        while (select.options.length > 1) {
            select.remove(1)
        }
        // 添加自定义字体
        availableFonts.forEach(f => {
            const opt = document.createElement('option')
            opt.value = f.fontFamily
            opt.textContent = f.fontFamily
            opt.style.fontFamily = f.fontFamily
            select.appendChild(opt)
        })
    })
}

// 生成游戏列（根据BO数）
function generateGameColumns() {
    const container = document.getElementById('gamesContainer')
    container.innerHTML = ''

    for (let i = 0; i < boCount; i++) {
        const gameNum = i + 1
        const column = document.createElement('div')
        column.className = 'game-column'
        column.id = `game${gameNum}Column`

        column.innerHTML = `
      <div class="header-cell game-header">
        <img id="game${gameNum}HeaderBg" class="cell-bg" src="" alt="">
        <span class="header-text">GAME ${gameNum}</span>
        <div class="sub-header">
          <span>FIRST HALF</span>
          <span>SECOND HALF</span>
        </div>
      </div>
      <div class="score-cell score-a" id="game${gameNum}ScoreA">
        <img id="game${gameNum}ABg" class="cell-bg" src="" alt="">
        <div class="score-values">
          <span class="half-score" id="game${gameNum}AUpper">0</span>
          <div class="half-divider"></div>
          <span class="half-score" id="game${gameNum}ALower">0</span>
        </div>
      </div>
      <div class="score-cell score-b" id="game${gameNum}ScoreB">
        <img id="game${gameNum}BBg" class="cell-bg" src="" alt="">
        <div class="score-values">
          <span class="half-score" id="game${gameNum}BUpper">0</span>
          <div class="half-divider"></div>
          <span class="half-score" id="game${gameNum}BLower">0</span>
        </div>
      </div>
    `
        container.appendChild(column)
    }

    // 调整窗口大小
    adjustWindowSize()
}

// 调整窗口大小（根据BO数）
function adjustWindowSize() {
    if (window.__ASG_OBS_MODE__) return

    const teamWidth = 150
    const gameWidth = 160
    const totalWidth = 100
    const baseWidth = teamWidth + (boCount * gameWidth) + totalWidth + 20 // 20px余量

    if (window.electronAPI && window.electronAPI.resizeWindow) {
        window.electronAPI.resizeWindow(baseWidth, 200)
    }
}

// 加载比分数据
function loadScoreData() {
    if (!roomId) return

    const saved = localStorage.getItem('score_' + roomId)
    if (saved) {
        try {
            scoreData = JSON.parse(saved)
            updateScoreDisplay()
        } catch (e) {
            console.warn('[ScoreboardOverview] 解析比分数据失败:', e)
        }
    }
}

// 更新比分显示
function updateScoreDisplay() {
    // 更新队伍名称
    document.getElementById('teamAName').textContent = scoreData.teamAName || 'A队'
    document.getElementById('teamBName').textContent = scoreData.teamBName || 'B队'

    // 更新队伍Logo
    const logoA = document.getElementById('teamALogo')
    const logoB = document.getElementById('teamBLogo')
    if (scoreData.teamALogo) {
        logoA.src = scoreData.teamALogo
    }
    if (scoreData.teamBLogo) {
        logoB.src = scoreData.teamBLogo
    }

    // 更新各游戏比分
    let totalA = 0
    let totalB = 0

    if (scoreData.bos && scoreData.bos.length) {
        scoreData.bos.forEach((bo, index) => {
            const gameNum = index + 1
            if (gameNum > boCount) return

            // 上半场
            const aUpper = bo.upper?.teamA || 0
            const bUpper = bo.upper?.teamB || 0
            // 下半场
            const aLower = bo.lower?.teamA || 0
            const bLower = bo.lower?.teamB || 0

            // 更新UI
            const elAUpper = document.getElementById(`game${gameNum}AUpper`)
            const elALower = document.getElementById(`game${gameNum}ALower`)
            const elBUpper = document.getElementById(`game${gameNum}BUpper`)
            const elBLower = document.getElementById(`game${gameNum}BLower`)

            if (elAUpper) elAUpper.textContent = aUpper
            if (elALower) elALower.textContent = aLower
            if (elBUpper) elBUpper.textContent = bUpper
            if (elBLower) elBLower.textContent = bLower

            // 累计总分
            totalA += aUpper + aLower
            totalB += bUpper + bLower
        })
    }

    // 更新TOTAL
    document.getElementById('totalAScore').textContent = totalA
    document.getElementById('totalBScore').textContent = totalB
}

// 应用布局配置
function applyLayout() {
    if (!layout) return

    // 应用贴图
    if (layout.textures) {
        Object.keys(layout.textures).forEach(id => {
            const img = document.getElementById(id)
            if (img && layout.textures[id]) {
                let src = layout.textures[id]
                if (!src.startsWith('file:') && !window.__ASG_OBS_MODE__ && !src.startsWith('data:')) {
                    src = toFileUrl(src)
                }
                img.src = src
            }
        })
    }

    // 应用背景
    if (layout.backgroundImage) {
        const bg = document.getElementById('backgroundImage')
        let src = layout.backgroundImage
        if (!src.startsWith('file:') && !window.__ASG_OBS_MODE__) {
            src = toFileUrl(src)
        }
        bg.src = src
        bg.style.display = 'block'
        document.body.classList.add('has-background')
    }

    // 应用统一的GAME贴图
    if (layout.textures) {
        // GAME表头统一贴图
        if (layout.textures.gameHeaderBg) {
            let src = layout.textures.gameHeaderBg
            if (!src.startsWith('file:') && !window.__ASG_OBS_MODE__ && !src.startsWith('data:')) {
                src = toFileUrl(src)
            }
            for (let i = 0; i < boCount; i++) {
                const img = document.getElementById(`game${i + 1}HeaderBg`)
                if (img) img.src = src
            }
        }
        // A队GAME统一贴图
        if (layout.textures.gameABg) {
            let src = layout.textures.gameABg
            if (!src.startsWith('file:') && !window.__ASG_OBS_MODE__ && !src.startsWith('data:')) {
                src = toFileUrl(src)
            }
            for (let i = 0; i < boCount; i++) {
                const img = document.getElementById(`game${i + 1}ABg`)
                if (img) img.src = src
            }
        }
        // B队GAME统一贴图
        if (layout.textures.gameBBg) {
            let src = layout.textures.gameBBg
            if (!src.startsWith('file:') && !window.__ASG_OBS_MODE__ && !src.startsWith('data:')) {
                src = toFileUrl(src)
            }
            for (let i = 0; i < boCount; i++) {
                const img = document.getElementById(`game${i + 1}BBg`)
                if (img) img.src = src
            }
        }
    }

    // 应用字体设置
    if (layout.fonts) {
        if (layout.fonts.header) {
            document.getElementById('headerFont').value = layout.fonts.header.family || ''
            document.getElementById('headerFontSize').value = layout.fonts.header.size || 24
            document.getElementById('headerFontColor').value = layout.fonts.header.color || '#ffffff'
        }
        if (layout.fonts.teamName) {
            document.getElementById('teamNameFont').value = layout.fonts.teamName.family || ''
            document.getElementById('teamNameFontSize').value = layout.fonts.teamName.size || 20
            document.getElementById('teamNameFontColor').value = layout.fonts.teamName.color || '#ffffff'
        }
        if (layout.fonts.score) {
            document.getElementById('scoreFont').value = layout.fonts.score.family || ''
            document.getElementById('scoreFontSize').value = layout.fonts.score.size || 18
            document.getElementById('scoreFontColor').value = layout.fonts.score.color || '#ffffff'
        }
        if (layout.fonts.total) {
            document.getElementById('totalFont').value = layout.fonts.total.family || ''
            document.getElementById('totalFontSize').value = layout.fonts.total.size || 28
            document.getElementById('totalFontColor').value = layout.fonts.total.color || '#ffffff'
        }
    }
}

// 应用字体设置
function applyFontSettings() {
    // 表头字体
    const headerFont = document.getElementById('headerFont').value
    const headerSize = document.getElementById('headerFontSize').value
    const headerColor = document.getElementById('headerFontColor').value
    document.querySelectorAll('.header-text').forEach(el => {
        el.style.fontFamily = headerFont ? `"${headerFont}", sans-serif` : ''
        el.style.fontSize = headerSize + 'px'
        el.style.color = headerColor
    })

    // 队伍名字体
    const teamNameFont = document.getElementById('teamNameFont').value
    const teamNameSize = document.getElementById('teamNameFontSize').value
    const teamNameColor = document.getElementById('teamNameFontColor').value
    document.querySelectorAll('.team-name').forEach(el => {
        el.style.fontFamily = teamNameFont ? `"${teamNameFont}", sans-serif` : ''
        el.style.fontSize = teamNameSize + 'px'
        el.style.color = teamNameColor
    })

    // 比分字体
    const scoreFont = document.getElementById('scoreFont').value
    const scoreSize = document.getElementById('scoreFontSize').value
    const scoreColor = document.getElementById('scoreFontColor').value
    document.querySelectorAll('.half-score').forEach(el => {
        el.style.fontFamily = scoreFont ? `"${scoreFont}", sans-serif` : ''
        el.style.fontSize = scoreSize + 'px'
        el.style.color = scoreColor
    })

    // TOTAL字体
    const totalFont = document.getElementById('totalFont').value
    const totalSize = document.getElementById('totalFontSize').value
    const totalColor = document.getElementById('totalFontColor').value
    document.querySelectorAll('.total-score').forEach(el => {
        el.style.fontFamily = totalFont ? `"${totalFont}", sans-serif` : ''
        el.style.fontSize = totalSize + 'px'
        el.style.color = totalColor
    })

    // 保存到布局
    layout.fonts = {
        header: { family: headerFont, size: parseInt(headerSize), color: headerColor },
        teamName: { family: teamNameFont, size: parseInt(teamNameSize), color: teamNameColor },
        score: { family: scoreFont, size: parseInt(scoreSize), color: scoreColor },
        total: { family: totalFont, size: parseInt(totalSize), color: totalColor }
    }
    saveLayout()
}

// 选择贴图
async function selectTexture(targetId) {
    if (window.__ASG_OBS_MODE__) return

    try {
        const result = await window.electronAPI.selectOverviewTexture()
        if (result.success && result.path) {
            const img = document.getElementById(targetId)
            if (img) {
                let src = result.path
                if (!src.startsWith('file:')) {
                    src = toFileUrl(src)
                }
                img.src = src

                // 保存到布局
                if (!layout.textures) layout.textures = {}
                layout.textures[targetId] = result.path
                saveLayout()
            }
        }
    } catch (e) {
        console.error('[ScoreboardOverview] 选择贴图失败:', e)
    }
}

// 清除贴图
function clearTexture(targetId) {
    const img = document.getElementById(targetId)
    if (img) {
        img.src = ''

        // 从布局中移除
        if (layout.textures && layout.textures[targetId]) {
            delete layout.textures[targetId]
            saveLayout()
        }
    }
}

// 选择背景
async function selectBackground() {
    if (window.__ASG_OBS_MODE__) return

    try {
        const result = await window.electronAPI.selectBackground()
        if (result.success && result.path) {
            const bg = document.getElementById('backgroundImage')
            let src = result.path
            if (!src.startsWith('file:')) {
                src = toFileUrl(src)
            }
            bg.src = src
            bg.style.display = 'block'
            document.body.classList.add('has-background')

            layout.backgroundImage = result.path
            saveLayout()
        }
    } catch (e) {
        console.error('[ScoreboardOverview] 选择背景失败:', e)
    }
}

// 设置弹窗
function openSettingsModal() {
    document.getElementById('settingsModal').classList.add('show')
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('show')
}

// 字体弹窗
function openFontModal() {
    document.getElementById('fontModal').classList.add('show')
}

function closeFontModal() {
    document.getElementById('fontModal').classList.remove('show')
    applyFontSettings()
}

// 切换编辑模式
function toggleEditMode() {
    editMode = !editMode
    document.body.classList.toggle('edit-mode', editMode)
}

// 键盘快捷键
function setupKeyboardShortcuts() {
    window.addEventListener('keydown', e => {
        if (e.key === 'F2') {
            toggleEditMode()
        } else if (e.key === 'F3' && editMode && !window.__ASG_OBS_MODE__) {
            selectBackground()
        } else if (e.key === 'F4' && editMode) {
            openSettingsModal()
        } else if (e.key === 'F5' && editMode) {
            openFontModal()
            e.preventDefault() // 阻止刷新
        } else if (e.key === 'F12') {
            if (window.electronAPI && window.electronAPI.openDevTools) {
                window.electronAPI.openDevTools()
            }
        }
    })
}

// OBS模式下的状态更新
function setupOBSMode() {
    if (window.__ASG_OBS_MODE__) {
        window.addEventListener('asg-state-update', e => {
            const s = e.detail.state
            if (s) {
                Object.assign(scoreData, s)
                updateScoreDisplay()
            }
        })
    }
}

// 统一选择GAME表头贴图
async function selectGameHeaderTexture() {
    if (window.__ASG_OBS_MODE__) return
    try {
        const result = await window.electronAPI.selectOverviewTexture()
        if (result.success && result.path) {
            let src = result.path
            if (!src.startsWith('file:')) {
                src = toFileUrl(src)
            }
            // 应用到所有GAME表头
            for (let i = 0; i < boCount; i++) {
                const img = document.getElementById(`game${i + 1}HeaderBg`)
                if (img) img.src = src
            }
            // 保存到布局
            if (!layout.textures) layout.textures = {}
            layout.textures.gameHeaderBg = result.path
            saveLayout()
        }
    } catch (e) {
        console.error('[ScoreboardOverview] 选择GAME表头贴图失败:', e)
    }
}

// 清除GAME表头贴图
function clearGameHeaderTexture() {
    for (let i = 0; i < boCount; i++) {
        const img = document.getElementById(`game${i + 1}HeaderBg`)
        if (img) img.src = ''
    }
    if (layout.textures && layout.textures.gameHeaderBg) {
        delete layout.textures.gameHeaderBg
        saveLayout()
    }
}

// 统一选择A队GAME贴图
async function selectGameATexture() {
    if (window.__ASG_OBS_MODE__) return
    try {
        const result = await window.electronAPI.selectOverviewTexture()
        if (result.success && result.path) {
            let src = result.path
            if (!src.startsWith('file:')) {
                src = toFileUrl(src)
            }
            // 应用到所有A队GAME
            for (let i = 0; i < boCount; i++) {
                const img = document.getElementById(`game${i + 1}ABg`)
                if (img) img.src = src
            }
            if (!layout.textures) layout.textures = {}
            layout.textures.gameABg = result.path
            saveLayout()
        }
    } catch (e) {
        console.error('[ScoreboardOverview] 选择A队GAME贴图失败:', e)
    }
}

// 清除A队GAME贴图
function clearGameATexture() {
    for (let i = 0; i < boCount; i++) {
        const img = document.getElementById(`game${i + 1}ABg`)
        if (img) img.src = ''
    }
    if (layout.textures && layout.textures.gameABg) {
        delete layout.textures.gameABg
        saveLayout()
    }
}

// 统一选择B队GAME贴图
async function selectGameBTexture() {
    if (window.__ASG_OBS_MODE__) return
    try {
        const result = await window.electronAPI.selectOverviewTexture()
        if (result.success && result.path) {
            let src = result.path
            if (!src.startsWith('file:')) {
                src = toFileUrl(src)
            }
            // 应用到所有B队GAME
            for (let i = 0; i < boCount; i++) {
                const img = document.getElementById(`game${i + 1}BBg`)
                if (img) img.src = src
            }
            if (!layout.textures) layout.textures = {}
            layout.textures.gameBBg = result.path
            saveLayout()
        }
    } catch (e) {
        console.error('[ScoreboardOverview] 选择B队GAME贴图失败:', e)
    }
}

// 清除B队GAME贴图
function clearGameBTexture() {
    for (let i = 0; i < boCount; i++) {
        const img = document.getElementById(`game${i + 1}BBg`)
        if (img) img.src = ''
    }
    if (layout.textures && layout.textures.gameBBg) {
        delete layout.textures.gameBBg
        saveLayout()
    }
}

// 全局导出
window.selectTexture = selectTexture
window.clearTexture = clearTexture
window.selectGameHeaderTexture = selectGameHeaderTexture
window.clearGameHeaderTexture = clearGameHeaderTexture
window.selectGameATexture = selectGameATexture
window.clearGameATexture = clearGameATexture
window.selectGameBTexture = selectGameBTexture
window.clearGameBTexture = clearGameBTexture
window.openSettingsModal = openSettingsModal
window.closeSettingsModal = closeSettingsModal
window.openFontModal = openFontModal
window.closeFontModal = closeFontModal
window.applyFontSettings = applyFontSettings

// 启动
init()
setupOBSMode()
