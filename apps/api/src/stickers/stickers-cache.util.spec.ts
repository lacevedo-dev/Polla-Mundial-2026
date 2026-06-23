import {
  buildPremiumStickerFileName,
  buildPremiumStickerPublicUrl,
  premiumStickerFileExists,
} from './stickers-cache.util';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('stickers-cache.util', () => {
  it('builds deterministic file names and public urls', () => {
    expect(buildPremiumStickerFileName(1642)).toBe('1642-premium.webp');
    expect(buildPremiumStickerPublicUrl(1642)).toBe('/uploads/stickers/1642-premium.webp');
  });

  it('detects cached files on disk', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stickers-cache-'));
    expect(premiumStickerFileExists(tmpDir, 99)).toBe(false);
    fs.writeFileSync(path.join(tmpDir, buildPremiumStickerFileName(99)), Buffer.from('png'));
    expect(premiumStickerFileExists(tmpDir, 99)).toBe(true);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
