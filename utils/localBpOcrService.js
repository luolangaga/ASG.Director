const { desktopCapturer } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const { pinyin } = require('pinyin-pro')
let sharp = null
try {
  sharp = require('sharp')
} catch {
  sharp = null
}
if (sharp) {
  try {
    // Bound native memory cache from libvips to avoid steady growth.
    sharp.cache({ memory: 32, files: 0, items: 100 })
    sharp.concurrency(Math.max(1, Math.min(2, os.cpus()?.length || 1)))
  } catch {}
}

const REGION_KEYS = ['survivors', 'hunter', 'survivorBans', 'hunterBans']
const WINDOWS_WORKER_MAX_REQUESTS = 120
const PADDLE_WORKER_MAX_REQUESTS = 100
const OCR_CAPTURE_THUMBNAIL_SIZE = { width: 1920, height: 1080 }

const DEFAULT_CONFIG = {
  windowSourceId: '',
  windowName: '',
  intervalMs: 4000,
  preferredEngine: 'windows',
  fuzzyThreshold: 0.56,
  regions: {
    survivors: null,
    hunter: null,
    survivorBans: null,
    hunterBans: null
  }
}

const PADDLE_PYTHON_URL = 'https://github.com/astral-sh/python-build-standalone/releases/download/20240224/cpython-3.11.8+20240224-x86_64-pc-windows-msvc-shared-install_only.tar.gz'

function clamp(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  if (n < min) return min
  if (n > max) return max
  return n
}

function clamp01(value) {
  return clamp(value, 0, 1)
}

function uniq(list) {
  return Array.from(new Set((Array.isArray(list) ? list : []).filter(Boolean)))
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readJsonSafe(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback
    const raw = fs.readFileSync(filePath, 'utf8')
    if (!raw || !raw.trim()) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJsonSafe(filePath, data) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function sanitizeText(text) {
  return String(text || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
}

function normalizeMatchText(text) {
  return String(text || '')
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')
    .toLowerCase()
}

function levenshteinDistance(a, b) {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length
  const m = a.length
  const n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      )
    }
  }
  return dp[m][n]
}

function similarity(a, b) {
  if (!a && !b) return 1
  if (!a || !b) return 0
  const dist = levenshteinDistance(a, b)
  const maxLen = Math.max(a.length, b.length)
  if (!maxLen) return 1
  return 1 - dist / maxLen
}

class LocalBpOcrService {
  constructor(options = {}) {
    this.userDataPath = options.userDataPath || process.cwd()
    this.getCharacterIndex = typeof options.getCharacterIndex === 'function'
      ? options.getCharacterIndex
      : () => ({ survivors: [], hunters: [] })
    this.applyMatchedResult = typeof options.applyMatchedResult === 'function'
      ? options.applyMatchedResult
      : () => ({ applied: false, reason: 'apply callback missing' })
    this.log = typeof options.log === 'function' ? options.log : () => {}

    this.runtimeDir = path.join(this.userDataPath, 'local-bp-ocr')
    this.configPath = path.join(this.runtimeDir, 'config.json')
    this.windowsOcrScriptPath = path.join(this.runtimeDir, 'windows-ocr.ps1')
    this.windowsOcrWorkerScriptPath = path.join(this.runtimeDir, 'windows-ocr-worker.ps1')
    this.paddleRoot = path.join(this.runtimeDir, 'paddleocr')
    this.paddlePythonRoot = path.join(this.paddleRoot, 'python')
    this.paddlePythonExe = path.join(this.paddlePythonRoot, 'python.exe')
    this.paddleOcrScriptPath = path.join(this.paddleRoot, 'ocr.py')
    this.paddleOcrWorkerScriptPath = path.join(this.paddleRoot, 'ocr-worker.py')
    this.paddleInstallScriptPath = path.join(this.runtimeDir, 'install-paddleocr.ps1')

    this.installState = {
      running: false,
      startedAt: 0,
      finishedAt: 0,
      success: false,
      message: '',
      logs: [],
      exitCode: null
    }

    this._metaCache = new Map()
    this.config = this._loadConfig()
    this.lastRecognition = null
    this.lastError = null
    this.paddleRuntime = {
      workerActive: false,
      workerReady: false,
      useGpu: false,
      workerStartedAt: 0,
      workerRequests: 0
    }
    this.windowsRuntime = {
      workerActive: false,
      workerReady: false,
      workerStartedAt: 0,
      workerRequests: 0
    }
    this._windowsWorker = null
    this._windowsWorkerReady = false
    this._windowsWorkerReadyPromise = null
    this._windowsWorkerBuffer = ''
    this._windowsWorkerPending = new Map()
    this._windowsWorkerRequestSeq = 0
    this._paddleWorker = null
    this._paddleWorkerReady = false
    this._paddleWorkerReadyPromise = null
    this._paddleWorkerBuffer = ''
    this._paddleWorkerPending = new Map()
    this._paddleWorkerRequestSeq = 0

    ensureDir(this.runtimeDir)
  }

  _defaultConfig() {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG))
  }

  _normalizeRegion(region) {
    if (!region || typeof region !== 'object') return null
    const x = clamp01(region.x)
    const y = clamp01(region.y)
    const width = clamp01(region.width)
    const height = clamp01(region.height)
    if (width <= 0 || height <= 0) return null
    if (x + width > 1 || y + height > 1) return null
    return { x, y, width, height }
  }

  _normalizeConfig(input) {
    const base = this._defaultConfig()
    const cfg = (input && typeof input === 'object') ? input : {}
    const out = {
      windowSourceId: typeof cfg.windowSourceId === 'string' ? cfg.windowSourceId : base.windowSourceId,
      windowName: typeof cfg.windowName === 'string' ? cfg.windowName : base.windowName,
      intervalMs: Math.round(clamp(cfg.intervalMs ?? base.intervalMs, 1000, 30000)),
      preferredEngine: cfg.preferredEngine === 'paddleocr' ? 'paddleocr' : 'windows',
      fuzzyThreshold: clamp(cfg.fuzzyThreshold ?? base.fuzzyThreshold, 0.3, 0.95),
      regions: {
        survivors: null,
        hunter: null,
        survivorBans: null,
        hunterBans: null
      }
    }
    const inputRegions = (cfg.regions && typeof cfg.regions === 'object') ? cfg.regions : {}
    for (const key of REGION_KEYS) {
      out.regions[key] = this._normalizeRegion(inputRegions[key])
    }
    return out
  }

  _loadConfig() {
    const raw = readJsonSafe(this.configPath, this._defaultConfig())
    const normalized = this._normalizeConfig(raw)
    try {
      writeJsonSafe(this.configPath, normalized)
    } catch {
      // ignore
    }
    return normalized
  }

  _saveConfig() {
    writeJsonSafe(this.configPath, this.config)
  }

  getConfig() {
    return JSON.parse(JSON.stringify(this.config))
  }

  updateConfig(patch) {
    const merged = {
      ...this.config,
      ...(patch && typeof patch === 'object' ? patch : {}),
      regions: {
        ...(this.config.regions || {}),
        ...((patch && patch.regions && typeof patch.regions === 'object') ? patch.regions : {})
      }
    }
    this.config = this._normalizeConfig(merged)
    this._saveConfig()
    return this.getConfig()
  }

  _clearMetaCache() {
    this._metaCache.clear()
  }

  _buildNameMeta(names) {
    const list = Array.isArray(names) ? names : []
    const key = list.join('|')
    if (this._metaCache.has(key)) {
      return this._metaCache.get(key)
    }
    const metas = list.map((name) => {
      const cleanName = String(name || '').trim()
      let pyFull = ''
      let pyInitials = ''
      try {
        const arr = pinyin(cleanName, { toneType: 'none', type: 'array' })
        if (Array.isArray(arr) && arr.length) {
          pyFull = arr.join('').toLowerCase()
          pyInitials = arr.map((v) => (v && v[0]) ? v[0] : '').join('').toLowerCase()
        }
      } catch {
        // ignore pinyin failures
      }
      return {
        name: cleanName,
        normalized: normalizeMatchText(cleanName),
        pinyinFull: pyFull,
        pinyinInitials: pyInitials
      }
    }).filter(item => item.name)
    this._metaCache.set(key, metas)
    return metas
  }

  _tokenize(rawText) {
    const text = String(rawText || '').trim()
    if (!text) return []
    const tokens = []
    const push = (v) => {
      const t = String(v || '').trim()
      if (!t) return
      if (!tokens.includes(t)) tokens.push(t)
    }

    const firstSplit = text.split(/[\r\n\t|/\\,，。;；:：\[\]{}()《》<>【】]/g)
    for (const part of firstSplit) {
      const trimmed = part.trim()
      if (!trimmed) continue
      const byWideSpace = trimmed.split(/\s{2,}/g).map(s => s.trim()).filter(Boolean)
      if (byWideSpace.length > 1) {
        byWideSpace.forEach(push)
      } else {
        push(trimmed)
      }
    }

    const cjkChunks = text.match(/[\u4e00-\u9fa5a-zA-Z0-9]+/g) || []
    cjkChunks.forEach(push)

    if (tokens.length > 0) {
      push(text)
    }

    return tokens.slice(0, 80)
  }

  _scoreCandidate(token, tokenNorm, candidateMeta) {
    const raw = String(token || '').trim()
    if (!raw) return 0
    const rawLower = raw.toLowerCase()
    const tokenNormLen = (tokenNorm || '').length
    const candidateNormLen = (candidateMeta?.normalized || '').length
    let score = 0

    if (raw === candidateMeta.name) score = 1
    if (
      tokenNormLen >= 2 &&
      candidateNormLen >= 2 &&
      (raw.includes(candidateMeta.name) || candidateMeta.name.includes(raw))
    ) {
      const overlapRatio = Math.min(tokenNormLen, candidateNormLen) / Math.max(tokenNormLen, candidateNormLen)
      if (overlapRatio >= 0.6) {
        score = Math.max(score, 0.88 + overlapRatio * 0.04)
      }
    }
    if (tokenNorm && tokenNorm === candidateMeta.normalized) score = Math.max(score, 0.96)
    if (
      tokenNormLen >= 2 &&
      candidateNormLen >= 2 &&
      (tokenNorm.includes(candidateMeta.normalized) || candidateMeta.normalized.includes(tokenNorm))
    ) {
      const overlapRatio = Math.min(tokenNormLen, candidateNormLen) / Math.max(tokenNormLen, candidateNormLen)
      if (overlapRatio >= 0.6) {
        score = Math.max(score, 0.84 + overlapRatio * 0.06)
      }
    }

    if (candidateMeta.pinyinFull) {
      if (
        rawLower.length >= 2 &&
        (rawLower === candidateMeta.pinyinFull || rawLower === candidateMeta.pinyinInitials)
      ) {
        score = Math.max(score, 0.9)
      } else if (
        rawLower.length >= 2 &&
        (
          candidateMeta.pinyinFull.startsWith(rawLower) ||
          candidateMeta.pinyinInitials.startsWith(rawLower)
        )
      ) {
        score = Math.max(score, 0.82)
      }
    }

    if (tokenNorm && candidateMeta.normalized) {
      const sim = similarity(tokenNorm, candidateMeta.normalized)
      score = Math.max(score, sim * 0.82)
    }

    return score
  }

  _matchTokenToName(token, nameMetas, threshold) {
    const tokenText = String(token || '').trim()
    if (!tokenText) return null
    const tokenNorm = normalizeMatchText(tokenText)
    let best = null
    for (const meta of nameMetas) {
      const score = this._scoreCandidate(tokenText, tokenNorm, meta)
      if (!best || score > best.score) {
        best = { name: meta.name, score }
      }
    }
    if (!best || best.score < threshold) return null
    return best
  }

  _extractBySubstring(rawText, allNames, { maxCount = 0 } = {}) {
    const normalizedText = normalizeMatchText(rawText)
    if (!normalizedText) return []
    const metas = this._buildNameMeta(allNames)
      .filter(item => item.normalized && item.normalized.length >= 2)
      .sort((a, b) => b.normalized.length - a.normalized.length)
    if (!metas.length) return []

    const picked = []
    let pos = 0
    while (pos < normalizedText.length) {
      let hit = null
      for (const meta of metas) {
        if (normalizedText.startsWith(meta.normalized, pos)) {
          hit = meta
          break
        }
      }
      if (hit) {
        if (!picked.includes(hit.name)) {
          picked.push(hit.name)
          if (maxCount > 0 && picked.length >= maxCount) break
        }
        pos += Math.max(1, hit.normalized.length)
        continue
      }
      pos += 1
    }
    return picked
  }

  _extractNames(rawText, allNames, {
    maxCount = 0,
    threshold = 0.56,
    allowWholeMatch = true,
    allowSubstring = true,
    minTokenLength = 2
  } = {}) {
    const metas = this._buildNameMeta(allNames)
    const tokens = this._tokenize(rawText)
    const picked = []
    for (const token of tokens) {
      const tokenNorm = normalizeMatchText(token)
      if ((tokenNorm || '').length < Math.max(1, minTokenLength)) continue
      const matched = this._matchTokenToName(token, metas, threshold)
      if (!matched) continue
      if (!picked.includes(matched.name)) {
        picked.push(matched.name)
      }
      if (maxCount > 0 && picked.length >= maxCount) break
    }

    if (allowWholeMatch && !picked.length && rawText) {
      const wholeMatch = this._matchTokenToName(rawText, metas, threshold + 0.05)
      if (wholeMatch) picked.push(wholeMatch.name)
    }

    if (allowSubstring && (!picked.length || (maxCount > 0 && picked.length < maxCount)) && rawText) {
      const bySubstring = this._extractBySubstring(rawText, allNames, { maxCount })
      for (const name of bySubstring) {
        if (!picked.includes(name)) picked.push(name)
        if (maxCount > 0 && picked.length >= maxCount) break
      }
    }

    if (maxCount > 0) return picked.slice(0, maxCount)
    return picked
  }

  _matchRecognized(rawResult) {
    const idx = this.getCharacterIndex() || { survivors: [], hunters: [] }
    const survivorNames = Array.isArray(idx.survivors) ? idx.survivors : []
    const hunterNames = Array.isArray(idx.hunters) ? idx.hunters : []
    const threshold = clamp(this.config.fuzzyThreshold, 0.3, 0.95)
    const strictThreshold = clamp(threshold + 0.1, 0.45, 0.95)

    const matchedSurvivors = this._extractNames(rawResult.survivors, survivorNames, {
      maxCount: 4,
      threshold,
      allowWholeMatch: true,
      allowSubstring: true,
      minTokenLength: 2
    })
    const matchedHunter = this._extractNames(rawResult.hunter, hunterNames, {
      maxCount: 1,
      threshold: strictThreshold,
      allowWholeMatch: true,
      allowSubstring: false,
      minTokenLength: 2
    })[0] || null
    const matchedSurvivorBans = this._extractNames(rawResult.survivorBans, survivorNames, {
      maxCount: 10,
      threshold: strictThreshold,
      allowWholeMatch: true,
      allowSubstring: false,
      minTokenLength: 2
    })
    const matchedHunterBans = this._extractNames(rawResult.hunterBans, hunterNames, {
      maxCount: 10,
      threshold: strictThreshold,
      allowWholeMatch: true,
      allowSubstring: false,
      minTokenLength: 2
    })

    return {
      survivors: matchedSurvivors,
      hunter: matchedHunter,
      survivorBans: uniq(matchedSurvivorBans),
      hunterBans: uniq(matchedHunterBans)
    }
  }

  async _getWindowSources(thumbnailSize = { width: 800, height: 450 }) {
    return desktopCapturer.getSources({
      types: ['window'],
      fetchWindowIcons: false,
      thumbnailSize
    })
  }

  _resolveSourceByConfig(sources, cfg) {
    if (!Array.isArray(sources) || !sources.length) return null
    if (cfg.windowSourceId) {
      const byId = sources.find(s => s.id === cfg.windowSourceId)
      if (byId) return byId
    }
    if (cfg.windowName) {
      const byName = sources.find(s => s.name === cfg.windowName)
      if (byName) return byName
    }
    return null
  }

  async listWindowSources() {
    const sources = await this._getWindowSources({ width: 320, height: 180 })
    const list = sources
      .filter(s => typeof s.name === 'string' && s.name.trim())
      .map(s => ({
        id: s.id,
        name: s.name
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    return {
      success: true,
      data: list
    }
  }

  async capturePreview(sourceId) {
    const id = typeof sourceId === 'string' && sourceId ? sourceId : this.config.windowSourceId
    if (!id) {
      return { success: false, error: '未选择窗口' }
    }
    const sources = await this._getWindowSources({ width: 1920, height: 1080 })
    const source = sources.find(s => s.id === id)
    if (!source) {
      return { success: false, error: '目标窗口未找到，请重新选择窗口' }
    }
    const size = source.thumbnail.getSize()
    if (!size.width || !size.height) {
      return { success: false, error: '窗口预览为空，请确保目标窗口可见且未最小化' }
    }
    const data = {
      sourceId: source.id,
      sourceName: source.name,
      width: size.width,
      height: size.height,
      dataUrl: source.thumbnail.toDataURL()
    }
    return { success: true, data }
  }

  _regionToRect(region, width, height) {
    if (!region || typeof region !== 'object') return null
    const x = Math.round(clamp01(region.x) * width)
    const y = Math.round(clamp01(region.y) * height)
    const w = Math.round(clamp01(region.width) * width)
    const h = Math.round(clamp01(region.height) * height)
    const safeX = clamp(x, 0, width - 1)
    const safeY = clamp(y, 0, height - 1)
    const safeW = clamp(w, 1, width - safeX)
    const safeH = clamp(h, 1, height - safeY)
    if (safeW <= 1 || safeH <= 1) return null
    return { x: safeX, y: safeY, width: safeW, height: safeH }
  }

  _scoreRecognizedText(text) {
    const clean = sanitizeText(text)
    if (!clean) return 0
    const zhCount = (clean.match(/[\u4e00-\u9fff]/g) || []).length
    const asciiCount = (clean.match(/[a-zA-Z0-9]/g) || []).length
    return zhCount * 3 + asciiCount + clean.length * 0.4
  }

  _getEarlyStopScore(regionKey, preferredEngine) {
    if (preferredEngine === 'paddleocr') {
      if (regionKey === 'hunter' || regionKey === 'hunterBans') return 4
      if (regionKey === 'survivorBans') return 8
      return 10
    }
    return 18
  }

  _cleanupTempFiles(files) {
    for (const filePath of (Array.isArray(files) ? files : [])) {
      try { fs.unlinkSync(filePath) } catch {}
    }
  }

  async _buildOcrImageCandidates(pngBuffer, key) {
    const stamp = `${Date.now()}_${Math.random().toString(16).slice(2)}_${key}`
    const files = []
    const candidates = []

    const pushBuffer = (buffer, label) => {
      const filePath = path.join(os.tmpdir(), `asg_local_bp_ocr_${stamp}_${label}.png`)
      fs.writeFileSync(filePath, buffer)
      files.push(filePath)
      candidates.push({ path: filePath, label })
    }

    pushBuffer(pngBuffer, 'orig')
    if (!sharp) {
      return { candidates, files }
    }

    try {
      const meta = await sharp(pngBuffer).metadata()
      const width = clamp(meta?.width ?? 0, 32, 4096)
      const height = clamp(meta?.height ?? 0, 24, 4096)
      const upscaleWidth = Math.min(4096, Math.max(width * 2, width + 140))
      const upscaleHeight = Math.min(4096, Math.max(height * 2, height + 80))

      const enhanced = await sharp(pngBuffer)
        .resize({ width: upscaleWidth, height: upscaleHeight, kernel: sharp.kernel.lanczos3 })
        .normalize()
        .sharpen({ sigma: 0.9 })
        .png()
        .toBuffer()
      pushBuffer(enhanced, 'enhanced')

      const highContrast = await sharp(pngBuffer)
        .resize({ width: upscaleWidth, height: upscaleHeight, kernel: sharp.kernel.lanczos3 })
        .greyscale()
        .normalize()
        .sharpen({ sigma: 1.1 })
        .threshold(150)
        .png()
        .toBuffer()
      pushBuffer(highContrast, 'contrast')
    } catch (error) {
      this.log('[LocalBpOCR] build image candidates failed:', error?.message || error)
    }

    return { candidates, files }
  }

  _ensureWindowsOcrScript() {
    ensureDir(path.dirname(this.windowsOcrScriptPath))
    const script = `
param(
  [Parameter(Mandatory = $true)]
  [string]$ImagePath
)

$ErrorActionPreference = 'Stop'
try {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [Console]::OutputEncoding = $utf8NoBom
  [Console]::InputEncoding = $utf8NoBom
  $OutputEncoding = $utf8NoBom
} catch {}

if (!(Test-Path -LiteralPath $ImagePath)) {
  throw "Image not found: $ImagePath"
}

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop
} catch {
  throw "Failed to load System.Runtime.WindowsRuntime: $($_.Exception.Message)"
}

$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapPixelFormat, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]
$null = [System.WindowsRuntimeSystemExtensions]

function Invoke-WinRtAwait {
  param(
    [Parameter(Mandatory = $true)] [Object]$AsyncOperation,
    [Type]$ResultType
  )

  $method = $null
  foreach ($m in [System.WindowsRuntimeSystemExtensions].GetMethods()) {
    if ($m.Name -ne 'AsTask') { continue }
    try { $paramCount = $m.GetParameters().Count } catch { continue }
    if ($paramCount -ne 1) { continue }

    if ($ResultType) {
      if (-not $m.IsGenericMethod) { continue }
      $method = $m
      break
    }

    if (-not $m.IsGenericMethod) {
      $method = $m
      break
    }
  }

  if ($null -eq $method) {
    throw 'WindowsRuntime AsTask API unavailable'
  }

  if ($ResultType) {
    $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($AsyncOperation))
  } else {
    $task = $method.Invoke($null, @($AsyncOperation))
  }

  $task.Wait()
  if ($task.Exception) {
    throw $task.Exception.InnerException
  }

  if ($ResultType) {
    return $task.Result
  }

  return $null
}

$file = Invoke-WinRtAwait ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
$stream = Invoke-WinRtAwait ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Invoke-WinRtAwait ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Invoke-WinRtAwait ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

if ($bitmap.BitmapPixelFormat -ne [Windows.Graphics.Imaging.BitmapPixelFormat]::Gray8 -and
    $bitmap.BitmapPixelFormat -ne [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8) {
  $bitmap = [Windows.Graphics.Imaging.SoftwareBitmap]::Convert(
    $bitmap,
    [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8
  )
}

$langs = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
if ($null -eq $langs -or $langs.Count -eq 0) {
  throw 'No OCR language installed in Windows'
}

$allTags = @($langs | ForEach-Object {
  $tag = [string]$_.LanguageTag
  if ([string]::IsNullOrWhiteSpace($tag)) { return }
  $tag
})

function Is-SimplifiedChineseTag {
  param([string]$Tag)
  if ([string]::IsNullOrWhiteSpace($Tag)) { return $false }
  $t = $Tag.ToLowerInvariant()
  if ($t -eq 'zh-cn' -or $t.StartsWith('zh-cn-')) { return $true }
  if ($t -eq 'zh-hans' -or $t.StartsWith('zh-hans-')) { return $true }
  if ($t -eq 'zh-sg' -or $t.StartsWith('zh-sg-')) { return $true }
  return $false
}

$targetLang = $langs |
  Where-Object { ([string]$_.LanguageTag).ToLowerInvariant() -eq 'zh-cn' } |
  Select-Object -First 1

if ($null -eq $targetLang) {
  $targetLang = $langs |
    Where-Object { Is-SimplifiedChineseTag ([string]$_.LanguageTag) } |
    Select-Object -First 1
}

if ($null -eq $targetLang) {
  $tagsText = ($allTags -join ', ')
  throw "Simplified Chinese OCR language pack missing. Available languages: $tagsText"
}

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($targetLang)
if ($null -eq $engine) {
  throw "Windows OCR cannot create engine for language: $([string]$targetLang.LanguageTag)"
}

$result = Invoke-WinRtAwait ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$text = ''
if ($null -ne $result) {
  $text = [string]$result.Text
}
$text = ($text -replace '[\r\n\t]+', ' ' -replace '\s{2,}', ' ').Trim()
Write-Output $text
`
    fs.writeFileSync(this.windowsOcrScriptPath, script.trim(), 'utf8')
  }

  _ensureWindowsOcrWorkerScript() {
    ensureDir(path.dirname(this.windowsOcrWorkerScriptPath))
    const script = `
$ErrorActionPreference = 'Stop'
try {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [Console]::OutputEncoding = $utf8NoBom
  [Console]::InputEncoding = $utf8NoBom
  $OutputEncoding = $utf8NoBom
} catch {}

function Write-JsonLine {
  param([Parameter(Mandatory = $true)][Object]$Payload)
  $json = $Payload | ConvertTo-Json -Compress -Depth 8
  [Console]::Out.WriteLine($json)
}

try {
  Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop
} catch {
  throw "Failed to load System.Runtime.WindowsRuntime: $($_.Exception.Message)"
}

$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapPixelFormat, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]
$null = [System.WindowsRuntimeSystemExtensions]

function Invoke-WinRtAwait {
  param(
    [Parameter(Mandatory = $true)] [Object]$AsyncOperation,
    [Type]$ResultType
  )

  $method = $null
  foreach ($m in [System.WindowsRuntimeSystemExtensions].GetMethods()) {
    if ($m.Name -ne 'AsTask') { continue }
    try { $paramCount = $m.GetParameters().Count } catch { continue }
    if ($paramCount -ne 1) { continue }

    if ($ResultType) {
      if (-not $m.IsGenericMethod) { continue }
      $method = $m
      break
    }

    if (-not $m.IsGenericMethod) {
      $method = $m
      break
    }
  }

  if ($null -eq $method) {
    throw 'WindowsRuntime AsTask API unavailable'
  }

  if ($ResultType) {
    $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($AsyncOperation))
  } else {
    $task = $method.Invoke($null, @($AsyncOperation))
  }

  $task.Wait()
  if ($task.Exception) {
    throw $task.Exception.InnerException
  }

  if ($ResultType) {
    return $task.Result
  }

  return $null
}

function Is-SimplifiedChineseTag {
  param([string]$Tag)
  if ([string]::IsNullOrWhiteSpace($Tag)) { return $false }
  $t = $Tag.ToLowerInvariant()
  if ($t -eq 'zh-cn' -or $t.StartsWith('zh-cn-')) { return $true }
  if ($t -eq 'zh-hans' -or $t.StartsWith('zh-hans-')) { return $true }
  if ($t -eq 'zh-sg' -or $t.StartsWith('zh-sg-')) { return $true }
  return $false
}

function New-SimplifiedChineseOcrEngine {
  $langs = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
  if ($null -eq $langs -or $langs.Count -eq 0) {
    throw 'No OCR language installed in Windows'
  }

  $allTags = @($langs | ForEach-Object {
    $tag = [string]$_.LanguageTag
    if ([string]::IsNullOrWhiteSpace($tag)) { return }
    $tag
  })

  $targetLang = $langs |
    Where-Object { ([string]$_.LanguageTag).ToLowerInvariant() -eq 'zh-cn' } |
    Select-Object -First 1

  if ($null -eq $targetLang) {
    $targetLang = $langs |
      Where-Object { Is-SimplifiedChineseTag ([string]$_.LanguageTag) } |
      Select-Object -First 1
  }

  if ($null -eq $targetLang) {
    $tagsText = ($allTags -join ', ')
    throw "Simplified Chinese OCR language pack missing. Available languages: $tagsText"
  }

  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($targetLang)
  if ($null -eq $engine) {
    throw "Windows OCR cannot create engine for language: $([string]$targetLang.LanguageTag)"
  }
  return $engine
}

function Get-OcrText {
  param([Parameter(Mandatory = $true)][string]$ImagePath)
  if (!(Test-Path -LiteralPath $ImagePath)) {
    throw "Image not found: $ImagePath"
  }

  $stream = $null
  $bitmap = $null
  try {
    $file = Invoke-WinRtAwait ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
    $stream = Invoke-WinRtAwait ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Invoke-WinRtAwait ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Invoke-WinRtAwait ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

    if ($bitmap.BitmapPixelFormat -ne [Windows.Graphics.Imaging.BitmapPixelFormat]::Gray8 -and
        $bitmap.BitmapPixelFormat -ne [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8) {
      $bitmap = [Windows.Graphics.Imaging.SoftwareBitmap]::Convert(
        $bitmap,
        [Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8
      )
    }

    $result = Invoke-WinRtAwait ($script:OcrEngine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $text = ''
    if ($null -ne $result) {
      $text = [string]$result.Text
    }
    return ($text -replace '[\\r\\n\\t]+', ' ' -replace '\\s{2,}', ' ').Trim()
  } finally {
    if ($bitmap -and ($bitmap -is [System.IDisposable])) {
      try { $bitmap.Dispose() } catch {}
    }
    if ($stream -and ($stream -is [System.IDisposable])) {
      try { $stream.Dispose() } catch {}
    }
  }
}

try {
  $script:OcrEngine = New-SimplifiedChineseOcrEngine
  $script:RequestCount = 0
  Write-JsonLine @{ type = 'ready' }

  while ($true) {
    $line = [Console]::In.ReadLine()
    if ($null -eq $line) { break }
    $line = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $request = $null
    try {
      $request = $line | ConvertFrom-Json -ErrorAction Stop
    } catch {
      Write-JsonLine @{ ok = $false; error = 'Invalid worker request payload' }
      continue
    }

    $id = $request.id
    $imagePath = [string]$request.image_path
    try {
      $text = Get-OcrText -ImagePath $imagePath
      $script:RequestCount++
      Write-JsonLine @{ id = $id; ok = $true; text = $text }
      if (($script:RequestCount % 20) -eq 0) {
        try {
          [System.GC]::Collect()
          [System.GC]::WaitForPendingFinalizers()
        } catch {}
      }
    } catch {
      $msg = $_.Exception.Message
      if ([string]::IsNullOrWhiteSpace($msg)) {
        $msg = 'Windows OCR worker request failed'
      }
      Write-JsonLine @{ id = $id; ok = $false; error = [string]$msg }
    }
  }
} catch {
  $fatalMsg = $_.Exception.Message
  if ([string]::IsNullOrWhiteSpace($fatalMsg)) {
    $fatalMsg = 'Windows OCR worker startup failed'
  }
  try { Write-JsonLine @{ type = 'fatal'; error = [string]$fatalMsg } } catch {}
  exit 1
}
`
    fs.writeFileSync(this.windowsOcrWorkerScriptPath, script.trim(), 'utf8')
  }

  _ensurePaddleOcrScript() {
    ensureDir(path.dirname(this.paddleOcrScriptPath))
    const script = `
import os
import sys
import traceback

os.environ.setdefault("PYTHONUTF8", "1")

def _extract_texts(result):
    texts = []
    if not isinstance(result, list):
        return texts
    for block in result:
        if not block:
            continue
        if isinstance(block, dict):
            text = block.get("text") if isinstance(block, dict) else ""
            if text:
                texts.append(str(text).strip())
            continue
        if not isinstance(block, (list, tuple)):
            continue
        for item in block:
            if isinstance(item, dict):
                text = item.get("text")
                if text:
                    texts.append(str(text).strip())
                continue
            if not isinstance(item, (list, tuple)) or len(item) < 2:
                continue
            text_info = item[1]
            if isinstance(text_info, (list, tuple)) and len(text_info) > 0:
                text = text_info[0]
                if text:
                    texts.append(str(text).strip())
    return texts

def main():
    if len(sys.argv) < 2:
        print("OCR_RESULT=", end="")
        return

    image_path = sys.argv[1]
    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
        result = ocr.ocr(image_path, cls=True)
        texts = _extract_texts(result)
        print("OCR_RESULT=" + " ".join(texts))
    except Exception as exc:
        print("ERROR: " + str(exc), file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        sys.exit(2)

if __name__ == "__main__":
    main()
`
    fs.writeFileSync(this.paddleOcrScriptPath, script.trim(), 'utf8')
  }

  _ensurePaddleWorkerScript() {
    ensureDir(path.dirname(this.paddleOcrWorkerScriptPath))
    const script = `
import json
import os
import sys
import traceback

os.environ.setdefault("PYTHONUTF8", "1")

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

def emit(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\\n")
    sys.stdout.flush()

def extract_texts(result):
    texts = []
    if not isinstance(result, list):
        return texts
    for block in result:
        if not block:
            continue
        if isinstance(block, dict):
            text = block.get("text")
            if text:
                texts.append(str(text).strip())
            continue
        if not isinstance(block, (list, tuple)):
            continue
        for item in block:
            if isinstance(item, dict):
                text = item.get("text")
                if text:
                    texts.append(str(text).strip())
                continue
            if not isinstance(item, (list, tuple)) or len(item) < 2:
                continue
            text_info = item[1]
            if isinstance(text_info, (list, tuple)) and len(text_info) > 0:
                text = text_info[0]
                if text:
                    texts.append(str(text).strip())
    return texts

def create_ocr():
    from paddleocr import PaddleOCR
    use_gpu = False
    try:
        import paddle
        use_gpu = bool(paddle.device.is_compiled_with_cuda())
    except Exception:
        use_gpu = False

    if use_gpu:
        try:
            ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False, use_gpu=True)
            return ocr, True
        except Exception:
            pass

    ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False, use_gpu=False)
    return ocr, False

def run_ocr(ocr, image_path):
    result = ocr.ocr(image_path, cls=True)
    texts = extract_texts(result)
    return " ".join(texts)

def main():
    try:
        ocr, use_gpu = create_ocr()
    except Exception as exc:
        emit({"type": "fatal", "error": str(exc)})
        traceback.print_exc(file=sys.stderr)
        return

    emit({"type": "ready", "gpu": bool(use_gpu)})

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            emit({"type": "error", "error": "invalid_json"})
            continue

        req_id = req.get("id")
        cmd = req.get("cmd")

        if cmd == "shutdown":
            emit({"id": req_id, "ok": True, "bye": True})
            break
        if cmd == "ping":
            emit({"id": req_id, "ok": True, "pong": True, "gpu": bool(use_gpu)})
            continue

        image_path = req.get("image_path")
        if not image_path:
            emit({"id": req_id, "ok": False, "error": "missing image_path"})
            continue

        try:
            text = run_ocr(ocr, image_path)
            emit({"id": req_id, "ok": True, "text": text})
        except Exception as exc:
            emit({"id": req_id, "ok": False, "error": str(exc)})

if __name__ == "__main__":
    main()
`
    fs.writeFileSync(this.paddleOcrWorkerScriptPath, script.trim(), 'utf8')
  }

  _ensurePaddleInstallScript() {
    ensureDir(path.dirname(this.paddleInstallScriptPath))
    const script = `
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallRoot,
  [Parameter(Mandatory = $true)]
  [string]$PythonUrl,
  [switch]$SkipPip
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$ErrorMessage
  )
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$ErrorMessage (exit=$LASTEXITCODE)"
  }
}

  function Download-IfNeeded {
  param(
    [string]$Uri,
    [string]$OutFile
  )
  if (Test-Path -LiteralPath $OutFile) {
    $existing = Get-Item -LiteralPath $OutFile -ErrorAction SilentlyContinue
    if ($existing -and $existing.Length -gt 10485760) {
      return
    }
    Remove-Item -LiteralPath $OutFile -Force -ErrorAction SilentlyContinue
  }
  Invoke-WebRequest -Uri $Uri -OutFile $OutFile -UseBasicParsing -MaximumRedirection 10
  $downloaded = Get-Item -LiteralPath $OutFile -ErrorAction Stop
  if ($downloaded.Length -lt 10485760) {
    throw "Downloaded Python runtime file is too small: $($downloaded.Length) bytes"
  }
}

function Ensure-Pip {
  param(
    [string]$PythonExe,
    [string]$InstallRoot
  )
  & $PythonExe -m ensurepip --upgrade
  if ($LASTEXITCODE -eq 0) {
    return
  }

  $getPipPath = Join-Path $InstallRoot 'get-pip.py'
  Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile $getPipPath -UseBasicParsing -MaximumRedirection 10
  Invoke-Checked -FilePath $PythonExe -Arguments @($getPipPath) -ErrorMessage 'Failed to install pip'
}

function Install-PipPackage {
  param(
    [string]$PythonExe,
    [string[]]$PackageArgs
  )
  $mirrors = @(
    @(),
    @('-i', 'https://pypi.tuna.tsinghua.edu.cn/simple')
  )
  foreach ($extra in $mirrors) {
    & $PythonExe -m pip install @PackageArgs @extra
    if ($LASTEXITCODE -eq 0) {
      return
    }
  }
  throw "pip install failed: $($PackageArgs -join ' ')"
}

function Test-PythonImport {
  param(
    [string]$PythonExe,
    [string]$ModuleName
  )
  & $PythonExe -c "import importlib.util,sys;sys.exit(0 if importlib.util.find_spec('$ModuleName') else 1)"
  return ($LASTEXITCODE -eq 0)
}

if (!(Test-Path -LiteralPath $InstallRoot)) {
  New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
}

$pythonRoot = Join-Path $InstallRoot 'python'
$pythonExe = Join-Path $pythonRoot 'python.exe'
$archivePath = Join-Path $InstallRoot 'python-standalone.tar.gz'
$extractTemp = Join-Path $InstallRoot '_extract_tmp'

Write-Output '[1/4] Preparing Python runtime...'

if (!(Test-Path -LiteralPath $pythonExe)) {
  Write-Output '[2/4] Downloading Python runtime (first time only)...'
  Download-IfNeeded -Uri $PythonUrl -OutFile $archivePath

  Write-Output '[3/4] Extracting Python runtime...'
  if (Test-Path -LiteralPath $extractTemp) {
    Remove-Item -LiteralPath $extractTemp -Recurse -Force
  }
  New-Item -ItemType Directory -Path $extractTemp -Force | Out-Null

  $tarCmd = Get-Command tar -ErrorAction SilentlyContinue
  if ($null -eq $tarCmd) {
    throw 'tar command not found; cannot extract .tar.gz'
  }
  Invoke-Checked -FilePath $tarCmd.Source -Arguments @('-xf', $archivePath, '-C', $extractTemp) -ErrorMessage 'Failed to extract Python runtime'

  $pythonExeFile = Get-ChildItem -Path $extractTemp -Recurse -File -Filter 'python.exe' | Select-Object -First 1
  if ($null -eq $pythonExeFile) {
    throw 'python.exe not found after extraction'
  }

  $sourcePythonRoot = Split-Path -Parent $pythonExeFile.FullName
  if (!(Test-Path -LiteralPath $sourcePythonRoot)) {
    throw "Invalid extracted Python root: $sourcePythonRoot"
  }

  if (Test-Path -LiteralPath $pythonRoot) {
    Remove-Item -LiteralPath $pythonRoot -Recurse -Force
  }

  Move-Item -LiteralPath $sourcePythonRoot -Destination $pythonRoot -Force
  if (Test-Path -LiteralPath $extractTemp) {
    Remove-Item -LiteralPath $extractTemp -Recurse -Force
  }
}

if (!(Test-Path -LiteralPath $pythonExe)) {
  throw "Python install failed: python.exe not found ($pythonExe)"
}

if ($SkipPip) {
  Write-Output 'PADDLE_INSTALL_SKIP_PIP'
  exit 0
}

Write-Output '[4/4] Installing PaddleOCR dependencies (this may take a while)...'
Ensure-Pip -PythonExe $pythonExe -InstallRoot $InstallRoot
Install-PipPackage -PythonExe $pythonExe -PackageArgs @('--upgrade', 'pip', 'setuptools', 'wheel')
Install-PipPackage -PythonExe $pythonExe -PackageArgs @('--upgrade', '--prefer-binary', 'numpy<2')

if (Test-PythonImport -PythonExe $pythonExe -ModuleName 'paddle') {
  Write-Output '[4/4] Existing paddle runtime detected; keeping current package.'
} else {
  Install-PipPackage -PythonExe $pythonExe -PackageArgs @('--upgrade', '--prefer-binary', 'paddlepaddle==2.6.2')
}

Install-PipPackage -PythonExe $pythonExe -PackageArgs @('--upgrade', '--prefer-binary', 'paddleocr==2.7.3')

Write-Output 'PADDLE_INSTALL_DONE'
`
    fs.writeFileSync(this.paddleInstallScriptPath, script.trim(), 'utf8')
  }

  async _runProcess(command, args, { timeoutMs = 15000, cwd = this.runtimeDir, env = process.env } = {}) {
    return new Promise((resolve, reject) => {
      const ps = spawn(command, args, {
        cwd,
        env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      })
      let stdout = ''
      let stderr = ''
      let timedOut = false
      const timer = setTimeout(() => {
        timedOut = true
        try { ps.kill() } catch {}
      }, timeoutMs)

      ps.stdout.on('data', (chunk) => {
        stdout += String(chunk || '')
      })
      ps.stderr.on('data', (chunk) => {
        stderr += String(chunk || '')
      })
      ps.on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
      ps.on('close', (code) => {
        clearTimeout(timer)
        if (timedOut) {
          reject(new Error(`命令执行超时 (${timeoutMs}ms)`))
          return
        }
        if (code !== 0) {
          const msg = sanitizeText(stderr || stdout || `exit code ${code}`)
          reject(new Error(msg || `exit code ${code}`))
          return
        }
        resolve({ stdout, stderr, code })
      })
    })
  }

  _buildPaddleEnv() {
    return {
      ...process.env,
      PYTHONUTF8: '1',
      PYTHONIOENCODING: 'utf-8'
    }
  }

  _normalizeWindowsOcrError(error) {
    const msg = String(error?.message || error || '')
    if (msg.includes('Simplified Chinese OCR language pack missing')) {
      const details = sanitizeText(msg)
      return new Error(`Windows OCR 仅允许简体中文（zh-CN/zh-Hans）。请在系统中安装“中文(简体，中国)”OCR 语言包。${details}`)
    }
    if (msg.includes('Windows OCR cannot create engine for language')) {
      return new Error('Windows OCR 无法创建简体中文识别引擎。请确认已安装“中文(简体，中国)”OCR 语言包，或切换到 PaddleOCR。')
    }
    if (msg.includes('No OCR language installed in Windows')) {
      return new Error('Windows OCR 未检测到任何语言包。请安装“中文(简体，中国)”OCR 语言包，或切换到 PaddleOCR。')
    }
    return (error instanceof Error) ? error : new Error(msg || 'Windows OCR 执行失败')
  }

  _resetWindowsWorkerState() {
    this._windowsWorker = null
    this._windowsWorkerReady = false
    this._windowsWorkerReadyPromise = null
    this._windowsWorkerBuffer = ''
    for (const pending of this._windowsWorkerPending.values()) {
      try {
        pending.reject(new Error('Windows OCR worker stopped'))
      } catch {}
      clearTimeout(pending.timer)
    }
    this._windowsWorkerPending.clear()
    this.windowsRuntime.workerActive = false
    this.windowsRuntime.workerReady = false
  }

  _killWindowsWorker(reason = 'stopped') {
    const worker = this._windowsWorker
    this._resetWindowsWorkerState()
    if (!worker) return
    try {
      if (worker.stdin && !worker.stdin.destroyed) {
        worker.stdin.end()
      }
    } catch {}
    try {
      worker.kill()
    } catch {}
    this.log('[LocalBpOCR] Windows worker killed:', reason)
  }

  _handleWindowsWorkerPayload(payload) {
    if (!payload || typeof payload !== 'object') return
    if (typeof payload.id === 'number') {
      const pending = this._windowsWorkerPending.get(payload.id)
      if (!pending) return
      this._windowsWorkerPending.delete(payload.id)
      clearTimeout(pending.timer)
      if (payload.ok) {
        pending.resolve(payload)
      } else {
        pending.reject(new Error(String(payload.error || 'Windows OCR worker request failed')))
      }
    }
  }

  async _startWindowsWorker() {
    if (process.platform !== 'win32') {
      throw new Error('Windows OCR 仅支持 Windows 系统')
    }

    if (this._windowsWorker && this._windowsWorkerReady) {
      return
    }
    if (this._windowsWorkerReadyPromise) {
      return this._windowsWorkerReadyPromise
    }

    this._ensureWindowsOcrWorkerScript()
    this._windowsWorkerReadyPromise = new Promise((resolve, reject) => {
      let settled = false
      let startTimer = null
      const finish = (ok, value) => {
        if (settled) return
        settled = true
        if (startTimer) clearTimeout(startTimer)
        if (ok) resolve(value)
        else reject(value)
      }

      const command = 'powershell.exe'
      const args = [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', this.windowsOcrWorkerScriptPath
      ]
      const worker = spawn(command, args, {
        cwd: this.runtimeDir,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this._windowsWorker = worker
      this._windowsWorkerBuffer = ''
      this._windowsWorkerReady = false
      this.windowsRuntime.workerActive = true
      this.windowsRuntime.workerReady = false
      this.windowsRuntime.workerStartedAt = Date.now()
      this.windowsRuntime.workerRequests = 0

      const onWorkerExit = (reason) => {
        if (!settled) {
          finish(false, new Error(reason))
        }
        this.log('[LocalBpOCR] Windows worker stopped:', reason)
        this._resetWindowsWorkerState()
      }

      const processStdoutLines = (chunk) => {
        this._windowsWorkerBuffer += String(chunk || '')
        let newlineIndex = this._windowsWorkerBuffer.indexOf('\n')
        while (newlineIndex >= 0) {
          const line = this._windowsWorkerBuffer.slice(0, newlineIndex).trim()
          this._windowsWorkerBuffer = this._windowsWorkerBuffer.slice(newlineIndex + 1)
          if (line) {
            try {
              const payload = JSON.parse(line)
              if (payload.type === 'ready') {
                this._windowsWorkerReady = true
                this.windowsRuntime.workerReady = true
                finish(true)
              } else if (payload.type === 'fatal') {
                const errMsg = String(payload.error || 'Windows OCR worker fatal error')
                finish(false, new Error(errMsg))
                try { worker.kill() } catch {}
              } else {
                this._handleWindowsWorkerPayload(payload)
              }
            } catch {
              // ignore malformed worker lines
            }
          }
          newlineIndex = this._windowsWorkerBuffer.indexOf('\n')
        }
      }

      worker.stdout.on('data', processStdoutLines)
      worker.stderr.on('data', (chunk) => {
        const lines = String(chunk || '')
          .split(/\r?\n/g)
          .map(line => sanitizeText(line))
          .filter(Boolean)
        for (const line of lines) {
          this.log('[LocalBpOCR][WindowsWorker][ERR]', line)
        }
      })

      worker.on('error', (error) => {
        onWorkerExit(`start failed: ${error.message}`)
      })
      worker.on('close', (code, signal) => {
        onWorkerExit(`exit code=${code} signal=${signal || ''}`.trim())
      })

      startTimer = setTimeout(() => {
        finish(false, new Error('Windows OCR worker startup timeout'))
        try { worker.kill() } catch {}
      }, 30000)
    })

    try {
      await this._windowsWorkerReadyPromise
    } finally {
      this._windowsWorkerReadyPromise = null
    }
  }

  _requestWindowsWorker(imagePath, timeoutMs = 30000) {
    if (!this._windowsWorker || !this._windowsWorkerReady || !this._windowsWorker.stdin || this._windowsWorker.stdin.destroyed) {
      return Promise.reject(new Error('Windows OCR worker unavailable'))
    }
    const id = ++this._windowsWorkerRequestSeq
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._windowsWorkerPending.delete(id)
        reject(new Error('Windows OCR worker request timeout'))
      }, timeoutMs)

      this._windowsWorkerPending.set(id, { resolve, reject, timer })
      try {
        this._windowsWorker.stdin.write(`${JSON.stringify({ id, image_path: imagePath })}\n`)
      } catch (error) {
        this._windowsWorkerPending.delete(id)
        clearTimeout(timer)
        reject(error)
      }
    })
  }

  async _disposeWindowsWorker() {
    this._killWindowsWorker('dispose')
  }

  _resetPaddleWorkerState() {
    this._paddleWorker = null
    this._paddleWorkerReady = false
    this._paddleWorkerReadyPromise = null
    this._paddleWorkerBuffer = ''
    for (const pending of this._paddleWorkerPending.values()) {
      try {
        pending.reject(new Error('PaddleOCR worker stopped'))
      } catch {}
      clearTimeout(pending.timer)
    }
    this._paddleWorkerPending.clear()
    this.paddleRuntime.workerActive = false
    this.paddleRuntime.workerReady = false
  }

  _killPaddleWorker(reason = 'stopped') {
    const worker = this._paddleWorker
    this._resetPaddleWorkerState()
    if (!worker) return
    try {
      if (worker.stdin && !worker.stdin.destroyed) {
        worker.stdin.end()
      }
    } catch {}
    try {
      worker.kill()
    } catch {}
    this.log('[LocalBpOCR] Paddle worker killed:', reason)
  }

  _handlePaddleWorkerPayload(payload) {
    if (!payload || typeof payload !== 'object') return
    if (typeof payload.id === 'number') {
      const pending = this._paddleWorkerPending.get(payload.id)
      if (!pending) return
      this._paddleWorkerPending.delete(payload.id)
      clearTimeout(pending.timer)
      if (payload.ok) {
        pending.resolve(payload)
      } else {
        pending.reject(new Error(String(payload.error || 'PaddleOCR worker request failed')))
      }
    }
  }

  async _startPaddleWorker() {
    if (!this._isPaddleReady()) {
      throw new Error('PaddleOCR 未安装')
    }

    if (this._paddleWorker && this._paddleWorkerReady) {
      return { useGpu: !!this.paddleRuntime.useGpu }
    }

    if (this._paddleWorkerReadyPromise) {
      return this._paddleWorkerReadyPromise
    }

    this._ensurePaddleWorkerScript()
    const env = this._buildPaddleEnv()

    this._paddleWorkerReadyPromise = new Promise((resolve, reject) => {
      let settled = false
      let startTimer = null
      const finish = (ok, value) => {
        if (settled) return
        settled = true
        if (startTimer) clearTimeout(startTimer)
        if (ok) {
          resolve(value)
        } else {
          reject(value)
        }
      }

      const commandArgs = ['-X', 'utf8', this.paddleOcrWorkerScriptPath]
      const worker = spawn(this.paddlePythonExe, commandArgs, {
        cwd: this.paddleRoot,
        env,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      this._paddleWorker = worker
      this._paddleWorkerBuffer = ''
      this._paddleWorkerReady = false
      this.paddleRuntime.workerActive = true
      this.paddleRuntime.workerReady = false
      this.paddleRuntime.workerStartedAt = Date.now()
      this.paddleRuntime.workerRequests = 0

      const onWorkerExit = (reason) => {
        if (!settled) {
          finish(false, new Error(reason))
        }
        this.log('[LocalBpOCR] Paddle worker stopped:', reason)
        this._resetPaddleWorkerState()
      }

      const processStdoutLines = (chunk) => {
        this._paddleWorkerBuffer += String(chunk || '')
        let newlineIndex = this._paddleWorkerBuffer.indexOf('\n')
        while (newlineIndex >= 0) {
          const line = this._paddleWorkerBuffer.slice(0, newlineIndex).trim()
          this._paddleWorkerBuffer = this._paddleWorkerBuffer.slice(newlineIndex + 1)
          if (line) {
            try {
              const payload = JSON.parse(line)
              if (payload.type === 'ready') {
                this._paddleWorkerReady = true
                this.paddleRuntime.workerReady = true
                this.paddleRuntime.useGpu = !!payload.gpu
                finish(true, { useGpu: !!payload.gpu })
              } else if (payload.type === 'fatal') {
                const errMsg = String(payload.error || 'PaddleOCR worker fatal error')
                finish(false, new Error(errMsg))
                try { worker.kill() } catch {}
              } else {
                this._handlePaddleWorkerPayload(payload)
              }
            } catch {
              // ignore malformed worker lines
            }
          }
          newlineIndex = this._paddleWorkerBuffer.indexOf('\n')
        }
      }

      worker.stdout.on('data', processStdoutLines)

      worker.stderr.on('data', (chunk) => {
        const lines = String(chunk || '')
          .split(/\r?\n/g)
          .map(line => sanitizeText(line))
          .filter(Boolean)
        for (const line of lines) {
          this.log('[LocalBpOCR][PaddleWorker][ERR]', line)
        }
      })

      worker.on('error', (error) => {
        onWorkerExit(`start failed: ${error.message}`)
      })

      worker.on('close', (code, signal) => {
        onWorkerExit(`exit code=${code} signal=${signal || ''}`.trim())
      })

      startTimer = setTimeout(() => {
        finish(false, new Error('PaddleOCR worker startup timeout'))
        try { worker.kill() } catch {}
      }, 180000)
    })

    try {
      const info = await this._paddleWorkerReadyPromise
      return info
    } finally {
      this._paddleWorkerReadyPromise = null
    }
  }

  _requestPaddleWorker(imagePath, timeoutMs = 30000) {
    if (!this._paddleWorker || !this._paddleWorkerReady || !this._paddleWorker.stdin || this._paddleWorker.stdin.destroyed) {
      return Promise.reject(new Error('PaddleOCR worker unavailable'))
    }

    const id = ++this._paddleWorkerRequestSeq
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._paddleWorkerPending.delete(id)
        reject(new Error('PaddleOCR worker request timeout'))
      }, timeoutMs)

      this._paddleWorkerPending.set(id, { resolve, reject, timer })
      try {
        this._paddleWorker.stdin.write(`${JSON.stringify({ id, image_path: imagePath })}\n`)
      } catch (error) {
        this._paddleWorkerPending.delete(id)
        clearTimeout(timer)
        reject(error)
      }
    })
  }

  async _disposePaddleWorker() {
    this._killPaddleWorker('dispose')
  }

  async _runPaddleOcrSingle(imagePath) {
    this._ensurePaddleOcrScript()
    const result = await this._runProcess(
      this.paddlePythonExe,
      ['-X', 'utf8', this.paddleOcrScriptPath, imagePath],
      {
        timeoutMs: 45000,
        cwd: this.paddleRoot,
        env: this._buildPaddleEnv()
      }
    )
    const stderrLines = String(result.stderr || '')
      .split(/\r?\n/g)
      .map(line => sanitizeText(line))
      .filter(Boolean)
    const errorLine = stderrLines.find(line => line.toUpperCase().startsWith('ERROR:'))
    if (errorLine) {
      throw new Error(errorLine)
    }

    const stdoutLines = String(result.stdout || '')
      .split(/\r?\n/g)
      .map(line => sanitizeText(line))
      .filter(Boolean)

    const marker = 'OCR_RESULT='
    const markerLine = [...stdoutLines].reverse().find(line => line.startsWith(marker))
    if (markerLine) {
      return sanitizeText(markerLine.slice(marker.length))
    }

    const filtered = stdoutLines.filter((line) => {
      if (/ppocr\s+(DEBUG|INFO|WARNING|ERROR)/i.test(line)) return false
      if (line.includes('Namespace(')) return false
      if (/^\[\d{4}\/\d{2}\/\d{2}/.test(line)) return false
      return true
    })
    return sanitizeText(filtered.join(' '))
  }

  async _runWindowsOcrSingle(imagePath) {
    if (process.platform !== 'win32') {
      throw new Error('Windows OCR 仅支持 Windows 系统')
    }
    this._ensureWindowsOcrScript()
    const command = 'powershell.exe'
    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', this.windowsOcrScriptPath,
      '-ImagePath', imagePath
    ]
    try {
      const result = await this._runProcess(command, args, { timeoutMs: 30000 })
      return sanitizeText(result.stdout)
    } catch (error) {
      throw this._normalizeWindowsOcrError(error)
    }
  }

  async _runWindowsOcr(imagePath) {
    try {
      await this._startWindowsWorker()
      const payload = await this._requestWindowsWorker(imagePath, 35000)
      this.windowsRuntime.workerRequests = (this.windowsRuntime.workerRequests || 0) + 1
      if (this.windowsRuntime.workerRequests >= WINDOWS_WORKER_MAX_REQUESTS) {
        this._killWindowsWorker(`recycle after ${WINDOWS_WORKER_MAX_REQUESTS} requests`)
      }
      return sanitizeText(payload?.text || '')
    } catch (workerError) {
      this.log('[LocalBpOCR] Windows worker failed, fallback single-run:', workerError?.message || workerError)
      this._killWindowsWorker('worker request failed')
      try {
        return await this._runWindowsOcrSingle(imagePath)
      } catch (singleError) {
        throw this._normalizeWindowsOcrError(singleError)
      }
    }
  }

  _isPaddleReady() {
    return fs.existsSync(this.paddlePythonExe) && fs.existsSync(this.paddleOcrScriptPath)
  }

  async _runPaddleOcr(imagePath) {
    if (!this._isPaddleReady()) {
      throw new Error('PaddleOCR 未安装')
    }
    try {
      await this._startPaddleWorker()
      const payload = await this._requestPaddleWorker(imagePath, 35000)
      this.paddleRuntime.workerRequests = (this.paddleRuntime.workerRequests || 0) + 1
      if (this.paddleRuntime.workerRequests >= PADDLE_WORKER_MAX_REQUESTS) {
        this._killPaddleWorker(`recycle after ${PADDLE_WORKER_MAX_REQUESTS} requests`)
      }
      return sanitizeText(payload?.text || '')
    } catch (workerError) {
      this.log('[LocalBpOCR] Paddle worker failed, fallback single-run:', workerError?.message || workerError)
      this._killPaddleWorker('worker request failed')
      return this._runPaddleOcrSingle(imagePath)
    }
  }

  async _recognizeWithEngine(imagePath, preferredEngine) {
    const engine = preferredEngine === 'paddleocr' ? 'paddleocr' : 'windows'
    if (engine === 'paddleocr') {
      try {
        const text = await this._runPaddleOcr(imagePath)
        if (text) {
          return { text, engineUsed: 'paddleocr', fallback: false }
        }
        const fallbackText = await this._runWindowsOcr(imagePath)
        return {
          text: fallbackText,
          engineUsed: fallbackText ? 'windows' : 'paddleocr',
          fallback: true,
          fallbackReason: 'paddleocr empty'
        }
      } catch (error) {
        const fallbackText = await this._runWindowsOcr(imagePath)
        return {
          text: fallbackText,
          engineUsed: 'windows',
          fallback: true,
          fallbackReason: error.message
        }
      }
    }

    try {
      const text = await this._runWindowsOcr(imagePath)
      if (text) {
        return { text, engineUsed: 'windows', fallback: false }
      }
      if (this._isPaddleReady()) {
        const fallbackText = await this._runPaddleOcr(imagePath)
        return {
          text: fallbackText,
          engineUsed: fallbackText ? 'paddleocr' : 'windows',
          fallback: true,
          fallbackReason: 'windows empty'
        }
      }
      return { text, engineUsed: 'windows', fallback: false }
    } catch (error) {
      if (this._isPaddleReady()) {
        try {
          const fallbackText = await this._runPaddleOcr(imagePath)
          return {
            text: fallbackText,
            engineUsed: fallbackText ? 'paddleocr' : 'windows',
            fallback: true,
            fallbackReason: error.message || 'windows ocr failed'
          }
        } catch {}
      }
      throw error
    }
  }

  async recognizeOnce(options = {}) {
    try {
      const apply = options.apply !== false
      const cfg = this._normalizeConfig({
        ...this.config,
        ...(options.config && typeof options.config === 'object' ? options.config : {})
      })
      this.config = cfg
      this._saveConfig()

      const sources = await this._getWindowSources(OCR_CAPTURE_THUMBNAIL_SIZE)
      const source = this._resolveSourceByConfig(sources, cfg)
      if (!source) {
        return { success: false, error: '目标窗口未找到，请重新选择窗口' }
      }

      const windowSize = source.thumbnail.getSize()
      if (!windowSize.width || !windowSize.height) {
        return { success: false, error: '目标窗口不可见，请确保窗口未最小化' }
      }

      const raw = {
        survivors: '',
        hunter: '',
        survivorBans: '',
        hunterBans: ''
      }

      const recognitionMeta = {
        engineRequested: cfg.preferredEngine,
        engineUsed: {},
        fallbackRegions: {},
        cropSize: {},
        imageVariant: {},
        emptyRegions: {}
      }

      for (const key of REGION_KEYS) {
        const region = cfg.regions[key]
        if (!region) continue
        const rect = this._regionToRect(region, windowSize.width, windowSize.height)
        if (!rect) continue
        const cropImage = source.thumbnail.crop(rect)
        const size = cropImage.getSize()
        if (!size.width || !size.height) continue

        recognitionMeta.cropSize[key] = size

        const { candidates, files } = await this._buildOcrImageCandidates(cropImage.toPNG(), key)
        let bestRec = null
        let bestScore = -1
        let bestLabel = 'orig'
        let lastError = null

        try {
          const activeCandidates = cfg.preferredEngine === 'paddleocr'
            ? candidates.filter(item => item.label !== 'contrast')
            : candidates
          const earlyStopScore = this._getEarlyStopScore(key, cfg.preferredEngine)

          for (const candidate of activeCandidates) {
            try {
              const rec = await this._recognizeWithEngine(candidate.path, cfg.preferredEngine)
              const text = sanitizeText(rec.text)
              const score = this._scoreRecognizedText(text)
              if (!bestRec || score > bestScore) {
                bestRec = { ...rec, text }
                bestScore = score
                bestLabel = candidate.label || 'orig'
              }
              if (bestScore >= earlyStopScore) break
            } catch (error) {
              lastError = error
            }
          }

          if (!bestRec) {
            if (lastError) throw lastError
            raw[key] = ''
            recognitionMeta.emptyRegions[key] = true
            continue
          }

          raw[key] = sanitizeText(bestRec.text)
          recognitionMeta.engineUsed[key] = bestRec.engineUsed
          recognitionMeta.imageVariant[key] = bestLabel
          if (!raw[key]) {
            recognitionMeta.emptyRegions[key] = true
          }
          if (bestRec.fallback) {
            recognitionMeta.fallbackRegions[key] = bestRec.fallbackReason || 'fallback'
          }
        } finally {
          this._cleanupTempFiles(files)
        }
      }

      const allRawEmpty = REGION_KEYS.every((key) => !sanitizeText(raw[key]))
      if (allRawEmpty) {
        recognitionMeta.warning = cfg.preferredEngine === 'windows'
          ? 'Windows OCR 结果为空。请确认窗口可见、文本足够清晰，并优先安装 PaddleOCR。'
          : 'OCR 结果为空。请确认窗口可见、文本足够清晰。'
      }

      const matched = this._matchRecognized(raw)
      const applyResult = apply ? (this.applyMatchedResult(matched, raw) || { applied: false }) : { applied: false, reason: 'apply disabled' }

      const payload = {
        timestamp: Date.now(),
        sourceId: source.id,
        sourceName: source.name,
        windowSize,
        raw,
        matched,
        applyResult,
        recognitionMeta
      }

      this.lastRecognition = payload
      this.lastError = null

      return { success: true, data: payload }
    } catch (error) {
      this.lastError = String(error?.message || error)
      return { success: false, error: this.lastError }
    }
  }

  getInstallStatus() {
    return {
      ...this.installState,
      paddleReady: this._isPaddleReady(),
      preferredEngine: this.config.preferredEngine
    }
  }

  isPaddleReady() {
    return this._isPaddleReady()
  }

  getRuntimeState() {
    return {
      lastRecognition: this.lastRecognition,
      lastError: this.lastError,
      paddleReady: this._isPaddleReady(),
      installStatus: this.getInstallStatus(),
      paddleRuntime: { ...this.paddleRuntime },
      windowsRuntime: { ...this.windowsRuntime }
    }
  }

  async dispose() {
    await this._disposeWindowsWorker()
    await this._disposePaddleWorker()
  }

  async installPaddleOcr() {
    if (process.platform !== 'win32') {
      return { success: false, error: 'PaddleOCR 一键安装仅支持 Windows' }
    }
    if (this.installState.running) {
      return { success: false, error: '安装任务正在进行中' }
    }

    this._ensurePaddleInstallScript()
    ensureDir(this.paddleRoot)

    this.installState = {
      running: true,
      startedAt: Date.now(),
      finishedAt: 0,
      success: false,
      message: '开始安装',
      logs: [],
      exitCode: null
    }

    const pushLog = (line) => {
      if (!line) return
      const msg = sanitizeText(line)
      if (!msg) return
      this.installState.logs.push(`${new Date().toLocaleTimeString()} ${msg}`)
      if (this.installState.logs.length > 200) {
        this.installState.logs = this.installState.logs.slice(-200)
      }
      this.installState.message = msg
      this.log('[LocalBpOCR][Install]', msg)
    }

    const command = 'powershell.exe'
    const args = [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-File', this.paddleInstallScriptPath,
      '-InstallRoot', this.paddleRoot,
      '-PythonUrl', PADDLE_PYTHON_URL
    ]

    const child = spawn(command, args, {
      cwd: this.runtimeDir,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    child.stdout.on('data', (chunk) => {
      String(chunk || '')
        .split(/\r?\n/g)
        .map(line => line.trim())
        .filter(Boolean)
        .forEach(pushLog)
    })
    child.stderr.on('data', (chunk) => {
      String(chunk || '')
        .split(/\r?\n/g)
        .map(line => line.trim())
        .filter(Boolean)
        .forEach((line) => pushLog(`[ERR] ${line}`))
    })
    child.on('error', (error) => {
      this.installState.running = false
      this.installState.finishedAt = Date.now()
      this.installState.success = false
      this.installState.message = `安装进程启动失败: ${error.message}`
      this.installState.exitCode = -1
    })
    child.on('close', (code) => {
      this.installState.running = false
      this.installState.finishedAt = Date.now()
      this.installState.exitCode = code

      if (code === 0) {
        try {
          this._ensurePaddleOcrScript()
          this._ensurePaddleWorkerScript()
          this._killPaddleWorker('reinit after install')
          this.installState.success = true
          this.installState.message = 'PaddleOCR 安装完成'
        } catch (error) {
          this.installState.success = false
          this.installState.message = `安装后配置失败: ${error.message}`
        }
      } else {
        this.installState.success = false
        this.installState.message = `安装失败 (exit=${code})`
      }
    })

    return {
      success: true,
      data: {
        started: true,
        startedAt: this.installState.startedAt
      }
    }
  }
}

module.exports = {
  LocalBpOcrService
}
