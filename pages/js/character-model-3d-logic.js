; (function () {
  const SLOT_CONFIGS = [
    { key: 'scene', label: '场景', roleType: 'scene', index: -1 },
    { key: 'light1', label: '光源1', roleType: 'light', index: 0 },
    { key: 'survivor1', label: '求生者1', roleType: 'survivor', index: 0 },
    { key: 'survivor2', label: '求生者2', roleType: 'survivor', index: 1 },
    { key: 'survivor3', label: '求生者3', roleType: 'survivor', index: 2 },
    { key: 'survivor4', label: '求生者4', roleType: 'survivor', index: 3 },
    { key: 'hunter', label: '监管者', roleType: 'hunter', index: 0 }
  ]

  const DEFAULT_LAYOUT = {
    mode: 'edit',
    transparentBackground: true,
    scene: {
      modelPath: '',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    },
    slots: {
      light1: { position: { x: 0, y: 4.2, z: 3.2 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      survivor1: { position: { x: -2.4, y: 0, z: 0.8 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      survivor2: { position: { x: -0.8, y: 0, z: 1.0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      survivor3: { position: { x: 0.8, y: 0, z: 1.0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      survivor4: { position: { x: 2.4, y: 0, z: 0.8 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      hunter: { position: { x: 0, y: 0, z: -2.2 }, rotation: { x: 0, y: 180, z: 0 }, scale: { x: 1.1, y: 1.1, z: 1.1 } }
    },
    lights: {
      light1: {
        color: '#fff1d6',
        intensity: 2.4,
        distance: 0,
        decay: 2
      }
    },
    camera: {
      position: { x: 0, y: 2, z: 8 },
      target: { x: 0, y: 1, z: 0 }
    }
  }

  const state = {
    bp: {
      survivors: [null, null, null, null],
      hunter: null
    },
    officialModelMap: {},
    layout: deepClone(DEFAULT_LAYOUT),
    selectedSlot: 'survivor1',
    slotModelPaths: {},
    slotDisplayNames: {},
    roleModelPathCache: {}
  }

  let THREE = null
  let renderer = null
  let scene = null
  let camera = null
  let root = null
  let grid = null
  let axes = null
  let gltfLoader = null
  const slotRuntime = new Map()
  const mixers = new Map()
  const lightRigs = new Map()
  let rafId = 0
  let clock = null
  let saveTimer = null

  const orbit = {
    target: { x: 0, y: 1, z: 0 },
    yaw: 0,
    pitch: 0.18,
    radius: 8,
    dragging: false,
    panning: false,
    lastX: 0,
    lastY: 0
  }

  const dom = {
    toolbar: document.getElementById('toolbar'),
    renderRoot: document.getElementById('renderRoot'),
    statusBar: document.getElementById('statusBar'),
    modeToggleBtn: document.getElementById('modeToggleBtn'),
    sceneImportBtn: document.getElementById('sceneImportBtn'),
    sceneClearBtn: document.getElementById('sceneClearBtn'),
    slotTabs: document.getElementById('slotTabs'),
    posX: document.getElementById('posX'),
    posY: document.getElementById('posY'),
    posZ: document.getElementById('posZ'),
    rotX: document.getElementById('rotX'),
    rotY: document.getElementById('rotY'),
    rotZ: document.getElementById('rotZ'),
    uniScale: document.getElementById('uniScale'),
    applyTransformBtn: document.getElementById('applyTransformBtn')
    , lightColor: document.getElementById('lightColor')
    , lightIntensity: document.getElementById('lightIntensity')
    , applyLightBtn: document.getElementById('applyLightBtn')
  }

  function deepClone(v) {
    return JSON.parse(JSON.stringify(v))
  }

  function setStatus(text) {
    if (dom.statusBar) dom.statusBar.textContent = text || ''
  }

  function asNumber(value, fallback = 0) {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }

  function ensureVec3(input, fallback = { x: 0, y: 0, z: 0 }) {
    const src = (input && typeof input === 'object') ? input : {}
    return {
      x: asNumber(src.x, fallback.x),
      y: asNumber(src.y, fallback.y),
      z: asNumber(src.z, fallback.z)
    }
  }

  function normalizeLayout(raw) {
    const base = (raw && typeof raw === 'object') ? raw : {}
    const out = deepClone(DEFAULT_LAYOUT)
    out.mode = base.mode === 'render' ? 'render' : 'edit'
    out.transparentBackground = base.transparentBackground !== false
    out.scene.modelPath = typeof base?.scene?.modelPath === 'string' ? base.scene.modelPath : ''
    out.scene.position = ensureVec3(base?.scene?.position, out.scene.position)
    out.scene.rotation = ensureVec3(base?.scene?.rotation, out.scene.rotation)
    out.scene.scale = ensureVec3(base?.scene?.scale, out.scene.scale)
    for (const cfg of SLOT_CONFIGS) {
      if (cfg.key === 'scene') continue
      const fallback = out.slots[cfg.key]
      const rawScale = ensureVec3(base?.slots?.[cfg.key]?.scale, fallback.scale)
      const uniform = Math.max(0.001, asNumber(rawScale.x, asNumber(rawScale.y, asNumber(rawScale.z, 1))))
      out.slots[cfg.key] = {
        position: ensureVec3(base?.slots?.[cfg.key]?.position, fallback.position),
        rotation: ensureVec3(base?.slots?.[cfg.key]?.rotation, fallback.rotation),
        scale: { x: uniform, y: uniform, z: uniform }
      }
    }
    out.lights = deepClone(DEFAULT_LAYOUT.lights)
    out.lights.light1.color = typeof base?.lights?.light1?.color === 'string' ? base.lights.light1.color : out.lights.light1.color
    out.lights.light1.intensity = Math.max(0, asNumber(base?.lights?.light1?.intensity, out.lights.light1.intensity))
    out.lights.light1.distance = Math.max(0, asNumber(base?.lights?.light1?.distance, out.lights.light1.distance))
    out.lights.light1.decay = Math.max(0, asNumber(base?.lights?.light1?.decay, out.lights.light1.decay))
    out.camera.position = ensureVec3(base?.camera?.position, out.camera.position)
    out.camera.target = ensureVec3(base?.camera?.target, out.camera.target)
    return out
  }

  function toRadians(deg) {
    return (asNumber(deg, 0) * Math.PI) / 180
  }

  function toDegrees(rad) {
    return (asNumber(rad, 0) * 180) / Math.PI
  }

  function normalizeFileUrl(value) {
    if (!value) return ''
    const src = String(value)
    if (/^(https?:|file:|data:)/i.test(src)) return src
    if (src.startsWith('/official-models/')) return `file://${encodeURI(src)}`
    if (/^[a-zA-Z]:[\\/]/.test(src)) {
      const normalized = src.replace(/\\/g, '/')
      return `file:///${encodeURI(normalized)}`
    }
    if (src.startsWith('\\\\')) {
      return `file:${encodeURI(src.replace(/\\/g, '/'))}`
    }
    return src
  }

  async function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement('script')
      s.src = src
      s.async = false
      s.onload = () => resolve(true)
      s.onerror = () => resolve(false)
      document.head.appendChild(s)
    })
  }

  async function ensureThreeRuntime() {
    if (window.THREE && window.THREE.GLTFLoader) {
      THREE = window.THREE
      return true
    }
    const coreOk = await loadScript('./js/three/three.min.js')
    if (!coreOk) return false
    const gltfOk = await loadScript('./js/three/GLTFLoader.js')
    if (!gltfOk) return false
    THREE = window.THREE
    return !!(THREE && THREE.GLTFLoader)
  }

  function createSceneGraph() {
    scene = new THREE.Scene()
    const initW = dom.renderRoot.clientWidth || window.innerWidth || 1920
    const initH = dom.renderRoot.clientHeight || window.innerHeight || 1080
    camera = new THREE.PerspectiveCamera(45, initW / Math.max(1, initH), 0.1, 5000)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(initW, initH)
    camera.updateProjectionMatrix()
    dom.renderRoot.innerHTML = ''
    dom.renderRoot.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 0.75)
    scene.add(ambient)

    const dir = new THREE.DirectionalLight(0xffffff, 1.15)
    dir.position.set(6, 14, 10)
    scene.add(dir)

    const fill = new THREE.DirectionalLight(0x9fc5ff, 0.45)
    fill.position.set(-10, 8, -6)
    scene.add(fill)

    grid = new THREE.GridHelper(24, 24, 0x4caf50, 0x2d3552)
    grid.position.y = 0
    scene.add(grid)

    axes = new THREE.AxesHelper(2.2)
    scene.add(axes)

    root = new THREE.Group()
    scene.add(root)

    for (const cfg of SLOT_CONFIGS) {
      const group = new THREE.Group()
      group.name = cfg.key
      root.add(group)
      slotRuntime.set(cfg.key, {
        key: cfg.key,
        cfg,
        group,
        model: null,
        modelPath: '',
        loadingPath: '',
        loadSeq: 0
      })
      if (cfg.roleType === 'light') {
        attachLightRig(cfg.key, group)
      }
    }

    gltfLoader = new THREE.GLTFLoader()
    clock = new THREE.Clock()
  }

  function attachLightRig(key, group) {
    const light = new THREE.PointLight(0xfff1d6, 2.4, 0, 2)
    light.castShadow = false
    group.add(light)

    const bulbGeo = new THREE.SphereGeometry(0.12, 20, 16)
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6 })
    const bulbMesh = new THREE.Mesh(bulbGeo, bulbMat)
    group.add(bulbMesh)

    const haloGeo = new THREE.SphereGeometry(0.22, 18, 14)
    const haloMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.28 })
    const haloMesh = new THREE.Mesh(haloGeo, haloMat)
    group.add(haloMesh)

    lightRigs.set(key, { light, bulbMesh, haloMesh })
    applyLightSettings(key)
  }

  function applyLightSettings(key = 'light1') {
    const rig = lightRigs.get(key)
    if (!rig || !state.layout?.lights?.[key]) return
    const cfg = state.layout.lights[key]
    const intensity = Math.max(0, asNumber(cfg.intensity, 2.4))
    const color = (typeof cfg.color === 'string' && cfg.color) ? cfg.color : '#fff1d6'
    const distance = Math.max(0, asNumber(cfg.distance, 0))
    const decay = Math.max(0, asNumber(cfg.decay, 2))

    rig.light.color.set(color)
    rig.light.intensity = intensity
    rig.light.distance = distance
    rig.light.decay = decay
    rig.bulbMesh.material.color.set(color)
    rig.haloMesh.material.color.set(color)
    rig.haloMesh.material.opacity = Math.min(0.45, 0.1 + intensity * 0.08)
  }

  function syncLightInputs() {
    const cfg = state.layout?.lights?.light1
    if (!cfg) return
    if (dom.lightColor) dom.lightColor.value = cfg.color || '#fff1d6'
    if (dom.lightIntensity) dom.lightIntensity.value = String(asNumber(cfg.intensity, 2.4))
  }

  function applyOrbitFromLayout() {
    const cam = state.layout.camera
    orbit.target = { ...cam.target }
    const dx = cam.position.x - cam.target.x
    const dy = cam.position.y - cam.target.y
    const dz = cam.position.z - cam.target.z
    orbit.radius = Math.max(0.3, Math.sqrt(dx * dx + dy * dy + dz * dz))
    orbit.yaw = Math.atan2(dx, dz)
    orbit.pitch = Math.asin(Math.max(-0.99, Math.min(0.99, dy / Math.max(0.0001, orbit.radius))))
    updateCameraFromOrbit()
  }

  function updateCameraFromOrbit() {
    const cosPitch = Math.cos(orbit.pitch)
    const x = orbit.target.x + orbit.radius * Math.sin(orbit.yaw) * cosPitch
    const y = orbit.target.y + orbit.radius * Math.sin(orbit.pitch)
    const z = orbit.target.z + orbit.radius * Math.cos(orbit.yaw) * cosPitch
    camera.position.set(x, y, z)
    camera.lookAt(orbit.target.x, orbit.target.y, orbit.target.z)
  }

  function saveCameraToLayout() {
    state.layout.camera = {
      position: {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
      },
      target: {
        x: orbit.target.x,
        y: orbit.target.y,
        z: orbit.target.z
      }
    }
    scheduleSaveLayout()
  }

  function applyTransformToGroup(key, transform) {
    const runtime = slotRuntime.get(key)
    if (!runtime || !runtime.group) return
    const t = transform || {}
    const p = ensureVec3(t.position, { x: 0, y: 0, z: 0 })
    const r = ensureVec3(t.rotation, { x: 0, y: 0, z: 0 })
    const s = ensureVec3(t.scale, { x: 1, y: 1, z: 1 })
    runtime.group.position.set(p.x, p.y, p.z)
    runtime.group.rotation.set(toRadians(r.x), toRadians(r.y), toRadians(r.z))
    if (key === 'scene') {
      runtime.group.scale.set(s.x, s.y, s.z)
    } else if (key === 'light1') {
      runtime.group.scale.set(1, 1, 1)
    } else {
      const uniform = Math.max(0.001, asNumber(s.x, asNumber(s.y, asNumber(s.z, 1))))
      runtime.group.scale.set(uniform, uniform, uniform)
    }
  }

  function removeModelFromSlot(key) {
    const runtime = slotRuntime.get(key)
    if (!runtime || !runtime.group) return
    while (runtime.group.children.length) {
      const child = runtime.group.children.pop()
      disposeObject(child)
    }
    runtime.model = null
    runtime.modelPath = ''
    if (mixers.has(key)) mixers.delete(key)
  }

  function disposeObject(obj) {
    if (!obj) return
    obj.traverse((node) => {
      if (node.geometry && typeof node.geometry.dispose === 'function') {
        node.geometry.dispose()
      }
      if (node.material) {
        const mats = Array.isArray(node.material) ? node.material : [node.material]
        mats.forEach((mat) => {
          if (mat && typeof mat.dispose === 'function') mat.dispose()
        })
      }
    })
    if (obj.parent) obj.parent.remove(obj)
  }


  async function loadModelForSlot(key, modelPath) {
    const runtime = slotRuntime.get(key)
    if (!runtime) return
    const nextPath = modelPath ? String(modelPath).trim() : ''
    if (!nextPath) {
      removeModelFromSlot(key)
      return
    }
    if (runtime.modelPath === nextPath && runtime.model) return
    if (runtime.loadingPath === nextPath) return

    removeModelFromSlot(key)
    runtime.modelPath = nextPath
    runtime.loadingPath = nextPath
    runtime.loadSeq = (runtime.loadSeq || 0) + 1
    const seq = runtime.loadSeq
    const url = normalizeFileUrl(nextPath)
    if (!url) return

    const shortPath = String(modelPath).split(/[\\/]/).slice(-2).join('/')
    setStatus(`加载模型: ${runtime.cfg.label} (${shortPath})`)
    gltfLoader.load(url, (gltf) => {
      if (runtime.loadSeq !== seq) {
        // 旧请求返回，直接丢弃，避免重复实例残留
        try { if (gltf && gltf.scene) disposeObject(gltf.scene) } catch { }
        return
      }
      const obj = gltf && gltf.scene ? gltf.scene : null
      if (!obj) {
        runtime.loadingPath = ''
        setStatus(`模型无效: ${runtime.cfg.label}`)
        return
      }
      // 再次清空，保证同槽位始终只保留 1 个实例
      removeModelFromSlot(key)
      runtime.modelPath = nextPath
      runtime.model = obj
      runtime.group.add(obj)
      if (Array.isArray(gltf.animations) && gltf.animations.length) {
        const mixer = new THREE.AnimationMixer(obj)
        gltf.animations.forEach((clip) => {
          try { mixer.clipAction(clip).play() } catch { }
        })
        mixers.set(key, mixer)
      }
      runtime.loadingPath = ''
      setStatus(`加载完成: ${runtime.cfg.label}`)
    }, undefined, (error) => {
      if (runtime.loadSeq !== seq) return
      runtime.loadingPath = ''
      setStatus(`加载失败: ${runtime.cfg.label}`)
      console.error('[CharacterModel3D] 模型加载失败:', key, modelPath, error)
    })
  }

  function sanitizeRoleName(name) {
    if (!name || typeof name !== 'string') return ''
    return name.replace(/["'“”‘’]/g, '').trim()
  }

  async function findOfficialModel(roleName) {
    if (!roleName) return ''
    const clean = sanitizeRoleName(roleName)
    const cacheKey = clean || roleName
    if (Object.prototype.hasOwnProperty.call(state.roleModelPathCache, cacheKey) && state.roleModelPathCache[cacheKey]) {
      return state.roleModelPathCache[cacheKey]
    }

    // 1) 强制优先从本机 official-models 目录解析
    try {
      if (window.electronAPI && window.electronAPI.invoke) {
        const res = await window.electronAPI.invoke('localBp:getOfficialModelLocalPath', roleName)
        const localPath = (res && res.success && typeof res.path === 'string') ? res.path.trim() : ''
        const httpUrl = (res && res.success && typeof res.httpUrl === 'string') ? res.httpUrl.trim() : ''
        const resolved = httpUrl || localPath
        if (resolved) {
          state.roleModelPathCache[cacheKey] = resolved
          return resolved
        }
      }
    } catch (error) {
      console.warn('[CharacterModel3D] 获取本地官方模型失败:', roleName, error)
    }

    // 2) 不回落到远程 URL，避免网络导致加载不稳定
    return ''
  }

  async function updateRoleModelsByBp() {
    const survivors = Array.isArray(state.bp.survivors) ? state.bp.survivors : [null, null, null, null]
    for (let i = 0; i < 4; i++) {
      const roleName = survivors[i] || ''
      const slotKey = `survivor${i + 1}`
      state.slotDisplayNames[slotKey] = roleName || ''
      const modelPath = await findOfficialModel(roleName)
      state.slotModelPaths[slotKey] = modelPath || ''
      if (roleName && !modelPath) {
        setStatus(`未命中本地模型: ${slotKey} -> ${roleName}`)
      }
      await loadModelForSlot(slotKey, modelPath)
    }
    const hunterName = state.bp.hunter || ''
    state.slotDisplayNames.hunter = hunterName || ''
    const hunterModel = await findOfficialModel(hunterName)
    state.slotModelPaths.hunter = hunterModel || ''
    if (hunterName && !hunterModel) {
      setStatus(`未命中本地模型: hunter -> ${hunterName}`)
    }
    await loadModelForSlot('hunter', hunterModel)
    renderSlotTabs()
  }

  function snapshotTransformFromGroup(key) {
    const runtime = slotRuntime.get(key)
    if (!runtime || !runtime.group) return
    const g = runtime.group
    if (key === 'scene') {
      state.layout.scene.position = { x: g.position.x, y: g.position.y, z: g.position.z }
      state.layout.scene.rotation = { x: toDegrees(g.rotation.x), y: toDegrees(g.rotation.y), z: toDegrees(g.rotation.z) }
      state.layout.scene.scale = { x: g.scale.x, y: g.scale.y, z: g.scale.z }
      return
    }
    if (!state.layout.slots[key]) state.layout.slots[key] = {}
    const uniform = Math.max(0.001, asNumber(g.scale.x, 1))
    state.layout.slots[key].position = { x: g.position.x, y: g.position.y, z: g.position.z }
    state.layout.slots[key].rotation = { x: toDegrees(g.rotation.x), y: toDegrees(g.rotation.y), z: toDegrees(g.rotation.z) }
    state.layout.slots[key].scale = { x: uniform, y: uniform, z: uniform }
  }

  function getSelectedTransform() {
    if (state.selectedSlot === 'scene') {
      return state.layout.scene
    }
    return state.layout.slots[state.selectedSlot]
  }

  function syncTransformInputs() {
    const tr = getSelectedTransform()
    if (!tr) return
    dom.posX.value = asNumber(tr.position?.x, 0).toFixed(3)
    dom.posY.value = asNumber(tr.position?.y, 0).toFixed(3)
    dom.posZ.value = asNumber(tr.position?.z, 0).toFixed(3)
    dom.rotX.value = asNumber(tr.rotation?.x, 0).toFixed(1)
    dom.rotY.value = asNumber(tr.rotation?.y, 0).toFixed(1)
    dom.rotZ.value = asNumber(tr.rotation?.z, 0).toFixed(1)
    if (state.selectedSlot === 'light1') {
      dom.uniScale.value = '1.000'
      dom.uniScale.disabled = true
    } else {
      dom.uniScale.disabled = false
      dom.uniScale.value = asNumber(tr.scale?.x, 1).toFixed(3)
    }
  }

  function applyInputsToSelectedTransform() {
    const tr = {
      position: {
        x: asNumber(dom.posX.value, 0),
        y: asNumber(dom.posY.value, 0),
        z: asNumber(dom.posZ.value, 0)
      },
      rotation: {
        x: asNumber(dom.rotX.value, 0),
        y: asNumber(dom.rotY.value, 0),
        z: asNumber(dom.rotZ.value, 0)
      },
      scale: {
        x: Math.max(0.001, asNumber(dom.uniScale.value, 1)),
        y: Math.max(0.001, asNumber(dom.uniScale.value, 1)),
        z: Math.max(0.001, asNumber(dom.uniScale.value, 1))
      }
    }
    if (state.selectedSlot === 'light1') {
      tr.scale = { x: 1, y: 1, z: 1 }
    }
    if (state.selectedSlot === 'scene') {
      state.layout.scene = { ...state.layout.scene, ...tr }
    } else {
      state.layout.slots[state.selectedSlot] = { ...state.layout.slots[state.selectedSlot], ...tr }
    }
    applyTransformToGroup(state.selectedSlot, tr)
    scheduleSaveLayout()
  }

  function renderSlotTabs() {
    const html = SLOT_CONFIGS.map((cfg) => {
      let tail = ''
      if (cfg.roleType === 'survivor' || cfg.roleType === 'hunter') {
        const name = state.slotDisplayNames[cfg.key]
        tail = name ? ` · ${name}` : ''
      }
      const active = cfg.key === state.selectedSlot ? 'active' : ''
      return `<button class="slot-tab ${active}" data-slot="${cfg.key}">${cfg.label}${tail}</button>`
    }).join('')
    dom.slotTabs.innerHTML = html
    dom.slotTabs.querySelectorAll('.slot-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.selectedSlot = btn.dataset.slot || 'survivor1'
        renderSlotTabs()
        syncTransformInputs()
      })
    })
  }

  function applyLayoutToScene() {
    applyTransformToGroup('scene', state.layout.scene)
    for (const cfg of SLOT_CONFIGS) {
      if (cfg.key === 'scene') continue
      applyTransformToGroup(cfg.key, state.layout.slots[cfg.key])
    }
    applyLightSettings('light1')
    applyMode(state.layout.mode)
    applyOrbitFromLayout()
    renderSlotTabs()
    syncTransformInputs()
    syncLightInputs()
  }

  function applyMode(mode) {
    const next = mode === 'render' ? 'render' : 'edit'
    state.layout.mode = next
    document.body.classList.toggle('render-mode', next === 'render')
    document.body.classList.toggle('edit-mode', next === 'edit')
    if (grid) grid.visible = next === 'edit'
    if (axes) axes.visible = next === 'edit'
    if (dom.modeToggleBtn) {
      dom.modeToggleBtn.textContent = next === 'edit' ? '切换到渲染模式 (F2)' : '切换到编辑模式 (F2)'
    }
    scheduleSaveLayout()
  }

  function collectPersistLayout() {
    return deepClone(state.layout)
  }

  function scheduleSaveLayout() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(async () => {
      const payload = collectPersistLayout()
      try {
        if (window.electronAPI && window.electronAPI.invoke) {
          await window.electronAPI.invoke('localBp:saveCharacterModel3DLayout', payload)
        }
      } catch (error) {
        console.error('[CharacterModel3D] 保存布局失败:', error)
      }
    }, 160)
  }

  async function importSceneModel() {
    let selectedPath = ''
    try {
      if (window.electronAPI && window.electronAPI.selectFileWithFilter) {
        const result = await window.electronAPI.selectFileWithFilter({
          filters: [{ name: '3D场景', extensions: ['gltf', 'glb'] }]
        })
        if (result && result.success && result.path) {
          selectedPath = result.path
        }
      }
    } catch (error) {
      console.error('[CharacterModel3D] 选择场景文件失败:', error)
    }
    if (!selectedPath) {
      const input = window.prompt('请输入场景模型路径(URL 或本地路径):', state.layout.scene.modelPath || '')
      if (!input) return
      selectedPath = input.trim()
    }
    if (!selectedPath) return
    state.layout.scene.modelPath = selectedPath
    await loadModelForSlot('scene', selectedPath)
    scheduleSaveLayout()
  }

  async function clearSceneModel() {
    state.layout.scene.modelPath = ''
    removeModelFromSlot('scene')
    scheduleSaveLayout()
  }

  function bindUiEvents() {
    dom.modeToggleBtn.addEventListener('click', () => {
      applyMode(state.layout.mode === 'edit' ? 'render' : 'edit')
    })
    dom.sceneImportBtn.addEventListener('click', importSceneModel)
    dom.sceneClearBtn.addEventListener('click', clearSceneModel)
    dom.applyTransformBtn.addEventListener('click', applyInputsToSelectedTransform)
    if (dom.applyLightBtn) {
      dom.applyLightBtn.addEventListener('click', () => {
        if (!state.layout.lights) state.layout.lights = deepClone(DEFAULT_LAYOUT.lights)
        if (!state.layout.lights.light1) state.layout.lights.light1 = deepClone(DEFAULT_LAYOUT.lights.light1)
        state.layout.lights.light1.color = (dom.lightColor && dom.lightColor.value) ? dom.lightColor.value : '#fff1d6'
        state.layout.lights.light1.intensity = Math.max(0, asNumber(dom.lightIntensity ? dom.lightIntensity.value : 2.4, 2.4))
        applyLightSettings('light1')
        scheduleSaveLayout()
      })
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault()
        applyMode(state.layout.mode === 'edit' ? 'render' : 'edit')
        return
      }
      if (state.layout.mode !== 'edit') return
      const tag = (document.activeElement && document.activeElement.tagName || '').toUpperCase()
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const runtime = slotRuntime.get(state.selectedSlot)
      if (!runtime || !runtime.group) return
      const step = e.shiftKey ? 0.2 : 0.05
      const rotStep = e.shiftKey ? 10 : 3
      let changed = true

      if (e.key === 'ArrowUp') runtime.group.position.z -= step
      else if (e.key === 'ArrowDown') runtime.group.position.z += step
      else if (e.key === 'ArrowLeft') runtime.group.position.x -= step
      else if (e.key === 'ArrowRight') runtime.group.position.x += step
      else if (e.key === 'PageUp') runtime.group.position.y += step
      else if (e.key === 'PageDown') runtime.group.position.y -= step
      else if (e.key.toLowerCase() === 'q') runtime.group.rotation.y -= toRadians(rotStep)
      else if (e.key.toLowerCase() === 'e') runtime.group.rotation.y += toRadians(rotStep)
      else changed = false

      if (!changed) return
      e.preventDefault()
      snapshotTransformFromGroup(state.selectedSlot)
      syncTransformInputs()
      scheduleSaveLayout()
    }, true)

    window.addEventListener('resize', () => {
      if (!renderer || !camera) return
      const w = dom.renderRoot.clientWidth || window.innerWidth
      const h = dom.renderRoot.clientHeight || window.innerHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })

    dom.renderRoot.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })

    dom.renderRoot.addEventListener('mousedown', (e) => {
      if (state.layout.mode !== 'edit') return
      // 左键旋转；右键或 Shift+左键 平移
      if (e.button === 0 && !e.shiftKey) {
        orbit.dragging = true
        orbit.panning = false
      } else if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
        orbit.panning = true
        orbit.dragging = false
      } else {
        return
      }
      orbit.lastX = e.clientX
      orbit.lastY = e.clientY
      e.preventDefault()
    })

    window.addEventListener('mouseup', () => {
      if (!orbit.dragging && !orbit.panning) return
      orbit.dragging = false
      orbit.panning = false
      saveCameraToLayout()
    })

    window.addEventListener('mousemove', (e) => {
      if ((!orbit.dragging && !orbit.panning) || state.layout.mode !== 'edit') return
      const dx = e.clientX - orbit.lastX
      const dy = e.clientY - orbit.lastY
      orbit.lastX = e.clientX
      orbit.lastY = e.clientY
      if (orbit.panning) {
        const panScale = orbit.radius * 0.0018
        const forward = new THREE.Vector3()
        camera.getWorldDirection(forward)
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize()
        const up = new THREE.Vector3().copy(camera.up).normalize()
        orbit.target.x += (-dx * panScale * right.x) + (dy * panScale * up.x)
        orbit.target.y += (-dx * panScale * right.y) + (dy * panScale * up.y)
        orbit.target.z += (-dx * panScale * right.z) + (dy * panScale * up.z)
        updateCameraFromOrbit()
      } else {
        orbit.yaw -= dx * 0.0052
        orbit.pitch -= dy * 0.0048
        orbit.pitch = Math.max(-1.45, Math.min(1.45, orbit.pitch))
        updateCameraFromOrbit()
      }
    })

    dom.renderRoot.addEventListener('wheel', (e) => {
      if (state.layout.mode !== 'edit') return
      e.preventDefault()
      orbit.radius += e.deltaY * 0.008
      orbit.radius = Math.max(1.8, Math.min(80, orbit.radius))
      updateCameraFromOrbit()
      saveCameraToLayout()
    }, { passive: false })
  }

  function renderLoop() {
    rafId = requestAnimationFrame(renderLoop)
    const dt = clock.getDelta()
    for (const mixer of mixers.values()) {
      try { mixer.update(dt) } catch { }
    }
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  async function loadOfficialModelMap() {
    try {
      if (window.electronAPI && window.electronAPI.getOfficialModelMap) {
        const map = await window.electronAPI.getOfficialModelMap()
        state.officialModelMap = map && typeof map === 'object' ? map : {}
        return
      }
    } catch (error) {
      console.warn('[CharacterModel3D] 获取官方模型映射失败:', error)
    }
    state.officialModelMap = {}
  }

  function applyIncomingBpState(nextState) {
    if (!nextState || typeof nextState !== 'object') return
    const incomingSurvivors = Array.isArray(nextState.survivors)
      ? nextState.survivors
      : (Array.isArray(nextState?.currentRoundData?.selectedSurvivors) ? nextState.currentRoundData.selectedSurvivors : [null, null, null, null])
    const incomingHunter = (typeof nextState.hunter === 'string' && nextState.hunter)
      ? nextState.hunter
      : (nextState?.currentRoundData?.selectedHunter || null)

    state.bp.survivors = Array.isArray(incomingSurvivors) ? incomingSurvivors.slice(0, 4) : [null, null, null, null]
    while (state.bp.survivors.length < 4) state.bp.survivors.push(null)
    state.bp.hunter = incomingHunter || null

    // 注意：这里不覆盖本窗口相机/布局，避免切换视角后被回退。
    // 只做 BP 角色同步。
    updateRoleModelsByBp()
  }

  async function loadInitialState() {
    if (!window.electronAPI || !window.electronAPI.invoke) {
      applyLayoutToScene()
      return
    }
    try {
      const result = await window.electronAPI.invoke('localBp:getState')
      if (result && result.success && result.data) {
        const data = result.data
        state.layout = normalizeLayout(data.characterModel3DLayout)
        state.bp.survivors = Array.isArray(data.survivors) ? data.survivors.slice(0, 4) : [null, null, null, null]
        while (state.bp.survivors.length < 4) state.bp.survivors.push(null)
        state.bp.hunter = data.hunter || null
      }
    } catch (error) {
      console.error('[CharacterModel3D] 读取初始状态失败:', error)
    }
    applyLayoutToScene()
    if (state.layout.scene.modelPath) {
      await loadModelForSlot('scene', state.layout.scene.modelPath)
    }
    await updateRoleModelsByBp()
  }

  function bindRealtimeBpSync() {
    if (window.electronAPI && window.electronAPI.onUpdateData) {
      window.electronAPI.onUpdateData((packet) => {
        if (!packet || typeof packet !== 'object') return
        if (packet.type === 'state' && packet.state) {
          setStatus('收到BP同步，正在刷新模型...')
          applyIncomingBpState(packet.state)
        }
      })
    }
    if (window.electronAPI && window.electronAPI.onLocalBpStateUpdate) {
      window.electronAPI.onLocalBpStateUpdate((nextState) => {
        if (!nextState || typeof nextState !== 'object') return
        setStatus('收到本地BP状态更新，正在刷新模型...')
        applyIncomingBpState(nextState)
      })
    }
  }

  async function init() {
    setStatus('加载 three.js...')
    const ok = await ensureThreeRuntime()
    if (!ok) {
      setStatus('three.js 初始化失败')
      return
    }
    createSceneGraph()
    bindUiEvents()
    await loadOfficialModelMap()
    await loadInitialState()
    bindRealtimeBpSync()
    renderLoop()
    setStatus('就绪')
  }

  init()
})()
