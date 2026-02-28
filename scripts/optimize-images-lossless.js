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

function listPngFiles(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const result = [];
  const stack = [rootDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
        result.push(fullPath);
      }
    }
  }
  return result;
}

function countUniqueColorsUpTo(rawRgba, limit) {
  const set = new Set();
  for (let i = 0; i < rawRgba.length; i += 4) {
    const key =
      ((rawRgba[i] << 24) >>> 0) +
      ((rawRgba[i + 1] << 16) >>> 0) +
      ((rawRgba[i + 2] << 8) >>> 0) +
      (rawRgba[i + 3] >>> 0);
    set.add(key);
    if (set.size > limit) return set.size;
  }
  return set.size;
}

async function decodeToRawRgba(pngBuffer) {
  return sharp(pngBuffer, { limitInputPixels: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
}

async function isPixelIdentical(baseRaw, candidatePngBuffer) {
  const candidateRaw = await decodeToRawRgba(candidatePngBuffer);
  if (candidateRaw.info.width !== baseRaw.info.width) return false;
  if (candidateRaw.info.height !== baseRaw.info.height) return false;
  if (candidateRaw.info.channels !== baseRaw.info.channels) return false;
  return Buffer.compare(baseRaw.data, candidateRaw.data) === 0;
}

async function encodeVariant(inputPngBuffer, pngOptions) {
  return sharp(inputPngBuffer, { limitInputPixels: false }).png(pngOptions).toBuffer();
}

function toKB(bytes) {
  return (bytes / 1024).toFixed(1);
}

async function optimizeOneFile(filePath) {
  const originalPng = fs.readFileSync(filePath);
  const originalSize = originalPng.length;
  const originalRaw = await decodeToRawRgba(originalPng);
  const uniqueColorCount = countUniqueColorsUpTo(originalRaw.data, 257);
  const canPaletteLossless = uniqueColorCount <= 256;

  const variants = [
    {
      name: 'rgba-adaptive',
      options: {
        palette: false,
        compressionLevel: 9,
        effort: 10,
        adaptiveFiltering: true
      }
    },
    {
      name: 'rgba-no-adaptive',
      options: {
        palette: false,
        compressionLevel: 9,
        effort: 10,
        adaptiveFiltering: false
      }
    }
  ];

  if (canPaletteLossless) {
    variants.push({
      name: 'palette-lossless',
      options: {
        palette: true,
        compressionLevel: 9,
        effort: 10,
        adaptiveFiltering: true
      }
    });
  }

  let bestBuffer = originalPng;
  let bestVariant = 'original';

  for (const variant of variants) {
    try {
      const encoded = await encodeVariant(originalPng, variant.options);
      if (encoded.length >= bestBuffer.length) continue;
      const identical = await isPixelIdentical(originalRaw, encoded);
      if (!identical) continue;
      bestBuffer = encoded;
      bestVariant = variant.name;
    } catch (error) {
      // Skip this variant and continue with others.
    }
  }

  if (bestBuffer.length < originalSize) {
    fs.writeFileSync(filePath, bestBuffer);
    return {
      changed: true,
      filePath,
      variant: bestVariant,
      originalSize,
      newSize: bestBuffer.length,
      uniqueColorCount
    };
  }

  return {
    changed: false,
    filePath,
    variant: 'unchanged',
    originalSize,
    newSize: originalSize,
    uniqueColorCount
  };
}

async function main() {
  const files = targetRoots.flatMap((rel) => listPngFiles(path.join(projectRoot, rel)));
  if (files.length === 0) {
    console.log('No PNG files found in target folders.');
    return;
  }

  console.log(`Scanning ${files.length} PNG files...`);

  let changedCount = 0;
  let totalBefore = 0;
  let totalAfter = 0;
  const topSavings = [];

  for (const filePath of files) {
    const result = await optimizeOneFile(filePath);
    totalBefore += result.originalSize;
    totalAfter += result.newSize;
    if (result.changed) {
      changedCount += 1;
      const saved = result.originalSize - result.newSize;
      topSavings.push({
        filePath: path.relative(projectRoot, filePath).replace(/\\/g, '/'),
        saved,
        variant: result.variant
      });
      console.log(
        `optimized ${path.basename(filePath)}: ${toKB(result.originalSize)}KB -> ${toKB(result.newSize)}KB via ${result.variant}`
      );
    }
  }

  const totalSaved = totalBefore - totalAfter;
  const savedPercent = totalBefore > 0 ? ((totalSaved / totalBefore) * 100).toFixed(2) : '0.00';

  topSavings.sort((a, b) => b.saved - a.saved);

  console.log('\nLossless optimization complete');
  console.log(`Changed files: ${changedCount}/${files.length}`);
  console.log(`Before: ${(totalBefore / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`After:  ${(totalAfter / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`Saved:  ${(totalSaved / (1024 * 1024)).toFixed(2)} MB (${savedPercent}%)`);

  if (topSavings.length > 0) {
    console.log('\nTop 20 savings:');
    for (const item of topSavings.slice(0, 20)) {
      console.log(`- ${item.filePath}: ${(item.saved / 1024).toFixed(1)}KB (${item.variant})`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
