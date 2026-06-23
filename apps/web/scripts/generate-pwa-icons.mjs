/**
 * Genera favicon e iconos PWA desde docs/Logo.png (transparencia real fuera del logo).
 * Ejecutar: npm run generate:pwa-icons (desde apps/web)
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const iconsDir = path.join(publicDir, 'icons');
const sourceLogo = path.join(__dirname, '../../../docs/Logo.png');
const processedLogo = path.join(iconsDir, 'logo-source.png');
const bg = { r: 15, g: 23, b: 42, alpha: 1 }; // #0f172a — theme_color

/** Píxeles del tablero de transparencia exportado (grises claros sin saturación). */
function isCheckerboardPixel(r, g, b) {
  const min = Math.min(r, g, b);
  const max = Math.max(r, g, b);
  return min >= 215 && max - min <= 18;
}

/** Convierte el fondo tablero en canal alpha real mediante flood-fill desde los bordes. */
function applyCheckerboardTransparency({ data, width, height, channels }) {
  const total = width * height;
  const rgba = Buffer.alloc(total * 4);
  const visited = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    const src = i * channels;
    rgba[i * 4] = data[src];
    rgba[i * 4 + 1] = data[src + 1];
    rgba[i * 4 + 2] = data[src + 2];
    rgba[i * 4 + 3] = 255;
  }

  const queue = [];
  const trySeed = (x, y) => {
    const idx = y * width + x;
    if (visited[idx]) return;
    const src = idx * channels;
    if (!isCheckerboardPixel(data[src], data[src + 1], data[src + 2])) return;
    visited[idx] = 1;
    rgba[idx * 4 + 3] = 0;
    queue.push(idx);
  };

  for (let x = 0; x < width; x++) {
    trySeed(x, 0);
    trySeed(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    trySeed(0, y);
    trySeed(width - 1, y);
  }

  while (queue.length > 0) {
    const idx = queue.pop();
    const x = idx % width;
    const y = (idx - x) / width;
    const neighbors = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      const src = nIdx * channels;
      if (!isCheckerboardPixel(data[src], data[src + 1], data[src + 2])) continue;
      visited[nIdx] = 1;
      rgba[nIdx * 4 + 3] = 0;
      queue.push(nIdx);
    }
  }

  return rgba;
}

async function loadProcessedLogo() {
  const { data, info } = await sharp(sourceLogo).raw().toBuffer({ resolveWithObject: true });
  const rgba = applyCheckerboardTransparency({
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  });

  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toFile(processedLogo);

  return processedLogo;
}

async function main() {
  const logo = await loadProcessedLogo();

  await sharp(logo).resize(16, 16).png().toFile(path.join(publicDir, 'favicon-16.png'));
  await sharp(logo).resize(32, 32).png().toFile(path.join(publicDir, 'favicon-32.png'));
  await sharp(logo).resize(192, 192).png().toFile(path.join(iconsDir, 'pwa-192.png'));
  await sharp(logo).resize(512, 512).png().toFile(path.join(iconsDir, 'pwa-512.png'));

  const safeSize = Math.round(512 * 0.8);
  const safeIcon = await sharp(logo).resize(safeSize, safeSize).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: bg },
  })
    .composite([{ input: safeIcon, gravity: 'center' }])
    .png()
    .toFile(path.join(iconsDir, 'pwa-512-maskable.png'));

  const meta = await sharp(processedLogo).metadata();
  console.log(
    `Iconos generados desde docs/Logo.png (alpha=${meta.hasAlpha}): favicon-16.png, favicon-32.png, pwa-192.png, pwa-512.png, pwa-512-maskable.png`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
