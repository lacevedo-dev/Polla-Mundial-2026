/**
 * Genera PNG para instalación PWA desde public/icons/pwa-icon.svg
 * Ejecutar: npm run generate:pwa-icons (desde apps/web)
 */
import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(__dirname, '../public/icons');
const sourceSvg = path.join(iconsDir, 'pwa-icon.svg');
const bg = { r: 15, g: 23, b: 42, alpha: 1 }; // #0f172a — theme_color

async function main() {
  await sharp(sourceSvg).resize(192, 192).png().toFile(path.join(iconsDir, 'pwa-192.png'));
  await sharp(sourceSvg).resize(512, 512).png().toFile(path.join(iconsDir, 'pwa-512.png'));

  const safeSize = Math.round(512 * 0.8);
  const safeIcon = await sharp(sourceSvg).resize(safeSize, safeSize).png().toBuffer();
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: bg },
  })
    .composite([{ input: safeIcon, gravity: 'center' }])
    .png()
    .toFile(path.join(iconsDir, 'pwa-512-maskable.png'));

  console.log('Iconos PWA generados: pwa-192.png, pwa-512.png, pwa-512-maskable.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
