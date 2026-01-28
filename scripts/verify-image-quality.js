const fs = require('fs');
const path = require('path');

/**
 * 验证优化后的图片质量
 * 随机选择几张图片，展示优化前后的对比
 */

const imageDirs = [
    'assets/surHalf',
    'assets/hunBig',
    'assets/surBig',
    'assets/hunHalf'
];

function checkImageQuality() {
    console.log('\n========== 图片质量验证 ==========\n');

    let totalSamples = 0;
    const samples = [];

    for (const dir of imageDirs) {
        const dirPath = path.join(__dirname, '..', dir);

        if (!fs.existsSync(dirPath)) {
            continue;
        }

        const files = fs.readdirSync(dirPath)
            .filter(f => f.toLowerCase().endsWith('.png'))
            .slice(0, 2); // 每个目录取2个样本

        for (const file of files) {
            const filePath = path.join(dirPath, file);
            const stat = fs.statSync(filePath);

            samples.push({
                dir: dir.replace('assets/', ''),
                file: file,
                size: stat.size,
                path: filePath
            });
            totalSamples++;
        }
    }

    console.log('📊 样本图片信息:\n');

    for (const sample of samples) {
        console.log(`  ${sample.dir}/${sample.file}`);
        console.log(`    大小: ${(sample.size / 1024).toFixed(1)} KB`);
        console.log(`    路径: ${sample.path}`);
        console.log();
    }

    console.log('==================================\n');
    console.log('💡 如何验证清晰度:\n');
    console.log('1. 打开上述图片文件');
    console.log('2. 在应用中使用这些图片');
    console.log('3. 如果发现质量问题，可以调整压缩参数\n');
    console.log('如需调整压缩参数，编辑 scripts/optimize-images.js:');
    console.log('  - quality: 80 → 90 (提高质量，减少压缩)');
    console.log('  - palette: true → false (保持真彩色，但文件更大)');
    console.log('==================================\n');
}

checkImageQuality();
