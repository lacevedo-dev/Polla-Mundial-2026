import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  Sticker,
  Users,
} from 'lucide-react';
import { ApiError, BASE_URL, request } from '../../api';
import {
  GoalScorerStickerCard,
  type GoalScorerStickerProps,
} from '../../components/live/GoalScorerStickerCard';
import type { GoalStickerVariant } from '../../utils/goalStickerConfig';
import { DEFAULT_GOAL_STICKER_SETTINGS } from '../../utils/goalStickerConfig';
import { useGoalStickerSettings } from '../../hooks/useGoalStickerSettings';
import type { MatchEventItem } from '../../hooks/useLiveSyncEvents';

type StickerAlbumPlayer = {
  apiFootballPlayerId: number;
  name: string;
  photoUrl: string | null;
  jerseyNumber: number | null;
  birthDate: string | null;
  height: string | null;
  weight: string | null;
  nationality: string | null;
  isDemo?: boolean;
};

type StickerAlbumTeam = {
  teamId: string | null;
  name: string;
  code: string;
  flagUrl: string | null;
  apiFootballTeamId: number | null;
  playerCount: number;
  theme: {
    primary: string;
    secondary: string;
    accent: string;
    pillFrom: string;
    pillTo: string;
  };
  players: StickerAlbumPlayer[];
};

type StickerAlbumResponse = {
  totalPlayers: number;
  totalTeams: number;
  previewContext: {
    homeTeam: string;
    awayTeam: string;
    homeScore: number;
    awayScore: number;
    minute: number;
    leagueName: string;
  };
  teams: StickerAlbumTeam[];
};

type PrewarmResult = {
  message: string;
  squadsFetched?: number;
  profilesEnriched?: number;
};

function buildPreviewEvent(
  player: StickerAlbumPlayer,
  team: StickerAlbumTeam,
  ctx: StickerAlbumResponse['previewContext'],
): MatchEventItem {
  return {
    type: 'GOAL',
    detail: 'Normal Goal',
    playerName: player.name,
    assistName: null,
    minute: ctx.minute,
    extraMin: null,
    teamId: team.teamId,
    playerProfile: {
      photoUrl: player.photoUrl,
      jerseyNumber: player.jerseyNumber,
      birthDate: player.birthDate,
      height: player.height,
      weight: player.weight,
      nationality: player.nationality,
    },
    teamStickerTheme: {
      ...team.theme,
      flagUrl: team.flagUrl,
      countryCode: team.code !== '—' ? team.code : null,
    },
  };
}

function buildStickerProps(
  player: StickerAlbumPlayer,
  team: StickerAlbumTeam,
  ctx: StickerAlbumResponse['previewContext'],
): GoalScorerStickerProps {
  return {
    event: buildPreviewEvent(player, team, ctx),
    teamName: team.name,
    homeTeam: ctx.homeTeam,
    awayTeam: ctx.awayTeam,
    homeScore: ctx.homeScore,
    awayScore: ctx.awayScore,
    leagueName: ctx.leagueName,
    teamFlagUrl: team.flagUrl,
  };
}

async function fetchWaStickerBlob(
  playerApiId: number,
  teamCode: string,
  variant: GoalStickerVariant,
): Promise<string> {
  const token = localStorage.getItem('token');
  const params = new URLSearchParams();
  if (teamCode && teamCode !== '—') params.set('teamCode', teamCode);
  params.set('variant', variant);
  const query = params.toString();
  const url = `${BASE_URL}/admin/football/sticker-preview/${playerApiId}?${query}`;

  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error('No se pudo generar el PNG de WhatsApp');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

type PreviewMode = 'dashboard' | 'whatsapp' | 'openai';

function formatStickerBirthDate(raw: string | null): string {
  if (!raw?.trim()) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.trim();
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}-${month}-${year}`;
}

function buildOpenAiStickerPayload(
  player: StickerAlbumPlayer,
  team: StickerAlbumTeam,
  ctx: StickerAlbumResponse['previewContext'],
) {
  const countryCode =
    team.code && team.code !== '—' ? team.code.toUpperCase().slice(0, 3) : 'GOL';
  const jersey = player.jerseyNumber ?? 10;
  const jerseyPadded = String(jersey).padStart(2, '0');
  const minutePadded = String(ctx.minute ?? 0).padStart(1, '0');

  return {
    playerApiFootballId: player.apiFootballPlayerId,
    photoUrl: player.photoUrl!,
    playerName: player.name.trim().toUpperCase(),
    birthDate: formatStickerBirthDate(player.birthDate),
    height: player.height?.trim() || '—',
    weight: player.weight?.trim() || '—',
    countryCode,
    countryName: team.name,
    cardCode: `${countryCode}${jerseyPadded}`.slice(0, 5),
    stickerNumber: `${jerseyPadded}${minutePadded}`.slice(0, 3),
    mainNumber: String(jersey),
    quality: 'high' as const,
  };
}

function resolveStickerImageUrl(imageUrl: string): string {
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
  const base = BASE_URL.replace(/\/$/, '');
  const path = imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`;
  return `${base}${path}`;
}

const OpenAiStickerPreview: React.FC<{
  player: StickerAlbumPlayer;
  team: StickerAlbumTeam;
  ctx: StickerAlbumResponse['previewContext'];
}> = ({ player, team, ctx }) => {
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [cached, setCached] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadCached = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request<{
        ok?: boolean;
        cached?: boolean;
        imageUrl?: string;
      }>(`/admin/stickers/cached/${player.apiFootballPlayerId}`);
      if (data.ok && data.cached && data.imageUrl) {
        setImageUrl(resolveStickerImageUrl(data.imageUrl));
        setCached(true);
      } else {
        setImageUrl(null);
        setCached(false);
      }
    } catch {
      setImageUrl(null);
      setCached(false);
    } finally {
      setLoading(false);
    }
  }, [player.apiFootballPlayerId]);

  React.useEffect(() => {
    void loadCached();
  }, [loadCached]);

  const handleGenerate = async (force = false) => {
    if (!player.photoUrl) {
      setError('Sin foto del jugador. Ejecuta «Precargar plantillas» primero.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const result = await request<{ imageUrl: string; cached: boolean }>('/admin/stickers/generate', {
        method: 'POST',
        body: JSON.stringify({
          ...buildOpenAiStickerPayload(player, team, ctx),
          forceRegenerate: force,
        }),
      });
      setImageUrl(resolveStickerImageUrl(result.imageUrl));
      setCached(result.cached);
    } catch (e: unknown) {
      setError(e instanceof ApiError ? e.message : 'Error al generar con OpenAI');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-violet-200 bg-violet-50/50">
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Sticker OpenAI: ${player.name}`}
          className="mx-auto w-full max-w-[220px] rounded-xl shadow-md"
        />
      ) : (
        <div className="flex h-[220px] w-full max-w-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-violet-200 bg-violet-50/40 px-4 text-center text-xs text-violet-800">
          <Sparkles className="mb-2 h-5 w-5 text-violet-500" />
          Sin imagen OpenAI cacheada para este jugador.
        </div>
      )}
      {cached && imageUrl && (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
          Desde caché
        </span>
      )}
      {error && <p className="text-center text-[11px] text-rose-600">{error}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => void handleGenerate(imageUrl != null)}
          disabled={generating}
          className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
        >
          {generating ? 'Generando…' : imageUrl ? 'Regenerar IA' : 'Generar con OpenAI'}
        </button>
        {imageUrl && (
          <button
            type="button"
            onClick={() => void loadCached()}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
          >
            Recargar caché
          </button>
        )}
      </div>
      <p className="text-center text-[10px] leading-relaxed text-slate-500">
        Requiere <code className="rounded bg-slate-100 px-1">OPENAI_API_KEY</code>. Dorsal{' '}
        {player.jerseyNumber != null ? `#${player.jerseyNumber}` : 'por defecto'}.
      </p>
    </div>
  );
};

const WaStickerPreview: React.FC<{
  playerApiId: number;
  teamCode: string;
  playerName: string;
  variant: GoalStickerVariant;
}> = ({ playerApiId, teamCode, playerName, variant }) => {
  const [src, setSrc] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    setLoading(true);
    setError(null);
    setSrc(null);

    void fetchWaStickerBlob(playerApiId, teamCode, variant)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setSrc(url);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar PNG');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [playerApiId, teamCode, variant]);

  if (loading) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl border border-dashed border-rose-200 bg-rose-50 px-4 text-center text-xs text-rose-600">
        {error ?? 'Preview no disponible'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Sticker WhatsApp: ${playerName}`}
      className="mx-auto w-full max-w-[220px] rounded-xl shadow-md"
    />
  );
};

const StickerAlbumCard: React.FC<{
  player: StickerAlbumPlayer;
  team: StickerAlbumTeam;
  ctx: StickerAlbumResponse['previewContext'];
  variant: GoalStickerVariant;
}> = ({ player, team, ctx, variant }) => {
  const [mode, setMode] = React.useState<PreviewMode>('dashboard');
  const stickerProps = buildStickerProps(player, team, ctx);

  return (
    <article className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{player.name}</p>
          <p className="truncate text-[10px] text-slate-500">
            {team.name}
            {player.jerseyNumber != null ? ` · #${player.jerseyNumber}` : ''}
            {player.isDemo ? ' · demo' : ''}
          </p>
        </div>
        {team.flagUrl && (
          <img src={team.flagUrl} alt="" className="h-6 w-6 shrink-0 rounded-full border object-cover" />
        )}
      </div>

      <div className="mb-3 min-h-[220px] flex items-center justify-center">
        {mode === 'dashboard' ? (
          <GoalScorerStickerCard {...stickerProps} variant={variant} />
        ) : mode === 'whatsapp' ? (
          <WaStickerPreview
            playerApiId={player.apiFootballPlayerId}
            teamCode={team.code}
            playerName={player.name}
            variant={variant}
          />
        ) : (
          <OpenAiStickerPreview player={player} team={team} ctx={ctx} />
        )}
      </div>

      <div className="mt-auto flex gap-1 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode('dashboard')}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-colors ${
            mode === 'dashboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Diseño actual
        </button>
        <button
          type="button"
          onClick={() => setMode('whatsapp')}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-colors ${
            mode === 'whatsapp' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          WA PNG
        </button>
        <button
          type="button"
          onClick={() => setMode('openai')}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-colors ${
            mode === 'openai' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          OpenAI
        </button>
      </div>
    </article>
  );
};

export default function AdminStickerAlbum() {
  const goalSticker = useGoalStickerSettings();
  const previewVariant = goalSticker.variant ?? DEFAULT_GOAL_STICKER_SETTINGS.variant;
  const [album, setAlbum] = React.useState<StickerAlbumResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [teamFilter, setTeamFilter] = React.useState<string>('all');
  const [prewarming, setPrewarming] = React.useState(false);
  const [prewarmMsg, setPrewarmMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  const loadAlbum = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request<StickerAlbumResponse>('/admin/football/sticker-album');
      setAlbum(data);
    } catch (e: unknown) {
      const text = e instanceof ApiError ? e.message : 'No se pudo cargar el álbum';
      setError(text);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadAlbum();
  }, [loadAlbum]);

  const handlePrewarm = async () => {
    setPrewarming(true);
    setPrewarmMsg(null);
    try {
      const result = await request<PrewarmResult>('/admin/football/prewarm-player-profiles', {
        method: 'POST',
        body: JSON.stringify({ season: 2026, enrichProfiles: true, maxProfileFetches: 80 }),
      });
      setPrewarmMsg({ ok: true, text: result.message });
      await loadAlbum();
    } catch (e: unknown) {
      const text = e instanceof ApiError ? e.message : 'Error en la precarga';
      setPrewarmMsg({ ok: false, text });
    } finally {
      setPrewarming(false);
    }
  };

  const filteredTeams = React.useMemo(() => {
    if (!album) return [];
    const q = search.trim().toLowerCase();

    return album.teams
      .filter((team) => teamFilter === 'all' || team.code === teamFilter)
      .map((team) => ({
        ...team,
        players: team.players.filter((player) => {
          if (!q) return true;
          return (
            player.name.toLowerCase().includes(q) ||
            team.name.toLowerCase().includes(q) ||
            team.code.toLowerCase().includes(q)
          );
        }),
      }))
      .filter((team) => team.players.length > 0);
  }, [album, search, teamFilter]);

  const visiblePlayerCount = filteredTeams.reduce((sum, t) => sum + t.players.length, 0);
  const isDemo = album != null && album.totalPlayers === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/admin/automation"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft size={14} />
            Automatización
          </Link>
          <div className="flex items-center gap-2">
            <Sticker size={22} className="text-amber-500" />
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Álbum de stickers</h1>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Compara el diseño actual (React/HTML), el PNG de WhatsApp y la versión generada con OpenAI.
            Cada carta muestra dorsal, nombre completo en mayúsculas y datos del jugador.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadAlbum()}
            disabled={loading}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => void handlePrewarm()}
            disabled={prewarming}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60"
          >
            {prewarming ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
            Precargar plantillas
          </button>
        </div>
      </div>

      {prewarmMsg && (
        <p className={`text-sm font-medium ${prewarmMsg.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
          {prewarmMsg.text}
        </p>
      )}

      {album && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Variante activa en config: <strong>{previewVariant === 'premium' ? 'Premium álbum' : 'Clásico'}</strong>.
          Cambia el estilo en Automatización → Sticker de goleador.
        </div>
      )}

      {album && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Jugadores</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{album.totalPlayers || 'Demo'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Selecciones</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{album.totalTeams}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Contexto preview</p>
            <p className="mt-1 text-sm font-bold text-slate-800">
              {album.previewContext.homeTeam} {album.previewContext.homeScore}–{album.previewContext.awayScore}{' '}
              {album.previewContext.awayTeam} · {album.previewContext.minute}&apos;
            </p>
          </div>
        </div>
      )}

      {isDemo && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Mostrando stickers de ejemplo (James Rodríguez, Mikel Merino). Ejecuta{' '}
          <strong>Precargar plantillas</strong> para ver jugadores reales del catálogo WC.
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugador o selección…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-amber-500 focus:ring-2"
          />
        </div>
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none ring-amber-500 focus:ring-2 sm:min-w-[180px]"
        >
          <option value="all">Todas las selecciones</option>
          {album?.teams.map((team) => (
            <option key={team.code + team.name} value={team.code}>
              {team.name} ({team.playerCount})
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <p className="text-xs font-semibold text-slate-500">
            {visiblePlayerCount} sticker{visiblePlayerCount === 1 ? '' : 's'} visibles
          </p>

          {filteredTeams.map((team) => (
            <section key={`${team.code}-${team.name}`} className="space-y-3">
              <div className="flex items-center gap-2">
                {team.flagUrl ? (
                  <img src={team.flagUrl} alt="" className="h-7 w-7 rounded-full border object-cover" />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200">
                    <ImageIcon size={14} className="text-slate-500" />
                  </div>
                )}
                <h2 className="text-lg font-black text-slate-900">{team.name}</h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                  {team.players.length}
                </span>
                <span
                  className="ml-auto hidden h-4 w-16 rounded-full sm:block"
                  style={{
                    background: `linear-gradient(90deg, ${team.theme.pillFrom}, ${team.theme.pillTo})`,
                  }}
                  title="Paleta del equipo"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {team.players.map((player) => (
                  <StickerAlbumCard
                    key={`${player.apiFootballPlayerId}-${player.name}`}
                    player={player}
                    team={team}
                    ctx={album!.previewContext}
                    variant={previewVariant}
                  />
                ))}
              </div>
            </section>
          ))}

          {filteredTeams.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
              <Sticker size={32} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Sin resultados</p>
              <p className="mt-1 text-xs text-slate-500">Prueba otro filtro o precarga las plantillas.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
