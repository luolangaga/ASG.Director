const fs = require('fs');
const path = require('path');

// 递归计算目录大小
function getDirSize(dirPath) {
    let size = 0;
    let fileCount = 0;

    try {
        const items = fs.readdirSync(dirPath);

        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stat = fs.statSync(itemPath);

            if (stat.isFile()) {
                size += stat.size;
                fileCount++;
            } else if (stat.isDirectory()) {
                const subResult = getDirSize(itemPath);
                size += subResult.size;
                fileCount += subResult.fileCount;
            }
        }
    } catch (err) {
        // 忽略权限错误
    }

    return { size, fileCount };
}

// 格式化字节大小
function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

// 分析打包结果
function analyzeBuild() {
    const distPath = path.join(__dirname, '..', 'dist');

    if (!fs.existsSync(distPath)) {
        console.log('✗ dist目录不存在，请先运行 npm run build');
        return;
    }

    console.log('\n========== 打包体积分析 ==========\n');

    // 分析安装包
    const installerFiles = fs.readdirSync(distPath).filter(f =>
        f.endsWith('.exe') || f.endsWith('.appx') || f.endsWith('.dmg')
    );

    if (installerFiles.length > 0) {
        console.log('📦 安装包文件:');
        for (const file of installerFiles) {
            const filePath = path.join(distPath, file);
            const stat = fs.statSync(filePath);
            console.log(`  ${file}: ${formatSize(stat.size)}`);
        }
        console.log();
    }

    // 分析win-unpacked
    const unpackedPath = path.join(distPath, 'win-unpacked');
    if (fs.existsSync(unpackedPath)) {
        console.log('📂 解包内容 (win-unpacked):');

        const items = fs.readdirSync(unpackedPath);
        const itemSizes = [];

        for (const item of items) {
            const itemPath = path.join(unpackedPath, item);
            const stat = fs.statSync(itemPath);

            if (stat.isFile()) {
                itemSizes.push({ name: item, size: stat.size, isDir: false });
            } else {
                const result = getDirSize(itemPath);
                itemSizes.push({ name: item + '/', size: result.size, isDir: true });
            }
        }

        // 按大小降序排列
        itemSizes.sort((a, b) => b.size - a.size);

        for (const item of itemSizes) {
            console.log(`  ${item.name.padEnd(30)} ${formatSize(item.size).padStart(12)}`);
        }

        const totalSize = itemSizes.reduce((sum, item) => sum + item.size, 0);
        console.log(`  ${'总计'.padEnd(30)} ${formatSize(totalSize).padStart(12)}`);
        console.log();
    }

    // 分析app.asar
    const appAsarPath = path.join(distPath, 'win-unpacked', 'resources', 'app.asar');
    if (fs.existsSync(appAsarPath)) {
        const asarStat = fs.statSync(appAsarPath);
        console.log('📦 应用代码包 (app.asar):');
        console.log(`  大小: ${formatSize(asarStat.size)}`);

        // 尝试列出asar内容的大概分布
        try {
            const { execSync } = require('child_process');
            console.log('\n  正在分析asar内容...');
            const asarList = execSync(`npx asar list "${appAsarPath}"`).toString();
            const lines = asarList.split('\n').filter(l => l.trim());

            const dirCount = {};
            for (const line of lines) {
                const parts = line.split('/');
                if (parts.length > 1) {
                    const topDir = parts[0];
                    dirCount[topDir] = (dirCount[topDir] || 0) + 1;
                }
            }

            console.log('\n  文件分布:');
            const sorted = Object.entries(dirCount).sort((a, b) => b[1] - a[1]);
            for (const [dir, count] of sorted) {
                console.log(`    ${dir.padEnd(25)} ${count} 个文件`);
            }
        } catch (err) {
            // 如果无法分析asar，静默忽略
        }
    }

    console.log('\n==================================\n');
}

analyzeBuild();
