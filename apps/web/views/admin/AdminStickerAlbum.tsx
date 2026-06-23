import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Grid3x3,
  ImageIcon,
  LayoutGrid,
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
type AlbumLayout = 'album' | 'compare';

const PREVIEW_MODE_STORAGE_KEY = 'sticker-album-preview-mode';
const ALBUM_LAYOUT_STORAGE_KEY = 'sticker-album-layout';

const PREVIEW_MODE_META: Record<
  PreviewMode,
  { label: string; description: string }
> = {
  dashboard: {
    label: 'Diseño actual',
    description: 'Componente React premium usado en el dashboard en vivo cuando la variante es «álbum».',
  },
  whatsapp: {
    label: 'WA PNG',
    description: 'PNG generado con Puppeteer — es lo que se envía por WhatsApp si OpenAI no está disponible.',
  },
  openai: {
    label: 'OpenAI',
    description: 'Imagen IA (gpt-image). Requiere API key en Sistema → Stickers OpenAI o OPENAI_API_KEY.',
  },
};

const ALBUM_LAYOUT_META: Record<AlbumLayout, { label: string; icon: React.ReactNode }> = {
  album: { label: 'Álbum', icon: <BookOpen size={13} /> },
  compare: { label: 'Comparar', icon: <LayoutGrid size={13} /> },
};

function readStoredPreviewMode(): PreviewMode {
  try {
    const raw = localStorage.getItem(PREVIEW_MODE_STORAGE_KEY);
    if (raw === 'dashboard' || raw === 'whatsapp' || raw === 'openai') return raw;
  } catch {
    /* ignore */
  }
  return 'openai';
}

function readStoredAlbumLayout(): AlbumLayout {
  try {
    const raw = localStorage.getItem(ALBUM_LAYOUT_STORAGE_KEY);
    if (raw === 'album' || raw === 'compare') return raw;
  } catch {
    /* ignore */
  }
  return 'album';
}

function teamSectionId(code: string, name: string): string {
  return `sticker-team-${code}-${name}`.replace(/\s+/g, '-').toLowerCase();
}

function scrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined') return 'smooth';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2';

function AlbumToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  getLabel,
  getIcon,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (next: T) => void;
  getLabel: (key: T) => string;
  getIcon?: (key: T) => React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <span id={`${label.replace(/\s+/g, '-').toLowerCase()}-label`} className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${label.replace(/\s+/g, '-').toLowerCase()}-label`}
        className="-mx-1 overflow-x-auto px-1 pb-0.5"
      >
        <div className="inline-flex min-w-full gap-1 rounded-xl bg-slate-100 p-1 sm:min-w-0">
          {options.map((key) => {
            const selected = value === key;
            const optionLabel = getLabel(key);
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={optionLabel}
                onClick={() => onChange(key)}
                className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-colors sm:px-4 sm:text-xs ${FOCUS_RING} ${
                  selected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {getIcon?.(key)}
                <span>{optionLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TeamAlbumIndexNav({
  teams,
  activeTeamCode,
  onSelectTeam,
  variant,
}: {
  teams: StickerAlbumTeam[];
  activeTeamCode: string | null;
  onSelectTeam: (team: StickerAlbumTeam) => void;
  variant: 'sidebar' | 'horizontal';
}) {
  if (teams.length === 0) return null;

  const listItems = teams.map((team) => {
    const sectionId = teamSectionId(team.code, team.name);
    const isActive = activeTeamCode === team.code;
    return (
      <li key={sectionId} className={variant === 'horizontal' ? 'shrink-0' : undefined}>
        <button
          type="button"
          onClick={() => onSelectTeam(team)}
          aria-current={isActive ? 'location' : undefined}
          aria-label={`Ir a ${team.name}, ${team.players.length} jugador${team.players.length === 1 ? '' : 'es'}`}
          className={`flex items-center gap-2 rounded-lg text-left text-xs transition-colors ${FOCUS_RING} ${
            variant === 'horizontal'
              ? `min-h-[44px] whitespace-nowrap border px-3 py-2 ${
                  isActive
                    ? 'border-amber-300 bg-amber-50 font-bold text-amber-900'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`
              : `w-full px-2 py-2 ${
                  isActive
                    ? 'bg-amber-50 font-bold text-amber-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
          }`}
        >
          {team.flagUrl ? (
            <img
              src={team.flagUrl}
              alt=""
              aria-hidden="true"
              className="h-5 w-5 shrink-0 rounded-full border object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200"
            >
              <ImageIcon size={10} className="text-slate-500" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{team.name}</span>
          <span
            aria-hidden="true"
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
              variant === 'horizontal' ? 'bg-slate-100 text-slate-500' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {team.players.length}
          </span>
        </button>
      </li>
    );
  });

  if (variant === 'horizontal') {
    return (
      <nav aria-label="Índice del álbum por selección" className="lg:hidden">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <ul className="flex min-w-max gap-2">{listItems}</ul>
        </div>
      </nav>
    );
  }

  return (
    <aside aria-label="Índice del álbum por selección" className="hidden lg:block">
      <nav className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
          <Grid3x3 size={12} aria-hidden="true" />
          Índice del álbum
        </p>
        <ul className="space-y-1">{listItems}</ul>
      </nav>
    </aside>
  );
}

function formatStickerBirthDate(raw: string | null): string {
  if (!raw?.trim()) return '—';
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.trim();
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatStickerHeight(raw: string | null): string {
  if (!raw?.trim()) return '—';
  const trimmed = raw.trim();
  if (/m$/i.test(trimmed) && !/\s/.test(trimmed)) {
    return trimmed.replace(/m$/i, ' m');
  }
  return trimmed;
}

function buildOpenAiStickerPayload(
  player: StickerAlbumPlayer,
  team: StickerAlbumTeam,
  ctx: StickerAlbumResponse['previewContext'],
) {
  const countryCode =
    team.code && team.code !== '—' ? team.code.toUpperCase().slice(0, 3) : 'GOL';
  const jersey = player.jerseyNumber;
  const jerseyPadded = jersey != null ? String(jersey).padStart(3, '0') : '';
  const minutePadded = String(ctx.minute ?? 0).padStart(1, '0');

  return {
    playerApiFootballId: player.apiFootballPlayerId,
    photoUrl: player.photoUrl!,
    playerName: player.name.trim().toUpperCase(),
    birthDate: formatStickerBirthDate(player.birthDate),
    height: formatStickerHeight(player.height),
    weight: player.weight?.trim() || '—',
    countryCode,
    countryName: team.name,
    cardCode: jerseyPadded ? `${countryCode} ${jerseyPadded}`.trim() : countryCode,
    ...(jersey != null
      ? {
          stickerNumber: `${String(jersey).padStart(2, '0')}${minutePadded}`.slice(0, 3),
          mainNumber: String(jersey),
        }
      : {}),
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
  compact?: boolean;
}> = ({ player, team, ctx, compact = false }) => {
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
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={`flex items-center justify-center rounded-xl border border-dashed border-violet-200 bg-violet-50/50 ${
          compact ? 'h-full min-h-[120px] w-full' : 'h-[280px]'
        }`}
      >
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" aria-hidden="true" />
        <span className="sr-only">Cargando sticker OpenAI de {player.name}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Sticker OpenAI de ${player.name}, ${team.name}`}
            className="h-full w-full object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={() => void handleGenerate(false)}
            disabled={generating}
            aria-busy={generating}
            aria-label={generating ? `Generando sticker IA de ${player.name}` : `Generar sticker IA de ${player.name}`}
            className={`flex h-full min-h-[44px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-violet-200 bg-violet-50/40 px-2 text-center text-[10px] font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60 ${FOCUS_RING}`}
          >
            {generating ? (
              <Loader2 className="h-5 w-5 animate-spin text-violet-500" aria-hidden="true" />
            ) : (
              <>
                <Sparkles className="mb-1 h-4 w-4 text-violet-500" aria-hidden="true" />
                Generar IA
              </>
            )}
          </button>
        )}
        {error && (
          <p role="alert" className="mt-1 text-center text-[9px] text-rose-600">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={`Sticker OpenAI de ${player.name}, ${team.name}`}
          className="mx-auto w-full max-w-[220px] rounded-xl shadow-md"
        />
      ) : (
        <div
          role="status"
          className="flex h-[220px] w-full max-w-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-violet-200 bg-violet-50/40 px-4 text-center text-xs text-violet-800"
        >
          <Sparkles className="mb-2 h-5 w-5 text-violet-500" aria-hidden="true" />
          Sin imagen OpenAI cacheada para este jugador.
        </div>
      )}
      {cached && imageUrl && (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
          Desde caché
        </span>
      )}
      {error && (
        <p role="alert" className="text-center text-[11px] text-rose-600">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => void handleGenerate(imageUrl != null)}
          disabled={generating}
          aria-busy={generating}
          className={`min-h-[44px] rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-60 ${FOCUS_RING}`}
        >
          {generating ? 'Generando…' : imageUrl ? 'Regenerar IA' : 'Generar con OpenAI'}
        </button>
        {imageUrl && (
          <button
            type="button"
            onClick={() => void loadCached()}
            className={`min-h-[44px] rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50 ${FOCUS_RING}`}
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
  compact?: boolean;
}> = ({ playerApiId, teamCode, playerName, variant, compact = false }) => {
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
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={`flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 ${
          compact ? 'h-full min-h-[120px] w-full' : 'h-[280px]'
        }`}
      >
        <Loader2 className="h-6 w-6 animate-spin text-amber-500" aria-hidden="true" />
        <span className="sr-only">Cargando sticker WhatsApp de {playerName}</span>
      </div>
    );
  }

  if (error || !src) {
    return (
      <div
        role="alert"
        className={`flex items-center justify-center rounded-xl border border-dashed border-rose-200 bg-rose-50 px-4 text-center text-xs text-rose-600 ${
          compact ? 'h-full min-h-[120px] w-full' : 'h-[280px]'
        }`}
      >
        {error ?? 'Preview no disponible'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Sticker WhatsApp de ${playerName}`}
      className={compact ? 'h-full w-full object-contain' : 'mx-auto w-full max-w-[220px] rounded-xl shadow-md'}
    />
  );
};

const StickerAlbumCard: React.FC<{
  player: StickerAlbumPlayer;
  team: StickerAlbumTeam;
  ctx: StickerAlbumResponse['previewContext'];
  variant: GoalStickerVariant;
  previewMode: PreviewMode;
  layout: AlbumLayout;
}> = ({ player, team, ctx, variant, previewMode, layout }) => {
  const stickerProps = buildStickerProps(player, team, ctx);
  const isCompact = layout === 'album';

  const previewContent =
    previewMode === 'dashboard' ? (
      <div className={isCompact ? 'origin-top scale-[0.55]' : undefined}>
        <GoalScorerStickerCard {...stickerProps} variant={variant} />
      </div>
    ) : previewMode === 'whatsapp' ? (
      <WaStickerPreview
        playerApiId={player.apiFootballPlayerId}
        teamCode={team.code}
        playerName={player.name}
        variant={variant}
        compact={isCompact}
      />
    ) : (
      <OpenAiStickerPreview player={player} team={team} ctx={ctx} compact={isCompact} />
    );

  if (isCompact) {
    return (
      <article
        id={`sticker-player-${player.apiFootballPlayerId}`}
        aria-label={`Sticker de ${player.name}, ${team.name}`}
        className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-amber-300 hover:shadow-md"
      >
        <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-gradient-to-b from-slate-50 to-white p-2">
          <div className="w-full scale-[0.92] transition group-hover:scale-100 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
            {previewContent}
          </div>
          {team.flagUrl && (
            <img
              src={team.flagUrl}
              alt=""
              aria-hidden="true"
              className="absolute right-2 top-2 h-5 w-5 rounded-full border border-white object-cover shadow-sm"
            />
          )}
          {player.jerseyNumber != null && (
            <span
              aria-label={`Dorsal ${player.jerseyNumber}`}
              className="absolute left-2 top-2 rounded-md bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-black text-white"
            >
              #{player.jerseyNumber}
            </span>
          )}
        </div>
        <div className="border-t border-slate-100 px-2.5 py-2">
          <h3 className="truncate text-xs font-bold text-slate-900">{player.name}</h3>
          <p className="truncate text-[10px] text-slate-500">
            {team.name}
            {player.isDemo ? ' · demo' : ''}
          </p>
        </div>
      </article>
    );
  }

  return (
    <article
      id={`sticker-player-${player.apiFootballPlayerId}`}
      aria-label={`Sticker de ${player.name}, ${team.name}`}
      className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:min-h-[480px] lg:min-h-[520px]"
    >
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-slate-900">{player.name}</h3>
          <p className="truncate text-[10px] text-slate-500">
            {team.name}
            {player.jerseyNumber != null ? ` · #${player.jerseyNumber}` : ''}
            {player.isDemo ? ' · demo' : ''}
          </p>
        </div>
        {team.flagUrl && (
          <img
            src={team.flagUrl}
            alt={`Bandera de ${team.name}`}
            className="h-6 w-6 shrink-0 rounded-full border object-cover"
          />
        )}
      </header>

      <div className="flex flex-1 items-center justify-center py-2">{previewContent}</div>

      <footer className="mt-auto border-t border-slate-100 pt-3">
        <p className="text-[10px] leading-relaxed text-slate-500">
          {PREVIEW_MODE_META[previewMode].description}
        </p>
      </footer>
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
  const [previewMode, setPreviewMode] = React.useState<PreviewMode>(readStoredPreviewMode);
  const [albumLayout, setAlbumLayout] = React.useState<AlbumLayout>(readStoredAlbumLayout);
  const [activeTeamCode, setActiveTeamCode] = React.useState<string | null>(null);
  const [prewarming, setPrewarming] = React.useState(false);
  const [prewarmMsg, setPrewarmMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const sectionRefs = React.useRef<Map<string, HTMLElement>>(new Map());

  const handlePreviewModeChange = (mode: PreviewMode) => {
    setPreviewMode(mode);
    try {
      localStorage.setItem(PREVIEW_MODE_STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  };

  const handleAlbumLayoutChange = (layout: AlbumLayout) => {
    setAlbumLayout(layout);
    try {
      localStorage.setItem(ALBUM_LAYOUT_STORAGE_KEY, layout);
    } catch {
      /* ignore */
    }
  };

  const scrollToTeam = React.useCallback((team: StickerAlbumTeam) => {
    setTeamFilter('all');
    const sectionId = teamSectionId(team.code, team.name);
    requestAnimationFrame(() => {
      const el = sectionRefs.current.get(sectionId) ?? document.getElementById(sectionId);
      el?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      setActiveTeamCode(team.code);
      const heading = el?.querySelector<HTMLElement>('h2');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    });
  }, []);

  const jumpToTeamFromFilter = React.useCallback(
    (code: string) => {
      setTeamFilter(code);
      setActiveTeamCode(code === 'all' ? null : code);
      if (code !== 'all' && album) {
        const team = album.teams.find((t) => t.code === code);
        if (team) {
          const sectionId = teamSectionId(team.code, team.name);
          requestAnimationFrame(() => {
            const el = sectionRefs.current.get(sectionId) ?? document.getElementById(sectionId);
            el?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
          });
        }
      }
    },
    [album],
  );

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

  React.useEffect(() => {
    if (teamFilter !== 'all' || filteredTeams.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (!top?.target.id) return;
        const team = filteredTeams.find((t) => teamSectionId(t.code, t.name) === top.target.id);
        if (team) setActiveTeamCode(team.code);
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.15, 0.4, 0.7] },
    );

    for (const team of filteredTeams) {
      const sectionId = teamSectionId(team.code, team.name);
      const el = sectionRefs.current.get(sectionId) ?? document.getElementById(sectionId);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [filteredTeams, teamFilter]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/admin/automation"
            className={`mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 ${FOCUS_RING}`}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Automatización
          </Link>
          <div className="flex items-center gap-2">
            <Sticker size={22} className="text-amber-500" aria-hidden="true" />
            <h1 id="sticker-album-title" className="text-2xl font-black tracking-tight text-slate-900">
              Álbum de stickers
            </h1>
          </div>
          <p id="sticker-album-description" className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
            Navega el álbum por selección, con vista OpenAI por defecto. Cambia a «Comparar» para revisar
            diseño React, PNG de WhatsApp e imágenes IA lado a lado.
          </p>
        </div>

        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => void loadAlbum()}
            disabled={loading}
            aria-busy={loading}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 sm:flex-none ${FOCUS_RING}`}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => void handlePrewarm()}
            disabled={prewarming}
            aria-busy={prewarming}
            className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60 sm:flex-none ${FOCUS_RING}`}
          >
            {prewarming ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <Users size={14} aria-hidden="true" />
            )}
            Precargar plantillas
          </button>
        </div>
      </header>

      <div role="status" aria-live="polite" className="sr-only">
        {loading
          ? 'Cargando álbum de stickers'
          : `${visiblePlayerCount} sticker${visiblePlayerCount === 1 ? '' : 's'} visibles. Vista ${albumLayout === 'album' ? 'álbum' : 'comparar'}. Imagen ${PREVIEW_MODE_META[previewMode].label}.`}
      </div>

      {prewarmMsg && (
        <p
          role="status"
          aria-live="polite"
          className={`text-sm font-medium ${prewarmMsg.ok ? 'text-emerald-600' : 'text-rose-600'}`}
        >
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
        <section aria-label="Estadísticas del álbum" className="grid gap-3 sm:grid-cols-3">
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
        </section>
      )}

      {isDemo && (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Mostrando stickers de ejemplo (James Rodríguez, Mikel Merino). Ejecuta{' '}
          <strong>Precargar plantillas</strong> para ver jugadores reales del catálogo WC.
        </div>
      )}

      <section aria-labelledby="sticker-album-controls-title" className="flex flex-col gap-3">
        <h2 id="sticker-album-controls-title" className="sr-only">
          Filtros y opciones de visualización
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="sticker-album-search" className="sr-only">
              Buscar jugador o selección
            </label>
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="sticker-album-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar jugador o selección…"
              aria-describedby="sticker-album-description"
              autoComplete="off"
              className={`w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none ring-amber-500 focus:ring-2 ${FOCUS_RING}`}
            />
          </div>
          <div className="sm:min-w-[200px]">
            <label htmlFor="sticker-album-team-filter" className="sr-only">
              Filtrar por selección
            </label>
            <select
              id="sticker-album-team-filter"
              value={teamFilter}
              onChange={(e) => jumpToTeamFromFilter(e.target.value)}
              className={`w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none ring-amber-500 focus:ring-2 ${FOCUS_RING}`}
            >
              <option value="all">Todas las selecciones</option>
              {album?.teams.map((team) => (
                <option key={team.code + team.name} value={team.code}>
                  {team.name} ({team.playerCount})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2">
          <AlbumToggleGroup
            label="Vista"
            value={albumLayout}
            options={['album', 'compare'] as AlbumLayout[]}
            onChange={handleAlbumLayoutChange}
            getLabel={(key) => ALBUM_LAYOUT_META[key].label}
            getIcon={(key) => ALBUM_LAYOUT_META[key].icon}
          />
          <AlbumToggleGroup
            label="Imagen"
            value={previewMode}
            options={['openai', 'dashboard', 'whatsapp'] as PreviewMode[]}
            onChange={handlePreviewModeChange}
            getLabel={(key) => PREVIEW_MODE_META[key].label}
          />
        </div>

        {teamFilter === 'all' && filteredTeams.length > 0 && (
          <div className="sticky top-0 z-10 -mx-1 rounded-xl border border-slate-200 bg-white/95 px-2 py-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 lg:hidden">
            <TeamAlbumIndexNav
              teams={filteredTeams}
              activeTeamCode={activeTeamCode}
              onSelectTeam={scrollToTeam}
              variant="horizontal"
            />
          </div>
        )}
      </section>

      {loading && (
        <div role="status" aria-live="polite" aria-busy="true" className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" aria-hidden="true" />
          <span className="sr-only">Cargando álbum de stickers…</span>
        </div>
      )}

      {error && !loading && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
          {teamFilter === 'all' && filteredTeams.length > 0 && (
            <TeamAlbumIndexNav
              teams={filteredTeams}
              activeTeamCode={activeTeamCode}
              onSelectTeam={scrollToTeam}
              variant="sidebar"
            />
          )}

          <main aria-labelledby="sticker-album-title" className="min-w-0 space-y-6">
            <p className="text-xs font-semibold text-slate-500" aria-hidden="true">
              {visiblePlayerCount} sticker{visiblePlayerCount === 1 ? '' : 's'} visibles
              {albumLayout === 'album' ? ' · vista álbum' : ' · vista comparar'}
              {' · '}
              {PREVIEW_MODE_META[previewMode].label}
            </p>

            {filteredTeams.map((team) => {
              const sectionId = teamSectionId(team.code, team.name);
              return (
                <section
                  key={`${team.code}-${team.name}`}
                  id={sectionId}
                  aria-labelledby={`${sectionId}-heading`}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(sectionId, el);
                    else sectionRefs.current.delete(sectionId);
                  }}
                  className="scroll-mt-20 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-3 sm:scroll-mt-4 sm:p-4"
                >
                  <header className="flex items-center gap-2">
                    {team.flagUrl ? (
                      <img
                        src={team.flagUrl}
                        alt={`Bandera de ${team.name}`}
                        className="h-8 w-8 shrink-0 rounded-full border object-cover shadow-sm"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200"
                      >
                        <ImageIcon size={16} className="text-slate-500" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 id={`${sectionId}-heading`} className="text-base font-black text-slate-900 sm:text-lg">
                        {team.name}
                      </h2>
                      <p className="text-[10px] font-semibold text-slate-500">
                        {team.players.length} jugador{team.players.length === 1 ? '' : 'es'} · {team.code}
                      </p>
                    </div>
                    <span
                      aria-hidden="true"
                      className="h-4 w-16 shrink-0 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${team.theme.pillFrom}, ${team.theme.pillTo})`,
                      }}
                      title="Paleta del equipo"
                    />
                  </header>

                  <ul
                    className={
                      albumLayout === 'album'
                        ? 'grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
                        : 'grid list-none gap-3 p-0 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4'
                    }
                  >
                    {team.players.map((player) => (
                      <li key={`${player.apiFootballPlayerId}-${player.name}`}>
                        <StickerAlbumCard
                          player={player}
                          team={team}
                          ctx={album!.previewContext}
                          variant={previewVariant}
                          previewMode={previewMode}
                          layout={albumLayout}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}

            {filteredTeams.length === 0 && (
              <div
                role="status"
                className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center"
              >
                <Sticker size={32} className="mx-auto text-slate-300" aria-hidden="true" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Sin resultados</p>
                <p className="mt-1 text-xs text-slate-500">Prueba otro filtro o precarga las plantillas.</p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
