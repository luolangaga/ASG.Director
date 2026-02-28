const fs = require('fs')

function readJsonFileSafe(filePath, fallback = {}) {
  try {
    if (!fs.existsSync(filePath)) return fallback
    const content = fs.readFileSync(filePath, 'utf8')
    if (!content || !content.trim()) return fallback
    return JSON.parse(content)
  } catch (e) {
    console.warn('[Main] 读取 JSON 失败:', filePath, e.message)
    return fallback
  }
}

function writeJsonFileSafe(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    return true
  } catch (e) {
    console.error('[Main] 写入 JSON 失败:', filePath, e)
    return false
  }
}

module.exports = {
  readJsonFileSafe,
  writeJsonFileSafe
}
