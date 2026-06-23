/** Metadatos del gol embebidos en caption (no visibles en WhatsApp). */
export type StoredGoalJobMeta = {
  scorerName?: string | null;
  assistName?: string | null;
  goalDetail?: string | null;
  elapsed?: number | null;
  homeScore: number;
  awayScore: number;
  scoringTeam?: string | null;
};

const META_PREFIX = '\n\u2063GOAL_META:';

export function encodeGoalJobCaption(caption: string, meta: StoredGoalJobMeta): string {
  return `${caption}${META_PREFIX}${JSON.stringify(meta)}`;
}

export function parseGoalJobCaption(raw: string): {
  caption: string;
  meta: StoredGoalJobMeta | null;
} {
  const idx = raw.lastIndexOf(META_PREFIX);
  if (idx < 0) {
    return { caption: raw, meta: null };
  }
  try {
    const meta = JSON.parse(raw.slice(idx + META_PREFIX.length)) as StoredGoalJobMeta;
    return { caption: raw.slice(0, idx), meta };
  } catch {
    return { caption: raw, meta: null };
  }
}
