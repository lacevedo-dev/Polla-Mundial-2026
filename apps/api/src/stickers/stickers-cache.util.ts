import * as fs from 'fs';
import * as path from 'path';

export const PREMIUM_STICKER_WEBP_SUFFIX = '-premium.webp';
export const PREMIUM_STICKER_LEGACY_PNG_SUFFIX = '-premium.png';

/** @deprecated Usar PREMIUM_STICKER_WEBP_SUFFIX */
export const PREMIUM_STICKER_FILENAME_SUFFIX = PREMIUM_STICKER_LEGACY_PNG_SUFFIX;

export function buildPremiumStickerFileName(playerApiFootballId: number): string {
  return `${playerApiFootballId}${PREMIUM_STICKER_WEBP_SUFFIX}`;
}

export function buildPremiumStickerLegacyPngFileName(playerApiFootballId: number): string {
  return `${playerApiFootballId}${PREMIUM_STICKER_LEGACY_PNG_SUFFIX}`;
}

export function buildPremiumStickerPublicUrl(playerApiFootballId: number): string {
  return `/uploads/stickers/${buildPremiumStickerFileName(playerApiFootballId)}`;
}

export function resolvePremiumStickerWebpPath(
  outputDir: string,
  playerApiFootballId: number,
): string {
  return path.join(outputDir, buildPremiumStickerFileName(playerApiFootballId));
}

export function resolvePremiumStickerLegacyPngPath(
  outputDir: string,
  playerApiFootballId: number,
): string {
  return path.join(outputDir, buildPremiumStickerLegacyPngFileName(playerApiFootballId));
}

/** @deprecated Usar resolvePremiumStickerWebpPath */
export function resolvePremiumStickerFilePath(
  outputDir: string,
  playerApiFootballId: number,
): string {
  return resolvePremiumStickerWebpPath(outputDir, playerApiFootballId);
}

export function premiumStickerWebpExists(
  outputDir: string,
  playerApiFootballId: number,
): boolean {
  return fs.existsSync(resolvePremiumStickerWebpPath(outputDir, playerApiFootballId));
}

export function premiumStickerLegacyPngExists(
  outputDir: string,
  playerApiFootballId: number,
): boolean {
  return fs.existsSync(resolvePremiumStickerLegacyPngPath(outputDir, playerApiFootballId));
}

export function premiumStickerFileExists(
  outputDir: string,
  playerApiFootballId: number,
): boolean {
  return (
    premiumStickerWebpExists(outputDir, playerApiFootballId) ||
    premiumStickerLegacyPngExists(outputDir, playerApiFootballId)
  );
}

export function readPremiumStickerWebpBuffer(
  outputDir: string,
  playerApiFootballId: number,
): Buffer | null {
  const filePath = resolvePremiumStickerWebpPath(outputDir, playerApiFootballId);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

export function readPremiumStickerLegacyPngBuffer(
  outputDir: string,
  playerApiFootballId: number,
): Buffer | null {
  const filePath = resolvePremiumStickerLegacyPngPath(outputDir, playerApiFootballId);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

/** Lee el archivo en disco (WebP preferido, PNG legado como fallback). */
export function readPremiumStickerFileBuffer(
  outputDir: string,
  playerApiFootballId: number,
): { buffer: Buffer; isLegacyPng: boolean } | null {
  const webp = readPremiumStickerWebpBuffer(outputDir, playerApiFootballId);
  if (webp) return { buffer: webp, isLegacyPng: false };

  const png = readPremiumStickerLegacyPngBuffer(outputDir, playerApiFootballId);
  if (png) return { buffer: png, isLegacyPng: true };

  return null;
}

/** @deprecated Usar readPremiumStickerFileBuffer */
export function readPremiumStickerBuffer(
  outputDir: string,
  playerApiFootballId: number,
): Buffer | null {
  return readPremiumStickerFileBuffer(outputDir, playerApiFootballId)?.buffer ?? null;
}

export function writePremiumStickerWebp(
  outputDir: string,
  playerApiFootballId: number,
  webp: Buffer,
): void {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(resolvePremiumStickerWebpPath(outputDir, playerApiFootballId), webp);
}

export function removePremiumStickerFiles(
  outputDir: string,
  playerApiFootballId: number,
): void {
  for (const filePath of [
    resolvePremiumStickerWebpPath(outputDir, playerApiFootballId),
    resolvePremiumStickerLegacyPngPath(outputDir, playerApiFootballId),
  ]) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
