import * as fs from 'fs';
import * as path from 'path';

export const PREMIUM_STICKER_FILENAME_SUFFIX = '-premium.png';

export function buildPremiumStickerFileName(playerApiFootballId: number): string {
  return `${playerApiFootballId}${PREMIUM_STICKER_FILENAME_SUFFIX}`;
}

export function buildPremiumStickerPublicUrl(playerApiFootballId: number): string {
  return `/uploads/stickers/${buildPremiumStickerFileName(playerApiFootballId)}`;
}

export function resolvePremiumStickerFilePath(
  outputDir: string,
  playerApiFootballId: number,
): string {
  return path.join(outputDir, buildPremiumStickerFileName(playerApiFootballId));
}

export function premiumStickerFileExists(
  outputDir: string,
  playerApiFootballId: number,
): boolean {
  return fs.existsSync(resolvePremiumStickerFilePath(outputDir, playerApiFootballId));
}

export function readPremiumStickerBuffer(
  outputDir: string,
  playerApiFootballId: number,
): Buffer | null {
  const filePath = resolvePremiumStickerFilePath(outputDir, playerApiFootballId);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}
