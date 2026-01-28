/**
 * HTTP 下载工具模块
 * 支持断点续传、进度回调、重试机制
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { promisify } = require('util')
const { pipeline } = require('stream')
const pipelineAsync = promisify(pipeline)

/**
 * 下载配置
 */
const DEFAULT_CONFIG = {
  timeout: 300000,        // 5分钟超时
  maxRetries: 3,          // 最大重试次数
  retryDelay: 1000,       // 重试延迟（毫秒）
  userAgent: 'ASG-Director/1.0',
  followRedirects: true,
  maxRedirects: 5
}

/**
 * HTTP GET 请求（返回 JSON）
 * @param {string} url - 请求地址
 * @param {object} options - 可选配置
 * @returns {Promise<object>}
 */
async function httpGet(url, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options }
  
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const protocol = urlObj.protocol === 'https:' ? https : http

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': config.userAgent,
        ...config.headers
      }
    }

    const request = protocol.request(requestOptions, (response) => {
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        if (config.followRedirects && config._redirectCount < config.maxRedirects) {
          const redirectUrl = new URL(response.headers.location, url).toString()
          return httpGet(redirectUrl, { 
            ...config, 
            _redirectCount: (config._redirectCount || 0) + 1 
          }).then(resolve).catch(reject)
        }
        reject(new Error('太多重定向'))
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }

      let data = ''
      response.on('data', chunk => data += chunk)
      response.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error('无效的 JSON 响应'))
        }
      })
    })

    request.on('error', reject)
    request.setTimeout(config.timeout, () => {
      request.destroy()
      reject(new Error('请求超时'))
    })
    
    request.end()
  })
}

/**
 * HTTP POST 请求
 * @param {string} url - 请求地址
 * @param {object|string} body - 请求体
 * @param {object} options - 可选配置
 * @returns {Promise<{status: number, data: any}>}
 */
async function httpPost(url, body, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options }
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const protocol = urlObj.protocol === 'https:' ? https : http

    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': config.userAgent,
        ...config.headers
      }
    }

    const request = protocol.request(requestOptions, (response) => {
      let data = ''
      response.on('data', chunk => data += chunk)
      response.on('end', () => {
        try {
          resolve({ status: response.statusCode, data: JSON.parse(data) })
        } catch {
          resolve({ status: response.statusCode, data })
        }
      })
    })

    request.on('error', reject)
    request.setTimeout(config.timeout, () => {
      request.destroy()
      reject(new Error('请求超时'))
    })

    request.write(bodyStr)
    request.end()
  })
}

/**
 * 下载文件
 * @param {string} url - 下载地址
 * @param {string} destPath - 目标路径
 * @param {object} options - 配置选项
 * @returns {Promise<{success: boolean, path: string, size: number}>}
 */
async function downloadFile(url, destPath, options = {}) {
  const {
    onProgress = null,
    timeout = DEFAULT_CONFIG.timeout,
    maxRetries = DEFAULT_CONFIG.maxRetries,
    retryDelay = DEFAULT_CONFIG.retryDelay,
    resumable = true,
    headers = {}
  } = options

  let retries = 0
  let lastError = null

  while (retries <= maxRetries) {
    try {
      const result = await downloadFileOnce(url, destPath, {
        onProgress,
        timeout,
        resumable,
        headers
      })
      return result
    } catch (error) {
      lastError = error
      retries++
      
      if (retries <= maxRetries) {
        console.log(`[Download] 下载失败，${retryDelay}ms 后重试 (${retries}/${maxRetries}):`, error.message)
        await sleep(retryDelay)
      }
    }
  }

  throw lastError
}

/**
 * 单次下载尝试
 */
async function downloadFileOnce(url, destPath, options = {}) {
  const {
    onProgress = null,
    timeout = 300000,
    resumable = true,
    headers = {}
  } = options

  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const protocol = urlObj.protocol === 'https:' ? https : http

    // 检查已下载的部分
    let startByte = 0
    if (resumable && fs.existsSync(destPath)) {
      const stats = fs.statSync(destPath)
      startByte = stats.size
    }

    const requestHeaders = {
      'User-Agent': DEFAULT_CONFIG.userAgent,
      ...headers
    }

    // 断点续传
    if (startByte > 0) {
      requestHeaders['Range'] = `bytes=${startByte}-`
      console.log(`[Download] 断点续传，从 ${startByte} 字节开始`)
    }

    // 确保目标目录存在
    const destDir = path.dirname(destPath)
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    const request = protocol.get(url, { headers: requestHeaders }, (response) => {
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = new URL(response.headers.location, url).toString()
        return downloadFileOnce(redirectUrl, destPath, options).then(resolve).catch(reject)
      }

      // 检查响应状态
      if (response.statusCode !== 200 && response.statusCode !== 206) {
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }

      // 获取文件大小
      let totalSize = parseInt(response.headers['content-length'], 10) || 0
      if (response.statusCode === 206) {
        // 断点续传，从 Content-Range 获取总大小
        const range = response.headers['content-range']
        if (range) {
          const match = range.match(/\/(\d+)$/)
          if (match) {
            totalSize = parseInt(match[1], 10)
          }
        }
        totalSize = totalSize || (startByte + parseInt(response.headers['content-length'], 10))
      }

      let downloadedSize = startByte
      
      // 打开文件流（追加模式或覆盖模式）
      const flags = startByte > 0 && response.statusCode === 206 ? 'a' : 'w'
      const file = fs.createWriteStream(destPath, { flags })

      response.on('data', (chunk) => {
        downloadedSize += chunk.length
        if (onProgress && totalSize > 0) {
          const progress = Math.round((downloadedSize / totalSize) * 100)
          onProgress(progress, downloadedSize, totalSize)
        }
      })

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        const finalSize = fs.statSync(destPath).size
        console.log(`[Download] 下载完成: ${finalSize} 字节`)
        resolve({ success: true, path: destPath, size: finalSize })
      })

      file.on('error', (err) => {
        file.close()
        fs.unlink(destPath, () => {})
        reject(err)
      })
    })

    request.on('error', (err) => {
      reject(err)
    })

    request.setTimeout(timeout, () => {
      request.destroy()
      reject(new Error('下载超时'))
    })
  })
}

/**
 * 获取文件大小（不下载）
 * @param {string} url - 文件地址
 * @returns {Promise<number>}
 */
async function getFileSize(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const protocol = urlObj.protocol === 'https:' ? https : http

    const request = protocol.request(url, { method: 'HEAD' }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        return getFileSize(response.headers.location).then(resolve).catch(reject)
      }

      const size = parseInt(response.headers['content-length'], 10) || 0
      resolve(size)
    })

    request.on('error', reject)
    request.setTimeout(10000, () => {
      request.destroy()
      reject(new Error('获取文件大小超时'))
    })

    request.end()
  })
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 格式化文件大小
 */
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}

module.exports = {
  httpGet,
  httpPost,
  downloadFile,
  getFileSize,
  formatSize,
  sleep
}
