import * as fs from 'fs';
import * as path from 'path';
import {
  listAvailableReferenceAssets,
  resolveCountryReferencePath,
  resolveStickerReferencesDir,
} from './stickers-reference.util';

describe('stickers-reference.util', () => {
  it('resuelve directorio de referencias', () => {
    expect(resolveStickerReferencesDir()).toContain('references');
  });

  it('lista assets disponibles', () => {
    const assets = listAvailableReferenceAssets();
    expect(typeof assets.seriesMaster).toBe('boolean');
    expect(Array.isArray(assets.countryTemplates)).toBe(true);
  });

  it('encuentra plantilla CIV si existe en disco', () => {
    const dir = resolveStickerReferencesDir();
    const civPath = path.join(dir, 'countries', 'CIV.png');
    const resolved = resolveCountryReferencePath('CIV');
    if (fs.existsSync(civPath)) {
      expect(resolved).toBe(civPath);
    } else {
      expect(resolved).toBeNull();
    }
  });
});
