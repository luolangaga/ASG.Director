const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 需要优化的图片目录
const imageDirs = [
    'assets/surHalf',
    'assets/hunBig',
    'assets/surBig',
    'assets/hunHalf',
    'assets/map'
];

// 检查是否安装了sharp (Node.js图片处理库)
function checkAndInstallSharp() {
    try {
        require.resolve('sharp');
        console.log('✓ Sharp已安装');
        return true;
    } catch (e) {
        console.log('正在安装图片优化工具 sharp...');
        try {
            execSync('npm install --save-dev sharp', { stdio: 'inherit' });
            console.log('✓ Sharp安装成功');
            return true;
        } catch (err) {
            console.error('✗ Sharp安装失败，将跳过图片优化');
            return false;
        }
    }
}

async function optimizeImages() {
    if (!checkAndInstallSharp()) {
        return;
    }

    const sharp = require('sharp');
    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;
    let filesProcessed = 0;

    for (const dir of imageDirs) {
        const dirPath = path.join(__dirname, '..', dir);

        if (!fs.existsSync(dirPath)) {
            console.log(`⊘ 目录不存在: ${dir}`);
            continue;
        }

        console.log(`\n处理目录: ${dir}`);
        const files = fs.readdirSync(dirPath);

        for (const file of files) {
            if (!file.toLowerCase().endsWith('.png')) {
                continue;
            }

            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);
            const originalSize = stat.size;
            totalOriginalSize += originalSize;

            try {
                // 读取原图
                const image = sharp(filePath);
                const metadata = await image.metadata();

                // 优化PNG (压缩)
                const tempPath = filePath + '.tmp';
                await image
                    .png({
                        quality: 80, // PNG质量
                        compressionLevel: 9, // 最高压缩级别
                        adaptiveFiltering: true,
                        palette: true // 使用调色板模式（适合角色图标）
                    })
                    .toFile(tempPath);

                const optimizedStat = fs.statSync(tempPath);
                const optimizedSize = optimizedStat.size;

                // 如果优化后更小，替换原文件
                if (optimizedSize < originalSize) {
                    fs.unlinkSync(filePath);
                    fs.renameSync(tempPath, filePath);
                    totalOptimizedSize += optimizedSize;
                    const savings = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
                    console.log(`  ✓ ${file}: ${(originalSize / 1024).toFixed(1)}KB → ${(optimizedSize / 1024).toFixed(1)}KB (节省 ${savings}%)`);
                    filesProcessed++;
                } else {
                    // 优化后反而更大，保留原文件
                    fs.unlinkSync(tempPath);
                    totalOptimizedSize += originalSize;
                    console.log(`  - ${file}: 保持原样 (${(originalSize / 1024).toFixed(1)}KB)`);
                }
            } catch (err) {
                console.error(`  ✗ ${file}: 优化失败 - ${err.message}`);
                totalOptimizedSize += originalSize;
            }
        }
    }

    console.log('\n========== 优化结果 ==========');
    console.log(`处理文件数: ${filesProcessed}`);
    console.log(`原始总大小: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`优化后大小: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`节省空间: ${((totalOriginalSize - totalOptimizedSize) / 1024 / 1024).toFixed(2)} MB (${((1 - totalOptimizedSize / totalOriginalSize) * 100).toFixed(1)}%)`);
    console.log('==============================\n');
}

// 运行优化
optimizeImages().catch(err => {
    console.error('优化过程出错:', err);
    process.exit(1);
});
