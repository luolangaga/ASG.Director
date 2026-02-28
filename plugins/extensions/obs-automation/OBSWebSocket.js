/**
 * OBS WebSocket 客户端
 * 支持 OBS WebSocket 5.x 协议
 * 
 * @author ASG Team
 * @version 1.0.0
 */

const WebSocket = require('ws')
const crypto = require('crypto')
const { EventEmitter } = require('events')

/**
 * OBS WebSocket 客户端类
 */
class OBSWebSocket extends EventEmitter {
  constructor() {
    super()

    /** @type {WebSocket|null} */
    this.ws = null

    /** @type {boolean} */
    this.connected = false

    /** @type {boolean} */
    this.identified = false

    /** @type {number} */
    this.rpcVersion = 1

    /** @type {Map<string, {resolve: Function, reject: Function, timeout: NodeJS.Timeout}>} */
    this.pendingRequests = new Map()

    /** @type {number} */
    this.requestIdCounter = 0

    /** @type {NodeJS.Timeout|null} */
    this.reconnectTimer = null

    /** @type {Object} */
    this.config = {
      host: 'localhost',
      port: 4455,
      password: '',
      reconnect: true,
      reconnectInterval: 5000
    }

    /** @type {Array<string>} */
    this.scenes = []

    /** @type {string|null} */
    this.currentScene = null
  }

  /**
   * 生成认证字符串
   * @param {string} password - 密码
   * @param {string} salt - 盐
   * @param {string} challenge - 挑战
   * @returns {string}
   */
  _generateAuth(password, salt, challenge) {
    const secret = crypto.createHash('sha256')
      .update(password + salt)
      .digest('base64')

    const auth = crypto.createHash('sha256')
      .update(secret + challenge)
      .digest('base64')

    return auth
  }

  /**
   * 生成请求ID
   * @returns {string}
   */
  _generateRequestId() {
    return `req-${++this.requestIdCounter}-${Date.now()}`
  }

  /**
   * 连接到 OBS
   * @param {Object} options - 连接选项
   * @returns {Promise<boolean>}
   */
  async connect(options = {}) {
    // 合并配置
    this.config = { ...this.config, ...options }

    // 如果已连接，先断开
    if (this.ws) {
      this.disconnect()
    }

    return new Promise((resolve, reject) => {
      const url = `ws://${this.config.host}:${this.config.port}`

      console.log(`[OBSWebSocket] 正在连接到 ${url}...`)

      try {
        this.ws = new WebSocket(url)

        this.ws.on('open', () => {
          console.log('[OBSWebSocket] WebSocket 已连接')
          this.connected = true
          this.emit('connected')
        })

        this.ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data.toString())
            await this._handleMessage(message, resolve, reject)
          } catch (e) {
            console.error('[OBSWebSocket] 解析消息失败:', e)
          }
        })

        this.ws.on('close', () => {
          console.log('[OBSWebSocket] WebSocket 已断开')
          this._handleDisconnect()
        })

        this.ws.on('error', (error) => {
          console.error('[OBSWebSocket] WebSocket 错误:', error.message)
          if (!this.connected) {
            reject(error)
          }
          this.emit('error', error)
        })

        // 连接超时
        setTimeout(() => {
          if (!this.connected) {
            this.ws?.close()
            reject(new Error('连接超时'))
          }
        }, 10000)

      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * 处理收到的消息
   * @param {Object} message - 消息对象
   * @param {Function} connectResolve - 连接Promise的resolve
   * @param {Function} connectReject - 连接Promise的reject
   */
  async _handleMessage(message, connectResolve, connectReject) {
    const { op, d } = message

    // OpCode 0: Hello - 服务器问候
    if (op === 0) {
      console.log('[OBSWebSocket] 收到 Hello 消息')
      const { authentication, rpcVersion } = d
      this.rpcVersion = rpcVersion

      // 构造 Identify 消息
      const identifyData = {
        rpcVersion: this.rpcVersion
      }

      // 如果需要认证
      if (authentication && this.config.password) {
        identifyData.authentication = this._generateAuth(
          this.config.password,
          authentication.salt,
          authentication.challenge
        )
      }

      this._send({
        op: 1, // Identify
        d: identifyData
      })
    }

    // OpCode 2: Identified - 认证成功
    else if (op === 2) {
      console.log('[OBSWebSocket] 认证成功')
      this.identified = true
      this.emit('identified')

      // 获取场景列表
      await this._fetchScenes()

      if (connectResolve) {
        connectResolve(true)
      }
    }

    // OpCode 5: Event - OBS 事件
    else if (op === 5) {
      this._handleOBSEvent(d)
    }

    // OpCode 7: RequestResponse - 请求响应
    else if (op === 7) {
      this._handleRequestResponse(d)
    }
  }

  /**
   * 处理 OBS 事件
   * @param {Object} eventData - 事件数据
   */
  _handleOBSEvent(eventData) {
    const { eventType, eventData: data } = eventData

    console.log(`[OBSWebSocket] OBS 事件: ${eventType}`)

    // 场景切换事件
    if (eventType === 'CurrentProgramSceneChanged') {
      this.currentScene = data.sceneName
      this.emit('sceneChanged', data.sceneName)
    }

    // 场景列表变化
    else if (eventType === 'SceneListChanged') {
      this.scenes = data.scenes.map(s => s.sceneName)
      this.emit('scenesChanged', this.scenes)
    }

    // 流状态变化
    else if (eventType === 'StreamStateChanged') {
      this.emit('streamStateChanged', data)
    }

    // 录制状态变化
    else if (eventType === 'RecordStateChanged') {
      this.emit('recordStateChanged', data)
    }

    // 发出通用事件
    this.emit('obsEvent', { eventType, data })
  }

  /**
   * 处理请求响应
   * @param {Object} responseData - 响应数据
   */
  _handleRequestResponse(responseData) {
    const { requestId, requestStatus, responseData: data } = responseData

    console.log(`[OBSWebSocket] 📥 收到响应: ID=${requestId}, status=${requestStatus.result}`)

    const pending = this.pendingRequests.get(requestId)
    if (!pending) {
      console.warn(`[OBSWebSocket] ⚠️ 收到未知请求的响应: ${requestId}`)
      return
    }

    clearTimeout(pending.timeout)
    this.pendingRequests.delete(requestId)

    if (requestStatus.result) {
      console.log(`[OBSWebSocket] ✅ 请求成功: ${requestId}`)
      pending.resolve(data || {})
    } else {
      console.error(`[OBSWebSocket] ❌ 请求失败: ${requestStatus.comment || '未知错误'}`)
      pending.reject(new Error(requestStatus.comment || '请求失败'))
    }
  }

  /**
   * 处理断开连接
   */
  _handleDisconnect() {
    this.connected = false
    this.identified = false
    this.ws = null

    // 清理所有待处理的请求
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('连接已断开'))
    }
    this.pendingRequests.clear()

    this.emit('disconnected')

    // 自动重连
    if (this.config.reconnect && !this.reconnectTimer) {
      console.log(`[OBSWebSocket] ${this.config.reconnectInterval}ms 后尝试重连...`)
      this.reconnectTimer = setTimeout(async () => {
        this.reconnectTimer = null
        try {
          await this.connect(this.config)
        } catch (e) {
          console.error('[OBSWebSocket] 重连失败:', e.message)
        }
      }, this.config.reconnectInterval)
    }
  }

  /**
   * 发送消息
   * @param {Object} message - 消息对象
   */
  _send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  /**
   * 发送请求
   * @param {string} requestType - 请求类型
   * @param {Object} requestData - 请求数据
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<any>}
   */
  async request(requestType, requestData = {}, timeout = 10000) {
    if (!this.identified) {
      console.error('[OBSWebSocket] ❌ 未连接到 OBS，无法发送请求')
      throw new Error('未连接到 OBS')
    }

    console.log(`[OBSWebSocket] 📤 发送请求: ${requestType}`, requestData)

    return new Promise((resolve, reject) => {
      const requestId = this._generateRequestId()

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        console.error(`[OBSWebSocket] ⏱️ 请求超时: ${requestType}`)
        reject(new Error(`请求超时: ${requestType}`))
      }, timeout)

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle
      })

      this._send({
        op: 6, // Request
        d: {
          requestType,
          requestId,
          requestData
        }
      })

      console.log(`[OBSWebSocket] 📨 请求已发送，等待响应... (ID: ${requestId})`)
    })
  }

  /**
   * 获取场景列表
   */
  async _fetchScenes() {
    try {
      const result = await this.request('GetSceneList')
      this.scenes = result.scenes.map(s => s.sceneName).reverse()
      this.currentScene = result.currentProgramSceneName
      console.log(`[OBSWebSocket] 场景列表: ${this.scenes.join(', ')}`)
      this.emit('scenesLoaded', this.scenes)
    } catch (e) {
      console.error('[OBSWebSocket] 获取场景列表失败:', e.message)
    }
  }

  /**
   * 断开连接
   */
  disconnect() {
    this.config.reconnect = false

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.connected = false
    this.identified = false
  }

  // ==================== 常用 API ====================

  /**
   * 切换场景
   * @param {string} sceneName - 场景名称
   * @returns {Promise<void>}
   */
  async setCurrentScene(sceneName) {
    console.log(`[OBSWebSocket] 🎬 请求切换场景: ${sceneName}`)
    console.log(`[OBSWebSocket] 📋 当前场景: ${this.currentScene}`)
    console.log(`[OBSWebSocket] 📋 可用场景: ${this.scenes.join(', ')}`)

    if (!sceneName) {
      console.error('[OBSWebSocket] ❌ 场景名称为空！')
      throw new Error('场景名称不能为空')
    }

    try {
      const result = await this.request('SetCurrentProgramScene', { sceneName })
      console.log(`[OBSWebSocket] ✅ 场景切换请求已发送，响应:`, result)
      this.currentScene = sceneName
    } catch (e) {
      console.error(`[OBSWebSocket] ❌ 切换场景失败:`, e)
      throw e
    }
  }

  /**
   * 获取当前场景
   * @returns {Promise<string>}
   */
  async getCurrentScene() {
    const result = await this.request('GetCurrentProgramScene')
    this.currentScene = result.currentProgramSceneName
    return this.currentScene
  }

  /**
   * 获取场景列表
   * @returns {Promise<string[]>}
   */
  async getSceneList() {
    const result = await this.request('GetSceneList')
    this.scenes = result.scenes.map(s => s.sceneName).reverse()
    return this.scenes
  }

  /**
   * 设置场景项可见性
   * @param {string} sceneName - 场景名称
   * @param {number} sceneItemId - 场景项ID
   * @param {boolean} visible - 是否可见
   * @returns {Promise<void>}
   */
  async setSceneItemEnabled(sceneName, sceneItemId, visible) {
    await this.request('SetSceneItemEnabled', {
      sceneName,
      sceneItemId,
      sceneItemEnabled: visible
    })
  }

  /**
   * 开始推流
   * @returns {Promise<void>}
   */
  async startStream() {
    await this.request('StartStream')
  }

  /**
   * 停止推流
   * @returns {Promise<void>}
   */
  async stopStream() {
    await this.request('StopStream')
  }

  /**
   * 开始录制
   * @returns {Promise<void>}
   */
  async startRecord() {
    await this.request('StartRecord')
  }

  /**
   * 停止录制
   * @returns {Promise<void>}
   */
  async stopRecord() {
    await this.request('StopRecord')
  }

  /**
   * 设置文本源内容
   * @param {string} sourceName - 源名称
   * @param {string} text - 文本内容
   * @returns {Promise<void>}
   */
  async setTextContent(sourceName, text) {
    await this.request('SetInputSettings', {
      inputName: sourceName,
      inputSettings: { text }
    })
  }

  /**
   * 设置图像源
   * @param {string} sourceName - 源名称
   * @param {string} file - 文件路径
   * @returns {Promise<void>}
   */
  async setImageSource(sourceName, file) {
    await this.request('SetInputSettings', {
      inputName: sourceName,
      inputSettings: { file }
    })
  }

  /**
   * 设置源的通用设置（支持任意源类型和属性）
   * @param {string} sourceName - 源名称
   * @param {Object} settings - 设置对象
   * @param {boolean} overlay - 是否覆盖现有设置（默认 true）
   * @returns {Promise<void>}
   */
  async setInputSettings(sourceName, settings, overlay = true) {
    await this.request('SetInputSettings', {
      inputName: sourceName,
      inputSettings: settings,
      overlay
    })
  }

  /**
   * 获取源的当前设置
   * @param {string} sourceName - 源名称
   * @returns {Promise<Object>}
   */
  async getInputSettings(sourceName) {
    const result = await this.request('GetInputSettings', {
      inputName: sourceName
    })
    return result.inputSettings || {}
  }

  /**
   * 设置浏览器源 URL
   * @param {string} sourceName - 源名称
   * @param {string} url - URL 地址
   * @returns {Promise<void>}
   */
  async setBrowserSourceUrl(sourceName, url) {
    await this.request('SetInputSettings', {
      inputName: sourceName,
      inputSettings: { url }
    })
  }

  /**
   * 刷新浏览器源
   * @param {string} sourceName - 源名称
   * @returns {Promise<void>}
   */
  async refreshBrowserSource(sourceName) {
    await this.request('PressInputPropertiesButton', {
      inputName: sourceName,
      propertyName: 'refreshnocache'
    })
  }

  /**
   * 获取输入列表
   * @returns {Promise<Array>}
   */
  async getInputList() {
    const result = await this.request('GetInputList')
    return result.inputs || []
  }

  /**
   * 获取场景项列表
   * @param {string} sceneName - 场景名称
   * @returns {Promise<Array>}
   */
  async getSceneItemList(sceneName) {
    const result = await this.request('GetSceneItemList', { sceneName })
    return result.sceneItems || []
  }

  /**
   * 通过源名称获取场景项 ID
   * @param {string} sceneName - 场景名称
   * @param {string} sourceName - 源名称
   * @returns {Promise<number>} 场景项 ID
   */
  async getSceneItemId(sceneName, sourceName) {
    const result = await this.request('GetSceneItemId', {
      sceneName,
      sourceName
    })
    return result.sceneItemId
  }

  /**
   * 设置场景项的变换属性
   * @param {string} sceneName - 场景名称
   * @param {number} sceneItemId - 场景项 ID
   * @param {Object} transform - 变换属性对象
   * @returns {Promise<void>}
   */
  async setSceneItemTransform(sceneName, sceneItemId, transform) {
    await this.request('SetSceneItemTransform', {
      sceneName,
      sceneItemId,
      sceneItemTransform: transform
    })
  }

  /**
   * 获取场景项的变换属性
   * @param {string} sceneName - 场景名称
   * @param {number} sceneItemId - 场景项 ID
   * @returns {Promise<Object>}
   */
  async getSceneItemTransform(sceneName, sceneItemId) {
    const result = await this.request('GetSceneItemTransform', {
      sceneName,
      sceneItemId
    })
    return result.sceneItemTransform || {}
  }

  /**
   * 设置源滤镜的设置
   * @param {string} sourceName - 源名称
   * @param {string} filterName - 滤镜名称
   * @param {Object} settings - 滤镜设置
   * @returns {Promise<void>}
   */
  async setSourceFilterSettings(sourceName, filterName, settings) {
    await this.request('SetSourceFilterSettings', {
      sourceName,
      filterName,
      filterSettings: settings
    })
  }

  /**
   * 获取源滤镜的设置
   * @param {string} sourceName - 源名称
   * @param {string} filterName - 滤镜名称
   * @returns {Promise<Object>}
   */
  async getSourceFilterSettings(sourceName, filterName) {
    const result = await this.request('GetSourceFilter', {
      sourceName,
      filterName
    })
    return result.filterSettings || {}
  }

  /**
   * 设置滤镜启用状态
   * @param {string} sourceName - 源名称
   * @param {string} filterName - 滤镜名称
   * @param {boolean} enabled - 是否启用
   * @returns {Promise<void>}
   */
  async setSourceFilterEnabled(sourceName, filterName, enabled) {
    await this.request('SetSourceFilterEnabled', {
      sourceName,
      filterName,
      filterEnabled: enabled
    })
  }

  /**
   * 获取源的滤镜列表
   * @param {string} sourceName - 源名称
   * @returns {Promise<Array>}
   */
  async getSourceFilterList(sourceName) {
    const result = await this.request('GetSourceFilterList', {
      sourceName
    })
    return result.filters || []
  }
}

module.exports = OBSWebSocket
