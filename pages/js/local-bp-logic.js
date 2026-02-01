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

let pickType = null
let pickIndex = null
let pickAction = null
let currentSurvivorIndex = 0 // 当前选中的求生者索引（用于天赋选择）

// ========== 对局基础信息（matchBase）统一源 ==========
const LOCAL_ROOM_ID = 'local-bp'
const MATCH_BASE_KEY = 'localBp_matchBase'
const SCORE_STORAGE_KEY = `score_${LOCAL_ROOM_ID}`
const POSTMATCH_STORAGE_KEY = `postmatch_${LOCAL_ROOM_ID}`
const TEAM_MANAGER_KEY = 'asg_team_manager_teams'
const TEAM_MANAGER_SELECTION_KEY = 'asg_team_manager_selection'

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

function findTeamFromManager(teams, val) {
  if (!val) return null
  return teams.find(t => (t.id || t.name) === val) || null
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
    if (rosterA.length) matchBase.teamA.members = ensureMembers5(rosterA)
  }
  if (teamB) {
    matchBase.teamB.name = teamB.name || matchBase.teamB.name
    const rosterB = (teamB.players || []).map(p => p.name || p.gameId).filter(Boolean)
    if (rosterB.length) matchBase.teamB.members = ensureMembers5(rosterB)
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

function getDefaultMatchBase() {
  return {
    mapName: '',
    teamA: {
      name: 'A队',
      logo: '',
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
      members: ensureMembers5(r.teamA?.members),
      memberRoles: ensureMemberRoles5(r.teamA?.memberRoles)
    },
    teamB: {
      name: typeof r.teamB?.name === 'string' ? r.teamB.name : d.teamB.name,
      logo: typeof r.teamB?.logo === 'string' ? r.teamB.logo : d.teamB.logo,
      members: ensureMembers5(r.teamB?.members),
      memberRoles: ensureMemberRoles5(r.teamB?.memberRoles)
    },
    lineup: {
      team: (r.lineup?.team === 'A' || r.lineup?.team === 'B') ? r.lineup.team : d.lineup.team,
      survivors: Array.isArray(r.lineup?.survivors) ? r.lineup.survivors.filter(i => Number.isInteger(i) && i >= 0 && i <= 4) : d.lineup.survivors,
      hunter: (Number.isInteger(r.lineup?.hunter) && r.lineup.hunter >= 0 && r.lineup.hunter <= 4) ? r.lineup.hunter : d.lineup.hunter
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
  ensureSelectHasValue('pmMapName', matchBase.mapName || '')
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
  const selects = ['baseMapName', 'pmMapName']
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
  const pmMap = document.getElementById('pmMapName')
  if (pmMap) pmMap.value = matchBase.mapName || ''
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
          playerNames[i] = team.members[memberIdx] || ''
        }
      }
      // 监管者
      if (typeof currentMatchBase.lineup.hunter === 'number' && currentMatchBase.lineup.hunter >= 0) {
        playerNames[4] = team.members[currentMatchBase.lineup.hunter] || ''
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
  if (team === 'A') matchBase.teamA.members[index] = value || ''
  if (team === 'B') matchBase.teamB.members[index] = value || ''
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
    memberRoles: matchBase.teamA.memberRoles.map(r => ({ ...r }))
  }

  matchBase.teamA.name = matchBase.teamB.name
  matchBase.teamA.logo = matchBase.teamB.logo
  matchBase.teamA.members = [...matchBase.teamB.members]
  matchBase.teamA.memberRoles = matchBase.teamB.memberRoles.map(r => ({ ...r }))

  matchBase.teamB.name = tempTeam.name
  matchBase.teamB.logo = tempTeam.logo
  matchBase.teamB.members = [...tempTeam.members]
  matchBase.teamB.memberRoles = tempTeam.memberRoles.map(r => ({ ...r }))

  // Save and refresh
  saveMatchBase(false)
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
  const survivorContainer = document.getElementById('survivorLineupOptions')
  const hunterContainer = document.getElementById('hunterLineupOptions')

  if (!survivorContainer || !hunterContainer) return

  // Generate survivor options
  survivorContainer.innerHTML = ''
  team.members.forEach((memberName, index) => {
    const canPlay = team.memberRoles[index]?.canPlaySurvivor
    if (!canPlay || !memberName.trim()) return

    const isChecked = matchBase.lineup.survivors.includes(index)
    const checkbox = document.createElement('label')
    checkbox.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px;background:#fff;border:2px solid #e2e8f0;border-radius:6px;cursor:pointer;'
    checkbox.innerHTML = `
          <input type="checkbox" value="${index}" ${isChecked ? 'checked' : ''} onchange="toggleSurvivorLineup(${index})">
          <span style="font-weight:500;">${memberName}</span>
        `
    survivorContainer.appendChild(checkbox)
  })

  if (survivorContainer.children.length === 0) {
    survivorContainer.innerHTML = '<div style="color:#9ca3af;font-size:13px;padding:8px;">暂无可选的求生者（请先设置成员角色）</div>'
  }

  // Generate hunter options
  hunterContainer.innerHTML = ''
  team.members.forEach((memberName, index) => {
    const canPlay = team.memberRoles[index]?.canPlayHunter
    if (!canPlay || !memberName.trim()) return

    const isChecked = matchBase.lineup.hunter === index
    const radio = document.createElement('label')
    radio.style.cssText = 'display:flex;align-items:center;gap:6px;padding:8px;background:#fff;border:2px solid #e2e8f0;border-radius:6px;cursor:pointer;'
    radio.innerHTML = `
          <input type="radio" name="hunterLineup" value="${index}" ${isChecked ? 'checked' : ''} onchange="selectHunterLineup(${index})">
          <span style="font-weight:500;">${memberName}</span>
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
      const names = matchBase.lineup.survivors.map(i => team.members[i] || `成员${i + 1}`).join(', ')
      survivorsDisplay.textContent = names
      survivorsDisplay.style.color = '#059669'
    }
  }

  if (hunterDisplay) {
    if (matchBase.lineup.hunter === null) {
      hunterDisplay.textContent = '未选择'
      hunterDisplay.style.color = '#9ca3af'
    } else {
      hunterDisplay.textContent = team.members[matchBase.lineup.hunter] || `成员${matchBase.lineup.hunter + 1}`
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
    const memberName = team.members[memberIndex] || ''
    const input = document.getElementById(`pmS${i + 1}Name`)
    if (input) input.value = memberName
  }

  const hunterName = team.members[matchBase.lineup.hunter] || ''
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
        if (characters.fullData) {
          // 清空并重建搜索索引
          CHAR_PY_MAP = {}
          const process = (list) => {
            if (Array.isArray(list)) {
              list.forEach(c => {
                if (c && c.name && c.abbr) {
                  // 构造搜索条目：[缩写, 英文名/拼音?]
                  // roles.json 只有 abbr (如 "ys") 和 enName (如 "Doctor")
                  // 这里简单地将 abbr 和 enName 加入索引
                  const keywords = [c.abbr.toLowerCase()]
                  if (c.enName) keywords.push(c.enName.toLowerCase())
                  CHAR_PY_MAP[c.name] = keywords
                }
              })
            }
          }
          process(characters.fullData.survivors)
          process(characters.fullData.hunters)

          // 清理不需要的字段以免混淆
          delete characters.fullData
        }
      }
    }
  }

  // 尝试获取 talents / skills 定义
  const idxRes = await window.electronAPI.invoke('character:get-index')
  if (idxRes.success && idxRes.data) {
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
    state.globalBannedSurvivors = Array.isArray(data.globalBannedSurvivors) ? data.globalBannedSurvivors : []
    state.globalBannedHunters = Array.isArray(data.globalBannedHunters) ? data.globalBannedHunters : []
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
  state.globalBannedSurvivors = Array.isArray(payload.globalBannedSurvivors) ? payload.globalBannedSurvivors : []
  state.globalBannedHunters = Array.isArray(payload.globalBannedHunters) ? payload.globalBannedHunters : []
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

  const folder = pickType === 'survivor' ? 'surHeader' : 'hunHeader'
  grid.innerHTML = list.map(name => `
        <div class="character-item" onclick="selectCharacter('${name}')" data-name="${name}">
          <img class="character-img" src="../assets/${folder}/${name}.png" onerror="this.style.display='none'">
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
    if (el.id === 'commandPaletteOverlay') return
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
  // 更新tab样式
  document.querySelectorAll('.survivor-tab').forEach((tab, i) => {
    tab.classList.toggle('active', i === index)
    // 显示是否已有天赋
    const hasTalents = state.survivorTalents[i] && state.survivorTalents[i].length > 0
    tab.classList.toggle('has-talents', hasTalents)
  })
  // 更新天赋选中状态
  updateSurvivorTalentUI()
  // 更新当前显示
  updateCurrentSurvivorTalentsDisplay()
}

// 切换求生者天赋（为当前选中的求生者）
async function toggleSurvivorTalent(talent) {
  if (state.editingSurvivorIndex === null) {
    alert('请先选择一个求生者')
    return
  }
  const i = state.editingSurvivorIndex
  if (!state.survivorTalents[i]) state.survivorTalents[i] = []

  const idx = state.survivorTalents[i].indexOf(talent)
  if (idx >= 0) {
    state.survivorTalents[i].splice(idx, 1)
  } else {
    state.survivorTalents[i].push(talent)
  }
  await window.electronAPI.invoke('localBp:setSurvivorTalents', { index: i, talents: state.survivorTalents[i] })
  updateSurvivorTalentUI()
  updateCurrentSurvivorTalentsDisplay()
  updateDisplay()
}

// 更新求生者天赋UI（仅当前选中的求生者）
function updateSurvivorTalentUI() {
  const i = state.editingSurvivorIndex
  document.querySelectorAll('#survivor-talent-grid .talent-item').forEach(item => {
    const talent = item.dataset.talent
    const isSelected = i !== null && state.survivorTalents[i] && state.survivorTalents[i].includes(talent)
    item.classList.toggle('selected', isSelected)
  })
  // 更新tab的has-talents状态
  document.querySelectorAll('.survivor-tab').forEach((tab, idx) => {
    const hasTalents = state.survivorTalents[idx] && state.survivorTalents[idx].length > 0
    tab.classList.toggle('has-talents', hasTalents)
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
    updateCurrentSurvivorTalentsDisplay()
  }
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
  scoreboardDisplay: { teamA: 'auto', teamB: 'auto' },
  teamAName: 'A队', teamBName: 'B队',
  teamALogo: '', teamBLogo: ''
}

function normalizeScoreData(raw) {
  const d = raw && typeof raw === 'object' ? raw : {}
  const bos = Array.isArray(d.bos) ? d.bos : []
  return {
    bos: bos.length ? bos : [{ upper: { teamA: 0, teamB: 0 }, lower: { teamA: 0, teamB: 0 } }],
    teamAWins: d.teamAWins || 0,
    teamBWins: d.teamBWins || 0,
    teamADraws: d.teamADraws || 0,
    teamBDraws: d.teamBDraws || 0,
    currentRound: d.currentRound || 1,
    currentHalf: d.currentHalf || 1,
    scoreboardDisplay: (d.scoreboardDisplay && typeof d.scoreboardDisplay === 'object') ? d.scoreboardDisplay : { teamA: 'auto', teamB: 'auto' },
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

function syncScoreStorageBaseFields() {
  // 从现有 scoreData（或本地存储）读出来，更新队名/Logo，再写回 score_${LOCAL_ROOM_ID}
  const data = normalizeScoreData(scoreData && typeof scoreData === 'object' ? scoreData : loadScoreDataAny())
  data.teamAName = matchBase?.teamA?.name || data.teamAName || 'A队'
  data.teamBName = matchBase?.teamB?.name || data.teamBName || 'B队'
  data.teamALogo = matchBase?.teamA?.logo || data.teamALogo || ''
  data.teamBLogo = matchBase?.teamB?.logo || data.teamBLogo || ''
  localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(data))
  localStorage.setItem('localBp_score', JSON.stringify(data))
}

function initScorePage() {
  if (!matchBase) loadMatchBase()
  scoreData = loadScoreDataAny()
  // 统一从 matchBase 覆盖队名/Logo
  scoreData.teamAName = matchBase.teamA.name || scoreData.teamAName || 'A队'
  scoreData.teamBName = matchBase.teamB.name || scoreData.teamBName || 'B队'
  scoreData.teamALogo = matchBase.teamA.logo || scoreData.teamALogo || ''
  scoreData.teamBLogo = matchBase.teamB.logo || scoreData.teamBLogo || ''
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
  if (team === 'A') scoreData.teamAName = matchBase?.teamA?.name || name || 'A队'
  else scoreData.teamBName = matchBase?.teamB?.name || name || 'B队'
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

    return `<div style="background:#f7fafc;border:2px solid ${isActive ? '#ffd700' : '#e2e8f0'};box-shadow: ${isActive ? '0 0 12px rgba(255, 215, 0, 0.3)' : 'none'};border-radius:10px;padding:15px;margin-bottom:15px; transition: all 0.3s;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div>
                ${isActive ? '<span style="color:#ffd700;margin-right:5px;">馃搳</span>' : ''}
                <strong>第${i + 1}个BO</strong> ${badge}
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

function updateBo(boIndex, half, team, value) {
  scoreData.bos[boIndex][half][team] = parseInt(value) || 0
  calculateScore()
  saveScoreData()
  renderBoList()
  updateScoreDisplay()
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
  if (!matchBase) loadMatchBase()
  scoreData.teamAName = matchBase.teamA.name || scoreData.teamAName || 'A队'
  scoreData.teamBName = matchBase.teamB.name || scoreData.teamBName || 'B队'
  scoreData.teamALogo = matchBase.teamA.logo || scoreData.teamALogo || ''
  scoreData.teamBLogo = matchBase.teamB.logo || scoreData.teamBLogo || ''
  localStorage.setItem(SCORE_STORAGE_KEY, JSON.stringify(scoreData))
  localStorage.setItem('localBp_score', JSON.stringify(scoreData))
  syncMatchBaseToFrontend()
}

function resetScore() {
  if (confirm('确定重置所有比分？')) {
    if (!matchBase) loadMatchBase()
    scoreData = {
      bos: [{ upper: { teamA: 0, teamB: 0 }, lower: { teamA: 0, teamB: 0 } }],
      teamAWins: 0, teamBWins: 0,
      teamADraws: 0, teamBDraws: 0,
      currentRound: 1,
      currentHalf: 1,
      scoreboardDisplay: { teamA: 'auto', teamB: 'auto' },
      teamAName: matchBase.teamA.name || 'A队',
      teamBName: matchBase.teamB.name || 'B队',
      teamALogo: matchBase.teamA.logo || '',
      teamBLogo: matchBase.teamB.logo || ''
    }
    saveScoreData()
    renderBoList()
    updateScoreDisplay()
    document.getElementById('scoreTeamAName').value = scoreData.teamAName
    document.getElementById('scoreTeamBName').value = scoreData.teamBName
  }
}

function updateScoreboardDisplayUI() {
  const roundSelect = document.getElementById('displayRoundSelect')
  if (roundSelect) {
    const current = scoreData.currentRound || 1
    roundSelect.innerHTML = scoreData.bos.map((_, i) => `<option value="${i + 1}" ${current === (i + 1) ? 'selected' : ''}>第 ${i + 1} 个BO</option>`).join('')
  }

  const modeSelect = document.getElementById('displayModeSelect')
  if (modeSelect) {
    modeSelect.value = scoreData.scoreboardDisplay?.teamA || 'auto'
  }

  const halfSelect = document.getElementById('displayHalfSelect')
  if (halfSelect) {
    halfSelect.value = scoreData.currentHalf || 1
  }
}

function updateScoreboardDisplayConfig() {
  const round = parseInt(document.getElementById('displayRoundSelect').value) || 1
  const mode = document.getElementById('displayModeSelect').value
  const half = parseInt(document.getElementById('displayHalfSelect').value) || 1

  scoreData.currentRound = round
  scoreData.currentHalf = half
  // 统一控制两个队的分数显示模式
  scoreData.scoreboardDisplay = {
    teamA: mode,
    teamB: mode
  }

  saveScoreData()
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

function syncPostMatchStorageBaseFields() {
  const data = normalizePostMatchData(postMatchData && typeof postMatchData === 'object' ? postMatchData : loadPostMatchAny())
  data.mapName = matchBase?.mapName || data.mapName || ''
  data.teamA.name = matchBase?.teamA?.name || data.teamA.name || 'A队'
  data.teamB.name = matchBase?.teamB?.name || data.teamB.name || 'B队'
  data.teamA.logo = matchBase?.teamA?.logo || data.teamA.logo || ''
  data.teamB.logo = matchBase?.teamB?.logo || data.teamB.logo || ''
  localStorage.setItem(POSTMATCH_STORAGE_KEY, JSON.stringify(data))
  localStorage.setItem('localBp_postmatch', JSON.stringify(data))
}

function initPostMatchPage() {
  if (!matchBase) loadMatchBase()
  postMatchData = loadPostMatchAny()
  // 强制从 matchBase 统一队名/Logo/地图
  postMatchData.mapName = matchBase.mapName || postMatchData.mapName || ''
  postMatchData.teamA.name = matchBase.teamA.name || postMatchData.teamA.name || 'A队'
  postMatchData.teamB.name = matchBase.teamB.name || postMatchData.teamB.name || 'B队'
  postMatchData.teamA.logo = matchBase.teamA.logo || postMatchData.teamA.logo || ''
  postMatchData.teamB.logo = matchBase.teamB.logo || postMatchData.teamB.logo || ''
  populatePostMatchForm()
  syncPostMatchStorageBaseFields()
}

function populatePostMatchForm() {
  const d = normalizePostMatchData(postMatchData)
  document.getElementById('pmTitle').value = d.title
  document.getElementById('pmSubTitle').value = d.subTitle
  document.getElementById('pmGameLabel').value = d.gameLabel
  document.getElementById('pmMapName').value = d.mapName

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
  return {
    title: document.getElementById('pmTitle').value,
    subTitle: document.getElementById('pmSubTitle').value,
    gameLabel: document.getElementById('pmGameLabel').value,
    mapName: document.getElementById('pmMapName').value,
    teamA: {
      name: matchBase.teamA.name || document.getElementById('pmTeamAName').value,
      meta: document.getElementById('pmTeamAMeta').value,
      score: parseInt(document.getElementById('pmTeamAScore').value) || 0,
      logo: matchBase.teamA.logo || ''
    },
    teamB: {
      name: matchBase.teamB.name || document.getElementById('pmTeamBName').value,
      meta: document.getElementById('pmTeamBMeta').value,
      score: parseInt(document.getElementById('pmTeamBScore').value) || 0,
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
  updateMatchBaseMapName(postMatchData.mapName)
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
    document.getElementById('pmMapName').value = matchBase?.mapName || ''
    document.getElementById('pmTeamAName').value = matchBase?.teamA?.name || ''
    document.getElementById('pmTeamAMeta').value = ''
    document.getElementById('pmTeamAScore').value = 0
    document.getElementById('pmTeamBName').value = matchBase?.teamB?.name || ''
    document.getElementById('pmTeamBMeta').value = ''
    document.getElementById('pmTeamBScore').value = 0
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

async function ocrFillPostMatch() {
  const btn = document.getElementById('pmOcrBtn')
  try {
    const input = document.getElementById('pmOcrFile')
    const file = input?.files?.[0]
    if (!file) {
      alert('请先选择一张对局截图')
      return
    }
    if (!window.electronAPI?.parseGameRecordImage) {
      alert('当前版本不支持 OCR 调用')
      return
    }

    if (btn) {
      btn.disabled = true
      btn.textContent = '识别中...'
    }

    const dataUrl = await readFileAsDataUrl(file)
    const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl

    const result = await window.electronAPI.parseGameRecordImage(base64)
    if (!result?.success) {
      alert('识别失败: ' + (result?.error || '未知错误'))
      return
    }

    const dto = result.data
    const ok = dto?.success ?? dto?.Success
    if (ok === false) {
      alert('识别失败: ' + (dto?.message ?? dto?.Message ?? '未知错误'))
      return
    }

    const normalized = normalizeOcrResponse(dto)
    if (normalized.mapName) {
      setValue('pmMapName', normalized.mapName)
      updateMatchBaseMapName(normalized.mapName)
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

    alert('识别完成：已回填到表单（请确认后保存）')
  } catch (e) {
    console.error('OCR 回填失败:', e)
    alert('OCR 回填失败: ' + (e?.message || e))
  } finally {
    if (btn) {
      btn.disabled = false
      btn.textContent = '识别并回填'
    }
  }
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
  });

  updateDisplay()
  updateCharacterStatus()
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
    if (entry[0] === q) return 90; // Exact initial
    if (entry[0].startsWith(q)) return 80; // Prefix initial
    if (entry[1] && entry[1].startsWith(q)) return 70; // Prefix pinyin
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

// 页面加载初始化
window.addEventListener('DOMContentLoaded', () => {
  syncDefaultImagesToMainProcess()
  updateDisplay()
  initGlobalShortcuts()
  if (isGuideOnly) {
    if (!matchBase) loadMatchBase()
    openBpGuide()
  } else {
    resetInteractionOverlays()
    resetSearchInputs()
    unlockAllInputs()
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
  const pages = ['bp', 'baseinfo', 'talents', 'score', 'postmatch']
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
