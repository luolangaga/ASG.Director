#!/usr/bin/env node
/**
 * 使用rcedit修改应用EXE图标
 */

const { execSync } = require('child_process');
const path = require('path');

const exePath = 'dist\\win-unpacked\\Idvevent导播端.exe';
const iconPath = 'assets\\icon.ico';
const rceditBin = path.join(__dirname, '../node_modules/rcedit/bin/rcedit.exe');

console.log(`修改应用EXE图标...`);
console.log(`exe: ${exePath}`);
console.log(`icon: ${iconPath}`);

try {
    const cmd = `"${rceditBin}" "${exePath}" --set-icon "${iconPath}"`;
    console.log(`\n执行...`);
    
    const result = execSync(cmd, { cwd: __dirname.replace(/scripts$/, ''), encoding: 'utf8' });
    console.log('\n✓ 应用图标已修改');
} catch (error) {
    console.error('✗ 失败:', error.message);
    process.exit(1);
}
