import { StickerReferenceStorageService } from './sticker-reference-storage.service';
import { listAvailableReferenceAssets } from './stickers-reference.util';

describe('stickers-reference.util', () => {
  const storage = new StickerReferenceStorageService({
    get: () => undefined,
  } as never);

  it('resuelve directorio de referencias', () => {
    expect(storage.resolveBundledReferencesDir()).toContain('references');
  });

  it('lista assets disponibles', () => {
    const assets = listAvailableReferenceAssets({
      globalCount: 2,
      bundledReferencesDir: storage.resolveBundledReferencesDir(),
      uploadReferencesDir: storage.resolveUploadReferencesDir(),
    });
    expect(assets.globalReferences).toBe(2);
    expect(Array.isArray(assets.countryTemplates)).toBe(true);
  });

  it('resuelve referencia global parametrizable con fallback bundled o missing', () => {
    const resolved = storage.resolveGlobalReferenceFile({
      id: 'series-master',
      bundledFile: 'series-master.png',
    });
    expect(['upload', 'bundled', 'missing']).toContain(resolved.source);
  });
});
