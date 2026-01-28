/**
 * 布局包验证工具
 * 用于验证布局包文件的完整性
 */

const fs = require('fs')
const path = require('path')
const { validateZip, unzipFile } = require('./archive')

/**
 * 验证布局包文件
 * @param {string} packFilePath - 布局包文件路径
 * @returns {Promise<{valid: boolean, errors: string[], warnings: string[]}>}
 */
async function validatePackFile(packFilePath) {
  const errors = []
  const warnings = []

  try {
    // 1. 检查文件是否存在
    if (!fs.existsSync(packFilePath)) {
      errors.push('文件不存在')
      return { valid: false, errors, warnings }
    }

    // 2. 验证 ZIP 格式
    console.log('[Validate] 检查 ZIP 格式...')
    const zipValidation = await validateZip(packFilePath)
    if (!zipValidation.valid) {
      errors.push(`ZIP 格式无效: ${zipValidation.error}`)
      return { valid: false, errors, warnings }
    }

    // 3. 解压到临时目录
    console.log('[Validate] 解压文件...')
    const tempDir = path.join(require('os').tmpdir(), `validate-${Date.now()}`)
    fs.mkdirSync(tempDir, { recursive: true })

    try {
      const unzipResult = await unzipFile(packFilePath, tempDir)
      if (!unzipResult.success) {
        errors.push('解压失败')
        return { valid: false, errors, warnings }
      }

      console.log('[Validate] 解压成功，文件数:', unzipResult.files.length)

      // 4. 检查必需文件（兼容 layout.json / layout-v2.json）
      const layoutV2File = path.join(tempDir, 'layout-v2.json')
      const layoutFile = path.join(tempDir, 'layout.json')
      const effectiveLayoutFile = fs.existsSync(layoutV2File) ? layoutV2File : layoutFile

      if (!fs.existsSync(effectiveLayoutFile)) {
        errors.push('缺少 layout.json 或 layout-v2.json 文件')
      } else {
        // 验证布局 JSON 格式
        try {
          const content = fs.readFileSync(effectiveLayoutFile, 'utf8').trim()
          if (!content) {
            errors.push(`${path.basename(effectiveLayoutFile)} 文件为空`)
          } else {
            const layout = JSON.parse(content)
            console.log(`[Validate] ${path.basename(effectiveLayoutFile)} 有效，键数量:`, Object.keys(layout).length)
          }
        } catch (e) {
          errors.push(`${path.basename(effectiveLayoutFile)} 格式无效: ${e.message}`)
        }
      }

      // 5. 检查可选文件
      const packConfigFile = path.join(tempDir, 'pack-config.json')
      if (fs.existsSync(packConfigFile)) {
        try {
          const content = fs.readFileSync(packConfigFile, 'utf8').trim()
          if (!content) {
            warnings.push('pack-config.json 文件为空（将被忽略）')
          } else {
            const packConfig = JSON.parse(content)
            console.log('[Validate] pack-config.json 有效，属性数:', Object.keys(packConfig).length)
          }
        } catch (e) {
          warnings.push(`pack-config.json 格式无效（将被忽略）: ${e.message}`)
        }
      }

      // 6. 检查图片文件
      const files = fs.readdirSync(tempDir)
      const imageFiles = files.filter(f => {
        const ext = path.extname(f).toLowerCase()
        return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext)
      })
      
      if (imageFiles.length > 0) {
        console.log('[Validate] 找到图片文件:', imageFiles.length, '个')
      } else {
        warnings.push('未找到图片文件')
      }

      // 清理临时目录
      fs.rmSync(tempDir, { recursive: true, force: true })

    } catch (e) {
      errors.push(`验证过程出错: ${e.message}`)
    }

  } catch (error) {
    errors.push(`验证失败: ${error.message}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * 从命令行运行验证
 */
if (require.main === module) {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.log('用法: node validatePack.js <布局包文件路径>')
    process.exit(1)
  }

  const packFile = args[0]
  console.log('验证布局包:', packFile)
  console.log('='.repeat(50))

  validatePackFile(packFile).then(result => {
    console.log('\n验证结果:')
    console.log('='.repeat(50))
    console.log('有效:', result.valid ? '✓' : '✗')
    
    if (result.errors.length > 0) {
      console.log('\n错误:')
      result.errors.forEach(err => console.log('  ✗', err))
    }

    if (result.warnings.length > 0) {
      console.log('\n警告:')
      result.warnings.forEach(warn => console.log('  ⚠', warn))
    }

    if (result.valid) {
      console.log('\n布局包文件有效！')
    } else {
      console.log('\n布局包文件无效！')
      process.exit(1)
    }
  }).catch(err => {
    console.error('验证失败:', err)
    process.exit(1)
  })
}

module.exports = {
  validatePackFile
}
