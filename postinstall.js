// 安装后脚本 - 下载SignalR库
const https = require('https')
const fs = require('fs')
const path = require('path')

const signalrUrl = 'https://cdn.jsdelivr.net/npm/@microsoft/signalr@8.0.0/dist/browser/signalr.min.js'
const destPath = path.join(__dirname, 'pages', 'js', 'signalr.min.js')

console.log('正在下载 SignalR 库...')

const file = fs.createWriteStream(destPath)
https.get(signalrUrl, (response) => {
  response.pipe(file)
  file.on('finish', () => {
    file.close()
    console.log('SignalR 库下载完成:', destPath)
  })
}).on('error', (err) => {
  fs.unlink(destPath, () => {})
  console.error('下载失败:', err.message)
  console.log('请手动下载 SignalR 库并放置到 pages/js/signalr.min.js')
})
