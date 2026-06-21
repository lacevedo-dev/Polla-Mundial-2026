import * as fs from 'fs';
import * as path from 'path';
import { toFile, type Uploadable } from 'openai';
import type { ResolvedStickerReferenceFile } from './sticker-reference-storage.service';

function mimeForReferencePath(absolutePath: string, uploadName: string): string {
  const ext = path.extname(uploadName || absolutePath).toLowerCase();
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

async function fileFromPath(absolutePath: string, uploadName: string): Promise<Uploadable> {
  const buffer = fs.readFileSync(absolutePath);
  return toFile(buffer, uploadName, { type: mimeForReferencePath(absolutePath, uploadName) });
}

/**
 * Imágenes de referencia para OpenAI images.edit (después de Image A = jugador).
 */
export async function loadStickerReferenceFiles(
  files: ResolvedStickerReferenceFile[],
): Promise<Uploadable[]> {
  const refs: Uploadable[] = [];
  for (const file of files) {
    if (file.source === 'missing' || !file.absolutePath) continue;
    refs.push(await fileFromPath(file.absolutePath, file.uploadName));
  }
  return refs;
}

export function listAvailableReferenceAssets(input: {
  globalCount: number;
  bundledReferencesDir: string;
  uploadReferencesDir: string;
}): {
  globalReferences: number;
  countryTemplates: string[];
} {
  const bundledDir = input.bundledReferencesDir;
  const uploadCountriesDir = path.join(input.uploadReferencesDir, 'countries');

  const codes = new Set<string>();
  for (const dir of [path.join(bundledDir, 'countries'), uploadCountriesDir]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      if (/\.png$/i.test(file)) codes.add(file.replace(/\.png$/i, '').toUpperCase());
    }
  }

  return {
    globalReferences: input.globalCount,
    countryTemplates: [...codes].sort(),
  };
}
