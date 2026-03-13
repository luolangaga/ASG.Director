; (function () {
  const SLOT_CONFIGS = [
    { key: 'scene', label: '场景', roleType: 'scene', index: -1 },
    { key: 'light1', label: '光源1', roleType: 'light', index: 0 },
    { key: 'video1', label: '视频屏幕', roleType: 'video', index: 0 },
    { key: 'survivor1', label: '求生者1', roleType: 'survivor', index: 0 },
    { key: 'survivor2', label: '求生者2', roleType: 'survivor', index: 1 },
    { key: 'survivor3', label: '求生者3', roleType: 'survivor', index: 2 },
    { key: 'survivor4', label: '求生者4', roleType: 'survivor', index: 3 },
    { key: 'hunter', label: '监管者', roleType: 'hunter', index: 0 }
  ]
  const CAMERA_EVENT_OPTIONS = [
    { key: 'survivor1', label: '求生者选了1个' },
    { key: 'survivor2', label: '求生者选了2个' },
    { key: 'survivor3', label: '求生者选了3个' },
    { key: 'survivor4', label: '求生者选了4个' },
    { key: 'hunterSelected', label: '监管者选了' }
  ]
  const ENVIRONMENT_PRESETS = {
    duskCinema: {
      label: '电影感黄昏',
      skyTop: '#ff9e5e',
      skyBottom: '#2a1630',
      fogColor: '#2a1a26',
      fogDensity: 0.0105,
      fogNear: 22,
      fogFar: 210,
      ambientColor: '#ffd9b3',
      ambientIntensity: 0.58,
      hemiSkyColor: '#ffbc8a',
      hemiGroundColor: '#2a1a2f',
      hemiIntensity: 0.32,
      keyColor: '#ffd29e',
      keyIntensity: 1.55,
      keyPos: { x: 10, y: 18, z: 7 },
      fillColor: '#7aa8ff',
      fillIntensity: 0.42,
      fillPos: { x: -12, y: 7, z: -9 },
      shadowOpacity: 0.38
    },
    cyberpunkNight: {
      label: '赛博朋克夜景',
      skyTop: '#1f2d7d',
      skyBottom: '#1a0431',
      fogColor: '#150624',
      fogDensity: 0.014,
      fogNear: 16,
      fogFar: 165,
      ambientColor: '#7aa9ff',
      ambientIntensity: 0.36,
      hemiSkyColor: '#37d9ff',
      hemiGroundColor: '#1b0031',
      hemiIntensity: 0.44,
      keyColor: '#ff56d8',
      keyIntensity: 1.36,
      keyPos: { x: 8, y: 13, z: 9 },
      fillColor: '#45e8ff',
      fillIntensity: 0.68,
      fillPos: { x: -10, y: 6, z: -7 },
      shadowOpacity: 0.32
    },
    horrorNight: {
      label: '恐怖风夜晚',
      skyTop: '#11232b',
      skyBottom: '#000000',
      fogColor: '#020507',
      fogDensity: 0.018,
      fogNear: 10,
      fogFar: 108,
      ambientColor: '#5f7d73',
      ambientIntensity: 0.22,
      hemiSkyColor: '#37555d',
      hemiGroundColor: '#020304',
      hemiIntensity: 0.26,
      keyColor: '#9ed4c2',
      keyIntensity: 0.88,
      keyPos: { x: 4, y: 10, z: 5 },
      fillColor: '#2f4350',
      fillIntensity: 0.25,
      fillPos: { x: -6, y: 4, z: -6 },
      shadowOpacity: 0.45
    }
  }
  const QUALITY_PRESETS = {
    low: { label: '低', pixelRatio: 1.0, shadowMap: 1536, shadowRadius: 0.8, exposure: 1.0, contrast: 1.0, cinemaOverlay: 0.0, rim: 0.0, bounce: 0.0 },
    medium: { label: '中', pixelRatio: 1.35, shadowMap: 2048, shadowRadius: 1.0, exposure: 1.04, contrast: 1.04, cinemaOverlay: 0.0, rim: 0.08, bounce: 0.05 },
    high: { label: '高', pixelRatio: 1.8, shadowMap: 3072, shadowRadius: 1.2, exposure: 1.08, contrast: 1.08, cinemaOverlay: 0.0, rim: 0.16, bounce: 0.11 },
    cinematic: { label: '电影级', pixelRatio: 2.0, shadowMap: 4096, shadowRadius: 1.65, exposure: 1.14, contrast: 1.18, cinemaOverlay: 0.62, rim: 0.32, bounce: 0.2 }
  }

  const DEFAULT_LAYOUT = {
    mode: 'edit',
    transparentBackground: true,
    environmentPreset: 'duskCinema',
    qualityPreset: 'high',
    droneMode: false,
    fogEnabled: true,
    fogStrength: 1,
    shadowStrength: 0.45,
    entranceEffect: 'fade',
    entranceParticle: {
      path: ''
    },
    survivorScale: 1,
    hunterScale: 1.1,
    videoScreen: {
      path: '',
      loop: true,
      muted: true,
      width: 2.2,
      height: 1.2
    },
    scene: {
      modelPath: '',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    },
    slots: {
      light1: { position: { x: 0, y: 4.2, z: 3.2 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      video1: { position: { x: 0, y: 1.4, z: -1.8 }, rotation: { x: 0, y: 180, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
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
    },
    cameraTransitionMs: 900,
    cameraKeyframes: {
      survivor1: null,
      survivor2: null,
      survivor3: null,
      survivor4: null,
      hunterSelected: null
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
    roleModelPathCache: {},
    bpSelectionState: {
      survivorCount: 0,
      hunterSelected: false
    }
  }

  let THREE = null
  let renderer = null
  let scene = null
  let camera = null
  let root = null
  let grid = null
  let axes = null
  let skyDome = null
  let shadowGround = null
  const sceneLights = {
    ambient: null,
    key: null,
    fill: null,
    hemi: null,
    rim: null,
    bounce: null
  }
  let gltfLoader = null
  let objLoader = null
  let mtlLoader = null
  const slotRuntime = new Map()
  const mixers = new Map()
  const lightRigs = new Map()
  let rafId = 0
  let clock = null
  let saveTimer = null
  let cameraTransition = null
  let fpsAccum = 0
  let fpsFrames = 0
  let fpsLast = 0
  let bpRoleSyncRunning = false
  let bpRoleSyncPending = false
  let pendingCameraEventKey = ''
  const CAMERA_EPSILON_RADIUS = 1e-6
  const CAMERA_ZOOM_FACTOR = 0.00105
  const activeEntranceEffects = []
  const pendingEntranceEffects = new Set()
  const activeParticleBursts = []
  const entranceParticleAsset = {
    path: '',
    scene: null,
    animations: [],
    loadingPromise: null
  }

  const orbit = {
    target: { x: 0, y: 1, z: 0 },
    desiredTarget: { x: 0, y: 1, z: 0 },
    yaw: 0,
    desiredYaw: 0,
    pitch: 0.18,
    desiredPitch: 0.18,
    radius: 8,
    desiredRadius: 8,
    smoothing: 0.2,
    dragging: false,
    panning: false,
    lastX: 0,
    lastY: 0
  }
  const cameraMoveState = {
    dir: '',
    activeBtn: null
  }
  const cameraKeyboardState = {
    pressed: new Set(),
    dirty: false
  }

  const dom = {
    toolbar: document.getElementById('toolbar'),
    renderRoot: document.getElementById('renderRoot'),
    fogOverlay: document.getElementById('fogOverlay'),
    cinemaOverlay: document.getElementById('cinemaOverlay'),
    fpsBadge: document.getElementById('fpsBadge'),
    statusBar: document.getElementById('statusBar'),
    modeToggleBtn: document.getElementById('modeToggleBtn'),
    sceneImportBtn: document.getElementById('sceneImportBtn'),
    sceneClearBtn: document.getElementById('sceneClearBtn'),
    videoImportBtn: document.getElementById('videoImportBtn'),
    videoClearBtn: document.getElementById('videoClearBtn'),
    videoLoopEnabled: document.getElementById('videoLoopEnabled'),
    videoMuted: document.getElementById('videoMuted'),
    videoWidth: document.getElementById('videoWidth'),
    videoHeight: document.getElementById('videoHeight'),
    applyVideoSettingsBtn: document.getElementById('applyVideoSettingsBtn'),
    slotTabs: document.getElementById('slotTabs'),
    posX: document.getElementById('posX'),
    posY: document.getElementById('posY'),
    posZ: document.getElementById('posZ'),
    rotX: document.getElementById('rotX'),
    rotY: document.getElementById('rotY'),
    rotZ: document.getElementById('rotZ'),
    uniScale: document.getElementById('uniScale'),
    applyTransformBtn: document.getElementById('applyTransformBtn'),
    cameraEventSelect: document.getElementById('cameraEventSelect'),
    saveCameraKeyframeBtn: document.getElementById('saveCameraKeyframeBtn'),
    previewCameraKeyframeBtn: document.getElementById('previewCameraKeyframeBtn'),
    clearCameraKeyframeBtn: document.getElementById('clearCameraKeyframeBtn'),
    cameraTransitionMs: document.getElementById('cameraTransitionMs'),
    cameraEventInfo: document.getElementById('cameraEventInfo')
    , environmentPresetSelect: document.getElementById('environmentPresetSelect')
    , renderQualitySelect: document.getElementById('renderQualitySelect')
    , applyEnvironmentPresetBtn: document.getElementById('applyEnvironmentPresetBtn')
    , fogEnabled: document.getElementById('fogEnabled')
    , fogStrength: document.getElementById('fogStrength')
    , shadowStrength: document.getElementById('shadowStrength')
    , droneModeEnabled: document.getElementById('droneModeEnabled')
    , entranceEffectSelect: document.getElementById('entranceEffectSelect')
    , particleImportBtn: document.getElementById('particleImportBtn')
    , particleClearBtn: document.getElementById('particleClearBtn')
    , particleFileInfo: document.getElementById('particleFileInfo')
    , cameraMoveStep: document.getElementById('cameraMoveStep')
    , cameraMoveButtons: Array.from(document.querySelectorAll('[data-cam-move]'))
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

  function showModelLoadErrorDialog(detail) {
    try {
      const d = (detail && typeof detail === 'object') ? detail : {}
      const lines = [
        '模型加载失败',
        `槽位: ${d.slotLabel || d.slot || '-'}`,
        `路径: ${d.modelPath || '-'}`,
        `URL: ${d.resolvedUrl || '-'}`,
        `扩展名: ${d.ext || '-'}`,
        `错误: ${d.errorMessage || '-'}`
      ]
      if (d.errorStack) {
        const stack = String(d.errorStack).split('\n').slice(0, 6).join('\n')
        lines.push(`堆栈:\n${stack}`)
      }
      window.alert(lines.join('\n'))
    } catch (e) {
      console.error('[CharacterModel3D] 弹出错误对话框失败:', e)
    }
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

  function normalizeCameraKeyframe(input, fallback = null) {
    if (!input || typeof input !== 'object') return fallback
    return {
      position: ensureVec3(input.position, fallback?.position || { x: 0, y: 2, z: 8 }),
      target: ensureVec3(input.target, fallback?.target || { x: 0, y: 1, z: 0 })
    }
  }

  function normalizeLayout(raw) {
    const base = (raw && typeof raw === 'object') ? raw : {}
    const out = deepClone(DEFAULT_LAYOUT)
    out.mode = base.mode === 'render' ? 'render' : 'edit'
    out.transparentBackground = base.transparentBackground !== false
    out.environmentPreset = (typeof base.environmentPreset === 'string' && ENVIRONMENT_PRESETS[base.environmentPreset])
      ? base.environmentPreset
      : 'duskCinema'
    out.qualityPreset = (typeof base.qualityPreset === 'string' && QUALITY_PRESETS[base.qualityPreset])
      ? base.qualityPreset
      : 'high'
    out.droneMode = !!base.droneMode
    out.fogEnabled = base.fogEnabled !== false
    out.fogStrength = Math.max(0, Math.min(3, asNumber(base.fogStrength, 1)))
    out.shadowStrength = Math.max(0, Math.min(1, asNumber(base.shadowStrength, 0.45)))
    out.entranceEffect = (base.entranceEffect === 'none' || base.entranceEffect === 'flameDissolve')
      ? base.entranceEffect
      : 'fade'
    out.entranceParticle = {
      path: (typeof base?.entranceParticle?.path === 'string') ? base.entranceParticle.path : ''
    }
    out.survivorScale = Math.max(0.001, asNumber(base?.survivorScale, 1))
    out.hunterScale = Math.max(0.001, asNumber(base?.hunterScale, out.slots.hunter.scale.x))
    out.videoScreen.path = typeof base?.videoScreen?.path === 'string' ? base.videoScreen.path : ''
    out.videoScreen.loop = base?.videoScreen?.loop !== false
    out.videoScreen.muted = base?.videoScreen?.muted !== false
    out.videoScreen.width = Math.max(0.1, asNumber(base?.videoScreen?.width, out.videoScreen.width))
    out.videoScreen.height = Math.max(0.1, asNumber(base?.videoScreen?.height, out.videoScreen.height))
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
    for (let i = 1; i <= 4; i++) {
      const key = `survivor${i}`
      out.slots[key].scale = { x: out.survivorScale, y: out.survivorScale, z: out.survivorScale }
    }
    out.slots.hunter.scale = { x: out.hunterScale, y: out.hunterScale, z: out.hunterScale }
    out.lights = deepClone(DEFAULT_LAYOUT.lights)
    out.lights.light1.color = typeof base?.lights?.light1?.color === 'string' ? base.lights.light1.color : out.lights.light1.color
    out.lights.light1.intensity = Math.max(0, asNumber(base?.lights?.light1?.intensity, out.lights.light1.intensity))
    out.lights.light1.distance = Math.max(0, asNumber(base?.lights?.light1?.distance, out.lights.light1.distance))
    out.lights.light1.decay = Math.max(0, asNumber(base?.lights?.light1?.decay, out.lights.light1.decay))
    out.camera.position = ensureVec3(base?.camera?.position, out.camera.position)
    out.camera.target = ensureVec3(base?.camera?.target, out.camera.target)
    out.cameraTransitionMs = Math.max(50, Math.min(10000, asNumber(base?.cameraTransitionMs, out.cameraTransitionMs)))
    out.cameraKeyframes = deepClone(DEFAULT_LAYOUT.cameraKeyframes)
    for (const eventCfg of CAMERA_EVENT_OPTIONS) {
      out.cameraKeyframes[eventCfg.key] = normalizeCameraKeyframe(base?.cameraKeyframes?.[eventCfg.key], null)
    }
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
    if (window.THREE && window.THREE.GLTFLoader && window.THREE.OBJLoader && window.THREE.MTLLoader) {
      THREE = window.THREE
      return true
    }
    const coreOk = await loadScript('./js/three/three.min.js')
    if (!coreOk) return false
    const gltfOk = await loadScript('./js/three/GLTFLoader.js')
    if (!gltfOk) return false
    const objOk = await loadScript('./js/three/OBJLoader.js')
    if (!objOk) return false
    const mtlOk = await loadScript('./js/three/MTLLoader.js')
    if (!mtlOk) return false
    THREE = window.THREE
    return !!(THREE && THREE.GLTFLoader && THREE.OBJLoader && THREE.MTLLoader)
  }

  function createSceneGraph() {
    scene = new THREE.Scene()
    const initW = dom.renderRoot.clientWidth || window.innerWidth || 1920
    const initH = dom.renderRoot.clientHeight || window.innerHeight || 1080
    camera = new THREE.PerspectiveCamera(45, initW / Math.max(1, initH), 0.1, 5000)
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
    renderer.outputEncoding = THREE.sRGBEncoding
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.08
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8))
    renderer.setSize(initW, initH)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    camera.updateProjectionMatrix()
    dom.renderRoot.innerHTML = ''
    dom.renderRoot.appendChild(renderer.domElement)

    sceneLights.ambient = new THREE.AmbientLight(0xffffff, 0.75)
    scene.add(sceneLights.ambient)

    sceneLights.hemi = new THREE.HemisphereLight(0xffc38a, 0x201020, 0.25)
    scene.add(sceneLights.hemi)

    sceneLights.key = new THREE.DirectionalLight(0xffffff, 1.15)
    sceneLights.key.position.set(6, 14, 10)
    sceneLights.key.castShadow = true
    sceneLights.key.shadow.mapSize.set(3072, 3072)
    sceneLights.key.shadow.camera.near = 0.5
    sceneLights.key.shadow.camera.far = 160
    sceneLights.key.shadow.camera.left = -12
    sceneLights.key.shadow.camera.right = 12
    sceneLights.key.shadow.camera.top = 12
    sceneLights.key.shadow.camera.bottom = -12
    sceneLights.key.shadow.radius = 1.2
    sceneLights.key.shadow.bias = -0.00012
    sceneLights.key.shadow.normalBias = 0.01
    scene.add(sceneLights.key.target)
    scene.add(sceneLights.key)

    sceneLights.fill = new THREE.DirectionalLight(0x9fc5ff, 0.45)
    sceneLights.fill.position.set(-10, 8, -6)
    scene.add(sceneLights.fill)

    sceneLights.rim = new THREE.DirectionalLight(0xffb36a, 0.18)
    sceneLights.rim.position.set(-6, 6, 8)
    scene.add(sceneLights.rim)

    sceneLights.bounce = new THREE.DirectionalLight(0x6f8fff, 0.12)
    sceneLights.bounce.position.set(4, 1.5, -4)
    scene.add(sceneLights.bounce)

    grid = new THREE.GridHelper(24, 24, 0x4caf50, 0x2d3552)
    grid.position.y = 0
    scene.add(grid)

    axes = new THREE.AxesHelper(2.2)
    scene.add(axes)

    root = new THREE.Group()
    scene.add(root)

    // 阴影接收地面：无场景地面时也能看到角色落影
    shadowGround = new THREE.Mesh(
      new THREE.PlaneGeometry(280, 280),
      new THREE.ShadowMaterial({ opacity: 0.24 })
    )
    shadowGround.rotation.x = -Math.PI / 2
    shadowGround.position.y = 0
    shadowGround.receiveShadow = true
    scene.add(shadowGround)

    // 天空穹顶：通过渐变营造天空氛围
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color('#ff9e5e') },
        uBottomColor: { value: new THREE.Color('#2a1630') },
        uOffset: { value: 42.0 },
        uExponent: { value: 0.72 }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uBottomColor;
        uniform float uOffset;
        uniform float uExponent;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + vec3(0.0, uOffset, 0.0)).y;
          float t = pow(max(h, 0.0), uExponent);
          vec3 col = mix(uBottomColor, uTopColor, t);
          gl_FragColor = vec4(col, 1.0);
        }
      `
    })
    skyDome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 18), skyMat)
    scene.add(skyDome)

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
        loadSeq: 0,
        videoElement: null,
        videoTexture: null
      })
      if (cfg.roleType === 'light') {
        attachLightRig(cfg.key, group)
      }
    }

    gltfLoader = new THREE.GLTFLoader()
    objLoader = new THREE.OBJLoader()
    mtlLoader = new THREE.MTLLoader()
    clock = new THREE.Clock()
    applyRenderQualityPreset(state.layout?.qualityPreset || 'high', false)
  }

  function updateKeyLightShadowFrustum() {
    if (!sceneLights.key || !sceneLights.key.shadow || !sceneLights.key.shadow.camera) return
    const keys = ['survivor1', 'survivor2', 'survivor3', 'survivor4', 'hunter']
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    let found = false
    for (const key of keys) {
      const runtime = slotRuntime.get(key)
      if (!runtime || !runtime.group || !runtime.model || !runtime.model.parent) continue
      const p = runtime.group.position
      if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) continue
      found = true
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.z < minZ) minZ = p.z
      if (p.z > maxZ) maxZ = p.z
    }
    if (!found) {
      minX = -4
      maxX = 4
      minZ = -4
      maxZ = 4
    }
    const cx = (minX + maxX) * 0.5
    const cz = (minZ + maxZ) * 0.5
    const spanX = Math.max(4, maxX - minX)
    const spanZ = Math.max(4, maxZ - minZ)
    const half = Math.max(6, Math.min(20, Math.max(spanX, spanZ) * 0.8 + 3))

    sceneLights.key.target.position.set(cx, 0.5, cz)
    sceneLights.key.target.updateMatrixWorld()
    const cam = sceneLights.key.shadow.camera
    cam.left = -half
    cam.right = half
    cam.top = half
    cam.bottom = -half
    cam.updateProjectionMatrix()
  }

  function getPathExt(pathValue) {
    try {
      const clean = String(pathValue || '').split('?')[0].split('#')[0]
      const m = clean.match(/\.([a-zA-Z0-9]+)$/)
      return m ? `.${m[1].toLowerCase()}` : ''
    } catch {
      return ''
    }
  }

  function isVideoExt(ext) {
    return ext === '.mp4' || ext === '.webm' || ext === '.ogg' || ext === '.mov' || ext === '.m4v'
  }

  function replacePathExt(pathValue, newExtWithDot) {
    const src = String(pathValue || '')
    const qIndex = src.indexOf('?')
    const hIndex = src.indexOf('#')
    const cut = [qIndex, hIndex].filter(i => i >= 0).reduce((a, b) => Math.min(a, b), src.length)
    const base = src.slice(0, cut)
    const tail = src.slice(cut)
    return base.replace(/\.[^.\\/]+$/, newExtWithDot) + tail
  }

  function loadObjModelWithOptionalMtl(objUrl, onSuccess, onError) {
    const tryPlainObj = () => {
      objLoader.load(objUrl, (obj) => onSuccess(obj), undefined, (err) => onError(err))
    }
    const mtlUrl = replacePathExt(objUrl, '.mtl')
    mtlLoader.load(mtlUrl, (materials) => {
      try {
        if (materials && typeof materials.preload === 'function') materials.preload()
      } catch { }
      objLoader.setMaterials(materials || null)
      objLoader.load(objUrl, (obj) => onSuccess(obj), undefined, () => {
        objLoader.setMaterials(null)
        tryPlainObj()
      })
    }, undefined, () => {
      objLoader.setMaterials(null)
      tryPlainObj()
    })
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

  function applyRenderQualityPreset(qualityKey, shouldSave = true) {
    const key = (typeof qualityKey === 'string' && QUALITY_PRESETS[qualityKey]) ? qualityKey : 'high'
    const q = QUALITY_PRESETS[key]
    state.layout.qualityPreset = key

    if (renderer) {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio))
      const w = dom.renderRoot?.clientWidth || window.innerWidth || 1920
      const h = dom.renderRoot?.clientHeight || window.innerHeight || 1080
      renderer.setSize(w, h)
      renderer.toneMappingExposure = q.exposure
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
    }
    if (sceneLights.key) {
      const mapSize = Math.max(1024, Math.round(q.shadowMap))
      sceneLights.key.shadow.mapSize.set(mapSize, mapSize)
      sceneLights.key.shadow.radius = q.shadowRadius
      sceneLights.key.shadow.needsUpdate = true
    }
    if (sceneLights.rim) sceneLights.rim.intensity = q.rim
    if (sceneLights.bounce) sceneLights.bounce.intensity = q.bounce
    if (dom.cinemaOverlay) dom.cinemaOverlay.style.opacity = String(q.cinemaOverlay)

    if (dom.renderQualitySelect) dom.renderQualitySelect.value = key
    if (dom.renderRoot) {
      dom.renderRoot.style.filter = key === 'cinematic'
        ? `contrast(${q.contrast}) saturate(1.06)`
        : `contrast(${q.contrast})`
    }
    if (shouldSave) scheduleSaveLayout()
  }

  function applyEnvironmentPreset(presetKey, shouldSave = true) {
    const key = (presetKey && ENVIRONMENT_PRESETS[presetKey]) ? presetKey : 'duskCinema'
    const preset = ENVIRONMENT_PRESETS[key]
    state.layout.environmentPreset = key

    if (sceneLights.ambient) {
      sceneLights.ambient.color.set(preset.ambientColor)
      sceneLights.ambient.intensity = preset.ambientIntensity
    }
    if (sceneLights.hemi) {
      sceneLights.hemi.color.set(preset.hemiSkyColor)
      sceneLights.hemi.groundColor.set(preset.hemiGroundColor)
      sceneLights.hemi.intensity = preset.hemiIntensity
    }
    if (sceneLights.key) {
      sceneLights.key.color.set(preset.keyColor)
      sceneLights.key.intensity = preset.keyIntensity
      sceneLights.key.position.set(preset.keyPos.x, preset.keyPos.y, preset.keyPos.z)
    }
    if (sceneLights.fill) {
      sceneLights.fill.color.set(preset.fillColor)
      sceneLights.fill.intensity = preset.fillIntensity
      sceneLights.fill.position.set(preset.fillPos.x, preset.fillPos.y, preset.fillPos.z)
    }
    if (sceneLights.rim) {
      sceneLights.rim.color.set(preset.keyColor)
      sceneLights.rim.position.set(-preset.keyPos.x * 0.55, Math.max(4, preset.keyPos.y * 0.45), preset.keyPos.z * 0.75)
    }
    if (sceneLights.bounce) {
      sceneLights.bounce.color.set(preset.fillColor)
      sceneLights.bounce.position.set(-preset.fillPos.x * 0.35, 1.5, -preset.fillPos.z * 0.35)
    }
    if (skyDome && skyDome.material && skyDome.material.uniforms) {
      skyDome.material.uniforms.uTopColor.value.set(preset.skyTop)
      skyDome.material.uniforms.uBottomColor.value.set(preset.skyBottom)
    }
    if (scene) {
      scene.background = new THREE.Color(preset.skyBottom)
      const fogStrength = Math.max(0, Math.min(3, asNumber(state.layout.fogStrength, 1)))
      const strength01 = Math.max(0, Math.min(1, fogStrength / 3))
      const near = Math.max(0.2, preset.fogNear * (1 - 0.85 * strength01))
      const far = Math.max(near + 2, preset.fogFar * (1 - 0.88 * strength01))
      scene.fog = state.layout.fogEnabled ? new THREE.Fog(preset.fogColor, near, far) : null
    }
    if (dom.fogOverlay) {
      const fogStrength = Math.max(0, Math.min(3, asNumber(state.layout.fogStrength, 1)))
      const strength01 = Math.max(0, Math.min(1, fogStrength / 3))
      const alpha = state.layout.fogEnabled ? (0.03 + Math.pow(strength01, 0.82) * 0.36) : 0
      dom.fogOverlay.style.backgroundColor = preset.fogColor
      dom.fogOverlay.style.opacity = String(alpha.toFixed(3))
    }
    if (shadowGround && shadowGround.material) {
      const strength = Math.max(0, Math.min(1, asNumber(state.layout.shadowStrength, preset.shadowOpacity)))
      shadowGround.material.opacity = strength
    }
    if (dom.environmentPresetSelect) dom.environmentPresetSelect.value = key
    if (dom.fogEnabled) dom.fogEnabled.checked = !!state.layout.fogEnabled
    if (dom.fogStrength) dom.fogStrength.value = String(Math.max(0, Math.min(3, asNumber(state.layout.fogStrength, 1))).toFixed(2))
    if (dom.shadowStrength) dom.shadowStrength.value = String(Math.max(0, Math.min(1, asNumber(state.layout.shadowStrength, preset.shadowOpacity))).toFixed(2))
    if (dom.droneModeEnabled) dom.droneModeEnabled.checked = !!state.layout.droneMode
    if (dom.renderQualitySelect) dom.renderQualitySelect.value = state.layout.qualityPreset || 'high'
    if (shouldSave) scheduleSaveLayout()
  }

  function applyOrbitFromLayout() {
    const cam = state.layout.camera
    orbit.target = { ...cam.target }
    orbit.desiredTarget = { ...cam.target }
    const dx = cam.position.x - cam.target.x
    const dy = cam.position.y - cam.target.y
    const dz = cam.position.z - cam.target.z
    orbit.radius = Math.max(CAMERA_EPSILON_RADIUS, Math.sqrt(dx * dx + dy * dy + dz * dz))
    orbit.yaw = Math.atan2(dx, dz)
    orbit.pitch = Math.asin(Math.max(-0.99, Math.min(0.99, dy / Math.max(0.0001, orbit.radius))))
    orbit.desiredRadius = orbit.radius
    orbit.desiredYaw = orbit.yaw
    orbit.desiredPitch = orbit.pitch
    updateCameraFromOrbit(true)
  }

  function updateCameraFromOrbit(force = false) {
    const lerpK = force ? 1 : orbit.smoothing
    orbit.yaw += (orbit.desiredYaw - orbit.yaw) * lerpK
    orbit.pitch += (orbit.desiredPitch - orbit.pitch) * lerpK
    orbit.radius += (orbit.desiredRadius - orbit.radius) * lerpK
    orbit.target.x += (orbit.desiredTarget.x - orbit.target.x) * lerpK
    orbit.target.y += (orbit.desiredTarget.y - orbit.target.y) * lerpK
    orbit.target.z += (orbit.desiredTarget.z - orbit.target.z) * lerpK

    const cosPitch = Math.cos(orbit.pitch)
    let x = orbit.target.x + orbit.radius * Math.sin(orbit.yaw) * cosPitch
    let y = orbit.target.y + orbit.radius * Math.sin(orbit.pitch)
    let z = orbit.target.z + orbit.radius * Math.cos(orbit.yaw) * cosPitch
    let tx = orbit.target.x
    let ty = orbit.target.y
    let tz = orbit.target.z

    if (state.layout?.droneMode) {
      const t = performance.now() * 0.001
      x += Math.sin(t * 0.37 + 1.2) * 0.03 + Math.sin(t * 1.13 + 2.7) * 0.012
      y += Math.sin(t * 0.29 + 0.4) * 0.018 + Math.sin(t * 0.91 + 5.1) * 0.008
      z += Math.sin(t * 0.41 + 3.3) * 0.026 + Math.sin(t * 1.27 + 0.8) * 0.010
      tx += Math.sin(t * 0.55 + 2.1) * 0.015
      ty += Math.sin(t * 0.47 + 4.7) * 0.010
      tz += Math.sin(t * 0.61 + 1.9) * 0.015
    }

    camera.position.set(x, y, z)
    camera.lookAt(tx, ty, tz)
  }

  function getBaseCameraPositionFromOrbit() {
    const cosPitch = Math.cos(orbit.pitch)
    return {
      x: orbit.target.x + orbit.radius * Math.sin(orbit.yaw) * cosPitch,
      y: orbit.target.y + orbit.radius * Math.sin(orbit.pitch),
      z: orbit.target.z + orbit.radius * Math.cos(orbit.yaw) * cosPitch
    }
  }

  function saveCameraToLayout() {
    const basePos = getBaseCameraPositionFromOrbit()
    state.layout.camera = {
      position: {
        x: basePos.x,
        y: basePos.y,
        z: basePos.z
      },
      target: {
        x: orbit.target.x,
        y: orbit.target.y,
        z: orbit.target.z
      }
    }
    scheduleSaveLayout()
  }

  function getCameraMoveStep() {
    const raw = asNumber(dom.cameraMoveStep ? dom.cameraMoveStep.value : 0.25, 0.25)
    return Math.max(0.001, raw)
  }

  function isCameraMoveKey(key) {
    return key === 'w' || key === 'a' || key === 's' || key === 'd' || key === 'q' || key === 'e'
  }

  function hasActiveCameraKeyboardMove() {
    for (const key of cameraKeyboardState.pressed) {
      if (isCameraMoveKey(key)) return true
    }
    return false
  }

  function applyCameraKeyboardInput(dt) {
    if (!camera || !THREE || cameraTransition) return
    if (!hasActiveCameraKeyboardMove()) return

    const keys = cameraKeyboardState.pressed
    const shiftDown = keys.has('shift')
    const moveStep = getCameraMoveStep() * Math.max(0.0001, dt * 5.2)
    const rotateStep = Math.max(0.0001, dt * 1.9)
    let changed = false

    if (shiftDown) {
      if (keys.has('a')) { orbit.desiredYaw += rotateStep; changed = true }
      if (keys.has('d')) { orbit.desiredYaw -= rotateStep; changed = true }
      if (keys.has('w')) { orbit.desiredPitch += rotateStep; changed = true }
      if (keys.has('s')) { orbit.desiredPitch -= rotateStep; changed = true }
      orbit.desiredPitch = Math.max(-1.4, Math.min(1.4, orbit.desiredPitch))
      orbit.yaw = orbit.desiredYaw
      orbit.pitch = orbit.desiredPitch
    } else {
      const forward = new THREE.Vector3()
      camera.getWorldDirection(forward).normalize()
      const up = new THREE.Vector3().copy(camera.up).normalize()
      const right = new THREE.Vector3().crossVectors(forward, up).normalize()
      const delta = new THREE.Vector3()
      if (keys.has('w')) delta.add(forward)
      if (keys.has('s')) delta.addScaledVector(forward, -1)
      if (keys.has('a')) delta.addScaledVector(right, -1)
      if (keys.has('d')) delta.add(right)
      if (keys.has('q')) delta.addScaledVector(up, -1)
      if (keys.has('e')) delta.add(up)
      if (delta.lengthSq() > 0) {
        delta.normalize().multiplyScalar(moveStep)
        orbit.desiredTarget.x += delta.x
        orbit.desiredTarget.y += delta.y
        orbit.desiredTarget.z += delta.z
        orbit.target.x += delta.x
        orbit.target.y += delta.y
        orbit.target.z += delta.z
        changed = true
      }
    }

    if (changed) {
      cancelCameraTransition()
      cameraKeyboardState.dirty = true
    }
  }

  function moveCameraByDirection(dir, scale = 1, immediate = false, shouldSave = false) {
    if (!camera || !dir) return
    cancelCameraTransition()
    const step = getCameraMoveStep() * Math.max(0.0001, scale)
    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward).normalize()
    const up = new THREE.Vector3().copy(camera.up).normalize()
    const right = new THREE.Vector3().crossVectors(forward, up).normalize()
    const delta = new THREE.Vector3()

    if (dir === 'forward') delta.addScaledVector(forward, step)
    else if (dir === 'back') delta.addScaledVector(forward, -step)
    else if (dir === 'left') delta.addScaledVector(right, -step)
    else if (dir === 'right') delta.addScaledVector(right, step)
    else if (dir === 'up') delta.addScaledVector(up, step)
    else if (dir === 'down') delta.addScaledVector(up, -step)
    else return

    orbit.desiredTarget.x += delta.x
    orbit.desiredTarget.y += delta.y
    orbit.desiredTarget.z += delta.z
    if (immediate) {
      orbit.target.x += delta.x
      orbit.target.y += delta.y
      orbit.target.z += delta.z
      updateCameraFromOrbit(true)
    }
    if (shouldSave) saveCameraToLayout()
  }

  function stopCameraMoveHold() {
    if (cameraMoveState.activeBtn) {
      cameraMoveState.activeBtn.classList.remove('active')
    }
    cameraMoveState.activeBtn = null
    cameraMoveState.dir = ''
    saveCameraToLayout()
  }

  function countSelectedSurvivors(list) {
    if (!Array.isArray(list)) return 0
    return list.filter(v => typeof v === 'string' && v.trim()).length
  }

  function isHunterSelected(value) {
    return typeof value === 'string' && value.trim().length > 0
  }

  function cancelCameraTransition() {
    cameraTransition = null
  }

  function normalizeAngleRad(value) {
    let v = value
    while (v > Math.PI) v -= Math.PI * 2
    while (v < -Math.PI) v += Math.PI * 2
    return v
  }

  function lerpAngleRad(from, to, t) {
    const delta = normalizeAngleRad(to - from)
    return from + delta * t
  }

  function buildOrbitStateFromFrame(frame) {
    const target = ensureVec3(frame?.target, state.layout.camera.target)
    const position = ensureVec3(frame?.position, state.layout.camera.position)
    const dx = position.x - target.x
    const dy = position.y - target.y
    const dz = position.z - target.z
    const radius = Math.max(CAMERA_EPSILON_RADIUS, Math.sqrt(dx * dx + dy * dy + dz * dz))
    return {
      target,
      radius,
      yaw: Math.atan2(dx, dz),
      pitch: Math.asin(Math.max(-0.99, Math.min(0.99, dy / Math.max(0.0001, radius))))
    }
  }

  function startCameraTransition(targetFrame, durationMs, reason = '') {
    if (!camera || !targetFrame) return
    const duration = Math.max(50, Math.min(10000, asNumber(durationMs, 900)))
    const toState = buildOrbitStateFromFrame(targetFrame)
    if (pendingEntranceEffects.size) {
      pendingEntranceEffects.forEach((rootModel) => {
        if (rootModel) rootModel.visible = false
      })
    }
    cameraTransition = {
      startAt: performance.now(),
      duration,
      fromTarget: { x: orbit.target.x, y: orbit.target.y, z: orbit.target.z },
      fromYaw: orbit.yaw,
      fromPitch: orbit.pitch,
      fromRadius: orbit.radius,
      toTarget: { ...toState.target },
      toYaw: toState.yaw,
      toPitch: toState.pitch,
      toRadius: toState.radius,
      reason
    }
  }

  function updateCameraTransition() {
    if (!cameraTransition || !camera) return
    const now = performance.now()
    const t = Math.max(0, Math.min(1, (now - cameraTransition.startAt) / Math.max(1, cameraTransition.duration)))
    const eased = 1 - Math.pow(1 - t, 3)

    orbit.target = {
      x: cameraTransition.fromTarget.x + (cameraTransition.toTarget.x - cameraTransition.fromTarget.x) * eased,
      y: cameraTransition.fromTarget.y + (cameraTransition.toTarget.y - cameraTransition.fromTarget.y) * eased,
      z: cameraTransition.fromTarget.z + (cameraTransition.toTarget.z - cameraTransition.fromTarget.z) * eased
    }
    orbit.desiredTarget = { ...orbit.target }
    orbit.radius = Math.max(CAMERA_EPSILON_RADIUS, cameraTransition.fromRadius + (cameraTransition.toRadius - cameraTransition.fromRadius) * eased)
    orbit.yaw = lerpAngleRad(cameraTransition.fromYaw, cameraTransition.toYaw, eased)
    orbit.pitch = cameraTransition.fromPitch + (cameraTransition.toPitch - cameraTransition.fromPitch) * eased
    orbit.desiredRadius = orbit.radius
    orbit.desiredYaw = orbit.yaw
    orbit.desiredPitch = orbit.pitch
    updateCameraFromOrbit(true)

    if (t >= 1) {
      const reason = cameraTransition.reason
      cameraTransition = null
      saveCameraToLayout()
      flushPendingEntranceEffects()
      if (reason) setStatus(`镜头已切换: ${reason}`)
    }
  }

  function enqueueEntranceEffect(modelRoot) {
    if (!modelRoot) return
    if (cameraTransition) {
      modelRoot.visible = false
      pendingEntranceEffects.add(modelRoot)
      return
    }
    startEntranceEffect(modelRoot)
  }

  function flushPendingEntranceEffects() {
    if (!pendingEntranceEffects.size) return
    const roots = Array.from(pendingEntranceEffects)
    pendingEntranceEffects.clear()
    roots.forEach((rootModel) => {
      if (rootModel && rootModel.parent) startEntranceEffect(rootModel)
    })
  }

  function getSelectedCameraEventKey() {
    const key = dom.cameraEventSelect ? String(dom.cameraEventSelect.value || '') : ''
    return CAMERA_EVENT_OPTIONS.some(item => item.key === key) ? key : CAMERA_EVENT_OPTIONS[0].key
  }

  function syncCameraEditorInputs() {
    if (dom.cameraTransitionMs) {
      dom.cameraTransitionMs.value = String(Math.max(50, Math.min(10000, asNumber(state.layout.cameraTransitionMs, 900))))
    }
    if (dom.entranceEffectSelect) {
      dom.entranceEffectSelect.value = state.layout?.entranceEffect || 'fade'
    }
    const eventKey = getSelectedCameraEventKey()
    const frame = state.layout?.cameraKeyframes?.[eventKey]
    if (!dom.cameraEventInfo) return
    if (frame && frame.position && frame.target) {
      dom.cameraEventInfo.textContent = '已录制'
    } else {
      dom.cameraEventInfo.textContent = '未录制'
    }
  }

  function saveCurrentCameraAsKeyframe() {
    const eventKey = getSelectedCameraEventKey()
    if (!state.layout.cameraKeyframes) state.layout.cameraKeyframes = deepClone(DEFAULT_LAYOUT.cameraKeyframes)
    state.layout.cameraKeyframes[eventKey] = {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: orbit.target.x, y: orbit.target.y, z: orbit.target.z }
    }
    syncCameraEditorInputs()
    scheduleSaveLayout()
    const eventLabel = CAMERA_EVENT_OPTIONS.find(item => item.key === eventKey)?.label || eventKey
    setStatus(`已记录关键帧: ${eventLabel}`)
  }

  function clearSelectedCameraKeyframe() {
    const eventKey = getSelectedCameraEventKey()
    if (!state.layout.cameraKeyframes) state.layout.cameraKeyframes = deepClone(DEFAULT_LAYOUT.cameraKeyframes)
    state.layout.cameraKeyframes[eventKey] = null
    syncCameraEditorInputs()
    scheduleSaveLayout()
    const eventLabel = CAMERA_EVENT_OPTIONS.find(item => item.key === eventKey)?.label || eventKey
    setStatus(`已清除关键帧: ${eventLabel}`)
  }

  function previewSelectedCameraKeyframe() {
    const eventKey = getSelectedCameraEventKey()
    const frame = state.layout?.cameraKeyframes?.[eventKey]
    if (!frame) {
      setStatus('该事件尚未录制关键帧')
      return
    }
    const duration = Math.max(50, Math.min(10000, asNumber(dom.cameraTransitionMs ? dom.cameraTransitionMs.value : state.layout.cameraTransitionMs, state.layout.cameraTransitionMs)))
    state.layout.cameraTransitionMs = duration
    startCameraTransition(frame, duration, `预览 ${CAMERA_EVENT_OPTIONS.find(item => item.key === eventKey)?.label || eventKey}`)
  }

  function triggerCameraEvent(eventKey) {
    const frame = state.layout?.cameraKeyframes?.[eventKey]
    if (!frame) return
    const eventLabel = CAMERA_EVENT_OPTIONS.find(item => item.key === eventKey)?.label || eventKey
    startCameraTransition(frame, state.layout.cameraTransitionMs, eventLabel)
  }

  function requestCameraEvent(eventKey) {
    if (!eventKey) return
    if (bpRoleSyncRunning) {
      pendingCameraEventKey = eventKey
      return
    }
    triggerCameraEvent(eventKey)
  }

  function flushPendingCameraEvent() {
    if (!pendingCameraEventKey) return
    const key = pendingCameraEventKey
    pendingCameraEventKey = ''
    triggerCameraEvent(key)
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
      const uniform = (key.startsWith('survivor'))
        ? Math.max(0.001, asNumber(state.layout?.survivorScale, asNumber(s.x, asNumber(s.y, asNumber(s.z, 1)))))
        : (key === 'hunter')
          ? Math.max(0.001, asNumber(state.layout?.hunterScale, asNumber(s.x, asNumber(s.y, asNumber(s.z, 1)))))
        : Math.max(0.001, asNumber(s.x, asNumber(s.y, asNumber(s.z, 1))))
      runtime.group.scale.set(uniform, uniform, uniform)
    }
  }

  function removeModelFromSlot(key) {
    const runtime = slotRuntime.get(key)
    if (!runtime || !runtime.group) return
    if (runtime.model) pendingEntranceEffects.delete(runtime.model)
    stopEntranceEffectsForRoot(runtime.model)
    stopParticleEffectsForRoot(runtime.model)
    if (runtime.videoElement) {
      try {
        runtime.videoElement.pause()
        runtime.videoElement.removeAttribute('src')
        runtime.videoElement.load()
      } catch { }
    }
    if (runtime.videoTexture && typeof runtime.videoTexture.dispose === 'function') {
      try { runtime.videoTexture.dispose() } catch { }
    }
    runtime.videoElement = null
    runtime.videoTexture = null
    while (runtime.group.children.length) {
      const child = runtime.group.children.pop()
      disposeObject(child)
    }
    runtime.model = null
    runtime.modelPath = ''
    if (mixers.has(key)) mixers.delete(key)
  }

  function updateVideoScreenGeometry(runtime) {
    if (!runtime || !runtime.model || !runtime.model.isMesh) return
    const w = Math.max(0.1, asNumber(state.layout?.videoScreen?.width, 2.2))
    const h = Math.max(0.1, asNumber(state.layout?.videoScreen?.height, 1.2))
    const oldGeo = runtime.model.geometry
    runtime.model.geometry = new THREE.PlaneGeometry(w, h, 1, 1)
    if (oldGeo && typeof oldGeo.dispose === 'function') {
      try { oldGeo.dispose() } catch { }
    }
  }

  function applyVideoScreenSettingsToRuntime(runtime) {
    if (!runtime || !runtime.videoElement) return
    const cfg = state.layout?.videoScreen || DEFAULT_LAYOUT.videoScreen
    runtime.videoElement.loop = cfg.loop !== false
    runtime.videoElement.muted = cfg.muted !== false
    runtime.videoElement.defaultMuted = runtime.videoElement.muted
    runtime.videoElement.volume = runtime.videoElement.muted ? 0 : 1
    updateVideoScreenGeometry(runtime)
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

  function prepareModelForShadows(obj) {
    if (!obj) return
    obj.traverse((node) => {
      if (node && node.isMesh) {
        node.castShadow = true
        node.receiveShadow = true
      }
    })
  }

  function stopEntranceEffectsForRoot(modelRoot) {
    if (!modelRoot || !activeEntranceEffects.length) return
    for (let i = activeEntranceEffects.length - 1; i >= 0; i--) {
      const fx = activeEntranceEffects[i]
      if (fx.modelRoot !== modelRoot) continue
      if (Array.isArray(fx.entries)) {
        fx.entries.forEach((entry) => {
          entry.materials.forEach((mat) => {
            if (!mat) return
            if (fx.type === 'flameDissolve') {
              if (mat.userData?.__asgDissolveUniforms) {
                mat.userData.__asgDissolveUniforms.uProgress.value = 1
              }
            }
            if (Number.isFinite(mat.userData?.__entranceOriginalOpacity)) {
              mat.opacity = mat.userData.__entranceOriginalOpacity
            }
            if (typeof mat.userData?.__entranceOriginalTransparent === 'boolean') {
              mat.transparent = mat.userData.__entranceOriginalTransparent
            }
            if (typeof mat.userData?.__entranceOriginalDepthWrite === 'boolean') {
              mat.depthWrite = mat.userData.__entranceOriginalDepthWrite
            }
            mat.needsUpdate = true
          })
        })
      }
      activeEntranceEffects.splice(i, 1)
    }
  }

  function syncEntranceParticleUi() {
    if (!dom.particleFileInfo) return
    const path = String(state.layout?.entranceParticle?.path || '').trim()
    if (!path) {
      dom.particleFileInfo.textContent = '粒子: 未配置'
      return
    }
    const shortName = path.split(/[\\/]/).pop() || path
    dom.particleFileInfo.textContent = `粒子: ${shortName}`
  }

  async function ensureEntranceParticleAsset(path) {
    const nextPath = String(path || '').trim()
    if (!nextPath) return { success: false, error: 'empty-path' }
    if (entranceParticleAsset.path === nextPath && entranceParticleAsset.scene) {
      return { success: true }
    }
    if (entranceParticleAsset.path === nextPath && entranceParticleAsset.loadingPromise) {
      return entranceParticleAsset.loadingPromise
    }
    const resolvedUrl = normalizeFileUrl(nextPath)
    if (!resolvedUrl) return { success: false, error: 'invalid-url' }

    entranceParticleAsset.path = nextPath
    entranceParticleAsset.scene = null
    entranceParticleAsset.animations = []
    entranceParticleAsset.loadingPromise = new Promise((resolve) => {
      gltfLoader.load(resolvedUrl, (gltf) => {
        const particleScene = gltf && gltf.scene ? gltf.scene : null
        if (!particleScene) {
          resolve({ success: false, error: 'particle-scene-empty' })
          return
        }
        entranceParticleAsset.scene = particleScene
        entranceParticleAsset.animations = Array.isArray(gltf.animations) ? gltf.animations : []
        resolve({ success: true })
      }, undefined, (error) => {
        resolve({ success: false, error: error?.message || String(error || 'particle-load-failed') })
      })
    }).finally(() => {
      entranceParticleAsset.loadingPromise = null
    })

    return entranceParticleAsset.loadingPromise
  }

  function stopParticleEffectsForRoot(modelRoot) {
    if (!modelRoot || !activeParticleBursts.length) return
    for (let i = activeParticleBursts.length - 1; i >= 0; i--) {
      const burst = activeParticleBursts[i]
      if (burst.modelRoot !== modelRoot) continue
      if (burst.node && burst.node.parent) {
        burst.node.parent.remove(burst.node)
      }
      activeParticleBursts.splice(i, 1)
    }
  }

  async function playEntranceParticleForModel(modelRoot) {
    const path = String(state.layout?.entranceParticle?.path || '').trim()
    if (!modelRoot || !path || !gltfLoader) return
    const loaded = await ensureEntranceParticleAsset(path)
    if (!loaded || !loaded.success || !entranceParticleAsset.scene) return

    const burstNode = entranceParticleAsset.scene.clone(true)
    if (!burstNode) return
    burstNode.position.set(0, 0, 0)
    burstNode.rotation.set(0, 0, 0)
    burstNode.scale.set(1, 1, 1)
    modelRoot.add(burstNode)

    let mixer = null
    let durationMs = 2200
    if (entranceParticleAsset.animations && entranceParticleAsset.animations.length) {
      mixer = new THREE.AnimationMixer(burstNode)
      let maxDuration = 0
      entranceParticleAsset.animations.forEach((clip) => {
        try {
          const action = mixer.clipAction(clip)
          action.reset()
          action.setLoop(THREE.LoopOnce, 1)
          action.clampWhenFinished = true
          action.play()
          if (Number.isFinite(clip.duration)) {
            maxDuration = Math.max(maxDuration, clip.duration)
          }
        } catch { }
      })
      if (maxDuration > 0) durationMs = Math.max(600, maxDuration * 1000)
    }

    activeParticleBursts.push({
      modelRoot,
      node: burstNode,
      mixer,
      startedAt: performance.now(),
      durationMs
    })
  }

  function updateParticleBursts(dt) {
    if (!activeParticleBursts.length) return
    const now = performance.now()
    for (let i = activeParticleBursts.length - 1; i >= 0; i--) {
      const burst = activeParticleBursts[i]
      if (burst.mixer) {
        try { burst.mixer.update(dt) } catch { }
      }
      const finished = (now - burst.startedAt) >= burst.durationMs
      const detached = !burst.node || !burst.node.parent
      if (!finished && !detached) continue
      if (burst.node && burst.node.parent) burst.node.parent.remove(burst.node)
      activeParticleBursts.splice(i, 1)
    }
  }

  function attachDissolveShader(mat, minY, maxY) {
    if (!mat) return
    if (!mat.userData) mat.userData = {}
    const uniforms = {
      uProgress: { value: 0 },
      uMinY: { value: minY },
      uMaxY: { value: Math.max(minY + 0.0001, maxY) },
      uNoiseAmp: { value: 0.1 },
      uEdgeWidth: { value: 0.075 }
    }
    mat.userData.__asgDissolveUniforms = uniforms
    const prevOnBeforeCompile = mat.onBeforeCompile
    const prevCacheKey = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : null
    mat.onBeforeCompile = (shader) => {
      if (typeof prevOnBeforeCompile === 'function') prevOnBeforeCompile(shader)
      shader.uniforms.uAsgProgress = uniforms.uProgress
      shader.uniforms.uAsgMinY = uniforms.uMinY
      shader.uniforms.uAsgMaxY = uniforms.uMaxY
      shader.uniforms.uAsgNoiseAmp = uniforms.uNoiseAmp
      shader.uniforms.uAsgEdgeWidth = uniforms.uEdgeWidth

      if (!shader.vertexShader.includes('varying float vAsgWorldY;')) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `#include <common>
varying float vAsgWorldY;
varying vec3 vAsgWorldPos;`
        )
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vec4 asgWorldPos = modelMatrix * vec4(transformed, 1.0);
vAsgWorldY = asgWorldPos.y;
vAsgWorldPos = asgWorldPos.xyz;`
        )
      }

      if (!shader.fragmentShader.includes('uniform float uAsgProgress;')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `#include <common>
varying float vAsgWorldY;
varying vec3 vAsgWorldPos;
uniform float uAsgProgress;
uniform float uAsgMinY;
uniform float uAsgMaxY;
uniform float uAsgNoiseAmp;
uniform float uAsgEdgeWidth;
float asgHash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}`
        )
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <alphatest_fragment>',
          `float asgSpan = max(0.0001, uAsgMaxY - uAsgMinY);
float asgH = clamp((vAsgWorldY - uAsgMinY) / asgSpan, 0.0, 1.0);
float asgN = asgHash21(vAsgWorldPos.xz * 2.8 + vec2(asgH * 3.1, asgH * 1.7));
float asgCut = uAsgProgress + (asgN - 0.5) * uAsgNoiseAmp;
if (asgH > asgCut) discard;
float asgEdge = 1.0 - smoothstep(0.0, uAsgEdgeWidth, abs(asgH - asgCut));
diffuseColor.rgb += vec3(1.0, 0.36, 0.07) * asgEdge * 0.95;
diffuseColor.rgb += vec3(1.0, 0.82, 0.25) * asgEdge * 0.28;
#include <alphatest_fragment>`
        )
      }
      mat.userData.__asgDissolveShader = shader
    }
    mat.customProgramCacheKey = () => {
      const base = prevCacheKey ? prevCacheKey() : ''
      return `${base}|asg-dissolve-v3`
    }
    mat.needsUpdate = true
  }

  function startEntranceEffect(modelRoot) {
    if (!modelRoot) return
    modelRoot.visible = true
    stopEntranceEffectsForRoot(modelRoot)
    const effectType = state.layout?.entranceEffect || 'fade'
    if (effectType !== 'none') {
      void playEntranceParticleForModel(modelRoot)
    }
    if (effectType === 'none') return
    const materialEntries = []
    let fx = null
    let box = null

    if (effectType === 'flameDissolve') {
      box = new THREE.Box3().setFromObject(modelRoot)
      if (!Number.isFinite(box.min.y) || !Number.isFinite(box.max.y)) return
      fx = {
        type: effectType,
        modelRoot,
        minY: box.min.y - 0.18,
        maxY: box.max.y + 0.18,
        startedAt: performance.now(),
        durationMs: 2200
      }
    } else {
      fx = {
        type: effectType,
        entries: materialEntries,
        modelRoot,
        startedAt: performance.now(),
        durationMs: 1500
      }
    }

    modelRoot.traverse((node) => {
      if (!node || !node.isMesh) return
      const originalMaterial = node.material
      const materials = Array.isArray(originalMaterial)
        ? originalMaterial.map((mat) => (mat && typeof mat.clone === 'function' ? mat.clone() : mat))
        : [(originalMaterial && typeof originalMaterial.clone === 'function') ? originalMaterial.clone() : originalMaterial]
      node.material = Array.isArray(originalMaterial) ? materials : materials[0]
      materials.forEach((mat) => {
        if (!mat) return
        if (!mat.userData) mat.userData = {}
        mat.userData.__entranceOriginalOpacity = Number.isFinite(mat.opacity) ? mat.opacity : 1
        mat.userData.__entranceOriginalTransparent = !!mat.transparent
        mat.userData.__entranceOriginalDepthWrite = mat.depthWrite !== false
        if (effectType === 'flameDissolve') {
          mat.transparent = true
          mat.depthWrite = true
          mat.opacity = Number.isFinite(mat.userData.__entranceOriginalOpacity) ? mat.userData.__entranceOriginalOpacity : 1
          attachDissolveShader(mat, fx.minY, fx.maxY)
          if ('emissiveIntensity' in mat && Number.isFinite(mat.emissiveIntensity)) {
            mat.userData.__entranceOriginalEmissiveIntensity = mat.emissiveIntensity
          }
        } else {
          mat.transparent = true
          mat.opacity = 0.01
          mat.depthWrite = mat.userData.__entranceOriginalDepthWrite
        }
        mat.needsUpdate = true
      })
      materialEntries.push({ node, materials })
    })
    if (!materialEntries.length) return
    fx.entries = materialEntries
    activeEntranceEffects.push(fx)
  }

  function updateEntranceEffects() {
    if (!activeEntranceEffects.length) return
    const now = performance.now()
    for (let i = activeEntranceEffects.length - 1; i >= 0; i--) {
      const fx = activeEntranceEffects[i]
      const t = Math.max(0, Math.min(1, (now - fx.startedAt) / fx.durationMs))
      const eased = 1 - Math.pow(1 - t, 3)
      if (fx.type === 'flameDissolve') {
        fx.entries.forEach((entry) => {
          entry.materials.forEach((mat) => {
            if (!mat) return
            if (mat.userData?.__asgDissolveUniforms) {
              mat.userData.__asgDissolveUniforms.uProgress.value = eased
            }
          })
        })
      } else {
        fx.entries.forEach((entry) => {
          entry.materials.forEach((mat) => {
            if (!mat) return
            const baseOpacity = Number.isFinite(mat.userData?.__entranceOriginalOpacity)
              ? mat.userData.__entranceOriginalOpacity
              : 1
            mat.opacity = Math.max(0.01, eased * baseOpacity)
          })
        })
      }
      if (t >= 1) {
        fx.entries.forEach((entry) => {
          entry.materials.forEach((mat) => {
            if (!mat) return
            if (fx.type === 'flameDissolve') {
              if (mat.userData?.__asgDissolveUniforms) {
                mat.userData.__asgDissolveUniforms.uProgress.value = 1
              }
              if ('emissiveIntensity' in mat && Number.isFinite(mat.emissiveIntensity)) {
                mat.emissiveIntensity = Number.isFinite(mat.userData?.__entranceOriginalEmissiveIntensity)
                  ? mat.userData.__entranceOriginalEmissiveIntensity
                  : 1
              }
            } else {
              mat.opacity = Number.isFinite(mat.userData?.__entranceOriginalOpacity)
                ? mat.userData.__entranceOriginalOpacity
                : 1
              mat.transparent = !!mat.userData?.__entranceOriginalTransparent
              mat.depthWrite = mat.userData?.__entranceOriginalDepthWrite !== false
            }
            mat.needsUpdate = true
          })
        })
        activeEntranceEffects.splice(i, 1)
      }
    }
  }

  async function loadVideoScreenForSlot(key, videoPath, resolvedUrl) {
    const runtime = slotRuntime.get(key)
    if (!runtime) return { success: false, error: 'slot-not-found' }
    removeModelFromSlot(key)
    runtime.modelPath = videoPath
    const video = document.createElement('video')
    video.src = resolvedUrl
    video.crossOrigin = 'anonymous'
    video.preload = 'auto'
    video.playsInline = true
    video.autoplay = true
    video.loop = state.layout?.videoScreen?.loop !== false
    video.muted = state.layout?.videoScreen?.muted !== false
    video.defaultMuted = video.muted
    video.volume = video.muted ? 0 : 1
    video.load()

    const ready = await new Promise((resolve) => {
      let done = false
      const finish = (ok, err) => {
        if (done) return
        done = true
        try { video.removeEventListener('loadeddata', onLoaded) } catch { }
        try { video.removeEventListener('error', onError) } catch { }
        clearTimeout(timer)
        resolve({ ok, err })
      }
      const onLoaded = () => finish(true, null)
      const onError = () => {
        const mediaErr = video.error
        const msg = mediaErr ? `视频解码失败(code=${mediaErr.code})` : '视频加载失败'
        finish(false, new Error(msg))
      }
      const timer = setTimeout(() => finish(false, new Error('视频加载超时')), 10000)
      video.addEventListener('loadeddata', onLoaded, { once: true })
      video.addEventListener('error', onError, { once: true })
    })
    if (!ready.ok) {
      try {
        video.pause()
        video.removeAttribute('src')
        video.load()
      } catch { }
      return { success: false, error: ready.err?.message || 'video-load-failed' }
    }

    const texture = new THREE.VideoTexture(video)
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace
    else if ('encoding' in texture && THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.generateMipmaps = false

    const w = Math.max(0.1, asNumber(state.layout?.videoScreen?.width, 2.2))
    const h = Math.max(0.1, asNumber(state.layout?.videoScreen?.height, 1.2))
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h, 1, 1),
      new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.45,
        side: THREE.DoubleSide,
        roughness: 0.92,
        metalness: 0.0
      })
    )
    mesh.castShadow = false
    mesh.receiveShadow = true

    runtime.videoElement = video
    runtime.videoTexture = texture
    runtime.model = mesh
    runtime.group.add(mesh)
    applyVideoScreenSettingsToRuntime(runtime)

    try {
      const playPromise = video.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => { })
      }
    } catch { }
    return { success: true }
  }


  async function loadModelForSlot(key, modelPath) {
    const runtime = slotRuntime.get(key)
    if (!runtime) return
    const nextPath = modelPath ? String(modelPath).trim() : ''
    if (!nextPath) {
      removeModelFromSlot(key)
      return { success: true, cleared: true }
    }
    if (runtime.modelPath === nextPath && runtime.model) return
    if (runtime.loadingPath === nextPath) return

    removeModelFromSlot(key)
    runtime.modelPath = nextPath
    runtime.loadingPath = nextPath
    runtime.loadSeq = (runtime.loadSeq || 0) + 1
    const seq = runtime.loadSeq
    const url = normalizeFileUrl(nextPath)
    if (!url) return { success: false, error: 'invalid-url' }
    const ext = getPathExt(nextPath)
    if (runtime.cfg?.roleType === 'video' || isVideoExt(ext)) {
      const result = await loadVideoScreenForSlot(key, nextPath, url)
      runtime.loadingPath = ''
      if (result && result.success) {
        setStatus(`加载完成: ${runtime.cfg.label}`)
      } else {
        setStatus(`加载失败: ${runtime.cfg.label}`)
        showModelLoadErrorDialog({
          slot: key,
          slotLabel: runtime?.cfg?.label || key,
          modelPath: modelPath || '',
          resolvedUrl: url || '',
          ext: ext || '',
          errorMessage: result?.error || '视频加载失败'
        })
      }
      return result
    }

    const shortPath = String(modelPath).split(/[\\/]/).slice(-2).join('/')
    setStatus(`加载模型: ${runtime.cfg.label} (${shortPath})`)
    const onLoadedObject = (obj, animations = []) => {
      if (runtime.loadSeq !== seq) {
        try { if (obj) disposeObject(obj) } catch { }
        return { success: false, stale: true }
      }
      if (!obj) {
        runtime.loadingPath = ''
        setStatus(`模型无效: ${runtime.cfg.label}`)
        return { success: false, error: 'invalid-object' }
      }
      // 再次清空，保证同槽位始终只保留 1 个实例
      removeModelFromSlot(key)
      runtime.modelPath = nextPath
      runtime.model = obj
      prepareModelForShadows(obj)
      runtime.group.add(obj)
      if (Array.isArray(animations) && animations.length) {
        const mixer = new THREE.AnimationMixer(obj)
        animations.forEach((clip) => {
          try { mixer.clipAction(clip).play() } catch { }
        })
        mixers.set(key, mixer)
      }
      if (runtime.cfg && (runtime.cfg.roleType === 'survivor' || runtime.cfg.roleType === 'hunter')) {
        enqueueEntranceEffect(obj)
      }
      runtime.loadingPath = ''
      setStatus(`加载完成: ${runtime.cfg.label}`)
      return { success: true }
    }
    const onError = (error) => {
      if (runtime.loadSeq !== seq) return
      runtime.loadingPath = ''
      setStatus(`加载失败: ${runtime.cfg.label}`)
      const detail = {
        slot: key,
        slotLabel: runtime?.cfg?.label || key,
        modelPath: modelPath || '',
        resolvedUrl: url || '',
        ext: ext || '',
        errorMessage: (error && (error.message || error.type || error.target?.statusText)) || String(error),
        errorStack: error && error.stack ? error.stack : '',
        rawError: error
      }
      console.error('[CharacterModel3D] 模型加载失败(详细):', detail)
      showModelLoadErrorDialog(detail)
    }

    return await new Promise((resolve) => {
      const doneLoaded = (obj, animations = []) => resolve(onLoadedObject(obj, animations))
      const doneError = (err) => {
        onError(err)
        resolve({ success: false, error: err?.message || String(err) })
      }

      if (ext === '.obj') {
        loadObjModelWithOptionalMtl(url, (obj) => doneLoaded(obj, []), doneError)
        return
      }

      gltfLoader.load(url, (gltf) => {
        const obj = gltf && gltf.scene ? gltf.scene : null
        doneLoaded(obj, (gltf && Array.isArray(gltf.animations)) ? gltf.animations : [])
      }, undefined, doneError)
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
      const cached = String(state.roleModelPathCache[cacheKey] || '').trim()
      // 仅直接复用本地路径；旧 http 缓存会继续走本地解析以避免拉取失败
      if (cached && !/^https?:\/\//i.test(cached)) return cached
    }

    // 1) 强制优先从本机 official-models 目录解析
    try {
      if (window.electronAPI && window.electronAPI.invoke) {
        const res = await window.electronAPI.invoke('localBp:getOfficialModelLocalPath', roleName)
        const localPath = (res && res.success && typeof res.path === 'string') ? res.path.trim() : ''
        const httpUrl = (res && res.success && typeof res.httpUrl === 'string') ? res.httpUrl.trim() : ''
        // 始终优先本地绝对路径，避免依赖本地 HTTP 服务监听地址
        const resolved = localPath || httpUrl
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
    const survivorModelPromises = []
    for (let i = 0; i < 4; i++) {
      const roleName = survivors[i] || ''
      survivorModelPromises.push(findOfficialModel(roleName))
    }
    const survivorModels = await Promise.all(survivorModelPromises)
    for (let i = 0; i < 4; i++) {
      const roleName = survivors[i] || ''
      const slotKey = `survivor${i + 1}`
      state.slotDisplayNames[slotKey] = roleName || ''
      const modelPath = survivorModels[i] || ''
      state.slotModelPaths[slotKey] = modelPath || ''
      if (roleName && !modelPath) {
        setStatus(`未命中本地模型: ${slotKey} -> ${roleName}`)
      }
      await loadModelForSlot(slotKey, modelPath)
      await new Promise((r) => setTimeout(r, 0))
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

  async function runBpRoleSyncLoop() {
    if (bpRoleSyncRunning) {
      bpRoleSyncPending = true
      return
    }
    bpRoleSyncRunning = true
    try {
      do {
        bpRoleSyncPending = false
        await updateRoleModelsByBp()
      } while (bpRoleSyncPending)
    } finally {
      bpRoleSyncRunning = false
      flushPendingCameraEvent()
    }
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
    if (key.startsWith('survivor')) {
      state.layout.survivorScale = uniform
      for (let i = 1; i <= 4; i++) {
        const slotKey = `survivor${i}`
        if (!state.layout.slots[slotKey]) state.layout.slots[slotKey] = {}
        state.layout.slots[slotKey].scale = { x: uniform, y: uniform, z: uniform }
        if (slotKey !== key) applyTransformToGroup(slotKey, state.layout.slots[slotKey])
      }
    } else if (key === 'hunter') {
      state.layout.hunterScale = uniform
    }
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
      if (state.selectedSlot.startsWith('survivor')) {
        dom.uniScale.value = asNumber(state.layout?.survivorScale, asNumber(tr.scale?.x, 1)).toFixed(3)
      } else if (state.selectedSlot === 'hunter') {
        dom.uniScale.value = asNumber(state.layout?.hunterScale, asNumber(tr.scale?.x, 1)).toFixed(3)
      } else {
        dom.uniScale.value = asNumber(tr.scale?.x, 1).toFixed(3)
      }
    }
  }

  function applyInputsToSelectedTransform() {
    const uniformScale = Math.max(0.001, asNumber(dom.uniScale.value, 1))
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
        x: uniformScale,
        y: uniformScale,
        z: uniformScale
      }
    }
    if (state.selectedSlot === 'light1') {
      tr.scale = { x: 1, y: 1, z: 1 }
    }
    if (state.selectedSlot === 'scene') {
      state.layout.scene = { ...state.layout.scene, ...tr }
    } else if (state.selectedSlot.startsWith('survivor')) {
      state.layout.survivorScale = uniformScale
      for (let i = 1; i <= 4; i++) {
        const slotKey = `survivor${i}`
        const prev = state.layout.slots[slotKey] || {}
        const slotTr = {
          ...prev,
          scale: { x: uniformScale, y: uniformScale, z: uniformScale }
        }
        if (slotKey === state.selectedSlot) {
          slotTr.position = tr.position
          slotTr.rotation = tr.rotation
        }
        state.layout.slots[slotKey] = slotTr
        applyTransformToGroup(slotKey, slotTr)
      }
      scheduleSaveLayout()
      return
    } else if (state.selectedSlot === 'hunter') {
      state.layout.hunterScale = uniformScale
      state.layout.slots.hunter = { ...state.layout.slots.hunter, ...tr, scale: { x: uniformScale, y: uniformScale, z: uniformScale } }
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
    applyEnvironmentPreset(state.layout.environmentPreset, false)
    applyRenderQualityPreset(state.layout.qualityPreset || 'high', false)
    updateKeyLightShadowFrustum()
    applyMode(state.layout.mode)
    applyOrbitFromLayout()
    renderSlotTabs()
    syncTransformInputs()
    syncLightInputs()
    syncVideoInputs()
    syncCameraEditorInputs()
    syncEntranceParticleUi()
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
          filters: [{ name: '3D场景', extensions: ['gltf', 'glb', 'obj'] }]
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

  function syncVideoInputs() {
    const cfg = state.layout?.videoScreen || DEFAULT_LAYOUT.videoScreen
    if (dom.videoLoopEnabled) dom.videoLoopEnabled.checked = cfg.loop !== false
    if (dom.videoMuted) dom.videoMuted.checked = cfg.muted !== false
    if (dom.videoWidth) dom.videoWidth.value = String(Math.max(0.1, asNumber(cfg.width, 2.2)).toFixed(2))
    if (dom.videoHeight) dom.videoHeight.value = String(Math.max(0.1, asNumber(cfg.height, 1.2)).toFixed(2))
  }

  function applyVideoSettingsFromInputs() {
    if (!state.layout.videoScreen) state.layout.videoScreen = deepClone(DEFAULT_LAYOUT.videoScreen)
    state.layout.videoScreen.loop = dom.videoLoopEnabled ? !!dom.videoLoopEnabled.checked : true
    state.layout.videoScreen.muted = dom.videoMuted ? !!dom.videoMuted.checked : true
    state.layout.videoScreen.width = Math.max(0.1, asNumber(dom.videoWidth ? dom.videoWidth.value : 2.2, 2.2))
    state.layout.videoScreen.height = Math.max(0.1, asNumber(dom.videoHeight ? dom.videoHeight.value : 1.2, 1.2))
    const runtime = slotRuntime.get('video1')
    if (runtime && runtime.model) applyVideoScreenSettingsToRuntime(runtime)
    syncVideoInputs()
    scheduleSaveLayout()
  }

  async function importVideoScreen() {
    let selectedPath = ''
    try {
      if (window.electronAPI && window.electronAPI.selectFileWithFilter) {
        const result = await window.electronAPI.selectFileWithFilter({
          filters: [{ name: '视频文件', extensions: ['mp4', 'webm', 'ogg', 'mov', 'm4v'] }]
        })
        if (result && result.success && result.path) {
          selectedPath = result.path
        }
      }
    } catch (error) {
      console.error('[CharacterModel3D] 选择视频文件失败:', error)
    }
    if (!selectedPath) {
      const input = window.prompt('请输入视频路径(URL 或本地路径):', state.layout?.videoScreen?.path || '')
      if (!input) return
      selectedPath = input.trim()
    }
    if (!selectedPath) return
    if (!state.layout.videoScreen) state.layout.videoScreen = deepClone(DEFAULT_LAYOUT.videoScreen)
    state.layout.videoScreen.path = selectedPath
    const result = await loadModelForSlot('video1', selectedPath)
    if (result && result.success) {
      state.selectedSlot = 'video1'
      renderSlotTabs()
      syncTransformInputs()
    }
    syncVideoInputs()
    scheduleSaveLayout()
  }

  function clearVideoScreen() {
    if (!state.layout.videoScreen) state.layout.videoScreen = deepClone(DEFAULT_LAYOUT.videoScreen)
    state.layout.videoScreen.path = ''
    removeModelFromSlot('video1')
    scheduleSaveLayout()
  }

  async function clearSceneModel() {
    state.layout.scene.modelPath = ''
    removeModelFromSlot('scene')
    scheduleSaveLayout()
  }

  async function importEntranceParticle() {
    let selectedPath = ''
    try {
      if (window.electronAPI && window.electronAPI.selectFileWithFilter) {
        const result = await window.electronAPI.selectFileWithFilter({
          filters: [{ name: '粒子特效(GLTF/GLB)', extensions: ['gltf', 'glb'] }]
        })
        if (result && result.success && result.path) selectedPath = result.path
      }
    } catch (error) {
      console.error('[CharacterModel3D] 选择粒子特效失败:', error)
    }
    if (!selectedPath) {
      const input = window.prompt('请输入粒子特效路径(GLTF/GLB，URL 或本地路径):', state.layout?.entranceParticle?.path || '')
      if (!input) return
      selectedPath = input.trim()
    }
    if (!selectedPath) return
    const ext = getPathExt(selectedPath)
    if (ext !== '.gltf' && ext !== '.glb') {
      window.alert('当前仅支持 GLTF/GLB 粒子特效文件')
      return
    }
    const loadResult = await ensureEntranceParticleAsset(selectedPath)
    if (!loadResult || !loadResult.success) {
      window.alert(`粒子特效加载失败: ${loadResult?.error || 'unknown-error'}`)
      return
    }
    if (!state.layout.entranceParticle) state.layout.entranceParticle = { path: '' }
    state.layout.entranceParticle.path = selectedPath
    syncEntranceParticleUi()
    scheduleSaveLayout()
    setStatus('已导入出场粒子特效')
  }

  function clearEntranceParticle() {
    if (!state.layout.entranceParticle) state.layout.entranceParticle = { path: '' }
    state.layout.entranceParticle.path = ''
    entranceParticleAsset.path = ''
    entranceParticleAsset.scene = null
    entranceParticleAsset.animations = []
    entranceParticleAsset.loadingPromise = null
    for (let i = activeParticleBursts.length - 1; i >= 0; i--) {
      const burst = activeParticleBursts[i]
      if (burst.node && burst.node.parent) burst.node.parent.remove(burst.node)
      activeParticleBursts.splice(i, 1)
    }
    syncEntranceParticleUi()
    scheduleSaveLayout()
    setStatus('已清除出场粒子特效')
  }

  function bindUiEvents() {
    dom.modeToggleBtn.addEventListener('click', () => {
      applyMode(state.layout.mode === 'edit' ? 'render' : 'edit')
    })
    dom.sceneImportBtn.addEventListener('click', importSceneModel)
    dom.sceneClearBtn.addEventListener('click', clearSceneModel)
    if (dom.particleImportBtn) dom.particleImportBtn.addEventListener('click', importEntranceParticle)
    if (dom.particleClearBtn) dom.particleClearBtn.addEventListener('click', clearEntranceParticle)
    if (dom.videoImportBtn) dom.videoImportBtn.addEventListener('click', importVideoScreen)
    if (dom.videoClearBtn) dom.videoClearBtn.addEventListener('click', clearVideoScreen)
    if (dom.applyVideoSettingsBtn) dom.applyVideoSettingsBtn.addEventListener('click', applyVideoSettingsFromInputs)
    dom.applyTransformBtn.addEventListener('click', applyInputsToSelectedTransform)
    if (dom.cameraEventSelect) {
      dom.cameraEventSelect.addEventListener('change', () => {
        syncCameraEditorInputs()
      })
    }
    if (dom.saveCameraKeyframeBtn) dom.saveCameraKeyframeBtn.addEventListener('click', saveCurrentCameraAsKeyframe)
    if (dom.previewCameraKeyframeBtn) dom.previewCameraKeyframeBtn.addEventListener('click', previewSelectedCameraKeyframe)
    if (dom.clearCameraKeyframeBtn) dom.clearCameraKeyframeBtn.addEventListener('click', clearSelectedCameraKeyframe)
    if (dom.cameraTransitionMs) {
      dom.cameraTransitionMs.addEventListener('change', () => {
        state.layout.cameraTransitionMs = Math.max(50, Math.min(10000, asNumber(dom.cameraTransitionMs.value, 900)))
        dom.cameraTransitionMs.value = String(state.layout.cameraTransitionMs)
        scheduleSaveLayout()
      })
    }
    if (dom.applyEnvironmentPresetBtn) {
      dom.applyEnvironmentPresetBtn.addEventListener('click', () => {
        const next = dom.environmentPresetSelect ? dom.environmentPresetSelect.value : state.layout.environmentPreset
        applyEnvironmentPreset(next, true)
      })
    }
    if (dom.environmentPresetSelect) {
      dom.environmentPresetSelect.addEventListener('change', () => {
        applyEnvironmentPreset(dom.environmentPresetSelect.value, true)
      })
    }
    if (dom.renderQualitySelect) {
      dom.renderQualitySelect.addEventListener('change', () => {
        applyRenderQualityPreset(dom.renderQualitySelect.value, true)
        setStatus(`画质: ${QUALITY_PRESETS[state.layout.qualityPreset || 'high']?.label || state.layout.qualityPreset}`)
      })
    }
    if (dom.fogEnabled) {
      dom.fogEnabled.addEventListener('change', () => {
        state.layout.fogEnabled = !!dom.fogEnabled.checked
        applyEnvironmentPreset(state.layout.environmentPreset, true)
        setStatus(`雾化效果滤镜: ${state.layout.fogEnabled ? '开启' : '关闭'}`)
      })
    }
    if (dom.fogStrength) {
      dom.fogStrength.addEventListener('change', () => {
        state.layout.fogStrength = Math.max(0, Math.min(3, asNumber(dom.fogStrength.value, 1)))
        dom.fogStrength.value = state.layout.fogStrength.toFixed(2)
        applyEnvironmentPreset(state.layout.environmentPreset, true)
        setStatus(`雾化强度: ${state.layout.fogStrength.toFixed(2)}`)
      })
    }
    if (dom.shadowStrength) {
      dom.shadowStrength.addEventListener('change', () => {
        state.layout.shadowStrength = Math.max(0, Math.min(1, asNumber(dom.shadowStrength.value, 0.45)))
        dom.shadowStrength.value = state.layout.shadowStrength.toFixed(2)
        applyEnvironmentPreset(state.layout.environmentPreset, true)
      })
    }
    if (dom.droneModeEnabled) {
      dom.droneModeEnabled.addEventListener('change', () => {
        state.layout.droneMode = !!dom.droneModeEnabled.checked
        setStatus(`无人机模式: ${state.layout.droneMode ? '开启' : '关闭'}`)
        scheduleSaveLayout()
      })
    }
    if (dom.entranceEffectSelect) {
      dom.entranceEffectSelect.addEventListener('change', () => {
        const next = dom.entranceEffectSelect.value
        state.layout.entranceEffect = (next === 'none' || next === 'flameDissolve') ? next : 'fade'
        scheduleSaveLayout()
      })
    }
    if (dom.cameraMoveStep) {
      dom.cameraMoveStep.addEventListener('change', () => {
        const next = getCameraMoveStep()
        dom.cameraMoveStep.value = String(next)
      })
    }
    if (Array.isArray(dom.cameraMoveButtons)) {
      dom.cameraMoveButtons.forEach((btn) => {
        const dir = String(btn.dataset.camMove || '').trim()
        if (!dir) return
        btn.addEventListener('click', (e) => {
          e.preventDefault()
          moveCameraByDirection(dir, 1, true, true)
        })
        btn.addEventListener('pointerdown', (e) => {
          if (e.button !== 0) return
          e.preventDefault()
          if (cameraMoveState.activeBtn && cameraMoveState.activeBtn !== btn) {
            cameraMoveState.activeBtn.classList.remove('active')
          }
          cameraMoveState.activeBtn = btn
          cameraMoveState.dir = dir
          btn.classList.add('active')
        })
        btn.addEventListener('pointerup', stopCameraMoveHold)
        btn.addEventListener('pointercancel', stopCameraMoveHold)
      })
      window.addEventListener('pointerup', stopCameraMoveHold)
      window.addEventListener('blur', stopCameraMoveHold)
    }
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
      const key = String(e.key || '').toLowerCase()
      if (key === 'shift' || isCameraMoveKey(key)) {
        cameraKeyboardState.pressed.add(key)
        cancelCameraTransition()
        e.preventDefault()
        return
      }

      const runtime = slotRuntime.get(state.selectedSlot)
      if (!runtime || !runtime.group) return
      const step = e.shiftKey ? 0.2 : 0.05
      let changed = true

      if (e.key === 'ArrowUp') runtime.group.position.z -= step
      else if (e.key === 'ArrowDown') runtime.group.position.z += step
      else if (e.key === 'ArrowLeft') runtime.group.position.x -= step
      else if (e.key === 'ArrowRight') runtime.group.position.x += step
      else if (e.key === 'PageUp') runtime.group.position.y += step
      else if (e.key === 'PageDown') runtime.group.position.y -= step
      else changed = false

      if (!changed) return
      e.preventDefault()
      snapshotTransformFromGroup(state.selectedSlot)
      syncTransformInputs()
      scheduleSaveLayout()
    }, true)

    window.addEventListener('keyup', (e) => {
      const key = String(e.key || '').toLowerCase()
      if (key !== 'shift' && !isCameraMoveKey(key)) return
      cameraKeyboardState.pressed.delete(key)
      if (!hasActiveCameraKeyboardMove() && cameraKeyboardState.dirty) {
        cameraKeyboardState.dirty = false
        saveCameraToLayout()
      }
    }, true)

    window.addEventListener('blur', () => {
      if (cameraKeyboardState.dirty) {
        cameraKeyboardState.dirty = false
        saveCameraToLayout()
      }
      cameraKeyboardState.pressed.clear()
    })

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
      cancelCameraTransition()
      stopCameraMoveHold()
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
        const panScale = Math.max(0.001, orbit.desiredRadius * 0.0016)
        const forward = new THREE.Vector3()
        camera.getWorldDirection(forward)
        const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize()
        const up = new THREE.Vector3().copy(camera.up).normalize()
        orbit.desiredTarget.x += (-dx * panScale * right.x) + (dy * panScale * up.x)
        orbit.desiredTarget.y += (-dx * panScale * right.y) + (dy * panScale * up.y)
        orbit.desiredTarget.z += (-dx * panScale * right.z) + (dy * panScale * up.z)
      } else {
        orbit.desiredYaw -= dx * 0.0048
        orbit.desiredPitch -= dy * 0.0044
      }
    })

    dom.renderRoot.addEventListener('wheel', (e) => {
      if (state.layout.mode !== 'edit') return
      e.preventDefault()
      cancelCameraTransition()
      const zoomFactor = Math.exp(e.deltaY * CAMERA_ZOOM_FACTOR)
      const baseRadius = Number.isFinite(orbit.desiredRadius) && orbit.desiredRadius > CAMERA_EPSILON_RADIUS
        ? orbit.desiredRadius
        : (Number.isFinite(orbit.radius) && orbit.radius > CAMERA_EPSILON_RADIUS ? orbit.radius : 1)
      orbit.desiredRadius = Math.max(CAMERA_EPSILON_RADIUS, baseRadius * zoomFactor)
      saveCameraToLayout()
    }, { passive: false })
  }

  function renderLoop() {
    rafId = requestAnimationFrame(renderLoop)
    const dt = clock.getDelta()
    fpsAccum += dt
    fpsFrames += 1
    if (fpsAccum >= 0.4) {
      fpsLast = Math.round(fpsFrames / Math.max(0.0001, fpsAccum))
      fpsAccum = 0
      fpsFrames = 0
      if (dom.fpsBadge) dom.fpsBadge.textContent = `FPS: ${fpsLast}`
    }
    for (const mixer of mixers.values()) {
      try { mixer.update(dt) } catch { }
    }
    updateEntranceEffects()
    updateParticleBursts(dt)
    if (cameraMoveState.dir && !cameraTransition) {
      moveCameraByDirection(cameraMoveState.dir, dt * 5.2, false, false)
    }
    applyCameraKeyboardInput(dt)
    if (cameraTransition) {
      updateCameraTransition()
    } else {
      updateCameraFromOrbit(false)
    }
    updateKeyLightShadowFrustum()
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
    const prevSurvivorCount = state.bpSelectionState.survivorCount || 0
    const prevHunterSelected = !!state.bpSelectionState.hunterSelected
    const incomingSurvivors = Array.isArray(nextState.survivors)
      ? nextState.survivors
      : (Array.isArray(nextState?.currentRoundData?.selectedSurvivors) ? nextState.currentRoundData.selectedSurvivors : [null, null, null, null])
    const incomingHunter = (typeof nextState.hunter === 'string' && nextState.hunter)
      ? nextState.hunter
      : (nextState?.currentRoundData?.selectedHunter || null)

    state.bp.survivors = Array.isArray(incomingSurvivors) ? incomingSurvivors.slice(0, 4) : [null, null, null, null]
    while (state.bp.survivors.length < 4) state.bp.survivors.push(null)
    state.bp.hunter = incomingHunter || null

    const nextSurvivorCount = countSelectedSurvivors(state.bp.survivors)
    const nextHunterSelected = isHunterSelected(state.bp.hunter)
    state.bpSelectionState = {
      survivorCount: nextSurvivorCount,
      hunterSelected: nextHunterSelected
    }

    if (nextSurvivorCount === 0 && !nextHunterSelected) {
      cancelCameraTransition()
    } else {
      let cameraEventKey = ''
      if (nextSurvivorCount > prevSurvivorCount) {
        cameraEventKey = `survivor${Math.min(nextSurvivorCount, 4)}`
      }
      if (!prevHunterSelected && nextHunterSelected) {
        cameraEventKey = 'hunterSelected'
      }
      if (cameraEventKey) requestCameraEvent(cameraEventKey)
    }

    // 注意：这里不覆盖本窗口相机/布局，避免切换视角后被回退。
    // 只做 BP 角色同步。
    runBpRoleSyncLoop()
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
        state.bpSelectionState = {
          survivorCount: countSelectedSurvivors(state.bp.survivors),
          hunterSelected: isHunterSelected(state.bp.hunter)
        }
      }
    } catch (error) {
      console.error('[CharacterModel3D] 读取初始状态失败:', error)
    }
    applyLayoutToScene()
    if (state.layout.scene.modelPath) {
      await loadModelForSlot('scene', state.layout.scene.modelPath)
    }
    if (state.layout?.videoScreen?.path) {
      await loadModelForSlot('video1', state.layout.videoScreen.path)
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
