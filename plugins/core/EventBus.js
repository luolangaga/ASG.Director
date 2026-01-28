/**
 * ASG.Director 事件总线
 * 
 * 提供应用级别的事件通信机制
 * 支持主进程和渲染进程之间的事件传递
 * 
 * @author ASG Team
 * @version 1.0.0
 */

const { EventEmitter } = require('events')
const { BrowserWindow, ipcMain } = require('electron')

/**
 * 事件优先级
 */
const EventPriority = {
  LOW: 0,
  NORMAL: 100,
  HIGH: 200,
  CRITICAL: 300
}

/**
 * 事件总线类
 * 提供发布-订阅模式的事件通信
 */
class EventBus extends EventEmitter {
  constructor() {
    super()
    
    /** @type {Map<string, Array<{handler: Function, priority: number, once: boolean}>>} */
    this._handlers = new Map()
    
    /** @type {Map<string, any[]>} 事件历史（用于粘性事件） */
    this._stickyEvents = new Map()
    
    /** @type {Set<string>} 已暂停的事件 */
    this._pausedEvents = new Set()
    
    /** @type {Array<{event: string, args: any[]}>} 暂停期间的事件队列 */
    this._eventQueue = []
    
    this._setupIPCBridge()
  }
  
  /**
   * 设置IPC桥接
   * @private
   */
  _setupIPCBridge() {
    // 从渲染进程接收事件
    ipcMain.on('eventbus:emit', (event, eventName, ...args) => {
      this.emit(eventName, ...args)
    })
    
    // 允许渲染进程订阅事件
    ipcMain.handle('eventbus:subscribe', (event, eventName) => {
      // 返回粘性事件的最后值
      if (this._stickyEvents.has(eventName)) {
        return this._stickyEvents.get(eventName)
      }
      return null
    })
  }
  
  /**
   * 订阅事件
   * @param {string} event - 事件名
   * @param {Function} handler - 处理函数
   * @param {Object} options - 选项
   * @param {number} options.priority - 优先级
   * @param {boolean} options.once - 是否只触发一次
   * @returns {Disposable}
   */
  subscribe(event, handler, options = {}) {
    const { priority = EventPriority.NORMAL, once = false } = options
    
    if (!this._handlers.has(event)) {
      this._handlers.set(event, [])
    }
    
    const entry = { handler, priority, once }
    const handlers = this._handlers.get(event)
    
    // 按优先级插入
    let inserted = false
    for (let i = 0; i < handlers.length; i++) {
      if (priority > handlers[i].priority) {
        handlers.splice(i, 0, entry)
        inserted = true
        break
      }
    }
    if (!inserted) {
      handlers.push(entry)
    }
    
    // 如果是粘性事件，立即触发
    if (this._stickyEvents.has(event)) {
      const args = this._stickyEvents.get(event)
      Promise.resolve().then(() => handler(...args))
    }
    
    return {
      dispose: () => {
        const handlers = this._handlers.get(event)
        if (handlers) {
          const index = handlers.findIndex(h => h.handler === handler)
          if (index !== -1) {
            handlers.splice(index, 1)
          }
        }
      }
    }
  }
  
  /**
   * 订阅一次性事件
   * @param {string} event - 事件名
   * @param {Function} handler - 处理函数
   * @param {number} priority - 优先级
   * @returns {Disposable}
   */
  subscribeOnce(event, handler, priority = EventPriority.NORMAL) {
    return this.subscribe(event, handler, { priority, once: true })
  }
  
  /**
   * 取消订阅
   * @param {string} event - 事件名
   * @param {Function} handler - 处理函数
   */
  unsubscribe(event, handler) {
    const handlers = this._handlers.get(event)
    if (handlers) {
      const index = handlers.findIndex(h => h.handler === handler)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }
  
  /**
   * 发布事件
   * @param {string} event - 事件名
   * @param {...any} args - 参数
   */
  publish(event, ...args) {
    // 检查是否暂停
    if (this._pausedEvents.has(event) || this._pausedEvents.has('*')) {
      this._eventQueue.push({ event, args })
      return
    }
    
    this._dispatchEvent(event, args)
  }
  
  /**
   * 发布粘性事件（新订阅者会立即收到最后一次的值）
   * @param {string} event - 事件名
   * @param {...any} args - 参数
   */
  publishSticky(event, ...args) {
    this._stickyEvents.set(event, args)
    this.publish(event, ...args)
  }
  
  /**
   * 清除粘性事件
   * @param {string} event - 事件名
   */
  clearSticky(event) {
    this._stickyEvents.delete(event)
  }
  
  /**
   * 分发事件
   * @private
   */
  _dispatchEvent(event, args) {
    const handlers = this._handlers.get(event)
    
    if (handlers && handlers.length > 0) {
      const toRemove = []
      
      for (const entry of handlers) {
        try {
          entry.handler(...args)
        } catch (e) {
          console.error(`[EventBus] 事件处理器错误 (${event}):`, e)
        }
        
        if (entry.once) {
          toRemove.push(entry)
        }
      }
      
      // 移除一次性处理器
      for (const entry of toRemove) {
        const index = handlers.indexOf(entry)
        if (index !== -1) {
          handlers.splice(index, 1)
        }
      }
    }
    
    // 广播到所有渲染进程
    this._broadcastToRenderers(event, args)
    
    // 同时触发 EventEmitter 的 emit
    super.emit(event, ...args)
  }
  
  /**
   * 广播事件到所有渲染进程
   * @private
   */
  _broadcastToRenderers(event, args) {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('eventbus:event', event, ...args)
      }
    }
  }
  
  /**
   * 暂停事件
   * @param {string} event - 事件名，'*' 表示所有事件
   */
  pause(event = '*') {
    this._pausedEvents.add(event)
  }
  
  /**
   * 恢复事件
   * @param {string} event - 事件名，'*' 表示所有事件
   * @param {boolean} flush - 是否处理暂停期间的事件
   */
  resume(event = '*', flush = true) {
    this._pausedEvents.delete(event)
    
    if (flush && this._eventQueue.length > 0) {
      const toProcess = event === '*' 
        ? [...this._eventQueue]
        : this._eventQueue.filter(e => e.event === event)
      
      // 清空队列
      if (event === '*') {
        this._eventQueue = []
      } else {
        this._eventQueue = this._eventQueue.filter(e => e.event !== event)
      }
      
      // 处理队列中的事件
      for (const { event: e, args } of toProcess) {
        this._dispatchEvent(e, args)
      }
    }
  }
  
  /**
   * 获取事件处理器数量
   * @param {string} event - 事件名
   * @returns {number}
   */
  listenerCount(event) {
    const handlers = this._handlers.get(event)
    return handlers ? handlers.length : 0
  }
  
  /**
   * 移除所有处理器
   * @param {string} event - 事件名（可选）
   */
  removeAllListeners(event) {
    if (event) {
      this._handlers.delete(event)
    } else {
      this._handlers.clear()
    }
    super.removeAllListeners(event)
  }
}

// ==================== 预定义事件 ====================

/**
 * 应用事件
 */
const AppEvents = {
  /** 应用就绪 */
  READY: 'app:ready',
  /** 应用退出前 */
  BEFORE_QUIT: 'app:before-quit',
  /** 窗口创建 */
  WINDOW_CREATED: 'app:window-created',
  /** 窗口关闭 */
  WINDOW_CLOSED: 'app:window-closed',
  /** 窗口获得焦点 */
  WINDOW_FOCUSED: 'app:window-focused'
}

/**
 * 房间事件
 */
const RoomEvents = {
  /** 房间创建 */
  CREATED: 'room:created',
  /** 房间数据更新 */
  UPDATED: 'room:updated',
  /** 房间关闭 */
  CLOSED: 'room:closed',
  /** 连接到房间 */
  CONNECTED: 'room:connected',
  /** 断开连接 */
  DISCONNECTED: 'room:disconnected'
}

/**
 * BP事件
 */
const BPEvents = {
  /** BP开始 */
  STARTED: 'bp:started',
  /** 角色被Ban */
  CHARACTER_BANNED: 'bp:character-banned',
  /** 角色被Pick */
  CHARACTER_PICKED: 'bp:character-picked',
  /** BP结束 */
  ENDED: 'bp:ended',
  /** 回合变化 */
  ROUND_CHANGED: 'bp:round-changed'
}

/**
 * 比赛事件
 */
const MatchEvents = {
  /** 比赛开始 */
  STARTED: 'match:started',
  /** 比分更新 */
  SCORE_UPDATED: 'match:score-updated',
  /** 比赛结束 */
  ENDED: 'match:ended',
  /** 地图变化 */
  MAP_CHANGED: 'match:map-changed'
}

/**
 * 布局事件
 */
const LayoutEvents = {
  /** 布局保存 */
  SAVED: 'layout:saved',
  /** 布局加载 */
  LOADED: 'layout:loaded',
  /** 布局重置 */
  RESET: 'layout:reset',
  /** 布局包导入 */
  PACK_IMPORTED: 'layout:pack-imported',
  /** 布局包导出 */
  PACK_EXPORTED: 'layout:pack-exported'
}

/**
 * 插件事件
 */
const PluginEvents = {
  /** 插件加载 */
  LOADED: 'plugin:loaded',
  /** 插件激活 */
  ACTIVATED: 'plugin:activated',
  /** 插件停用 */
  DEACTIVATED: 'plugin:deactivated',
  /** 插件错误 */
  ERROR: 'plugin:error'
}

// 导出单例
const eventBus = new EventBus()

module.exports = {
  EventBus,
  EventPriority,
  AppEvents,
  RoomEvents,
  BPEvents,
  MatchEvents,
  LayoutEvents,
  PluginEvents,
  eventBus
}
