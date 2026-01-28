#!/usr/bin/env node
/**
 * 使用rcedit修改icon
 */

const { execSync } = require('child_process');
const path = require('path');

const exePath = 'dist\\Idvevent导播端 Setup 1.4.1.exe';
const iconPath = 'assets\\icon.ico';
const rceditBin = path.join(__dirname, '../node_modules/rcedit/bin/rcedit.exe');

console.log(`exe: ${exePath}`);
console.log(`icon: ${iconPath}`);
console.log(`rcedit: ${rceditBin}`);

try {
    const cmd = `"${rceditBin}" "${exePath}" --set-icon "${iconPath}"`;
    console.log(`\n执行: ${cmd}\n`);
    
    const result = execSync(cmd, { cwd: __dirname.replace(/scripts$/, ''), encoding: 'utf8' });
    console.log(result);
    console.log('\n✓ 图标已修改');
} catch (error) {
    console.error('✗ 失败:', error.message);
    if (error.stderr) {
        console.error('stderr:', error.stderr);
    }
    process.exit(1);
}
