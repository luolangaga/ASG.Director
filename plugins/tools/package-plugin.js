#!/usr/bin/env node

/**
 * ASG.Director 插件打包工具
 *
 * 用法：
 *   node plugins/tools/package-plugin.js --src <插件目录> --out <输出文件.asgplugin>
 *
 * 说明：
 * - 输出文件本质是 zip（扩展名 .asgplugin 只是约定）
 * - 会跳过 node_modules、dist、.git、.storage 等目录
 */

const fs = require('fs')
const path = require('path')
const AdmZip = require('adm-zip')

function parseArgs(argv) {
  const args = { src: null, out: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--src') args.src = argv[++i]
    else if (a === '--out') args.out = argv[++i]
    else if (!a.startsWith('--') && !args.src) args.src = a
    else if (!a.startsWith('--') && !args.out) args.out = a
  }
  return args
}

function fail(msg) {
  console.error('[plugin:pack] ' + msg)
  process.exit(1)
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function shouldIgnore(relPath) {
  const parts = relPath.split(/[\\/]/g).filter(Boolean)
  if (parts.length === 0) return false
  const top = parts[0]

  // 常见无需分发内容
  if (top === 'node_modules') return true
  if (top === 'dist') return true
  if (top === '.git') return true
  if (top === '.storage') return true

  // 也排除一些本地临时/系统文件
  const base = parts[parts.length - 1]
  if (base === '.DS_Store') return true

  return false
}

function readManifest(pluginDir) {
  const manifestPath = path.join(pluginDir, 'package.json')
  if (!fs.existsSync(manifestPath)) fail('找不到 package.json：' + manifestPath)

  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  } catch (e) {
    fail('package.json 不是合法 JSON：' + e.message)
  }

  const missing = []
  if (!manifest.name) missing.push('name')
  if (!manifest.version) missing.push('version')
  if (!manifest.main) missing.push('main')
  if (missing.length) fail('package.json 缺少字段：' + missing.join(', '))

  const mainPath = path.join(pluginDir, manifest.main)
  if (!fs.existsSync(mainPath)) fail(`入口文件不存在：${manifest.main}`)

  return manifest
}

function addFolderToZip(zip, folder, zipRoot) {
  const entries = fs.readdirSync(folder, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(folder, entry.name)
    const rel = path.relative(zipRoot, abs)
    if (shouldIgnore(rel)) continue

    if (entry.isDirectory()) {
      addFolderToZip(zip, abs, zipRoot)
    } else if (entry.isFile()) {
      zip.addLocalFile(abs, path.dirname(rel).replace(/\\/g, '/'))
    }
  }
}

function main() {
  const { src, out } = parseArgs(process.argv.slice(2))
  if (!src || !out) {
    console.log('用法：node plugins/tools/package-plugin.js --src <插件目录> --out <输出文件.asgplugin>')
    process.exit(0)
  }

  const pluginDir = path.resolve(process.cwd(), src)
  const outFile = path.resolve(process.cwd(), out)

  if (!fs.existsSync(pluginDir) || !fs.statSync(pluginDir).isDirectory()) {
    fail('插件目录不存在：' + pluginDir)
  }

  const manifest = readManifest(pluginDir)

  ensureDir(path.dirname(outFile))

  const zip = new AdmZip()
  addFolderToZip(zip, pluginDir, pluginDir)
  zip.writeZip(outFile)

  console.log(`[plugin:pack] 打包完成：${manifest.name}@${manifest.version}`)
  console.log(`[plugin:pack] 输出文件：${outFile}`)
}

main()
