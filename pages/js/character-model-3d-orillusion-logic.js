; (function () {
  const SLOT_CONFIGS = [
    { key: 'scene', label: '场景', roleType: 'scene' },
    { key: 'light1', label: '光源1', roleType: 'light' },
    { key: 'video1', label: '视频屏幕', roleType: 'video' },
    { key: 'survivor1', label: '求生者1', roleType: 'survivor' },
    { key: 'survivor2', label: '求生者2', roleType: 'survivor' },
    { key: 'survivor3', label: '求生者3', roleType: 'survivor' },
    { key: 'survivor4', label: '求生者4', roleType: 'survivor' },
    { key: 'hunter', label: '监管者', roleType: 'hunter' }
  ]
  const CAMERA_EPSILON_RADIUS = 1e-6
  const CAMERA_ZOOM_FACTOR = 0.00105
  const DEFAULT_LAYOUT = {
    mode: 'edit',
    maxFps: 60,
    survivorScale: 1,
    hunterScale: 1.1,
    scene: { modelPath: '', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
    slots: {
      light1: { position: { x: 0, y: 4.2, z: 3.2 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      video1: { position: { x: 0, y: 1.4, z: -1.8 }, rotation: { x: 0, y: 180, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      survivor1: { position: { x: -2.4, y: 0, z: 0.8 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      survivor2: { position: { x: -0.8, y: 0, z: 1.0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      survivor3: { position: { x: 0.8, y: 0, z: 1.0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      survivor4: { position: { x: 2.4, y: 0, z: 0.8 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      hunter: { position: { x: 0, y: 0, z: -2.2 }, rotation: { x: 0, y: 180, z: 0 }, scale: { x: 1.1, y: 1.1, z: 1.1 } }
    },
    lights: { light1: { color: '#fff1d6', intensity: 2.4 } },
    camera: { position: { x: 0, y: 2, z: 8 }, target: { x: 0, y: 1, z: 0 } }
  }

  const state = {
    layout: JSON.parse(JSON.stringify(DEFAULT_LAYOUT)),
    selectedSlot: 'survivor1',
    bp: { survivors: [null, null, null, null], hunter: null },
    slotModelPaths: {},
    slotDisplayNames: {},
    roleModelPathCache: {}
  }
  const dom = {
    renderRoot: document.getElementById('renderRoot'),
    statusBar: document.getElementById('statusBar'),
    fpsBadge: document.getElementById('fpsBadge'),
    slotTabs: document.getElementById('slotTabs'),
    modeToggleBtn: document.getElementById('modeToggleBtn'),
    sceneImportBtn: document.getElementById('sceneImportBtn'),
    sceneClearBtn: document.getElementById('sceneClearBtn'),
    applyTransformBtn: document.getElementById('applyTransformBtn'),
    focusSelectedBtn: document.getElementById('focusSelectedBtn'),
    posX: document.getElementById('posX'),
    posY: document.getElementById('posY'),
    posZ: document.getElementById('posZ'),
    rotX: document.getElementById('rotX'),
    rotY: document.getElementById('rotY'),
    rotZ: document.getElementById('rotZ'),
    uniScale: document.getElementById('uniScale'),
    lightColor: document.getElementById('lightColor'),
    lightIntensity: document.getElementById('lightIntensity'),
    applyLightBtn: document.getElementById('applyLightBtn'),
    maxFps: document.getElementById('maxFps'),
    cameraMoveStep: document.getElementById('cameraMoveStep')
  }

  let O = null, scene = null, view = null, root = null, cameraObj = null, cameraComp = null, lightObj = null, lightComp = null, rafId = 0, saveTimer = null
  const slotRuntime = new Map()
  const orbit = { target: { x: 0, y: 1, z: 0 }, desiredTarget: { x: 0, y: 1, z: 0 }, yaw: 0, desiredYaw: 0, pitch: 0.18, desiredPitch: 0.18, radius: 8, desiredRadius: 8, smoothing: 0.2, dragging: false, panning: false, lastX: 0, lastY: 0 }
  const cameraMoveState = { dir: '', activeBtn: null }
  const keyState = new Set()
  const fpsState = { lastAt: 0, accum: 0, frames: 0 }
  const debugState = { bootstrapReady: false, sceneModelLoaded: false }

  const setStatus = (t) => { if (dom.statusBar) dom.statusBar.textContent = t || '' }
  const logInfo = (...args) => { try { console.log('[CharacterModel3D-Orillusion]', ...args) } catch {} }
  const logWarn = (...args) => { try { console.warn('[CharacterModel3D-Orillusion]', ...args) } catch {} }
  const n = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f
  const c = (v, min, max) => Math.max(min, Math.min(max, v))
  const deg = (r) => r * 180 / Math.PI
  const rad = (d) => d * Math.PI / 180
  const v3 = (x, y, z) => new O.Vector3(x, y, z)
  const ext = (p) => { const s = String(p || '').toLowerCase(); const i = s.lastIndexOf('.'); return i > -1 ? s.slice(i) : '' }
  const normUrl = (raw) => { const v = String(raw || '').trim(); if (!v) return ''; if (/^(https?:|file:)/i.test(v)) return v; let p = v.replace(/\\/g, '/'); if (/^[a-zA-Z]:\//.test(p)) p = '/' + p; return 'file://' + p.split('/').map(encodeURIComponent).join('/') }
  const asVec3 = (src, fb) => ({
    x: n(src?.x, fb?.x ?? 0),
    y: n(src?.y, fb?.y ?? 0),
    z: n(src?.z, fb?.z ?? 0)
  })
  function normalizeLayout(input) {
    const base = (input && typeof input === 'object') ? input : {}
    const out = JSON.parse(JSON.stringify(DEFAULT_LAYOUT))
    out.mode = base.mode === 'render' ? 'render' : 'edit'
    out.maxFps = c(n(base.maxFps, out.maxFps), 10, 240)
    out.survivorScale = Math.max(0.001, n(base.survivorScale, out.survivorScale))
    out.hunterScale = Math.max(0.001, n(base.hunterScale, out.hunterScale))
    out.scene.modelPath = String(base?.scene?.modelPath || '')
    out.scene.position = asVec3(base?.scene?.position, out.scene.position)
    out.scene.rotation = asVec3(base?.scene?.rotation, out.scene.rotation)
    out.scene.scale = asVec3(base?.scene?.scale, out.scene.scale)
    out.camera.position = asVec3(base?.camera?.position, out.camera.position)
    out.camera.target = asVec3(base?.camera?.target, out.camera.target)
    out.lights.light1.color = String(base?.lights?.light1?.color || out.lights.light1.color)
    out.lights.light1.intensity = Math.max(0, n(base?.lights?.light1?.intensity, out.lights.light1.intensity))
    SLOT_CONFIGS.forEach((cfg) => {
      if (cfg.key === 'scene') return
      out.slots[cfg.key].position = asVec3(base?.slots?.[cfg.key]?.position, out.slots[cfg.key].position)
      out.slots[cfg.key].rotation = asVec3(base?.slots?.[cfg.key]?.rotation, out.slots[cfg.key].rotation)
      out.slots[cfg.key].scale = asVec3(base?.slots?.[cfg.key]?.scale, out.slots[cfg.key].scale)
    })
    return out
  }
  function scheduleSave() { if (saveTimer) clearTimeout(saveTimer); saveTimer = setTimeout(async () => { if (!window.electronAPI?.invoke) return; try { await window.electronAPI.invoke('localBp:saveCharacterModel3DLayout', state.layout) } catch {} }, 250) }
  async function loadScript(src) { return new Promise((resolve) => { const s = document.createElement('script'); s.src = src; s.onload = () => resolve(true); s.onerror = () => resolve(false); document.head.appendChild(s) }) }
  let fallbackInjected = false
  async function fallbackToThree(reason, error) {
    if (fallbackInjected) return
    fallbackInjected = true
    try {
      window.__asgCharacter3DBackend = 'three-fallback'
      window.__asgCharacter3DFallbackReason = String(reason || 'unknown')
    } catch {}
    try {
      console.warn('[CharacterModel3D-Orillusion] fallback to three.js:', reason, error || '')
    } catch {}
    setStatus(`orillusion 不可用，已回退 three.js: ${reason}`)
    const ok = await loadScript('./js/character-model-3d-logic.js')
    if (!ok) setStatus('orillusion 与 three.js 回退均失败，请检查依赖文件')
  }

  async function ensureRuntime() {
    if (window.Orillusion?.Engine3D) { O = window.Orillusion; return true }
    const ok = await loadScript('../node_modules/@orillusion/core/dist/orillusion.umd.js')
    if (!ok) return false
    O = window.Orillusion
    return !!O?.Engine3D
  }

  function applyObjTransform(obj, tr) {
    if (!obj || !tr) return
    obj.localPosition = v3(n(tr.position?.x), n(tr.position?.y), n(tr.position?.z))
    obj.localRotation = v3(rad(n(tr.rotation?.x)), rad(n(tr.rotation?.y)), rad(n(tr.rotation?.z)))
    obj.localScale = v3(n(tr.scale?.x, 1), n(tr.scale?.y, 1), n(tr.scale?.z, 1))
  }
  function applyGroupTransform(key) {
    const rt = slotRuntime.get(key); if (!rt) return
    const tr = key === 'scene'
      ? (state.layout.scene || DEFAULT_LAYOUT.scene)
      : (state.layout.slots?.[key] || DEFAULT_LAYOUT.slots[key])
    if (!tr) return
    const t = JSON.parse(JSON.stringify(tr))
    if (key.startsWith('survivor')) t.scale = { x: state.layout.survivorScale, y: state.layout.survivorScale, z: state.layout.survivorScale }
    if (key === 'hunter') t.scale = { x: state.layout.hunterScale, y: state.layout.hunterScale, z: state.layout.hunterScale }
    applyObjTransform(rt.group, t)
  }
  function applyLight() {
    if (!lightObj || !lightComp) return
    const cfg = state.layout.lights.light1
    lightComp.intensity = Math.max(0, n(cfg.intensity, 2.4))
    const color = new O.Color(); color.setHex(String(cfg.color || '#fff1d6')); lightComp.lightColor = color
    applyObjTransform(lightObj, state.layout.slots.light1)
  }
  function applyOrbitFromLayout() {
    const p = state.layout.camera.position, t = state.layout.camera.target
    const dx = p.x - t.x, dy = p.y - t.y, dz = p.z - t.z
    orbit.target = { ...t }; orbit.desiredTarget = { ...t }
    orbit.radius = Math.max(CAMERA_EPSILON_RADIUS, Math.sqrt(dx * dx + dy * dy + dz * dz))
    orbit.desiredRadius = orbit.radius; orbit.yaw = Math.atan2(dx, dz); orbit.desiredYaw = orbit.yaw
    orbit.pitch = Math.asin(c(dy / Math.max(0.0001, orbit.radius), -0.99, 0.99)); orbit.desiredPitch = orbit.pitch
  }
  function updateCamera(force = false) {
    const k = force ? 1 : orbit.smoothing
    orbit.yaw += (orbit.desiredYaw - orbit.yaw) * k
    orbit.pitch += (orbit.desiredPitch - orbit.pitch) * k
    orbit.radius += (orbit.desiredRadius - orbit.radius) * k
    orbit.target.x += (orbit.desiredTarget.x - orbit.target.x) * k
    orbit.target.y += (orbit.desiredTarget.y - orbit.target.y) * k
    orbit.target.z += (orbit.desiredTarget.z - orbit.target.z) * k
    const cp = Math.cos(orbit.pitch)
    const pos = v3(orbit.target.x + orbit.radius * Math.sin(orbit.yaw) * cp, orbit.target.y + orbit.radius * Math.sin(orbit.pitch), orbit.target.z + orbit.radius * Math.cos(orbit.yaw) * cp)
    const tar = v3(orbit.target.x, orbit.target.y, orbit.target.z)
    cameraObj.localPosition = pos
    cameraComp.lookAt(pos, tar, O.Vector3.UP)
  }
  function saveCamera() {
    const cp = Math.cos(orbit.pitch)
    state.layout.camera.position = { x: orbit.target.x + orbit.radius * Math.sin(orbit.yaw) * cp, y: orbit.target.y + orbit.radius * Math.sin(orbit.pitch), z: orbit.target.z + orbit.radius * Math.cos(orbit.yaw) * cp }
    state.layout.camera.target = { ...orbit.target }
    scheduleSave()
  }
  function applyLayout() {
    SLOT_CONFIGS.forEach(s => applyGroupTransform(s.key))
    applyLight(); applyOrbitFromLayout(); updateCamera(true)
    O.Engine3D.frameRate = c(n(state.layout.maxFps, 60), 10, 240)
  }

  function createBootstrapScene() {
    if (!O || !root || debugState.bootstrapReady) return
    try {
      const floorObj = new O.Object3D()
      const floorMr = floorObj.addComponent(O.MeshRenderer)
      floorMr.geometry = new O.PlaneGeometry(20, 20, 1, 1, O.Vector3.UP)
      const floorMat = new O.UnLitMaterial()
      const floorColor = new O.Color()
      floorColor.setHex('#1b2334')
      floorMat.baseColor = floorColor
      floorMr.material = floorMat
      floorObj.localPosition = v3(0, -0.001, 0)
      root.addChild(floorObj)

      const markerObj = new O.Object3D()
      const markerMr = markerObj.addComponent(O.MeshRenderer)
      markerMr.geometry = new O.BoxGeometry(0.6, 1.8, 0.6)
      const markerMat = new O.UnLitMaterial()
      const markerColor = new O.Color()
      markerColor.setHex('#5aa8ff')
      markerMat.baseColor = markerColor
      markerMr.material = markerMat
      markerObj.localPosition = v3(0, 0.9, 0)
      root.addChild(markerObj)

      try {
        const skyObj = new O.Object3D()
        const sky = skyObj.addComponent(O.AtmosphericComponent)
        sky.sunY = 0.62
        sky.sunX = 0.48
        scene.addChild(skyObj)
      } catch (skyErr) {
        logWarn('atmosphere-init-failed', skyErr?.message || skyErr)
      }

      debugState.bootstrapReady = true
      logInfo('bootstrap-scene-created')
    } catch (err) {
      logWarn('bootstrap-scene-failed', err?.message || err)
    }
  }

  function unsupportedNotice() { setStatus('orillusion 迁移版：该功能暂未映射，后续补齐') }
  function setupUnsupported() {
    ;['videoImportBtn', 'videoClearBtn', 'applyEnvironmentPresetBtn', 'particleImportBtn', 'particleClearBtn', 'applyVideoSettingsBtn'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.addEventListener('click', unsupportedNotice)
    })
  }

  function renderTabs() {
    dom.slotTabs.innerHTML = ''
    SLOT_CONFIGS.forEach((cfg) => {
      const b = document.createElement('button'); b.className = `btn ${state.selectedSlot === cfg.key ? 'active' : ''}`; b.textContent = cfg.label
      b.addEventListener('click', () => { state.selectedSlot = cfg.key; renderTabs(); syncInputs() }); dom.slotTabs.appendChild(b)
    })
  }
  function syncInputs() {
    const tr = state.selectedSlot === 'scene' ? state.layout.scene : state.layout.slots[state.selectedSlot]
    dom.posX.value = n(tr.position?.x).toFixed(3); dom.posY.value = n(tr.position?.y).toFixed(3); dom.posZ.value = n(tr.position?.z).toFixed(3)
    dom.rotX.value = n(tr.rotation?.x).toFixed(2); dom.rotY.value = n(tr.rotation?.y).toFixed(2); dom.rotZ.value = n(tr.rotation?.z).toFixed(2)
    dom.uniScale.value = (state.selectedSlot.startsWith('survivor') ? state.layout.survivorScale : state.selectedSlot === 'hunter' ? state.layout.hunterScale : n(tr.scale?.x, 1)).toFixed(3)
  }

  async function loadModel(slotKey, modelPath) {
    const rt = slotRuntime.get(slotKey); if (!rt) return
    if (!modelPath) { if (rt.model) { try { rt.group.removeChild(rt.model) } catch {} try { rt.model.destroy(true) } catch {} rt.model = null } return }
    const url = normUrl(modelPath); if (!url) return
    const e = ext(modelPath); if (!['.gltf', '.glb', '.obj'].includes(e)) { setStatus(`不支持 ${e}`); return }
    if (rt.model) { try { rt.group.removeChild(rt.model) } catch {} try { rt.model.destroy(true) } catch {} rt.model = null }
    setStatus(`加载模型: ${slotKey}`)
    logInfo('model-load-start', { slotKey, modelPath, url, ext: e })
    try {
      rt.model = e === '.obj' ? await O.Engine3D.res.loadObj(url) : await O.Engine3D.res.loadGltf(url)
      rt.group.addChild(rt.model)
      if (slotKey === 'scene') debugState.sceneModelLoaded = true
      setStatus(`加载完成: ${slotKey}`)
      logInfo('model-load-success', { slotKey, hasModel: !!rt.model })
    } catch (err) {
      setStatus(`加载失败: ${slotKey}`)
      logWarn('model-load-failed', { slotKey, modelPath, message: err?.message || String(err) })
    }
  }
  async function findOfficialModel(roleName) {
    const role = String(roleName || '').trim(); if (!role) return ''
    const key = `official:${role}`; if (state.roleModelPathCache[key]) return state.roleModelPathCache[key]
    try { const res = await window.electronAPI.invoke('localBp:getOfficialModelLocalPath', role); const p = res?.success ? String(res.path || '') : ''; if (p) { state.roleModelPathCache[key] = p; return p } } catch {}
    return ''
  }
  async function syncBpModels() {
    for (let i = 0; i < 4; i++) {
      const slot = `survivor${i + 1}`; const name = state.bp.survivors[i] || ''; const p = await findOfficialModel(name)
      state.slotDisplayNames[slot] = name; await loadModel(slot, p)
    }
    const h = state.bp.hunter || ''; const hp = await findOfficialModel(h); state.slotDisplayNames.hunter = h; await loadModel('hunter', hp)
  }

  function bindEvents() {
    renderTabs(); syncInputs(); setupUnsupported()
    dom.modeToggleBtn.addEventListener('click', () => { state.layout.mode = state.layout.mode === 'edit' ? 'render' : 'edit'; document.body.classList.toggle('edit-mode', state.layout.mode === 'edit'); scheduleSave() })
    dom.sceneImportBtn.addEventListener('click', async () => {
      const r = await window.electronAPI?.selectFileWithFilter?.({ title: '选择场景模型', properties: ['openFile'], filters: [{ name: '3D', extensions: ['gltf', 'glb', 'obj'] }] })
      const p = r?.canceled ? '' : (r?.filePaths?.[0] || ''); if (!p) return; state.layout.scene.modelPath = p; await loadModel('scene', p); scheduleSave()
    })
    dom.sceneClearBtn.addEventListener('click', async () => { state.layout.scene.modelPath = ''; await loadModel('scene', ''); scheduleSave() })
    dom.applyLightBtn.addEventListener('click', () => { state.layout.lights.light1.color = dom.lightColor.value; state.layout.lights.light1.intensity = Math.max(0, n(dom.lightIntensity.value, 2.4)); applyLight(); scheduleSave() })
    dom.maxFps.addEventListener('change', () => { state.layout.maxFps = c(n(dom.maxFps.value, 60), 10, 240); O.Engine3D.frameRate = state.layout.maxFps; scheduleSave() })
    dom.applyTransformBtn.addEventListener('click', () => {
      const tr = state.selectedSlot === 'scene' ? state.layout.scene : state.layout.slots[state.selectedSlot]
      tr.position = { x: n(dom.posX.value), y: n(dom.posY.value), z: n(dom.posZ.value) }; tr.rotation = { x: n(dom.rotX.value), y: n(dom.rotY.value), z: n(dom.rotZ.value) }
      const u = Math.max(0.001, n(dom.uniScale.value, 1))
      if (state.selectedSlot.startsWith('survivor')) state.layout.survivorScale = u
      else if (state.selectedSlot === 'hunter') state.layout.hunterScale = u
      else tr.scale = { x: u, y: u, z: u }
      applyGroupTransform(state.selectedSlot); scheduleSave()
    })
    dom.focusSelectedBtn.addEventListener('click', () => { const tr = state.selectedSlot === 'scene' ? state.layout.scene : state.layout.slots[state.selectedSlot]; orbit.target = { ...tr.position }; orbit.desiredTarget = { ...tr.position }; orbit.desiredRadius = c(orbit.desiredRadius * 0.75, 1.4, 18); saveCamera() })
    const moveBtns = Array.from(document.querySelectorAll('[data-cam-move]'))
    moveBtns.forEach((btn) => {
      btn.addEventListener('mousedown', () => { cameraMoveState.dir = btn.getAttribute('data-cam-move') || ''; cameraMoveState.activeBtn = btn; btn.classList.add('active') })
      btn.addEventListener('mouseup', () => { if (cameraMoveState.activeBtn) cameraMoveState.activeBtn.classList.remove('active'); cameraMoveState.activeBtn = null; cameraMoveState.dir = ''; saveCamera() })
      btn.addEventListener('click', () => { const d = btn.getAttribute('data-cam-move') || ''; const step = Math.max(0.001, n(dom.cameraMoveStep.value, 0.25)); const f = cameraComp.getWorldDirection(new O.Vector3()); const u = O.Vector3.UP.clone(); const r = f.clone().crossProduct(u).normalize(); const dv = new O.Vector3(); if (d === 'forward') dv.addScaledVector(f, step); if (d === 'back') dv.addScaledVector(f, -step); if (d === 'left') dv.addScaledVector(r, -step); if (d === 'right') dv.addScaledVector(r, step); if (d === 'up') dv.addScaledVector(u, step); if (d === 'down') dv.addScaledVector(u, -step); orbit.target.x += dv.x; orbit.target.y += dv.y; orbit.target.z += dv.z; orbit.desiredTarget = { ...orbit.target }; saveCamera() })
    })
    window.addEventListener('keydown', (e) => { if (e.key === 'F2') { e.preventDefault(); dom.modeToggleBtn.click(); return } keyState.add(String(e.key || '').toLowerCase()) })
    window.addEventListener('keyup', (e) => keyState.delete(String(e.key || '').toLowerCase()))
    dom.renderRoot.addEventListener('pointerdown', (e) => { if (state.layout.mode !== 'edit') return; orbit.dragging = e.button === 0 && !e.shiftKey; orbit.panning = e.button === 2 || (e.button === 0 && e.shiftKey); orbit.lastX = e.clientX; orbit.lastY = e.clientY })
    dom.renderRoot.addEventListener('pointerup', () => { orbit.dragging = false; orbit.panning = false; saveCamera() })
    dom.renderRoot.addEventListener('pointermove', (e) => { if (state.layout.mode !== 'edit' || (!orbit.dragging && !orbit.panning)) return; const dx = e.clientX - orbit.lastX; const dy = e.clientY - orbit.lastY; orbit.lastX = e.clientX; orbit.lastY = e.clientY; if (orbit.panning) { const pan = Math.max(0.001, orbit.desiredRadius * 0.0016); const f = cameraComp.getWorldDirection(new O.Vector3()); const r = f.clone().crossProduct(O.Vector3.UP).normalize(); const u = O.Vector3.UP.clone(); orbit.desiredTarget.x += (-dx * pan * r.x) + (dy * pan * u.x); orbit.desiredTarget.y += (-dx * pan * r.y) + (dy * pan * u.y); orbit.desiredTarget.z += (-dx * pan * r.z) + (dy * pan * u.z) } else { orbit.desiredYaw -= dx * 0.0048; orbit.desiredPitch = c(orbit.desiredPitch - dy * 0.0044, -1.4, 1.4) } })
    dom.renderRoot.addEventListener('wheel', (e) => { if (state.layout.mode !== 'edit') return; e.preventDefault(); orbit.desiredRadius = Math.max(CAMERA_EPSILON_RADIUS, orbit.desiredRadius * Math.pow(1 + CAMERA_ZOOM_FACTOR, e.deltaY)) }, { passive: false })
    dom.renderRoot.addEventListener('contextmenu', (e) => e.preventDefault())
    window.addEventListener('resize', () => cameraComp.perspective(45, Math.max(1e-6, dom.renderRoot.clientWidth / Math.max(1, dom.renderRoot.clientHeight)), 0.1, 5000))
    if (window.electronAPI?.onUpdateData) window.electronAPI.onUpdateData((p) => { if (p?.type === 'state' && p.state) { state.bp.survivors = (p.state.survivors || []).slice(0, 4); while (state.bp.survivors.length < 4) state.bp.survivors.push(null); state.bp.hunter = p.state.hunter || null; syncBpModels() } })
    if (window.electronAPI?.onLocalBpStateUpdate) window.electronAPI.onLocalBpStateUpdate((s) => { if (!s) return; state.bp.survivors = (s.survivors || []).slice(0, 4); while (state.bp.survivors.length < 4) state.bp.survivors.push(null); state.bp.hunter = s.hunter || null; syncBpModels() })
  }

  function tick(now) {
    rafId = requestAnimationFrame(tick)
    const prev = fpsState.lastAt || now, dtMs = Math.max(0.1, now - prev), dt = dtMs / 1000
    fpsState.lastAt = now
    if (cameraMoveState.dir) {
      const step = Math.max(0.001, n(dom.cameraMoveStep.value, 0.25)) * dt * 5.2
      const f = cameraComp.getWorldDirection(new O.Vector3()), u = O.Vector3.UP.clone(), r = f.clone().crossProduct(u).normalize(), dv = new O.Vector3()
      if (cameraMoveState.dir === 'forward') dv.addScaledVector(f, step); if (cameraMoveState.dir === 'back') dv.addScaledVector(f, -step); if (cameraMoveState.dir === 'left') dv.addScaledVector(r, -step); if (cameraMoveState.dir === 'right') dv.addScaledVector(r, step); if (cameraMoveState.dir === 'up') dv.addScaledVector(u, step); if (cameraMoveState.dir === 'down') dv.addScaledVector(u, -step)
      orbit.desiredTarget.x += dv.x; orbit.desiredTarget.y += dv.y; orbit.desiredTarget.z += dv.z
    }
    const shift = keyState.has('shift'), rs = Math.max(0.0001, dt * 1.9), ms = Math.max(0.001, n(dom.cameraMoveStep.value, 0.25)) * Math.max(0.0001, dt * 5.2)
    if (shift) { if (keyState.has('a')) orbit.desiredYaw += rs; if (keyState.has('d')) orbit.desiredYaw -= rs; if (keyState.has('w')) orbit.desiredPitch += rs; if (keyState.has('s')) orbit.desiredPitch -= rs; orbit.desiredPitch = c(orbit.desiredPitch, -1.4, 1.4) } else if (keyState.size) { const f = cameraComp.getWorldDirection(new O.Vector3()), u = O.Vector3.UP.clone(), r = f.clone().crossProduct(u).normalize(), dv = new O.Vector3(); if (keyState.has('w')) dv.add(f); if (keyState.has('s')) dv.addScaledVector(f, -1); if (keyState.has('a')) dv.addScaledVector(r, -1); if (keyState.has('d')) dv.add(r); if (keyState.has('q')) dv.addScaledVector(u, -1); if (keyState.has('e')) dv.add(u); if (dv.lengthSquared > 0) { dv.normalize().multiplyScalar(ms); orbit.desiredTarget.x += dv.x; orbit.desiredTarget.y += dv.y; orbit.desiredTarget.z += dv.z } }
    updateCamera(false)
    fpsState.accum += dtMs; fpsState.frames += 1
    if (fpsState.accum >= 500) { dom.fpsBadge.textContent = `FPS: ${(fpsState.frames * 1000 / fpsState.accum).toFixed(1)}`; fpsState.accum = 0; fpsState.frames = 0 }
  }

  async function init() {
    setStatus('加载 orillusion...')
    if (!(await ensureRuntime())) {
      await fallbackToThree('runtime-load-failed')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.display = 'block'
    canvas.style.background = '#0b1220'
    dom.renderRoot.innerHTML = ''
    dom.renderRoot.appendChild(canvas)
    logInfo('canvas-mounted', { width: dom.renderRoot.clientWidth, height: dom.renderRoot.clientHeight, dpr: window.devicePixelRatio || 1 })
    try {
      await O.Engine3D.init({ canvasConfig: { canvas } })
    } catch (err) {
      await fallbackToThree('engine-init-failed', err)
      return
    }
    logInfo('engine-init-success')
    scene = new O.Scene3D(); root = new O.Object3D(); scene.addChild(root)
    cameraObj = new O.Object3D(); cameraComp = cameraObj.addComponent(O.Camera3D); cameraComp.perspective(45, Math.max(1e-6, dom.renderRoot.clientWidth / Math.max(1, dom.renderRoot.clientHeight)), 0.1, 5000); scene.addChild(cameraObj)
    lightObj = new O.Object3D(); lightComp = lightObj.addComponent(O.DirectLight); root.addChild(lightObj)
    createBootstrapScene()
    SLOT_CONFIGS.forEach((cfg) => { const g = new O.Object3D(); g.name = `slot-${cfg.key}`; root.addChild(g); slotRuntime.set(cfg.key, { key: cfg.key, cfg, group: g, model: null }) })
    view = new O.View3D(); view.scene = scene; view.camera = cameraComp; O.Engine3D.startRenderView(view)
    logInfo('render-view-started')

    try {
      const result = await window.electronAPI?.invoke?.('localBp:getState')
      if (result?.success && result.data) {
        state.layout = normalizeLayout(result.data.characterModel3DLayout)
        state.bp.survivors = (result.data.survivors || []).slice(0, 4); while (state.bp.survivors.length < 4) state.bp.survivors.push(null)
        state.bp.hunter = result.data.hunter || null
      }
    } catch {}
    applyLayout(); bindEvents()
    await loadModel('scene', state.layout.scene.modelPath || '')
    await syncBpModels()
    setTimeout(() => {
      logInfo('post-init-check', {
        renderSize: `${dom.renderRoot.clientWidth}x${dom.renderRoot.clientHeight}`,
        slotRuntimeCount: slotRuntime.size,
        sceneModelLoaded: debugState.sceneModelLoaded,
        backend: window.__asgCharacter3DBackend || 'pending'
      })
      if (dom.renderRoot.clientWidth < 2 || dom.renderRoot.clientHeight < 2) setStatus('渲染区域尺寸异常：请检查窗口大小')
    }, 800)
    tick(performance.now())
    try {
      window.__asgCharacter3DBackend = 'orillusion-webgpu'
    } catch {}
    console.log('[CharacterModel3D] backend=orillusion-webgpu')
    setStatus('就绪（orillusion-webgpu）')
  }

  init().catch(async (err) => {
    console.error('[CharacterModel3D-Orillusion] init failed', err)
    try { setStatus(`orillusion 初始化异常: ${err?.message || String(err)}`) } catch {}
    await fallbackToThree('init-exception', err)
  })
})()
