export type ParsedPlayerProfile = {
  apiFootballPlayerId: number;
  name: string;
  firstname: string | null;
  lastname: string | null;
  photoUrl: string | null;
  nationality: string | null;
  birthDate: string | null;
  height: string | null;
  weight: string | null;
  jerseyNumber: number | null;
};

export type ParsedSquadPlayer = {
  apiFootballPlayerId: number;
  name: string;
  photoUrl: string | null;
  jerseyNumber: number | null;
  nationality: string | null;
};

function formatHeight(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.includes('m')) return s;
  const cm = Number(s);
  if (Number.isFinite(cm) && cm > 0) {
    return `${(cm / 100).toFixed(2).replace('.', ',')} m`;
  }
  return s;
}

function formatWeight(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.toLowerCase().includes('kg')) return s;
  const n = Number(s);
  if (Number.isFinite(n) && n > 0) return `${n} kg`;
  return s;
}

function formatBirthDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) {
    return `${Number(iso[3])}-${Number(iso[2])}-${iso[1]}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getUTCDate()}-${parsed.getUTCMonth() + 1}-${parsed.getUTCFullYear()}`;
}

export function parsePlayerProfileResponse(
  apiFootballPlayerId: number,
  response: unknown,
): ParsedPlayerProfile | null {
  const rows = (response as { response?: unknown[] })?.response;
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const row = rows[0] as { player?: Record<string, unknown> };
  const player = row?.player ?? (rows[0] as Record<string, unknown>);
  if (!player || typeof player !== 'object') return null;

  const id = Number(player.id ?? apiFootballPlayerId);
  const name = String(player.name ?? '').trim();
  if (!name) return null;

  const birth = player.birth as { date?: string } | undefined;

  return {
    apiFootballPlayerId: id,
    name,
    firstname: player.firstname != null ? String(player.firstname) : null,
    lastname: player.lastname != null ? String(player.lastname) : null,
    photoUrl: player.photo != null ? String(player.photo) : null,
    nationality: player.nationality != null ? String(player.nationality) : null,
    birthDate: formatBirthDate(birth?.date ?? null),
    height: formatHeight(player.height as string | number | null),
    weight: formatWeight(player.weight as string | number | null),
    jerseyNumber: null,
  };
}

export function parseSquadPlayersResponse(response: unknown): ParsedSquadPlayer[] {
  const rows = (response as { response?: unknown[] })?.response;
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const players = (rows[0] as { players?: unknown[] })?.players;
  if (!Array.isArray(players)) return [];

  return players
    .map((raw) => {
      const p = raw as Record<string, unknown>;
      const id = Number(p.id);
      const name = String(p.name ?? '').trim();
      if (!Number.isFinite(id) || !name) return null;
      return {
        apiFootballPlayerId: id,
        name,
        photoUrl: p.photo != null ? String(p.photo) : null,
        jerseyNumber: p.number != null ? Number(p.number) : null,
        nationality: p.nationality != null ? String(p.nationality) : null,
      } satisfies ParsedSquadPlayer;
    })
    .filter((p): p is ParsedSquadPlayer => p != null);
}
