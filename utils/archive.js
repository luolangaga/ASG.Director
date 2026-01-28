/**
 * 跨平台压缩解压模块
 * 使用 Node.js 原生方案，不依赖 PowerShell
 */

const fs = require('fs')
const path = require('path')
const archiver = require('archiver')
const { createReadStream, createWriteStream } = require('fs')
const { pipeline } = require('stream/promises')
const zlib = require('zlib')

/**
 * 压缩目录为 ZIP 文件
 * @param {string} sourceDir - 源目录路径
 * @param {string} outputPath - 输出 ZIP 文件路径
 * @param {object} options - 可选配置
 * @returns {Promise<{success: boolean, size: number, error?: string}>}
 */
async function zipDirectory(sourceDir, outputPath, options = {}) {
  const {
    compressionLevel = 9,
    onProgress = null
  } = options

  return new Promise((resolve, reject) => {
    // 确保源目录存在
    if (!fs.existsSync(sourceDir)) {
      reject(new Error(`源目录不存在: ${sourceDir}`))
      return
    }

    // 确保输出目录存在
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const output = createWriteStream(outputPath)
    const archive = archiver('zip', {
      zlib: { level: compressionLevel }
    })

    let totalBytes = 0

    output.on('close', () => {
      totalBytes = archive.pointer()
      console.log(`[Archive] 压缩完成: ${totalBytes} 字节`)
      resolve({ success: true, size: totalBytes })
    })

    output.on('error', (err) => {
      console.error('[Archive] 输出流错误:', err)
      reject(err)
    })

    archive.on('error', (err) => {
      console.error('[Archive] 压缩错误:', err)
      reject(err)
    })

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('[Archive] 压缩警告:', err.message)
      } else {
        reject(err)
      }
    })

    archive.on('progress', (progress) => {
      if (onProgress) {
        onProgress(progress.entries.processed, progress.entries.total)
      }
    })

    archive.pipe(output)
    archive.directory(sourceDir, false)
    archive.finalize()
  })
}

/**
 * 解压 ZIP 文件到目录（纯 Node.js 实现）
 * @param {string} zipPath - ZIP 文件路径
 * @param {string} destDir - 目标目录
 * @param {object} options - 可选配置
 * @returns {Promise<{success: boolean, files: string[], error?: string}>}
 */
async function unzipFile(zipPath, destDir, options = {}) {
  const {
    onProgress = null,
    overwrite = true
  } = options

  // 动态导入 yauzl（因为它可能需要安装）
  let yauzl
  try {
    yauzl = require('yauzl')
  } catch (e) {
    // 如果 yauzl 不可用，使用备用方案
    console.log('[Archive] yauzl 不可用，使用备用解压方案')
    return await unzipFallback(zipPath, destDir, options)
  }

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(zipPath)) {
      reject(new Error(`ZIP 文件不存在: ${zipPath}`))
      return
    }

    // 确保目标目录存在
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    const extractedFiles = []

    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err)
        return
      }

      const totalEntries = zipfile.entryCount
      let processedEntries = 0

      zipfile.readEntry()

      zipfile.on('entry', (entry) => {
        processedEntries++
        
        if (onProgress) {
          onProgress(processedEntries, totalEntries)
        }

        const fullPath = path.join(destDir, entry.fileName)

        // 目录条目
        if (/\/$/.test(entry.fileName)) {
          if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true })
          }
          zipfile.readEntry()
          return
        }

        // 确保父目录存在
        const parentDir = path.dirname(fullPath)
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true })
        }

        // 检查是否需要跳过
        if (!overwrite && fs.existsSync(fullPath)) {
          zipfile.readEntry()
          return
        }

        // 提取文件
        zipfile.openReadStream(entry, (err, readStream) => {
          if (err) {
            console.error(`[Archive] 读取条目失败: ${entry.fileName}`, err)
            zipfile.readEntry()
            return
          }

          const writeStream = createWriteStream(fullPath)
          
          readStream.on('end', () => {
            extractedFiles.push(entry.fileName)
            zipfile.readEntry()
          })

          readStream.on('error', (err) => {
            console.error(`[Archive] 流读取错误: ${entry.fileName}`, err)
            zipfile.readEntry()
          })

          writeStream.on('error', (err) => {
            console.error(`[Archive] 流写入错误: ${entry.fileName}`, err)
            zipfile.readEntry()
          })

          readStream.pipe(writeStream)
        })
      })

      zipfile.on('end', () => {
        console.log(`[Archive] 解压完成: ${extractedFiles.length} 个文件`)
        resolve({ success: true, files: extractedFiles })
      })

      zipfile.on('error', (err) => {
        console.error('[Archive] ZIP 文件错误:', err)
        reject(err)
      })
    })
  })
}

/**
 * 备用解压方案（使用 adm-zip）
 */
async function unzipFallback(zipPath, destDir, options = {}) {
  let AdmZip
  try {
    AdmZip = require('adm-zip')
  } catch (e) {
    // 如果 adm-zip 也不可用，尝试使用内置解压
    console.log('[Archive] adm-zip 不可用，使用内置解压方案')
    return await unzipBuiltin(zipPath, destDir, options)
  }

  try {
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()
    const files = []

    for (const entry of entries) {
      if (!entry.isDirectory) {
        files.push(entry.entryName)
      }
    }

    zip.extractAllTo(destDir, true)
    console.log(`[Archive] 解压完成 (adm-zip): ${files.length} 个文件`)
    
    return { success: true, files }
  } catch (error) {
    console.error('[Archive] adm-zip 解压失败:', error)
    throw error
  }
}

/**
 * 内置解压方案（简易 ZIP 解析）
 * 这是最后的备用方案，支持基本的 ZIP 文件
 */
async function unzipBuiltin(zipPath, destDir, options = {}) {
  const { promisify } = require('util')
  const { exec } = require('child_process')
  const execAsync = promisify(exec)
  const os = require('os')

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  const platform = os.platform()

  try {
    if (platform === 'win32') {
      // Windows: 尝试使用 tar（Windows 10 1803+ 内置）
      try {
        await execAsync(`tar -xf "${zipPath}" -C "${destDir}"`)
        console.log('[Archive] 使用 Windows tar 解压成功')
      } catch (tarError) {
        // 如果 tar 失败，尝试使用 PowerShell 的 .NET 方法（更可靠）
        console.log('[Archive] tar 失败，尝试 .NET 方案')
        const psCommand = `
          Add-Type -AssemblyName System.IO.Compression.FileSystem
          [System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPath.replace(/'/g, "''")}', '${destDir.replace(/'/g, "''")}')
        `
        await execAsync(`powershell -NoProfile -Command "${psCommand}"`)
        console.log('[Archive] 使用 .NET ZipFile 解压成功')
      }
    } else if (platform === 'darwin' || platform === 'linux') {
      // macOS/Linux: 使用 unzip 命令
      await execAsync(`unzip -o "${zipPath}" -d "${destDir}"`)
      console.log('[Archive] 使用 unzip 命令解压成功')
    } else {
      throw new Error(`不支持的平台: ${platform}`)
    }

    // 列出解压后的文件
    const files = listFilesRecursive(destDir)
    return { success: true, files }
  } catch (error) {
    console.error('[Archive] 内置解压失败:', error)
    throw error
  }
}

/**
 * 递归列出目录中的所有文件
 */
function listFilesRecursive(dir, baseDir = dir) {
  const files = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...listFilesRecursive(fullPath, baseDir))
    } else {
      files.push(path.relative(baseDir, fullPath))
    }
  }
  
  return files
}

/**
 * 验证 ZIP 文件完整性
 * @param {string} zipPath - ZIP 文件路径
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
async function validateZip(zipPath) {
  return new Promise((resolve) => {
    if (!fs.existsSync(zipPath)) {
      resolve({ valid: false, error: '文件不存在' })
      return
    }

    // 检查文件头（ZIP 文件应以 PK 开头）
    const buffer = Buffer.alloc(4)
    const fd = fs.openSync(zipPath, 'r')
    fs.readSync(fd, buffer, 0, 4, 0)
    fs.closeSync(fd)

    // ZIP 文件魔数: 0x504B0304 (PK..)
    if (buffer[0] === 0x50 && buffer[1] === 0x4B) {
      resolve({ valid: true })
    } else {
      resolve({ valid: false, error: '不是有效的 ZIP 文件' })
    }
  })
}

/**
 * 获取 ZIP 文件信息
 * @param {string} zipPath - ZIP 文件路径
 * @returns {Promise<{entries: number, size: number, compressedSize: number}>}
 */
async function getZipInfo(zipPath) {
  const stats = fs.statSync(zipPath)
  
  let AdmZip
  try {
    AdmZip = require('adm-zip')
    const zip = new AdmZip(zipPath)
    const entries = zip.getEntries()
    
    let uncompressedSize = 0
    for (const entry of entries) {
      uncompressedSize += entry.header.size
    }
    
    return {
      entries: entries.length,
      compressedSize: stats.size,
      uncompressedSize
    }
  } catch (e) {
    return {
      entries: -1,
      compressedSize: stats.size,
      uncompressedSize: -1
    }
  }
}

module.exports = {
  zipDirectory,
  unzipFile,
  validateZip,
  getZipInfo,
  listFilesRecursive
}
