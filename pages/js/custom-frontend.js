const FRONTEND_MAIN_WINDOW_ID = 'frontend-main'
const currentFrontendWindowId = (() => {
  try {
    const params = new URLSearchParams(window.location.search || '')
    return params.get('windowId') || FRONTEND_MAIN_WINDOW_ID
  } catch {
    return FRONTEND_MAIN_WINDOW_ID
  }
})()

window.__ASG_FRONTEND_WINDOW_ID__ = currentFrontendWindowId

let roomData = null
let currentLayout = {}
let customComponentsLoaded = []
let latestFrontendStateForTemplate = null
let latestScoreDataForTemplate = null
let lastTemplateEventData = {}
let editMode = false
let initialEntranceAnimationPlayed = false
let customComponentTemplateVars = {
  timestamp: Date.now(),
  frontendWindowId: currentFrontendWindowId
}

const IMAGE_FIT_VALUES = new Set(['contain', 'cover', 'fill', 'none'])
const COMPONENT_BEHAVIOR_MAX_DEPTH = 6
const componentBehaviorRuntimeMap = new Map()

function normalizeImageFitOption(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return IMAGE_FIT_VALUES.has(normalized) ? normalized : null
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)))
}

function parseDurationMs(rawValue, fallback = 0) {
  if (rawValue == null || rawValue === '') return fallback
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return Math.max(0, Math.round(rawValue))
  const raw = String(rawValue).trim().toLowerCase()
  if (!raw) return fallback
  if (/^\d+$/.test(raw)) return Math.max(0, parseInt(raw, 10))
  if (/^\d+(\.\d+)?ms$/.test(raw)) return Math.max(0, Math.round(parseFloat(raw)))
  if (/^\d+(\.\d+)?s$/.test(raw)) return Math.max(0, Math.round(parseFloat(raw) * 1000))
  if (/^\d+(\.\d+)?m$/.test(raw)) return Math.max(0, Math.round(parseFloat(raw) * 60000))
  const mmssMatch = raw.match(/^(\d{1,2}):(\d{1,2})$/)
  if (mmssMatch) {
    const minutes = parseInt(mmssMatch[1], 10)
    const seconds = parseInt(mmssMatch[2], 10)
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return Math.max(0, (minutes * 60 + seconds) * 1000)
    }
  }
  return fallback
}

function safeParseJsonObject(rawText, fallback = {}) {
  if (rawText && typeof rawText === 'object' && !Array.isArray(rawText)) return rawText
  if (typeof rawText !== 'string') return fallback
  const text = rawText.trim()
  if (!text) return fallback
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch {
    return fallback
  }
  return fallback
}

function getComponentBehaviorRuntime(componentId) {
  const key = String(componentId || '').trim()
  if (!key) return { vars: {} }
  if (!componentBehaviorRuntimeMap.has(key)) {
    componentBehaviorRuntimeMap.set(key, { vars: {} })
  }
  return componentBehaviorRuntimeMap.get(key)
}

function getComponentBehaviorRules(comp) {
  if (!comp || typeof comp !== 'object') return []
  const behavior = (comp.behavior && typeof comp.behavior === 'object') ? comp.behavior : {}
  const rules = Array.isArray(behavior.rules) ? behavior.rules : []
  return rules.filter(rule => rule && typeof rule === 'object')
}

function isBehaviorRuleMatched(rule, eventType, eventData = {}) {
  if (!rule || rule.enabled === false) return false
  const triggerType = String(rule.triggerType || '').trim()
  if (!triggerType) return false
  if (triggerType === 'custom:event') {
    const expected = String(rule.triggerEventName || '').trim()
    const actual = String(eventData.eventName || '').trim()
    return expected ? expected === actual : !!actual
  }
  return triggerType === eventType
}

function buildBehaviorTemplateScope(comp, runtimeState, eventType) {
  return {
    ...customComponentTemplateVars,
    runtime: (runtimeState && runtimeState.vars) ? runtimeState.vars : {},
    componentId: comp && comp.id ? comp.id : '',
    componentName: comp && comp.name ? comp.name : '',
    eventType
  }
}

function resolveBehaviorTemplateValue(rawValue, comp, eventType, eventData, runtimeState) {
  if (rawValue == null) return ''
  return resolveCustomComponentTemplate(String(rawValue), eventData, buildBehaviorTemplateScope(comp, runtimeState, eventType))
}

function parseBehaviorJsonValue(rawValue, comp, eventType, eventData, runtimeState, fallback = {}) {
  const resolved = resolveBehaviorTemplateValue(rawValue, comp, eventType, eventData, runtimeState)
  return safeParseJsonObject(resolved, fallback)
}

async function executeComponentBehaviorAction(comp, action, eventType, eventData = {}, depth = 0) {
  if (!comp || !action || action.enabled === false) return
  if (depth > COMPONENT_BEHAVIOR_MAX_DEPTH) return
  const runtimeState = getComponentBehaviorRuntime(comp.id)
  const params = (action.params && typeof action.params === 'object') ? action.params : {}
  const beforeDelay = parseDurationMs(resolveBehaviorTemplateValue(action.delay || '', comp, eventType, eventData, runtimeState), 0)
  if (beforeDelay > 0) await sleep(beforeDelay)

  if (action.type === 'DELAY') {
    const delayMs = parseDurationMs(resolveBehaviorTemplateValue(params.duration || '500ms', comp, eventType, eventData, runtimeState), 500)
    await sleep(delayMs)
    return
  }

  if (action.type === 'SET_COMPONENT_PROPERTY') {
    const targetComponentId = resolveBehaviorTemplateValue(params.componentId || comp.id, comp, eventType, eventData, runtimeState).trim() || comp.id
    const patch = parseBehaviorJsonValue(params.patchJson || '{}', comp, eventType, eventData, runtimeState, {})
    applyAutomationComponentPatch({
      targetPage: 'custom-frontend',
      targetWindowId: currentFrontendWindowId,
      componentId: targetComponentId,
      patch
    })
    return
  }

  if (action.type === 'EMIT_CUSTOM_EVENT') {
    const eventName = resolveBehaviorTemplateValue(params.eventName || 'component:event', comp, eventType, eventData, runtimeState).trim() || 'component:event'
    const payload = parseBehaviorJsonValue(params.payloadJson || '{}', comp, eventType, eventData, runtimeState, {})
    await dispatchComponentBehaviorEvent('custom:event', {
      ...payload,
      eventName,
      sourceComponentId: comp.id
    }, depth + 1)
    return
  }

  if (action.type === 'EXECUTE_COMMAND') {
    const command = resolveBehaviorTemplateValue(params.command || '', comp, eventType, eventData, runtimeState).trim()
    const args = parseBehaviorJsonValue(params.argsJson || '{}', comp, eventType, eventData, runtimeState, {})
    if (command) {
      await dispatchComponentBehaviorEvent('custom:event', {
        eventName: `command:${command}`,
        command,
        args,
        sourceComponentId: comp.id
      }, depth + 1)
    }
    return
  }

  if (action.type === 'CALL_CUSTOM_API') {
    const url = resolveBehaviorTemplateValue(params.url || '', comp, eventType, eventData, runtimeState).trim()
    if (!url) return

    const method = (resolveBehaviorTemplateValue(params.method || 'GET', comp, eventType, eventData, runtimeState).trim() || 'GET').toUpperCase()
    const headers = parseBehaviorJsonValue(params.headersJson || '{}', comp, eventType, eventData, runtimeState, {})
    const timeoutMs = Math.max(0, parseInt(resolveBehaviorTemplateValue(params.timeoutMs || '8000', comp, eventType, eventData, runtimeState), 10) || 8000)
    const bodyRaw = resolveBehaviorTemplateValue(params.bodyJson || '', comp, eventType, eventData, runtimeState).trim()
    const hasBody = method !== 'GET' && method !== 'HEAD'
    const request = { method, headers: { ...headers } }

    if (hasBody && bodyRaw) {
      try {
        const jsonBody = JSON.parse(bodyRaw)
        request.body = JSON.stringify(jsonBody)
        if (!Object.keys(request.headers).some(key => key.toLowerCase() === 'content-type')) {
          request.headers['Content-Type'] = 'application/json'
        }
      } catch {
        request.body = bodyRaw
      }
    }

    const controller = new AbortController()
    request.signal = controller.signal
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let responseInfo = {
      ok: false,
      status: 0,
      statusText: '',
      body: null,
      rawText: '',
      url
    }

    try {
      const response = await fetch(url, request)
      const rawText = await response.text()
      let body = rawText
      try {
        body = rawText ? JSON.parse(rawText) : {}
      } catch {
        body = rawText
      }
      responseInfo = {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        body,
        rawText,
        url
      }
    } catch (error) {
      responseInfo = {
        ok: false,
        status: 0,
        statusText: String(error && error.message ? error.message : error),
        body: null,
        rawText: '',
        url
      }
    } finally {
      clearTimeout(timer)
    }

    const saveAs = resolveBehaviorTemplateValue(params.saveAs || 'lastApi', comp, eventType, eventData, runtimeState).trim() || 'lastApi'
    runtimeState.vars[saveAs] = responseInfo

    const resultEventName = resolveBehaviorTemplateValue(params.resultEventName || '', comp, eventType, eventData, runtimeState).trim()
    if (resultEventName) {
      await dispatchComponentBehaviorEvent('custom:event', {
        eventName: resultEventName,
        apiResult: responseInfo,
        sourceComponentId: comp.id
      }, depth + 1)
    }
    return
  }
}

async function executeComponentBehaviorRule(comp, rule, eventType, eventData = {}, depth = 0) {
  if (!comp || !rule || depth > COMPONENT_BEHAVIOR_MAX_DEPTH) return
  const actions = Array.isArray(rule.actions) ? rule.actions : []
  for (const action of actions) {
    try {
      await executeComponentBehaviorAction(comp, action, eventType, eventData, depth)
    } catch (error) {
      console.warn('[Custom Frontend] 组件积木动作执行失败:', error?.message || error)
    }
  }
}

async function triggerComponentBehaviorForSingle(comp, eventType, eventData = {}, depth = 0) {
  if (!comp || depth > COMPONENT_BEHAVIOR_MAX_DEPTH) return
  const rules = getComponentBehaviorRules(comp)
  for (const rule of rules) {
    if (!isBehaviorRuleMatched(rule, eventType, eventData)) continue
    await executeComponentBehaviorRule(comp, rule, eventType, eventData, depth)
  }
}

async function dispatchComponentBehaviorEvent(eventType, eventData = {}, depth = 0) {
  if (!eventType || depth > COMPONENT_BEHAVIOR_MAX_DEPTH) return
  const targets = customComponentsLoaded.filter(isComponentTargetForCurrentFrontendWindow)
  for (const comp of targets) {
    await triggerComponentBehaviorForSingle(comp, eventType, eventData, depth)
  }
}

function getTemplateNestedValue(obj, path) {
  if (!obj || typeof obj !== 'object' || !path) return undefined
  const parts = String(path).split('.')
  let value = obj
  for (const part of parts) {
    if (value == null) return undefined
    value = value[part]
  }
  return value
}

function resolveCustomComponentTemplate(template, eventData = {}, extraVars = null) {
  if (typeof template !== 'string' || !template) return ''
  const vars = (extraVars && typeof extraVars === 'object') ? extraVars : customComponentTemplateVars
  return template.replace(/\{\{([^}]+)\}\}/g, (match, rawPath) => {
    const path = String(rawPath || '').trim()
    if (!path) return ''
    if (path.startsWith('eventData.')) {
      return getTemplateNestedValue(eventData, path.slice(10)) ?? ''
    }
    if (Object.prototype.hasOwnProperty.call(vars, path)) {
      return vars[path] ?? ''
    }
    return getTemplateNestedValue(vars, path) ?? ''
  })
}

function isComponentTargetForCurrentFrontendWindow(comp) {
  if (!comp || !Array.isArray(comp.targetPages) || !comp.targetPages.includes('frontend')) return false
  const targets = Array.isArray(comp.targetWindows)
    ? comp.targetWindows.map(v => String(v || '').trim()).filter(Boolean)
    : []
  if (!targets.length) return currentFrontendWindowId === FRONTEND_MAIN_WINDOW_ID
  return targets.includes(currentFrontendWindowId)
}

function asTemplateInt(input, fallback = 0) {
  const n = parseInt(input, 10)
  return Number.isFinite(n) ? n : fallback
}

function asTemplateString(input, fallback = '') {
  if (typeof input === 'string') return input
  if (input == null) return fallback
  return String(input)
}

function normalizeTemplateHalf(input) {
  return input === 'lower' ? 'lower' : 'upper'
}

function resolveTemplateScoreDisplayTarget(scoreData) {
  const bos = Array.isArray(scoreData?.bos) ? scoreData.bos : []
  if (!bos.length) {
    return { round: 1, half: 'upper', scoreA: 0, scoreB: 0, boCount: 0 }
  }

  const cfgRaw = (scoreData?.displayConfig && typeof scoreData.displayConfig === 'object') ? scoreData.displayConfig : {}
  const legacyHalf = (asTemplateInt(scoreData?.currentHalf, 1) === 2) ? 'lower' : 'upper'
  const auto = (typeof cfgRaw.auto === 'boolean')
    ? cfgRaw.auto
    : !((scoreData?.scoreboardDisplay?.teamA === 'upper') || (scoreData?.scoreboardDisplay?.teamA === 'lower'))
  const round = Math.max(1, Math.min(bos.length, asTemplateInt(cfgRaw.round, asTemplateInt(scoreData?.currentRound, 1))))
  const half = normalizeTemplateHalf(cfgRaw.half || legacyHalf)

  let targetIndex = round - 1
  let targetHalf = half

  if (auto) {
    targetIndex = 0
    targetHalf = 'upper'
    let found = false
    for (let i = bos.length - 1; i >= 0; i--) {
      const bo = bos[i] || {}
      const hasLower = asTemplateInt(bo?.lower?.teamA, 0) > 0 || asTemplateInt(bo?.lower?.teamB, 0) > 0
      const hasUpper = asTemplateInt(bo?.upper?.teamA, 0) > 0 || asTemplateInt(bo?.upper?.teamB, 0) > 0
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
  }

  const bo = bos[targetIndex] || {}
  const halfData = bo[targetHalf] || {}
  return {
    round: targetIndex + 1,
    half: targetHalf,
    scoreA: asTemplateInt(halfData.teamA, 0),
    scoreB: asTemplateInt(halfData.teamB, 0),
    boCount: bos.length
  }
}

function buildTemplateMatchVariables(eventData = {}) {
  const vars = (eventData && eventData.__templateVarsBase && typeof eventData.__templateVarsBase === 'object')
    ? eventData.__templateVarsBase
    : (customComponentTemplateVars || {})
  const scoreData = (eventData?.scoreData && typeof eventData.scoreData === 'object') ? eventData.scoreData : latestScoreDataForTemplate
  const target = resolveTemplateScoreDisplayTarget(scoreData)

  const teamAName = asTemplateString(
    scoreData?.teamAName ?? eventData?.teamA?.name ?? eventData?.teamAName ?? vars.matchTeamA ?? vars.localTeamA ?? '',
    ''
  )
  const teamBName = asTemplateString(
    scoreData?.teamBName ?? eventData?.teamB?.name ?? eventData?.teamBName ?? vars.matchTeamB ?? vars.localTeamB ?? '',
    ''
  )
  const scoreA = asTemplateInt(scoreData?.teamAWins, asTemplateInt(eventData?.matchScoreA, asTemplateInt(vars.matchScoreA, 0)))
  const scoreB = asTemplateInt(scoreData?.teamBWins, asTemplateInt(eventData?.matchScoreB, asTemplateInt(vars.matchScoreB, 0)))
  const drawA = asTemplateInt(scoreData?.teamADraws, asTemplateInt(eventData?.matchDrawA, asTemplateInt(vars.matchDrawA, 0)))
  const drawB = asTemplateInt(scoreData?.teamBDraws, asTemplateInt(eventData?.matchDrawB, asTemplateInt(vars.matchDrawB, 0)))
  const mapName = asTemplateString(eventData?.mapName ?? vars.mapName ?? '', '')
  const round = asTemplateInt(target.round, asTemplateInt(vars.matchRound, 1))
  const half = normalizeTemplateHalf(target.half || vars.matchHalf)
  const halfText = half === 'lower' ? '下半局' : '上半局'
  const smallA = asTemplateInt(target.scoreA, asTemplateInt(vars.matchSmallScoreA, 0))
  const smallB = asTemplateInt(target.scoreB, asTemplateInt(vars.matchSmallScoreB, 0))
  const boCount = asTemplateInt(target.boCount, asTemplateInt(vars.matchBoCount, 0))
  const hasTeamNames = !!(teamAName || teamBName)

  return {
    matchTeamA: teamAName,
    matchTeamB: teamBName,
    matchScoreA: scoreA,
    matchScoreB: scoreB,
    matchDrawA: drawA,
    matchDrawB: drawB,
    matchMap: mapName,
    matchRound: round,
    matchHalf: half,
    matchHalfText: halfText,
    matchBoCount: boCount,
    matchSmallScoreA: smallA,
    matchSmallScoreB: smallB,
    matchScore: `${scoreA}:${scoreB}`,
    matchSmallScore: `${smallA}:${smallB}`,
    matchTitle: hasTeamNames ? `${teamAName} vs ${teamBName}` : '',
    matchScoreText: hasTeamNames ? `${teamAName} ${scoreA} : ${scoreB} ${teamBName}` : `${scoreA}:${scoreB}`
  }
}

function applyBpTemplateVariables(targetVars, eventData = {}) {
  if (!targetVars || typeof targetVars !== 'object') return
  const survivors = eventData.survivors || eventData.selectedSurvivors || []
  const selectedCount = survivors.filter(Boolean).length
  const bannedSurvivors = eventData.hunterBannedSurvivors || []
  const bannedHunters = eventData.survivorBannedHunters || []

  Object.assign(targetVars, {
    bpHunter: eventData.hunter || eventData.selectedHunter || eventData.character || '',
    bpSurvivors: survivors,
    bpBannedSurvivors: bannedSurvivors,
    bpBannedHunters: bannedHunters,
    bpRound: eventData.round || eventData.currentRound || 0,
    bpSurvivorSelectedCount: Number.isFinite(eventData.selectedCount) ? eventData.selectedCount : selectedCount,
    bpLatestSurvivor: eventData.survivor || eventData.character || '',
    'bpSurvivors.0': survivors[0] || '',
    'bpSurvivors.1': survivors[1] || '',
    'bpSurvivors.2': survivors[2] || '',
    'bpSurvivors.3': survivors[3] || '',
    bpSurvivorsText: survivors.filter(s => s).join(', '),
    bpBannedSurvivorsText: bannedSurvivors.filter(s => s).join(', '),
    bpBannedHuntersText: bannedHunters.filter(s => s).join(', '),
    bpTeamA: eventData.teamAName || eventData.teamA || '',
    bpTeamB: eventData.teamBName || eventData.teamB || ''
  })
}

function buildTemplateEventDataFromState(state, rawData = {}) {
  const data = rawData && typeof rawData === 'object' ? rawData : {}
  const st = state && typeof state === 'object' ? state : {}
  const roundData = st.currentRoundData || {}
  const survivors = Array.isArray(roundData.selectedSurvivors)
    ? roundData.selectedSurvivors
    : (Array.isArray(st.survivors) ? st.survivors : [])
  const selectedCount = survivors.filter(Boolean).length
  const latestSurvivor = selectedCount > 0 ? (survivors[selectedCount - 1] || '') : ''

  return {
    ...data,
    roomId: data.roomId || roomData?.roomId || '',
    roomName: data.roomName || roomData?.roomId || roomData?.roomName || '',
    status: data.status || data.roomStatus || roomData?.status || 'localbp',
    mapName: data.mapName || st.currentMap || st.mapName || '',
    teamA: data.teamA || st.teamA || {},
    teamB: data.teamB || st.teamB || {},
    teamAName: data.teamAName || st?.teamA?.name || '',
    teamBName: data.teamBName || st?.teamB?.name || '',
    hunter: data.hunter || roundData.selectedHunter || st.hunter || '',
    selectedHunter: data.selectedHunter || roundData.selectedHunter || st.hunter || '',
    survivors,
    selectedSurvivors: survivors,
    selectedCount: asTemplateInt(data.selectedCount, selectedCount),
    survivor: data.survivor || latestSurvivor,
    character: data.character || data.survivor || latestSurvivor || roundData.selectedHunter || st.hunter || '',
    hunterBannedSurvivors: data.hunterBannedSurvivors || roundData.hunterBannedSurvivors || st.hunterBannedSurvivors || [],
    survivorBannedHunters: data.survivorBannedHunters || roundData.survivorBannedHunters || st.survivorBannedHunters || [],
    round: asTemplateInt(data.round, asTemplateInt(st.currentRound || data.currentRound, 0)),
    currentRound: asTemplateInt(data.currentRound, asTemplateInt(st.currentRound || data.round, 0)),
    scoreData: data.scoreData || latestScoreDataForTemplate || undefined
  }
}

function buildTemplateEventDataFromScore(scoreData, rawData = {}) {
  const data = rawData && typeof rawData === 'object' ? rawData : {}
  const score = scoreData && typeof scoreData === 'object' ? scoreData : {}
  const st = latestFrontendStateForTemplate || {}
  const vars = customComponentTemplateVars || {}
  return {
    ...data,
    scoreData: score,
    mapName: data.mapName || st.currentMap || st.mapName || vars.mapName || '',
    teamA: data.teamA || st.teamA || {},
    teamB: data.teamB || st.teamB || {},
    teamAName: data.teamAName || st?.teamA?.name || vars.localTeamA || '',
    teamBName: data.teamBName || st?.teamB?.name || vars.localTeamB || '',
    roomId: data.roomId || vars.roomId || roomData?.roomId || '',
    roomName: data.roomName || vars.roomName || roomData?.roomId || '',
    status: data.status || data.roomStatus || vars.roomStatus || 'localbp'
  }
}

function normalizeTemplateEventData(data) {
  if (!data || typeof data !== 'object') return {}
  if (data.type === 'state' && data.state) return buildTemplateEventDataFromState(data.state, data)
  if (data.state && typeof data.state === 'object') return buildTemplateEventDataFromState(data.state, data)
  if (data.type === 'score' && data.scoreData) return buildTemplateEventDataFromScore(data.scoreData, data)
  if (data.scoreData && typeof data.scoreData === 'object') return buildTemplateEventDataFromScore(data.scoreData, data)
  return data
}

function resolveTemplateEventType(rawData, normalizedData) {
  const raw = rawData && typeof rawData === 'object' ? rawData : {}
  const normalized = normalizedData && typeof normalizedData === 'object' ? normalizedData : {}

  const explicit = typeof raw.eventType === 'string' && raw.eventType.trim()
    ? raw.eventType.trim()
    : (typeof normalized.eventType === 'string' ? normalized.eventType.trim() : '')
  if (explicit) return explicit

  const rawType = typeof raw.type === 'string' ? raw.type.trim() : ''
  if (rawType === 'automation-custom-event') return 'custom:event'
  if (rawType && rawType.includes(':')) return rawType
  if (rawType === 'state' || (raw.state && typeof raw.state === 'object')) return 'localbp:state-updated'
  if (rawType === 'score' || (raw.scoreData && typeof raw.scoreData === 'object')) return 'localbp:score-updated'
  if (rawType === 'timer') return 'timer:interval'
  return rawType || 'frontend:update'
}

function updateTemplateVarsByObsEventType(eventType, eventData = {}) {
  const vars = customComponentTemplateVars || {}
  const nextVars = Object.assign({}, vars, {
    lastEvent: eventType,
    lastEventData: eventData,
    timestamp: Date.now(),
    frontendWindowId: currentFrontendWindowId
  })

  if (eventType.startsWith('bp:')) {
    applyBpTemplateVariables(nextVars, eventData)
  }

  if (eventType.startsWith('localbp:')) {
    const prevRoomId = nextVars.roomId || ''
    const prevRoomName = nextVars.roomName || ''
    const prevRoomStatus = nextVars.roomStatus || ''
    const prevMapName = nextVars.mapName || ''
    const prevTeamA = nextVars.localTeamA || ''
    const prevTeamB = nextVars.localTeamB || ''

    Object.assign(nextVars, {
      roomId: eventData.roomId || eventData.id || prevRoomId,
      roomName: eventData.roomName || eventData.name || prevRoomName,
      roomStatus: eventData.status || prevRoomStatus,
      mapName: eventData.mapName || prevMapName,
      localTeamA: eventData.teamA?.name || eventData.teamAName || prevTeamA,
      localTeamB: eventData.teamB?.name || eventData.teamBName || prevTeamB
    })

    Object.assign(nextVars, buildTemplateMatchVariables({
      ...eventData,
      __templateVarsBase: nextVars
    }))
  }

  if (eventType === 'timer:interval') {
    Object.assign(nextVars, {
      timerRuleId: eventData.timerRuleId || '',
      timerRuleName: eventData.timerRuleName || '',
      intervalMs: Number.isFinite(eventData.intervalMs) ? eventData.intervalMs : 0
    })
  }

  customComponentTemplateVars = nextVars
}

function refreshCustomComponentTemplateVars(data) {
  if (!data || typeof data !== 'object') return
  const normalizedData = normalizeTemplateEventData(data)
  lastTemplateEventData = normalizedData

  if (data.type === 'state' && data.state) {
    latestFrontendStateForTemplate = data.state
    applyBpTemplateVariables(customComponentTemplateVars, normalizedData)
  } else if (data.state && typeof data.state === 'object') {
    latestFrontendStateForTemplate = data.state
    applyBpTemplateVariables(customComponentTemplateVars, normalizedData)
  } else if (data.type === 'score' && data.scoreData) {
    latestScoreDataForTemplate = data.scoreData
  } else if (data.scoreData && typeof data.scoreData === 'object') {
    latestScoreDataForTemplate = data.scoreData
  }

  const eventType = resolveTemplateEventType(data, normalizedData)
  updateTemplateVarsByObsEventType(eventType, normalizedData)
  return { eventType, normalizedData }
}

function shouldApplyAutomationMessage(data, pageName = 'custom-frontend') {
  if (!data || typeof data !== 'object') return false
  const targetPage = typeof data.targetPage === 'string' ? data.targetPage.trim().toLowerCase() : ''
  if (targetPage && targetPage !== 'all' && targetPage !== pageName) return false
  const targetWindowId = typeof data.targetWindowId === 'string' ? data.targetWindowId.trim() : ''
  if (targetWindowId && targetWindowId !== currentFrontendWindowId) return false
  return true
}

function parseAutomationPatchObject(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) return input
  if (typeof input === 'string' && input.trim()) {
    try {
      const parsed = JSON.parse(input)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {
      return {}
    }
  }
  return {}
}

function toCssLength(value, fallback = null) {
  if (value == null || value === '') return fallback
  if (typeof value === 'number' && Number.isFinite(value)) return `${Math.round(value)}px`
  const raw = String(value).trim()
  if (!raw) return fallback
  if (/^-?\d+(\.\d+)?$/.test(raw)) return `${Math.round(Number(raw))}px`
  return raw
}

function applyNestedPath(target, path, value) {
  if (!target || typeof target !== 'object' || !path) return
  const parts = String(path).split('.').filter(Boolean)
  if (!parts.length) return
  let cursor = target
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {}
    cursor = cursor[key]
  }
  cursor[parts[parts.length - 1]] = value
}

function applyAutomationComponentPatch(data) {
  if (!shouldApplyAutomationMessage(data, 'custom-frontend')) return false
  const componentId = typeof data.componentId === 'string' ? data.componentId.trim() : ''
  if (!componentId) return false
  const container = document.getElementById(componentId)
  if (!container) return false

  const patch = parseAutomationPatchObject(data.patch)
  const content = container.querySelector('.custom-component-content')

  if (typeof patch.visible === 'boolean') {
    container.style.display = patch.visible ? '' : 'none'
  }
  if (patch.x != null) container.style.left = toCssLength(patch.x, container.style.left)
  if (patch.y != null) container.style.top = toCssLength(patch.y, container.style.top)
  if (patch.width != null) container.style.width = toCssLength(patch.width, container.style.width)
  if (patch.height != null) container.style.height = toCssLength(patch.height, container.style.height)
  if (patch.zIndex != null) container.style.zIndex = String(patch.zIndex)
  if (patch.opacity != null) container.style.opacity = String(patch.opacity)

  if (patch.style && typeof patch.style === 'object') {
    Object.assign(container.style, patch.style)
  }
  if (content && patch.contentStyle && typeof patch.contentStyle === 'object') {
    Object.assign(content.style, patch.contentStyle)
  }
  if (patch.attrs && typeof patch.attrs === 'object') {
    Object.entries(patch.attrs).forEach(([k, v]) => {
      if (!k) return
      if (v == null || v === false) container.removeAttribute(k)
      else container.setAttribute(k, String(v))
    })
  }

  const classAdd = Array.isArray(patch.classAdd) ? patch.classAdd : (patch.classAdd ? [patch.classAdd] : [])
  classAdd.forEach((cls) => cls && container.classList.add(String(cls)))
  const classRemove = Array.isArray(patch.classRemove) ? patch.classRemove : (patch.classRemove ? [patch.classRemove] : [])
  classRemove.forEach((cls) => cls && container.classList.remove(String(cls)))

  if (content && patch.text != null) content.textContent = String(patch.text)
  if (content && patch.html != null) content.innerHTML = String(patch.html)
  if (content && patch.imageSrc) {
    const img = content.querySelector('img')
    if (img) img.src = String(patch.imageSrc)
  }

  if (patch.propertyPath) {
    const propertyPath = String(patch.propertyPath).trim()
    if (propertyPath.startsWith('content.') && content) {
      applyNestedPath(content, propertyPath.slice(8), patch.value)
    } else if (propertyPath.startsWith('style.')) {
      applyNestedPath(container.style, propertyPath.slice(6), patch.value)
    } else {
      applyNestedPath(container, propertyPath, patch.value)
    }
  }

  currentLayout = currentLayout && typeof currentLayout === 'object' ? currentLayout : {}
  if (!currentLayout[componentId]) currentLayout[componentId] = {}
  currentLayout[componentId] = Object.assign({}, currentLayout[componentId], {
    x: parseInt(container.style.left || container.offsetLeft || 0, 10),
    y: parseInt(container.style.top || container.offsetTop || 0, 10),
    width: container.style.width || `${container.offsetWidth}px`,
    height: container.style.height || `${container.offsetHeight}px`
  })

  return true
}

function applyAutomationCustomEvent(data) {
  if (!shouldApplyAutomationMessage(data, 'custom-frontend')) return false
  const eventName = typeof data.eventName === 'string' && data.eventName.trim()
    ? data.eventName.trim()
    : 'automation:custom-event'
  const payload = parseAutomationPatchObject(data.payload)
  const merged = {
    ...payload,
    eventType: eventName,
    type: eventName
  }
  refreshCustomComponentTemplateVars(merged)
  refreshCustomComponentsByTemplate(merged)
  return true
}

function toCssSize(value, fallbackValue, allowAuto = true) {
  const valueToUse = (value == null || value === '') ? fallbackValue : value
  if (valueToUse == null || valueToUse === '') return allowAuto ? 'auto' : '0px'
  if (typeof valueToUse === 'number' && Number.isFinite(valueToUse)) {
    return `${Math.max(1, Math.round(valueToUse))}px`
  }
  const raw = String(valueToUse).trim()
  if (!raw) return allowAuto ? 'auto' : '0px'
  if (allowAuto && raw.toLowerCase() === 'auto') return 'auto'
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return `${Math.max(1, Math.round(Number(raw)))}px`
  }
  return raw
}

function toCoord(value, fallbackValue) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : fallbackValue
}

function buildLegacyComponentHtml(comp) {
  if (!comp || typeof comp !== 'object') return ''
  if (comp.type === 'text') {
    const styles = [
      `font-size: ${comp.fontSize || 16}px`,
      `font-weight: ${comp.fontWeight || 'normal'}`,
      `color: ${comp.color || '#ffffff'}`,
      `text-align: ${comp.textAlign || 'left'}`,
      `background-color: ${comp.backgroundColor || 'transparent'}`,
      'padding: 8px 12px',
      'border-radius: 4px',
      'width: 100%',
      'height: 100%',
      'box-sizing: border-box'
    ]
    return `<div style="${styles.join('; ')}">${comp.content || ''}</div>`
  }
  if (comp.type === 'image') {
    const src = comp.imageData || comp.imageUrl || ''
    if (!src) return ''
    const fit = normalizeImageFitOption(comp.objectFit) || 'contain'
    return `<img src="${src}" style="width: 100%; height: 100%; object-fit: ${fit}; display: block;" draggable="false" />`
  }
  return ''
}

function getComponentLabel(comp) {
  if (!comp || typeof comp !== 'object') return '组件'
  const baseName = (typeof comp.name === 'string' && comp.name.trim()) ? comp.name.trim() : comp.id
  const typeMap = { text: '文本', image: '图片', html: 'HTML' }
  const typeLabel = typeMap[comp.type] || '组件'
  return `${baseName} (${typeLabel})`
}

async function persistLayout() {
  try {
    currentLayout = currentLayout && typeof currentLayout === 'object' ? currentLayout : {}
    if (!Array.isArray(currentLayout.customComponents)) {
      currentLayout.customComponents = customComponentsLoaded
    }
    await window.electronAPI.saveLayout(currentLayout)
  } catch (e) {
    console.error('[Custom Frontend] 保存布局失败:', e?.message || e)
  }
}

function toggleCustomEditMode(forceValue = null) {
  editMode = typeof forceValue === 'boolean' ? forceValue : !editMode
  document.body.classList.toggle('editing', editMode)
  document.querySelectorAll('.custom-component').forEach(el => {
    el.classList.toggle('editing', editMode)
  })
}

function setupComponentEditorInteractions(container) {
  if (!container || container.dataset.editorBound === '1') return
  container.dataset.editorBound = '1'

  let isDragging = false
  let isResizing = false
  let resizeDir = ''
  let startX = 0
  let startY = 0
  let startLeft = 0
  let startTop = 0
  let startWidth = 0
  let startHeight = 0

  const onMouseMove = (e) => {
    if (!editMode || (!isDragging && !isResizing)) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY

    if (isDragging) {
      container.style.left = `${startLeft + dx}px`
      container.style.top = `${startTop + dy}px`
      return
    }

    let nextLeft = startLeft
    let nextTop = startTop
    let nextWidth = startWidth
    let nextHeight = startHeight

    if (resizeDir.includes('e')) nextWidth = startWidth + dx
    if (resizeDir.includes('w')) {
      nextWidth = startWidth - dx
      nextLeft = startLeft + dx
    }
    if (resizeDir.includes('s')) nextHeight = startHeight + dy
    if (resizeDir.includes('n')) {
      nextHeight = startHeight - dy
      nextTop = startTop + dy
    }

    if (nextWidth >= 40) {
      container.style.width = `${Math.round(nextWidth)}px`
      container.style.left = `${Math.round(nextLeft)}px`
    }
    if (nextHeight >= 24) {
      container.style.height = `${Math.round(nextHeight)}px`
      container.style.top = `${Math.round(nextTop)}px`
    }
  }

  const onMouseUp = async () => {
    if (!isDragging && !isResizing) return
    isDragging = false
    isResizing = false
    resizeDir = ''
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)

    if (!currentLayout || typeof currentLayout !== 'object') currentLayout = {}
    if (!currentLayout[container.id] || typeof currentLayout[container.id] !== 'object') {
      currentLayout[container.id] = {}
    }
    currentLayout[container.id] = Object.assign({}, currentLayout[container.id], {
      x: Math.round(container.offsetLeft),
      y: Math.round(container.offsetTop),
      width: Math.round(container.offsetWidth),
      height: Math.round(container.offsetHeight)
    })
    await persistLayout()
  }

  container.addEventListener('mousedown', (e) => {
    if (!editMode || e.button !== 0) return
    const handle = e.target.closest('.resize-handle')

    isDragging = !handle
    isResizing = !!handle
    resizeDir = handle ? String(handle.dataset.dir || '') : ''

    startX = e.clientX
    startY = e.clientY
    startLeft = container.offsetLeft
    startTop = container.offsetTop
    startWidth = container.offsetWidth
    startHeight = container.offsetHeight

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    e.preventDefault()
    e.stopPropagation()
  })
}

function setupComponentBehaviorInteractions(container, comp) {
  if (!container || !comp || !comp.id) return
  container.dataset.behaviorCompId = comp.id
  if (container.dataset.behaviorBound === '1') return
  container.dataset.behaviorBound = '1'

  const fire = (eventType, event) => {
    if (editMode) return
    const componentId = container.dataset.behaviorCompId || ''
    const latestComp = customComponentsLoaded.find(item => item && item.id === componentId)
    if (!latestComp) return
    const payload = {
      componentId,
      eventName: eventType,
      x: event && Number.isFinite(event.clientX) ? event.clientX : 0,
      y: event && Number.isFinite(event.clientY) ? event.clientY : 0,
      button: event && Number.isFinite(event.button) ? event.button : 0
    }
    triggerComponentBehaviorForSingle(latestComp, eventType, payload, 0).catch((error) => {
      console.warn('[Custom Frontend] 组件触发失败:', error?.message || error)
    })
  }

  container.addEventListener('click', (event) => fire('component:click', event))
  container.addEventListener('dblclick', (event) => fire('component:dblclick', event))
  container.addEventListener('mouseenter', (event) => fire('component:mouseenter', event))
  container.addEventListener('mouseleave', (event) => fire('component:mouseleave', event))
}

function ensureComponentEditorShell(container, comp) {
  if (!container) return

  let label = container.querySelector('.control-label')
  if (!label) {
    label = document.createElement('div')
    label.className = 'control-label'
    container.appendChild(label)
  }
  label.textContent = getComponentLabel(comp)

  const handles = ['nw', 'ne', 'sw', 'se']
  handles.forEach(dir => {
    if (container.querySelector(`.resize-handle.${dir}`)) return
    const handle = document.createElement('div')
    handle.className = `resize-handle ${dir}`
    handle.dataset.dir = dir
    container.appendChild(handle)
  })

  setupComponentEditorInteractions(container)
}

function applyCustomComponentContent(container, comp, eventData = {}) {
  const content = container.querySelector('.custom-component-content')
  if (!content) return
  const runtimeState = getComponentBehaviorRuntime(comp.id)
  const templateScope = buildBehaviorTemplateScope(comp, runtimeState, eventData?.eventType || eventData?.type || '')

  const styleId = `custom-window-css-${comp.id}`
  const rawCss = typeof comp.customCss === 'string' ? comp.customCss : ''
  let styleEl = document.getElementById(styleId)
  if (rawCss) {
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = resolveCustomComponentTemplate(rawCss, eventData, templateScope)
  } else if (styleEl) {
    styleEl.remove()
  }

  let htmlContent = comp.html || buildLegacyComponentHtml(comp) || '<div style="padding:10px;color:#aaa;">空组件</div>'
  htmlContent = resolveCustomComponentTemplate(htmlContent, eventData, templateScope)

  if (comp.type === 'image') {
    const imgFit = normalizeImageFitOption(comp.objectFit) || 'contain'
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = htmlContent
    const img = tempDiv.querySelector('img')
    if (img) {
      img.style.width = '100%'
      img.style.height = '100%'
      img.style.objectFit = imgFit
      img.style.display = 'block'
      const fallbackSrc = resolveCustomComponentTemplate(comp.imageData || comp.imageUrl || '', eventData, templateScope)
      if ((!img.src || img.src.includes('null') || img.src.includes('undefined')) && fallbackSrc) {
        img.src = fallbackSrc
      }
      htmlContent = tempDiv.innerHTML
    } else {
      const src = resolveCustomComponentTemplate(comp.imageData || comp.imageUrl || '', eventData, templateScope)
      htmlContent = src
        ? `<img src="${src}" style="width: 100%; height: 100%; object-fit: ${imgFit}; display: block;" draggable="false" />`
        : '<div style="padding:10px;color:#aaa;">空图片组件</div>'
    }
  }

  content.innerHTML = htmlContent
}

function getComponentBounds(comp, idx = 0) {
  const layoutPos = (currentLayout && currentLayout[comp.id] && typeof currentLayout[comp.id] === 'object')
    ? currentLayout[comp.id]
    : {}

  const x = toCoord(layoutPos.x, toCoord(comp.x, 40 + (idx % 8) * 24))
  const y = toCoord(layoutPos.y, toCoord(comp.y, 40 + (idx % 6) * 24))
  const width = toCssSize(layoutPos.width, comp.width || 200, true)
  const height = toCssSize(layoutPos.height, comp.height || (comp.type === 'text' ? 'auto' : 100), true)

  return { x, y, width, height }
}

function upsertCustomComponent(comp, idx = 0, eventData = lastTemplateEventData) {
  if (!comp || !comp.id) return
  const root = document.getElementById('customFrontendRoot')
  if (!root) return

  let container = document.getElementById(comp.id)
  let created = false
  if (!container) {
    created = true
    container = document.createElement('div')
    container.id = comp.id
    container.className = 'custom-component'
    container.dataset.componentType = comp.type || 'html'
    const content = document.createElement('div')
    content.className = 'custom-component-content'
    root.appendChild(container)
    container.appendChild(content)
  }

  const bounds = getComponentBounds(comp, idx)
  container.style.left = `${bounds.x}px`
  container.style.top = `${bounds.y}px`
  container.style.width = bounds.width
  container.style.height = bounds.height
  container.classList.toggle('editing', editMode)
  ensureComponentEditorShell(container, comp)
  setupComponentBehaviorInteractions(container, comp)

  applyCustomComponentContent(container, comp, eventData)

  if (created || container.dataset.behaviorInit !== '1') {
    container.dataset.behaviorInit = '1'
    triggerComponentBehaviorForSingle(comp, 'component:init', {
      componentId: comp.id,
      eventName: 'component:init'
    }, 0).catch((error) => {
      console.warn('[Custom Frontend] 组件初始化触发失败:', error?.message || error)
    })
  }
}

function renderCustomComponents(eventData = lastTemplateEventData) {
  const normalizedData = normalizeTemplateEventData(eventData)
  if (normalizedData && typeof normalizedData === 'object') {
    lastTemplateEventData = normalizedData
  }

  const targets = customComponentsLoaded.filter(isComponentTargetForCurrentFrontendWindow)
  const targetIdSet = new Set(targets.map(comp => comp.id))

  document.querySelectorAll('.custom-component').forEach(node => {
    if (!targetIdSet.has(node.id)) {
      const styleEl = document.getElementById(`custom-window-css-${node.id}`)
      if (styleEl) styleEl.remove()
      componentBehaviorRuntimeMap.delete(node.id)
      node.remove()
    }
  })

  targets.forEach((comp, idx) => upsertCustomComponent(comp, idx, normalizedData))
}

function refreshCustomComponentsByTemplate(eventData = lastTemplateEventData) {
  const normalizedData = normalizeTemplateEventData(eventData)
  if (normalizedData && typeof normalizedData === 'object') {
    lastTemplateEventData = normalizedData
  }
  customComponentsLoaded
    .filter(isComponentTargetForCurrentFrontendWindow)
    .forEach(comp => {
      const container = document.getElementById(comp.id)
      if (!container) return
      applyCustomComponentContent(container, comp, normalizedData)
    })
}

function playCustomComponentsEntrance() {
  if (!window.ASGAnimations || typeof window.ASGAnimations.playEntranceSequence !== 'function') return
  const targets = customComponentsLoaded
    .filter(isComponentTargetForCurrentFrontendWindow)
    .map(comp => comp.id)
    .filter(Boolean)
  if (!targets.length) return
  window.ASGAnimations.playEntranceSequence(targets)
}

async function loadLayoutAndRender(options = {}) {
  try {
    const result = await window.electronAPI.loadLayout()
    const layout = (result && result.success && result.layout) ? result.layout : {}
    currentLayout = layout
    customComponentsLoaded = Array.isArray(layout.customComponents) ? layout.customComponents : []
    renderCustomComponents(lastTemplateEventData)
    const shouldPlayEntrance = options.playEntrance === true
    if (shouldPlayEntrance) {
      playCustomComponentsEntrance()
      initialEntranceAnimationPlayed = true
    }
  } catch (error) {
    console.error('[Custom Frontend] 加载布局失败:', error)
  }
}

function initializeTemplateVarsByRoom(data) {
  customComponentTemplateVars = Object.assign({}, customComponentTemplateVars, {
    roomId: data?.roomId || customComponentTemplateVars.roomId || 'local-bp',
    roomName: data?.roomName || data?.roomId || customComponentTemplateVars.roomName || '',
    roomStatus: data?.localMode ? 'localbp' : (data?.status || customComponentTemplateVars.roomStatus || ''),
    bpTeamA: data?.teamAName || customComponentTemplateVars.bpTeamA || '',
    bpTeamB: data?.teamBName || customComponentTemplateVars.bpTeamB || '',
    localTeamA: data?.teamAName || customComponentTemplateVars.localTeamA || '',
    localTeamB: data?.teamBName || customComponentTemplateVars.localTeamB || ''
  })
}

async function bootstrapInitialTemplateState() {
  try {
    if (window.electronAPI && typeof window.electronAPI.invoke === 'function') {
      const state = await window.electronAPI.invoke('localBp:getState')
      if (state && state.success && state.data) {
        refreshCustomComponentTemplateVars({ type: 'state', state: state.data })
      }
    }
  } catch (e) {
    console.warn('[Custom Frontend] 初始化模板状态失败:', e?.message || e)
  }
}

async function init() {
  if (!window.electronAPI) {
    console.error('[Custom Frontend] electronAPI 不可用')
    return
  }

  document.body.classList.add('opening')
  setTimeout(() => {
    document.body.classList.remove('opening')
  }, 1800)

  await bootstrapInitialTemplateState()
  await loadLayoutAndRender({ playEntrance: true })

  if (typeof window.electronAPI.onRoomData === 'function') {
    window.electronAPI.onRoomData((data) => {
      roomData = data || null
      initializeTemplateVarsByRoom(roomData || {})
      refreshCustomComponentsByTemplate(lastTemplateEventData)
    })
  }

  if (typeof window.electronAPI.onUpdateData === 'function') {
    window.electronAPI.onUpdateData(async (data) => {
      const behaviorMeta = refreshCustomComponentTemplateVars(data) || {}
      if (behaviorMeta.eventType) {
        dispatchComponentBehaviorEvent(behaviorMeta.eventType, behaviorMeta.normalizedData || data || {}, 0).catch((error) => {
          console.warn('[Custom Frontend] 分发积木事件失败:', error?.message || error)
        })
      }

      if (data && data.type === 'automation-component-patch') {
        applyAutomationComponentPatch(data)
        return
      }

      if (data && data.type === 'automation-custom-event') {
        applyAutomationCustomEvent(data)
        return
      }

      if (data && data.type === 'layout-updated') {
        await loadLayoutAndRender()
        return
      }

      if (data && data.type === 'custom-components-updated') {
        if (Array.isArray(data.components)) {
          customComponentsLoaded = data.components
          renderCustomComponents(data)
          if (!initialEntranceAnimationPlayed) {
            playCustomComponentsEntrance()
            initialEntranceAnimationPlayed = true
          }
        } else {
          await loadLayoutAndRender()
        }
        return
      }

      refreshCustomComponentsByTemplate(data)
    })
  }

  if (typeof window.electronAPI.onToggleEditMode === 'function') {
    window.electronAPI.onToggleEditMode(() => {
      toggleCustomEditMode()
    })
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'F2') return
    e.preventDefault()
    e.stopPropagation()
    toggleCustomEditMode()
  }, true)
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => console.error('[Custom Frontend] 初始化失败:', err))
})
