import * as fs from 'fs';
import * as path from 'path';
import { toFile, type Uploadable } from 'openai';

const SERIES_MASTER_FILE = 'series-master.png';
const FIFA_LOGO_FILE = 'fifa-2026-logo.png';

export function resolveStickerReferencesDir(): string {
  return path.join(__dirname, 'references');
}

export function resolveCountryReferencePath(countryCode: string): string | null {
  const code = countryCode.trim().toUpperCase().slice(0, 3);
  if (!code) return null;
  const filePath = path.join(resolveStickerReferencesDir(), 'countries', `${code}.png`);
  return fs.existsSync(filePath) ? filePath : null;
}

async function loadLocalPng(filePath: string, uploadName: string): Promise<Uploadable | null> {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return toFile(buffer, uploadName, { type: 'image/png' });
}

/**
 * Imágenes de referencia para OpenAI images.edit (después de la foto del jugador):
 * B = series-master, C = logo FIFA 2026, D = plantilla del país (opcional).
 */
export async function loadStickerReferenceFiles(
  countryCode: string,
): Promise<Uploadable[]> {
  const dir = resolveStickerReferencesDir();
  const refs: Uploadable[] = [];

  const master = await loadLocalPng(path.join(dir, SERIES_MASTER_FILE), 'series-master.png');
  if (master) refs.push(master);

  const logo = await loadLocalPng(path.join(dir, FIFA_LOGO_FILE), 'fifa-2026-logo.png');
  if (logo) refs.push(logo);

  const countryPath = resolveCountryReferencePath(countryCode);
  if (countryPath) {
    const countryRef = await loadLocalPng(countryPath, path.basename(countryPath));
    if (countryRef) refs.push(countryRef);
  }

  return refs;
}

export function listAvailableReferenceAssets(): {
  seriesMaster: boolean;
  fifaLogo: boolean;
  countryTemplates: string[];
} {
  const dir = resolveStickerReferencesDir();
  const countriesDir = path.join(dir, 'countries');
  const countryTemplates = fs.existsSync(countriesDir)
    ? fs
        .readdirSync(countriesDir)
        .filter((f) => f.toLowerCase().endsWith('.png'))
        .map((f) => f.replace(/\.png$/i, '').toUpperCase())
    : [];

  return {
    seriesMaster: fs.existsSync(path.join(dir, SERIES_MASTER_FILE)),
    fifaLogo: fs.existsSync(path.join(dir, FIFA_LOGO_FILE)),
    countryTemplates,
  };
}
