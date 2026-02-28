const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const projectRoot = path.resolve(__dirname, '..');
const targetRoots = [
  'assets/hunBig',
  'assets/hunHalf',
  'assets/hunHeader',
  'assets/surBig',
  'assets/surHalf',
  'assets/surHeader'
];

const quality = Number(process.env.PNG_QUALITY || 70);
const colors = Number(process.env.PNG_COLORS || 192);
const dither = Number(process.env.PNG_DITHER || 1);

function listPngFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const files = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

function toMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

async function optimizeOne(filePath) {
  const before = fs.readFileSync(filePath);
  const beforeSize = before.length;

  const optimized = await sharp(before, { limitInputPixels: false })
    .png({
      palette: true,
      quality,
      colors,
      dither,
      compressionLevel: 9,
      effort: 10,
      adaptiveFiltering: true
    })
    .toBuffer();

  if (optimized.length >= beforeSize) {
    return {
      changed: false,
      filePath,
      beforeSize,
      afterSize: beforeSize
    };
  }

  fs.writeFileSync(filePath, optimized);
  return {
    changed: true,
    filePath,
    beforeSize,
    afterSize: optimized.length
  };
}

async function main() {
  const files = targetRoots.flatMap((rel) => listPngFiles(path.join(projectRoot, rel)));
  if (files.length === 0) {
    console.log('No target PNG files found.');
    return;
  }

  console.log(
    `PNG lossy optimization start: files=${files.length}, quality=${quality}, colors=${colors}, dither=${dither}`
  );

  let changed = 0;
  let beforeTotal = 0;
  let afterTotal = 0;
  const savedTop = [];

  for (const filePath of files) {
    const result = await optimizeOne(filePath);
    beforeTotal += result.beforeSize;
    afterTotal += result.afterSize;
    if (result.changed) {
      changed += 1;
      const saved = result.beforeSize - result.afterSize;
      savedTop.push({
        file: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
        saved
      });
    }
  }

  savedTop.sort((a, b) => b.saved - a.saved);
  const savedTotal = beforeTotal - afterTotal;
  const savedPercent = beforeTotal > 0 ? ((savedTotal / beforeTotal) * 100).toFixed(2) : '0.00';

  console.log('PNG lossy optimization done');
  console.log(`Changed: ${changed}/${files.length}`);
  console.log(`Before: ${toMB(beforeTotal)} MB`);
  console.log(`After:  ${toMB(afterTotal)} MB`);
  console.log(`Saved:  ${toMB(savedTotal)} MB (${savedPercent}%)`);
  console.log('Top savings:');
  for (const item of savedTop.slice(0, 20)) {
    console.log(`- ${item.file}: ${(item.saved / 1024).toFixed(1)} KB`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
