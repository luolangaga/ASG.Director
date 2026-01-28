let roomData = null
let connection = null
let currentState = null
let timerInterval = null
let timerRemaining = 0

// 比分数据（与当前房间对应）
let scoreData = {
  rounds: [],
  teamAWins: 0,
  teamBWins: 0,
  teamADraws: 0,
  teamBDraws: 0
}

// BP阶段配置
const phases = [
  { id: 0, name: '换人阶段' },
  { id: 1, name: '监管者禁用第一阶段' },
  { id: 2, name: '求生者禁用阶段' },
  { id: 3, name: '求生者选择第一阶段' },
  { id: 4, name: '监管者禁用第二阶段' },
  { id: 5, name: '求生者选择第二阶段' },
  { id: 6, name: '监管者禁用第三阶段' },
  { id: 7, name: '求生者选择第三阶段' },
  { id: 8, name: '监管者选择阶段' },
  { id: 9, name: '角色展示阶段' },
  { id: 10, name: '本半局结束' }
]

// 初始化
function init() {
  // 生成阶段按钮
  const container = document.getElementById('phaseControls')
  phases.forEach(phase => {
    const btn = document.createElement('div')
    btn.className = 'phase-btn'
    btn.dataset.phase = phase.id
    btn.textContent = phase.name
    btn.onclick = () => jumpToPhase(phase.id)
    container.appendChild(btn)
  })

  // 应用持久化主题（如果有）
  try {
    const saved = localStorage.getItem('asg_theme')
    if (saved === 'dark' || saved === 'light') document.documentElement.setAttribute('data-theme', saved)
    else document.documentElement.removeAttribute('data-theme')
  } catch (e) { console.warn('读取主题失败', e) }

  // 监听来自主窗口 / electron 的房间数据
  if (window.electronAPI && window.electronAPI.onRoomData) {
    window.electronAPI.onRoomData((data) => {
      roomData = data
      updateRoomInfo()
      initScoreBoard()
      loadPostMatch(false)

      // 本地BP模式：完全离线，不连接服务器
      if (roomData && roomData.localMode) {
        try {
          const statusText = document.getElementById('statusText')
          if (statusText) statusText.textContent = '本地模式（离线）'
        } catch (e) {
          console.warn('设置本地模式状态失败', e)
        }
        return
      }

      connectToServer()
    })
  }

  // 监听主题变更消息（来自主窗口）
  if (window.electronAPI) {
    // 主进程会把 sendToFrontend 调用广播到其它窗口，使用 onUpdateData 或 onRoomData 通道捕捉自定义消息
    if (window.electronAPI.onUpdateData) {
      window.electronAPI.onUpdateData((payload) => {
        try {
          if (payload && payload.type === 'theme-changed') {
            if (payload.theme === 'dark' || payload.theme === 'light') document.documentElement.setAttribute('data-theme', payload.theme)
            else document.documentElement.removeAttribute('data-theme')
          }
        } catch (e) { console.warn('onUpdateData error', e) }
      })
    }

    // 作为兼容，如果主窗口使用 sendToFrontend({type:'theme-changed'})，主进程可能通过 'update-data' 分发
    if (window.electronAPI.onReloadLayoutFromPack) {
      window.electronAPI.onReloadLayoutFromPack(() => {
        const saved = localStorage.getItem('asg_theme')
        if (saved === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
        else document.documentElement.removeAttribute('data-theme')
      })
    }
  }

  addLog('后台已启动', 'info')
}

// 更新队伍名称
function updateTeamName(team, name) {
  if (team === 'teamA') {
    scoreData.teamAName = name || 'A队'
  } else {
    scoreData.teamBName = name || 'B队'
  }
  saveScore()
  addLog(`已更新${team === 'teamA' ? 'A' : 'B'}队名称: ${name}`, 'info')
}

// 初始化比分板
function initScoreBoard() {
  if (!roomData) return

  const boType = roomData.boType || 3

  // 尝试从 localStorage 加载当前房间的比分
  const savedScore = localStorage.getItem(`score_${roomData.roomId}`)
  if (savedScore) {
    scoreData = JSON.parse(savedScore)
    if (!scoreData.scoreboardDisplay || typeof scoreData.scoreboardDisplay !== 'object') {
      scoreData.scoreboardDisplay = { teamA: 'auto', teamB: 'auto' }
    }
    // 更新队伍名称输入框
    document.getElementById('teamAName').value = scoreData.teamAName || roomData.teamAName || 'A队'
    document.getElementById('teamBName').value = scoreData.teamBName || roomData.teamBName || 'B队'
  } else {
    // 初始化新比分（每个 BO 有上下半局）
    scoreData = {
      bos: [],
      teamAWins: 0,
      teamBWins: 0,
      teamADraws: 0,
      teamBDraws: 0,
      currentRound: 1,
      currentHalf: 1,
      scoreboardDisplay: { teamA: 'auto', teamB: 'auto' },
      teamAName: roomData.teamAName || 'A队',
      teamBName: roomData.teamBName || 'B队',
      teamALogo: roomData.teamALogo || '',
      teamBLogo: roomData.teamBLogo || ''
    }
    for (let i = 0; i < boType; i++) {
      scoreData.bos.push({
        upper: { teamA: 0, teamB: 0 },
        lower: { teamA: 0, teamB: 0 }
      })
    }
  }

  renderScoreBoard()
  updateScoreDisplay()

  // 同步下拉框显示
  const selA = document.getElementById('scoreboardDisplayTeamA')
  const selB = document.getElementById('scoreboardDisplayTeamB')
  if (selA) selA.value = scoreData.scoreboardDisplay?.teamA || 'auto'
  if (selB) selB.value = scoreData.scoreboardDisplay?.teamB || 'auto'
}

function updateScoreboardDisplay(team, mode) {
  if (!scoreData.scoreboardDisplay || typeof scoreData.scoreboardDisplay !== 'object') {
    scoreData.scoreboardDisplay = { teamA: 'auto', teamB: 'auto' }
  }
  if (team !== 'teamA' && team !== 'teamB') return
  if (mode !== 'auto' && mode !== 'upper' && mode !== 'lower') mode = 'auto'
  scoreData.scoreboardDisplay[team] = mode
  saveScore()
  addLog(`比分板显示已设置: ${team} -> ${mode}`, 'info')
}

// 渲染比分输入界面
function renderScoreBoard() {
  const container = document.getElementById('scoreManagement')
  container.innerHTML = ''

  scoreData.bos.forEach((bo, boIndex) => {
    const boDiv = document.createElement('div')
    boDiv.className = 'round-item'
    boDiv.style.marginBottom = '20px'

    const boResult = getBoResult(bo)
    const resultText = boResult === 'A' ? 'A队胜' : boResult === 'B' ? 'B队胜' : boResult === 'D' ? '平局' : '待定'
    const resultClass = boResult === 'A' ? 'win-a' : boResult === 'B' ? 'win-b' : boResult === 'D' ? 'draw' : 'pending'

    boDiv.innerHTML = `
          <div class="round-header">第${boIndex + 1}个BO <span class="round-result-badge ${resultClass}">${resultText}</span></div>
          <div class="round-input-row" style="margin-bottom: 8px;">
            <label style="color: #aaa; min-width: 60px;">上半局:</label>
            <label style="color: #64b5f6;">A队</label>
            <input type="number" class="score-input-small" min="0" value="${bo.upper.teamA}" 
                   onchange="updateBoScore(${boIndex}, 'upper', 'teamA', this.value)">
            <span style="color: #666;">:</span>
            <input type="number" class="score-input-small" min="0" value="${bo.upper.teamB}"
                   onchange="updateBoScore(${boIndex}, 'upper', 'teamB', this.value)">
            <label style="color: #ef5350;">B队</label>
          </div>
          <div class="round-input-row">
            <label style="color: #aaa; min-width: 60px;">下半局:</label>
            <label style="color: #64b5f6;">A队</label>
            <input type="number" class="score-input-small" min="0" value="${bo.lower.teamA}" 
                   onchange="updateBoScore(${boIndex}, 'lower', 'teamA', this.value)">
            <span style="color: #666;">:</span>
            <input type="number" class="score-input-small" min="0" value="${bo.lower.teamB}"
                   onchange="updateBoScore(${boIndex}, 'lower', 'teamB', this.value)">
            <label style="color: #ef5350;">B队</label>
          </div>
        `

    container.appendChild(boDiv)
  })
}

// 获取 BO 结果（上下半局总和）
function getBoResult(bo) {
  const teamATotal = bo.upper.teamA + bo.lower.teamA
  const teamBTotal = bo.upper.teamB + bo.lower.teamB

  // 只有上下半局都有数据才计算结果
  const hasUpperData = bo.upper.teamA > 0 || bo.upper.teamB > 0
  const hasLowerData = bo.lower.teamA > 0 || bo.lower.teamB > 0

  if (!hasUpperData || !hasLowerData) return 'P' // Pending - 未完成

  if (teamATotal > teamBTotal) return 'A'
  if (teamBTotal > teamATotal) return 'B'
  return 'D' // Draw
}

// 更新 BO 比分
function updateBoScore(boIndex, half, team, value) {
  scoreData.bos[boIndex][half][team] = parseInt(value) || 0
  calculateScore()
  renderScoreBoard()
  updateScoreDisplay()
  saveScore()
}

// 计算总比分
function calculateScore() {
  let teamAWins = 0, teamBWins = 0, teamADraws = 0, teamBDraws = 0

  scoreData.bos.forEach(bo => {
    const result = getBoResult(bo)
    if (result === 'A') teamAWins++
    else if (result === 'B') teamBWins++
    else if (result === 'D') {
      teamADraws++
      teamBDraws++
    }
  })

  scoreData.teamAWins = teamAWins
  scoreData.teamBWins = teamBWins
  scoreData.teamADraws = teamADraws
  scoreData.teamBDraws = teamBDraws
}

// 更新比分显示
function updateScoreDisplay() {
  document.getElementById('teamAScoreBig').textContent = scoreData.teamAWins
  document.getElementById('teamBScoreBig').textContent = scoreData.teamBWins

  const teamALosses = scoreData.bos.length - scoreData.teamAWins - scoreData.teamADraws
  const teamBLosses = scoreData.bos.length - scoreData.teamBWins - scoreData.teamBDraws

  document.getElementById('teamARecord').textContent = `${scoreData.teamAWins}胜 ${scoreData.teamADraws}平 ${teamALosses}负`
  document.getElementById('teamBRecord').textContent = `${scoreData.teamBWins}胜 ${scoreData.teamBDraws}平 ${teamBLosses}负`
}

// 保存比分到 localStorage
function saveScore() {
  if (roomData && roomData.roomId) {
    localStorage.setItem(`score_${roomData.roomId}`, JSON.stringify(scoreData))
    addLog('比分已保存', 'success')
  }
}

// ===== 赛后数据（postmatch_${roomId}） =====
function buildTeamMeta(team) {
  const wins = team === 'A' ? (scoreData.teamAWins || 0) : (scoreData.teamBWins || 0)
  const draws = team === 'A' ? (scoreData.teamADraws || 0) : (scoreData.teamBDraws || 0)
  return `W ${wins}  D ${draws}`
}

function getDefaultPostMatchData() {
  const roundNo = currentState?.currentRound || 1
  return {
    title: '赛后数据',
    subTitle: 'MATCH STATS',
    gameLabel: `GAME ${roundNo}`,
    mapName: currentState?.currentMap || '',
    teamA: {
      name: scoreData.teamAName || roomData?.teamAName || 'A队',
      meta: buildTeamMeta('A'),
      score: 0,
      logo: scoreData.teamALogo || roomData?.teamALogo || ''
    },
    teamB: {
      name: scoreData.teamBName || roomData?.teamBName || 'B队',
      meta: buildTeamMeta('B'),
      score: 0,
      logo: scoreData.teamBLogo || roomData?.teamBLogo || ''
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

function parseIntSafe(v) {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

function setValue(id, value) {
  const el = document.getElementById(id)
  if (el) el.value = value ?? ''
}

function getValue(id) {
  const el = document.getElementById(id)
  return el ? el.value : ''
}

function populatePostMatchForm(data) {
  const d = data || getDefaultPostMatchData()
  setValue('pmTitle', d.title || '')
  setValue('pmSubTitle', d.subTitle || '')
  setValue('pmGameLabel', d.gameLabel || '')
  setValue('pmMapName', d.mapName || '')

  setValue('pmTeamAName', d.teamA?.name || '')
  setValue('pmTeamAMeta', d.teamA?.meta || '')
  setValue('pmTeamAScore', parseIntSafe(d.teamA?.score))
  setValue('pmTeamBName', d.teamB?.name || '')
  setValue('pmTeamBMeta', d.teamB?.meta || '')
  setValue('pmTeamBScore', parseIntSafe(d.teamB?.score))

  const list = Array.isArray(d.survivors) ? d.survivors : []
  for (let i = 0; i < 4; i++) {
    const s = list[i] || {}
    setValue(`pmS${i + 1}Name`, s.name || '')
    setValue(`pmS${i + 1}Decode`, parseIntSafe(s.decodeProgress))
    setValue(`pmS${i + 1}Pallet`, parseIntSafe(s.palletHit))
    setValue(`pmS${i + 1}Rescue`, parseIntSafe(s.rescue))
    setValue(`pmS${i + 1}Heal`, parseIntSafe(s.heal))
    setValue(`pmS${i + 1}Chase`, parseIntSafe(s.chaseSeconds))
  }

  setValue('pmHunterName', d.hunter?.name || '')
  setValue('pmHunterRole', d.hunter?.roleName || '')
  setValue('pmHunterRemaining', parseIntSafe(d.hunter?.remainingCiphers))
  setValue('pmHunterPalletDestroy', parseIntSafe(d.hunter?.palletDestroy))
  setValue('pmHunterHit', parseIntSafe(d.hunter?.hit))
  setValue('pmHunterTerror', parseIntSafe(d.hunter?.terrorShock))
  setValue('pmHunterDown', parseIntSafe(d.hunter?.down))
}

function collectPostMatchFromForm() {
  const base = getDefaultPostMatchData()
  const survivors = []
  for (let i = 0; i < 4; i++) {
    survivors.push({
      name: getValue(`pmS${i + 1}Name`) || `选手${i + 1}`,
      decodeProgress: parseIntSafe(getValue(`pmS${i + 1}Decode`)),
      palletHit: parseIntSafe(getValue(`pmS${i + 1}Pallet`)),
      rescue: parseIntSafe(getValue(`pmS${i + 1}Rescue`)),
      heal: parseIntSafe(getValue(`pmS${i + 1}Heal`)),
      chaseSeconds: parseIntSafe(getValue(`pmS${i + 1}Chase`))
    })
  }

  return {
    title: getValue('pmTitle') || base.title,
    subTitle: getValue('pmSubTitle') || base.subTitle,
    gameLabel: getValue('pmGameLabel') || base.gameLabel,
    mapName: getValue('pmMapName') || base.mapName,
    teamA: {
      name: getValue('pmTeamAName') || base.teamA.name,
      meta: getValue('pmTeamAMeta') || base.teamA.meta,
      score: parseIntSafe(getValue('pmTeamAScore')),
      logo: base.teamA.logo
    },
    teamB: {
      name: getValue('pmTeamBName') || base.teamB.name,
      meta: getValue('pmTeamBMeta') || base.teamB.meta,
      score: parseIntSafe(getValue('pmTeamBScore')),
      logo: base.teamB.logo
    },
    survivors,
    hunter: {
      name: getValue('pmHunterName') || '监管者',
      roleName: getValue('pmHunterRole') || '',
      remainingCiphers: parseIntSafe(getValue('pmHunterRemaining')),
      palletDestroy: parseIntSafe(getValue('pmHunterPalletDestroy')),
      hit: parseIntSafe(getValue('pmHunterHit')),
      terrorShock: parseIntSafe(getValue('pmHunterTerror')),
      down: parseIntSafe(getValue('pmHunterDown'))
    }
  }
}

function loadPostMatch(forceLog = false) {
  if (!roomData || !roomData.roomId) return

  const key = `postmatch_${roomData.roomId}`
  const raw = localStorage.getItem(key)
  let data = null
  try {
    data = raw ? JSON.parse(raw) : null
  } catch {
    data = null
  }

  if (!data) {
    data = getDefaultPostMatchData()
    if (forceLog) addLog('未找到已保存的赛后数据，已加载默认值', 'info')
  } else {
    if (forceLog) addLog('已从本地加载赛后数据', 'success')
  }

  populatePostMatchForm(data)
}

function savePostMatch() {
  if (!roomData || !roomData.roomId) {
    addLog('房间ID未找到，无法保存赛后数据', 'error')
    return
  }
  const data = collectPostMatchFromForm()
  localStorage.setItem(`postmatch_${roomData.roomId}`, JSON.stringify(data))
  addLog('赛后数据已保存（前台将自动刷新）', 'success')
}

function openPostMatchWindow() {
  if (roomData && roomData.roomId) {
    window.electronAPI.openPostMatch(roomData.roomId)
    addLog('已打开赛后数据展示窗口', 'success')
  } else {
    addLog('房间ID未找到', 'error')
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

async function ocrFillPostMatch() {
  try {
    const input = document.getElementById('pmOcrFile')
    const file = input?.files?.[0]
    if (!file) {
      addLog('请先选择一张对局截图', 'warning')
      return
    }
    if (!window.electronAPI?.parseGameRecordImage) {
      addLog('当前版本不支持 OCR 调用', 'error')
      return
    }

    addLog('正在识别图片（OCR）...', 'info')
    const dataUrl = await readFileAsDataUrl(file)
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl

    const result = await window.electronAPI.parseGameRecordImage(base64)
    if (!result?.success) {
      addLog('识别失败: ' + (result?.error || '未知错误'), 'error')
      return
    }

    const dto = result.data
    const ok = dto?.success ?? dto?.Success
    if (ok === false) {
      addLog('识别失败: ' + (dto?.message ?? dto?.Message ?? '未知错误'), 'error')
      return
    }

    const normalized = normalizeOcrResponse(dto)
    if (normalized.mapName) setValue('pmMapName', normalized.mapName)

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

    addLog('识别完成：已回填到表单（请确认后保存）', 'success')
  } catch (e) {
    console.error('OCR 回填失败:', e)
    addLog('OCR 回填失败: ' + e.message, 'error')
  }
}

// 更新房间信息
function updateRoomInfo() {
  if (!roomData) return

  document.getElementById('roomIdDisplay').textContent = roomData.roomId || '-'
  document.getElementById('eventIdDisplay').textContent = roomData.eventId || '-'
  document.getElementById('boTypeDisplay').textContent = `BO${roomData.boType || 3}`
}

// 连接服务器
async function connectToServer() {
  if (roomData && roomData.localMode) return
  if (!roomData || !roomData.serverUrl) return

  const statusDot = document.getElementById('statusDot')
  const statusText = document.getElementById('statusText')

  try {
    // 如果已有连接，先断开
    if (connection) {
      try {
        await connection.stop()
        addLog('已断开旧连接', 'info')
      } catch (e) {
        console.log('断开旧连接失败:', e)
      }
    }

    connection = new signalR.HubConnectionBuilder()
      .withUrl(`${roomData.serverUrl}/hubs/bp`)
      .withAutomaticReconnect()
      .build()

    connection.onreconnecting(() => {
      statusDot.classList.add('disconnected')
      statusText.textContent = '重连中...'
      addLog('连接断开，正在重连...', 'warning')
    })

    connection.onreconnected(() => {
      statusDot.classList.remove('disconnected')
      statusText.textContent = '已连接'
      addLog('重连成功', 'success')
    })

    connection.onclose(() => {
      statusDot.classList.add('disconnected')
      statusText.textContent = '已断开'
      addLog('连接已断开', 'error')
    })

    // 注册事件
    connection.on('RoomStateUpdated', (state) => {
      currentState = state
      updateStateDisplay()
      addLog(`状态更新: ${state.phaseName || state.status}`, 'info')
    })

    connection.on('CharacterPicked', (data) => {
      addLog(`角色选择: ${data.characterId}`, 'success')
      // RoomStateUpdated 事件会自动更新UI
    })

    connection.on('CharacterBanned', (data) => {
      addLog(`角色禁用: ${data.characterId}`, 'warning')
      // RoomStateUpdated 事件会自动更新UI
    })

    connection.on('PhaseChanged', (state) => {
      currentState = state
      updateStateDisplay()
      addLog(`阶段变更: ${state.phaseName}`, 'info')
    })

    connection.on('MapBanned', (data) => {
      addLog(`地图禁用: ${data.mapId}`, 'warning')
      // 显示地图展示窗口
      window.electronAPI.showMapDisplay('ban', data.mapId, data.team || '未知')
    })

    connection.on('MapPicked', (data) => {
      addLog(`地图选择: ${data.mapId}`, 'success')
      // 显示地图展示窗口
      window.electronAPI.showMapDisplay('pick', data.mapId, data.team || '未知')
    })

    connection.on('SidePicked', (data) => {
      addLog(`阵营选择: ${data.sideChoice}`, 'success')
    })

    await connection.start()
    statusDot.classList.remove('disconnected')
    statusText.textContent = '已连接'
    addLog('已连接到服务器', 'success')

    // 以管理员身份加入房间（使用 "admin" 身份，无需token，可接收所有实时消息）
    const state = await connection.invoke('JoinRoom', roomData.roomId, '', 'admin')
    if (state) {
      currentState = state
      updateStateDisplay()
      addLog('已以管理员身份加入房间', 'success')
    }

  } catch (error) {
    statusDot.classList.add('disconnected')
    statusText.textContent = '连接失败'
    addLog(`连接失败: ${error.message}`, 'error')
  }
}

// 更新状态显示
function updateStateDisplay() {
  if (!currentState) return

  // 同步当前局数和半场到比分数据
  if (currentState.currentRound && currentState.currentHalf) {
    scoreData.currentRound = currentState.currentRound
    scoreData.currentHalf = currentState.currentHalf
    saveScore() // 保存到 localStorage
  }

  // 侧边栏信息
  document.getElementById('roundDisplay').textContent = `第${currentState.currentRound}局 第${currentState.currentHalf}半局`
  document.getElementById('statusDisplay').textContent = currentState.status || '-'
  document.getElementById('mapDisplay').textContent = currentState.currentMap || '-'
  document.getElementById('homeTeamDisplay').textContent = currentState.homeTeam || '-'
  document.getElementById('awayTeamDisplay').textContent = currentState.awayTeam || '-'

  // 更新阶段高亮
  document.querySelectorAll('.phase-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.phase) === currentState.currentPhase)
  })

  // 更新BP状态卡片
  const roundData = currentState.currentRoundData
  if (roundData) {
    // 已选求生者
    const selectedSurvivors = document.getElementById('selectedSurvivors')
    selectedSurvivors.innerHTML = ''
    if (roundData.selectedSurvivors && roundData.selectedSurvivors.length > 0) {
      roundData.selectedSurvivors.forEach(name => {
        const item = document.createElement('span')
        item.className = 'item picked'
        item.textContent = name
        selectedSurvivors.appendChild(item)
      })
    } else {
      selectedSurvivors.innerHTML = '<span class="item">暂无</span>'
    }

    // 已选监管者
    const selectedHunter = document.getElementById('selectedHunter')
    selectedHunter.innerHTML = ''
    if (roundData.selectedHunter) {
      const item = document.createElement('span')
      item.className = 'item picked'
      item.textContent = roundData.selectedHunter
      selectedHunter.appendChild(item)
    } else {
      selectedHunter.innerHTML = '<span class="item">暂无</span>'
    }

    // 被禁求生者
    const bannedSurvivors = document.getElementById('bannedSurvivors')
    bannedSurvivors.innerHTML = ''
    if (roundData.hunterBannedSurvivors && roundData.hunterBannedSurvivors.length > 0) {
      roundData.hunterBannedSurvivors.forEach(name => {
        const item = document.createElement('span')
        item.className = 'item banned'
        item.textContent = name
        bannedSurvivors.appendChild(item)
      })
    } else {
      bannedSurvivors.innerHTML = '<span class="item">暂无</span>'
    }

    // 被禁监管者
    const bannedHunters = document.getElementById('bannedHunters')
    bannedHunters.innerHTML = ''
    if (roundData.survivorBannedHunters && roundData.survivorBannedHunters.length > 0) {
      roundData.survivorBannedHunters.forEach(name => {
        const item = document.createElement('span')
        item.className = 'item banned'
        item.textContent = name
        bannedHunters.appendChild(item)
      })
    } else {
      bannedHunters.innerHTML = '<span class="item">暂无</span>'
    }
  }

  // 更新全局禁选状态
  const globalBannedSurvivors = document.getElementById('globalBannedSurvivors')
  if (globalBannedSurvivors) {
    globalBannedSurvivors.innerHTML = ''
    if (currentState.globalBannedSurvivors && currentState.globalBannedSurvivors.length > 0) {
      currentState.globalBannedSurvivors.forEach(name => {
        const item = document.createElement('span')
        item.className = 'item banned'
        item.style.background = 'rgba(156, 39, 176, 0.3)'
        item.textContent = name
        globalBannedSurvivors.appendChild(item)
      })
    } else {
      globalBannedSurvivors.innerHTML = '<span class="item">暂无</span>'
    }
  }

  const globalBannedHunters = document.getElementById('globalBannedHunters')
  if (globalBannedHunters) {
    globalBannedHunters.innerHTML = ''
    if (currentState.globalBannedHunters && currentState.globalBannedHunters.length > 0) {
      currentState.globalBannedHunters.forEach(name => {
        const item = document.createElement('span')
        item.className = 'item banned'
        item.style.background = 'rgba(156, 39, 176, 0.3)'
        item.textContent = name
        globalBannedHunters.appendChild(item)
      })
    } else {
      globalBannedHunters.innerHTML = '<span class="item">暂无</span>'
    }
  }

  // 同步状态到前台窗口
  if (window.electronAPI && window.electronAPI.sendToFrontend) {
    window.electronAPI.sendToFrontend({
      type: 'state',
      state: currentState
    })
  }
}

// 添加日志
function addLog(message, type = 'info') {
  const container = document.getElementById('logContainer')
  const item = document.createElement('div')
  item.className = `log-item ${type}`

  const time = new Date().toLocaleTimeString()
  item.innerHTML = `<span class="time">[${time}]</span>${message}`

  container.appendChild(item)
  container.scrollTop = container.scrollHeight
}

// 流程控制
async function startBp() {
  if (!connection) return
  try {
    await connection.invoke('AdminForceStartBp', roomData.roomId)
    addLog('强制开始BP', 'success')
  } catch (error) {
    addLog(`操作失败: ${error.message}`, 'error')
  }
}

async function nextPhase() {
  if (!connection) return
  try {
    await connection.invoke('AdminNextPhase', roomData.roomId)
    addLog('跳转下一阶段', 'success')
  } catch (error) {
    addLog(`操作失败: ${error.message}`, 'error')
  }
}

async function pauseBp() {
  if (!connection) return
  try {
    await connection.invoke('AdminPauseBp', roomData.roomId)
    addLog('暂停BP', 'warning')
  } catch (error) {
    addLog(`操作失败: ${error.message}`, 'error')
  }
}

async function resetRound() {
  if (!confirm('确定要重置本局吗？')) return
  if (!connection) return
  try {
    await connection.invoke('AdminResetRound', roomData.roomId)
    addLog('重置本局', 'warning')
  } catch (error) {
    addLog(`操作失败: ${error.message}`, 'error')
  }
}

async function jumpToPhase(phase) {
  if (!connection) return
  try {
    await connection.invoke('AdminJumpToPhase', roomData.roomId, phase)
    addLog(`跳转到阶段: ${phases.find(p => p.id === phase)?.name}`, 'success')
  } catch (error) {
    addLog(`操作失败: ${error.message}`, 'error')
  }
}

// 前台控制
async function toggleAlwaysOnTop() {
  const checked = document.getElementById('alwaysOnTop').checked
  await window.electronAPI.setFrontendAlwaysOnTop(checked)
  addLog(`窗口置顶: ${checked ? '开启' : '关闭'}`, 'info')
}

// 全屏模式功能已移除

async function openEditMode() {
  // 向前台窗口发送切换编辑模式请求
  await window.electronAPI.toggleFrontendEditMode()
  addLog('已向前台发送编辑模式切换请求', 'info')
}

// 计时器控制
function startTimer() {
  const duration = parseInt(document.getElementById('timerDuration').value) || 60
  timerRemaining = duration

  if (timerInterval) clearInterval(timerInterval)

  updateTimerDisplay()
  timerInterval = setInterval(() => {
    timerRemaining--
    updateTimerDisplay()

    if (timerRemaining <= 0) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }, 1000)

  addLog(`计时器开始: ${duration}秒`, 'info')
}

function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
    addLog('计时器暂停', 'warning')
  }
}

function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  timerRemaining = parseInt(document.getElementById('timerDuration').value) || 60
  updateTimerDisplay()
  addLog('计时器重置', 'info')
}

function updateTimerDisplay() {
  const display = document.getElementById('timerDisplay')
  const minutes = Math.floor(timerRemaining / 60)
  const seconds = timerRemaining % 60
  display.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
  display.classList.toggle('warning', timerRemaining <= 10)

  // 同步到前台
  if (window.electronAPI && window.electronAPI.sendToFrontend) {
    window.electronAPI.sendToFrontend({
      type: 'timer',
      remaining: timerRemaining
    })
  }
}

// 编辑展示内容
let currentEditType = null
let selectedCharacters = []
let availableCharacters = []

// 所有角色列表
const ALL_SURVIVORS = [
  "医生", "律师", "慈善家", "园丁", "魔术师", "冒险家", "佣兵", "空军",
  "祭司", "机械师", "前锋", "盲女", "调香师", "牛仔", "舞女", "先知",
  "入殓师", "勘探员", "咒术师", "野人", "杂技演员", "大副", "调酒师",
  "邮差", "守墓人", "囚徒", "昆虫学者", "画家", "击球手", "玩具商",
  "病患", "心理学家", "小说家", "小女孩", "哭泣小丑", "教授", "古董商",
  "拉拉队员", "记者", "飞行家", "作曲家", "弓箭手", "骑士", "木偶师",
  "幸运儿", "火灾调查员", "逃脱大师", "气象学家", "法罗女士"
]

const ALL_HUNTERS = [
  "厂长", "小丑", "鹿头", "杰克", "蜘蛛", "红蝶", "黄衣之主",
  "摄影师", "疯眼", "宿伞之魂", "梦之女巫", "破轮", "红夫人", "26号守卫",
  "使徒", "小提琴家", "雕刻家", "守夜人", "记录员", "噩梦", "渔女", "蜡像师",
  "喧嚣", "杂货商", "隐士", "愚人金", "时空之影", "歌剧演员", "爱哭鬼", "孽蜥", "跛脚羊",
  "台球手", "博士"
]

function showCharacterModal(title, characters, currentSelection, isMultiple = true) {
  currentEditType = { title, isMultiple }
  availableCharacters = characters
  selectedCharacters = Array.isArray(currentSelection) ? [...currentSelection] : (currentSelection ? [currentSelection] : [])

  document.getElementById('modalTitle').textContent = title
  const grid = document.getElementById('characterGrid')
  grid.innerHTML = ''

  characters.forEach(char => {
    const item = document.createElement('div')
    item.className = 'character-item' + (selectedCharacters.includes(char) ? ' selected' : '')
    item.textContent = char
    item.onclick = () => toggleCharacterSelection(char, isMultiple)
    grid.appendChild(item)
  })

  document.getElementById('characterModal').classList.add('show')
}

function toggleCharacterSelection(char, isMultiple) {
  if (isMultiple) {
    const index = selectedCharacters.indexOf(char)
    if (index > -1) {
      selectedCharacters.splice(index, 1)
    } else {
      selectedCharacters.push(char)
    }
  } else {
    selectedCharacters = [char]
  }

  // 更新UI
  document.querySelectorAll('.character-item').forEach(item => {
    item.classList.toggle('selected', selectedCharacters.includes(item.textContent))
  })
}

function closeCharacterModal() {
  document.getElementById('characterModal').classList.remove('show')
  currentEditType = null
  selectedCharacters = []
}

function confirmCharacterSelection() {
  if (!currentEditType) return

  const { title, isMultiple } = currentEditType
  const value = isMultiple ? selectedCharacters : (selectedCharacters[0] || '')

  // 根据标题判断是哪种类型的编辑
  if (title.includes('已选求生者')) {
    updateDisplayContent('selectedSurvivors', value)
    addLog(`已更新求生者: ${Array.isArray(value) ? value.join(', ') : value}`, 'success')
  } else if (title.includes('已选监管者')) {
    updateDisplayContent('selectedHunter', value)
    addLog(`已更新监管者: ${value}`, 'success')
  } else if (title.includes('被禁求生者')) {
    updateDisplayContent('bannedSurvivors', value)
    addLog(`已更新被禁求生者: ${Array.isArray(value) ? value.join(', ') : value}`, 'success')
  } else if (title.includes('被禁监管者')) {
    updateDisplayContent('bannedHunters', value)
    addLog(`已更新被禁监管者: ${Array.isArray(value) ? value.join(', ') : value}`, 'success')
  }

  closeCharacterModal()
}

function editSurvivors() {
  const current = currentState?.currentRoundData?.selectedSurvivors || []
  showCharacterModal('编辑已选求生者', ALL_SURVIVORS, current, true)
}

function editHunter() {
  const current = currentState?.currentRoundData?.selectedHunter || ''
  showCharacterModal('编辑已选监管者', ALL_HUNTERS, current, false)
}

function editBannedSurvivors() {
  const current = currentState?.currentRoundData?.hunterBannedSurvivors || []
  showCharacterModal('编辑被禁求生者', ALL_SURVIVORS, current, true)
}

function editBannedHunters() {
  const current = currentState?.currentRoundData?.survivorBannedHunters || []
  showCharacterModal('编辑被禁监管者', ALL_HUNTERS, current, true)
}

function updateDisplayContent(type, value) {
  // 更新本地状态
  if (!currentState) currentState = { currentRoundData: {} }
  if (!currentState.currentRoundData) currentState.currentRoundData = {}

  switch (type) {
    case 'selectedSurvivors':
      currentState.currentRoundData.selectedSurvivors = value
      break
    case 'selectedHunter':
      currentState.currentRoundData.selectedHunter = value
      break
    case 'bannedSurvivors':
      currentState.currentRoundData.hunterBannedSurvivors = value
      break
    case 'bannedHunters':
      currentState.currentRoundData.survivorBannedHunters = value
      break
  }

  // 刷新显示
  updateStateDisplay()

  // 同步到前台
  window.electronAPI.sendToFrontend({
    type: 'state',
    state: currentState
  })
}

// 打开比分展示窗口
function openScoreboardWindow() {
  if (roomData && roomData.roomId) {
    window.electronAPI.openScoreboard(roomData.roomId, 'teamA')
    window.electronAPI.openScoreboard(roomData.roomId, 'teamB')
    addLog('已打开比分展示窗口（A队和B队）', 'success')
  } else {
    addLog('房间ID未找到', 'error')
  }
}

// 打开总览比分板窗口
function openScoreboardOverviewWindow() {
  if (roomData && roomData.roomId) {
    const boCount = roomData.boType || 5
    window.electronAPI.openScoreboardOverview(roomData.roomId, boCount)
    addLog(`已打开总览比分板窗口 (BO${boCount})`, 'success')
  } else {
    addLog('房间ID未找到', 'error')
  }
}

// 打开组件编辑器v2
async function openComponentEditor() {
  try {
    const result = await window.electronAPI.openComponentEditor()
    if (result && result.success) {
      addLog('组件编辑器已打开', 'success')
    }
  } catch (e) {
    console.error('打开组件编辑器失败:', e)
    addLog('打开组件编辑器失败: ' + e.message, 'error')
  }
}

// 导出BP布局包
async function exportBpPack() {
  try {
    addLog('正在导出BP布局包...', 'info')
    const result = await window.electronAPI.exportBpPack()
    if (result.success) {
      addLog('BP布局包导出成功！', 'success')
    } else if (!result.canceled) {
      addLog('导出失败: ' + (result.error || '未知错误'), 'error')
    }
  } catch (error) {
    addLog('导出失败: ' + error.message, 'error')
  }
}

// 导入BP布局包
async function importBpPack() {
  try {
    addLog('正在导入BP布局包...', 'info')
    const result = await window.electronAPI.importBpPack()
    if (result.success) {
      const details = []
      if (result.packData?.frontendBounds) details.push('前台窗口大小')
      if (result.packData?.scoreboardLayoutA) details.push('A队比分板布局')
      if (result.packData?.scoreboardLayoutB) details.push('B队比分板布局')
      const detailStr = details.length > 0 ? `（已应用：${details.join('、')}）` : ''
      addLog(`BP布局包导入成功！前台页面已自动刷新。${detailStr}`, 'success')
      // 发送更新通知给前台
      window.electronAPI.sendToFrontend({ type: 'layout-updated', layout: result.layout })
    } else if (!result.canceled) {
      addLog('导入失败: ' + (result.error || '未知错误'), 'error')
    }
  } catch (error) {
    addLog('导入失败: ' + error.message, 'error')
  }
}

// 恢复默认布局
async function resetLayout() {
  if (!confirm('确定要恢复默认布局吗？这将清除所有自定义布局、背景图片、窗口大小和比分板布局！')) {
    return
  }

  try {
    addLog('正在恢复默认布局...', 'info')
    const result = await window.electronAPI.resetLayout()
    if (result.success) {
      addLog('已恢复默认布局！（前台窗口大小、比分板布局已重置，前台页面已自动刷新）', 'success')
      // 发送更新通知给前台
      window.electronAPI.sendToFrontend({ type: 'layout-reset' })
    } else {
      addLog('恢复失败: ' + (result.error || '未知错误'), 'error')
    }
  } catch (error) {
    addLog('恢复失败: ' + error.message, 'error')
  }
}

// 打开布局包商店
async function openLayoutStore() {
  try {
    addLog('正在打开布局包商店...', 'info')
    await window.electronAPI.openStore()
    addLog('布局包商店已打开', 'success')
  } catch (error) {
    addLog('打开商店失败: ' + error.message, 'error')
  }
}

// ========= 字体设置功能 =========
let installedFonts = []

// 打开字体设置面板
async function openFontSettings() {
  const panel = document.getElementById('fontSettingsPanel')
  panel.style.display = 'flex'
  await loadFontList()
  await loadFontConfig()
}

// 关闭字体设置面板
function closeFontSettings() {
  document.getElementById('fontSettingsPanel').style.display = 'none'
}

// 加载字体列表
async function loadFontList() {
  try {
    const result = await window.electronAPI.getCustomFonts()
    const fontListEl = document.getElementById('fontList')

    if (!result.success || !result.fonts.length) {
      fontListEl.innerHTML = '<div style="color: #888; text-align: center; padding: 10px;">暂无自定义字体，点击下方按钮添加</div>'
      installedFonts = []
      updateFontSelects([])
      return
    }

    installedFonts = result.fonts

    fontListEl.innerHTML = result.fonts.map(font => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 5px; background: rgba(255,255,255,0.05); border-radius: 4px;">
            <div>
              <span style="color: #ffd700; font-weight: bold;">${font.fontFamily}</span>
              <span style="color: #888; font-size: 12px; margin-left: 10px;">${font.fileName}</span>
            </div>
            <button onclick="deleteFont('${font.fileName}')" style="background: rgba(244,67,54,0.2); border: 1px solid #f44336; color: #f44336; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 12px;">删除</button>
          </div>
        `).join('')

    // 更新下拉框选项
    updateFontSelects(result.fonts)

  } catch (error) {
    console.error('加载字体列表失败:', error)
    addLog('加载字体列表失败: ' + error.message, 'error')
  }
}

// 更新字体选择下拉框
function updateFontSelects(fonts) {
  const selects = [
    'fontConfigTitle',
    'fontConfigNumber',
    'fontConfigLabel',
    'fontConfigDefault',
    'fontConfigTimer',
    'fontConfigTeamName',
    'fontConfigCharacterName',
    'fontConfigPhase',
    'fontConfigMap',
    'fontConfigGlobalBanLabel',
    'fontConfigControlLabel',
    'fontConfigPluginWidget'
  ]

  selects.forEach(selectId => {
    const select = document.getElementById(selectId)
    const currentValue = select.value

    // 保留第一个"系统默认"选项
    select.innerHTML = '<option value="">系统默认</option>'

    // 添加字体选项
    fonts.forEach(font => {
      const option = document.createElement('option')
      option.value = font.fontFamily
      option.textContent = font.fontFamily
      select.appendChild(option)
    })

    // 恢复之前的选择
    if (currentValue) {
      select.value = currentValue
    }
  })

  // 覆盖规则里的下拉框也需要更新
  updateFontOverrideSelectOptions()
}

function buildFontOptionsHtml() {
  let html = '<option value="">系统默认</option>'
  installedFonts.forEach(font => {
    html += `<option value="${font.fontFamily}">${font.fontFamily}</option>`
  })
  return html
}

function updateFontOverrideSelectOptions() {
  const listEl = document.getElementById('fontOverridesList')
  if (!listEl) return
  const selects = listEl.querySelectorAll('select[data-role="font-override-select"]')
  const optionsHtml = buildFontOptionsHtml()
  selects.forEach(sel => {
    const v = sel.value
    sel.innerHTML = optionsHtml
    if (v) sel.value = v
  })
}

function addFontOverrideRow(selector = '', fontFamily = '') {
  const listEl = document.getElementById('fontOverridesList')
  if (!listEl) return

  const row = document.createElement('div')
  row.style.display = 'grid'
  row.style.gridTemplateColumns = '1.2fr 1fr auto'
  row.style.gap = '8px'
  row.style.alignItems = 'center'
  row.style.padding = '8px'
  row.style.border = '1px solid rgba(255,255,255,0.12)'
  row.style.borderRadius = '8px'
  row.style.background = 'rgba(0,0,0,0.18)'

  const input = document.createElement('input')
  input.type = 'text'
  input.placeholder = 'CSS选择器，例如 .team-name 或 #bigScore'
  input.value = selector || ''
  input.style.width = '100%'
  input.style.padding = '8px'
  input.style.borderRadius = '6px'
  input.style.border = '1px solid rgba(255,255,255,0.2)'
  input.style.background = 'rgba(0,0,0,0.3)'
  input.style.color = '#fff'

  const select = document.createElement('select')
  select.setAttribute('data-role', 'font-override-select')
  select.style.width = '100%'
  select.style.padding = '8px'
  select.style.borderRadius = '6px'
  select.style.border = '1px solid rgba(255,255,255,0.2)'
  select.style.background = 'rgba(0,0,0,0.3)'
  select.style.color = '#fff'
  select.innerHTML = buildFontOptionsHtml()
  if (fontFamily) select.value = fontFamily

  const delBtn = document.createElement('button')
  delBtn.textContent = '删除'
  delBtn.style.padding = '8px 10px'
  delBtn.style.borderRadius = '6px'
  delBtn.style.cursor = 'pointer'
  delBtn.style.border = '1px solid rgba(244,67,54,0.5)'
  delBtn.style.background = 'rgba(244,67,54,0.15)'
  delBtn.style.color = '#ff8a80'
  delBtn.onclick = () => row.remove()

  row.appendChild(input)
  row.appendChild(select)
  row.appendChild(delBtn)
  listEl.appendChild(row)
}

function renderFontOverrides(elements) {
  const listEl = document.getElementById('fontOverridesList')
  if (!listEl) return
  listEl.innerHTML = ''

  if (!elements || typeof elements !== 'object') return
  for (const [selector, fontFamily] of Object.entries(elements)) {
    addFontOverrideRow(selector, fontFamily)
  }
}

function readFontOverrides() {
  const listEl = document.getElementById('fontOverridesList')
  const elements = {}
  const invalidSelectors = []
  if (!listEl) return { elements, invalidSelectors }

  const rows = Array.from(listEl.children)
  rows.forEach(row => {
    const input = row.querySelector('input')
    const select = row.querySelector('select[data-role="font-override-select"]')
    const selector = (input?.value || '').trim()
    const fontFamily = (select?.value || '').trim()
    if (!selector) return
    try {
      // 仅做语法校验；不会保证在前台页面存在
      document.querySelector(selector)
    } catch {
      invalidSelectors.push(selector)
      return
    }
    if (!fontFamily) return
    elements[selector] = fontFamily
  })

  return { elements, invalidSelectors }
}

// 加载字体配置
async function loadFontConfig() {
  try {
    const result = await window.electronAPI.getFontConfig()
    if (!result.success || !result.config) return

    const config = result.config

    // 新增：通用文本类别
    if (config.titleFont) {
      document.getElementById('fontConfigTitle').value = config.titleFont
    }
    if (config.numberFont) {
      document.getElementById('fontConfigNumber').value = config.numberFont
    }
    if (config.labelFont) {
      document.getElementById('fontConfigLabel').value = config.labelFont
    }

    if (config.defaultFont) {
      document.getElementById('fontConfigDefault').value = config.defaultFont
    }
    if (config.timerFont) {
      document.getElementById('fontConfigTimer').value = config.timerFont
    }
    if (config.teamNameFont) {
      document.getElementById('fontConfigTeamName').value = config.teamNameFont
    }
    if (config.characterNameFont) {
      document.getElementById('fontConfigCharacterName').value = config.characterNameFont
    }
    if (config.phaseFont) {
      document.getElementById('fontConfigPhase').value = config.phaseFont
    }

    if (config.mapFont) {
      document.getElementById('fontConfigMap').value = config.mapFont
    }

    if (config.globalBanLabelFont) {
      document.getElementById('fontConfigGlobalBanLabel').value = config.globalBanLabelFont
    }

    if (config.controlLabelFont) {
      document.getElementById('fontConfigControlLabel').value = config.controlLabelFont
    }

    if (config.pluginWidgetFont) {
      document.getElementById('fontConfigPluginWidget').value = config.pluginWidgetFont
    }

    // 高级覆盖：选择器 → 字体
    renderFontOverrides(config.elements || {})

  } catch (error) {
    console.error('加载字体配置失败:', error)
  }
}

// 选择并导入字体
async function selectCustomFont() {
  try {
    addLog('正在选择字体文件...', 'info')
    const result = await window.electronAPI.selectCustomFont()

    if (result.success) {
      addLog(`成功导入 ${result.fonts.length} 个字体文件`, 'success')
      await loadFontList()
    } else if (!result.canceled) {
      addLog('导入字体失败: ' + (result.error || '未知错误'), 'error')
    }
  } catch (error) {
    addLog('导入字体失败: ' + error.message, 'error')
  }
}

// 删除字体
async function deleteFont(fileName) {
  if (!confirm(`确定要删除字体 "${fileName}" 吗？`)) return

  try {
    const result = await window.electronAPI.deleteCustomFont(fileName)
    if (result.success) {
      addLog(`字体 "${fileName}" 已删除`, 'success')
      await loadFontList()
    } else {
      addLog('删除字体失败: ' + (result.error || '未知错误'), 'error')
    }
  } catch (error) {
    addLog('删除字体失败: ' + error.message, 'error')
  }
}

// 保存字体配置
async function saveFontConfig() {
  try {
    const overrides = readFontOverrides()
    if (overrides.invalidSelectors.length) {
      addLog('存在无效CSS选择器，无法保存：' + overrides.invalidSelectors.join('；'), 'error')
      return
    }

    const config = {
      // 新增：通用文本类别（优先级更高）
      titleFont: document.getElementById('fontConfigTitle').value || null,
      numberFont: document.getElementById('fontConfigNumber').value || null,
      labelFont: document.getElementById('fontConfigLabel').value || null,

      defaultFont: document.getElementById('fontConfigDefault').value || null,
      timerFont: document.getElementById('fontConfigTimer').value || null,
      teamNameFont: document.getElementById('fontConfigTeamName').value || null,
      characterNameFont: document.getElementById('fontConfigCharacterName').value || null,
      phaseFont: document.getElementById('fontConfigPhase').value || null,
      mapFont: document.getElementById('fontConfigMap').value || null,
      globalBanLabelFont: document.getElementById('fontConfigGlobalBanLabel').value || null,
      controlLabelFont: document.getElementById('fontConfigControlLabel').value || null,
      pluginWidgetFont: document.getElementById('fontConfigPluginWidget').value || null
    }

    if (Object.keys(overrides.elements).length) {
      config.elements = overrides.elements
    }

    addLog('正在保存字体配置...', 'info')
    const result = await window.electronAPI.saveFontConfig(config)

    if (result.success) {
      addLog('字体配置已保存，前台窗口将自动应用新字体', 'success')
      closeFontSettings()
    } else {
      addLog('保存字体配置失败: ' + (result.error || '未知错误'), 'error')
    }
  } catch (error) {
    addLog('保存字体配置失败: ' + error.message, 'error')
  }
}

// 启动
init()