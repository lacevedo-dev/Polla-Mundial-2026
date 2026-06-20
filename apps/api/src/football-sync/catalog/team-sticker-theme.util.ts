import { WORLD_CUP_TEAM_CATALOG_BY_CODE } from './world-cup-team-catalog';

export type TeamStickerTheme = {
  primary: string;
  secondary: string;
  accent: string;
  pillFrom: string;
  pillTo: string;
};

/** Paletas curadas por selección (48 equipos: ampliar al completar catálogo). */
const CURATED_TEAM_STICKER_THEMES: Record<string, TeamStickerTheme> = {
  MEX: { primary: '#006847', secondary: '#f5c518', accent: '#ce1126', pillFrom: '#006847', pillTo: '#ce1126' },
  RSA: { primary: '#007749', secondary: '#f5c518', accent: '#de3831', pillFrom: '#007749', pillTo: '#de3831' },
  KOR: { primary: '#003478', secondary: '#f5c518', accent: '#cd2e3a', pillFrom: '#003478', pillTo: '#cd2e3a' },
  DEN: { primary: '#c60c30', secondary: '#f5c518', accent: '#ffffff', pillFrom: '#c60c30', pillTo: '#8b0000' },
  CAN: { primary: '#d80621', secondary: '#ffffff', accent: '#f5c518', pillFrom: '#d80621', pillTo: '#8b0000' },
  FRA: { primary: '#002395', secondary: '#f5c518', accent: '#ed2939', pillFrom: '#002395', pillTo: '#ed2939' },
  NGA: { primary: '#008751', secondary: '#f5c518', accent: '#ffffff', pillFrom: '#008751', pillTo: '#006b40' },
  JPN: { primary: '#bc002d', secondary: '#ffffff', accent: '#1a1a1a', pillFrom: '#bc002d', pillTo: '#8b0000' },
  USA: { primary: '#3c3b6e', secondary: '#f5c518', accent: '#b22234', pillFrom: '#3c3b6e', pillTo: '#b22234' },
  ENG: { primary: '#ffffff', secondary: '#c8102e', accent: '#012169', pillFrom: '#012169', pillTo: '#c8102e' },
  IRN: { primary: '#239f40', secondary: '#ffffff', accent: '#da0000', pillFrom: '#239f40', pillTo: '#da0000' },
  CHI: { primary: '#d52b1e', secondary: '#ffffff', accent: '#0039a6', pillFrom: '#d52b1e', pillTo: '#0039a6' },
  BRA: { primary: '#009c3b', secondary: '#f5c518', accent: '#002776', pillFrom: '#009c3b', pillTo: '#002776' },
  COL: { primary: '#fcd116', secondary: '#003893', accent: '#ce1126', pillFrom: '#003893', pillTo: '#ce1126' },
  POL: { primary: '#dc143c', secondary: '#ffffff', accent: '#f5c518', pillFrom: '#dc143c', pillTo: '#8b0000' },
  SAU: { primary: '#006c35', secondary: '#ffffff', accent: '#f5c518', pillFrom: '#006c35', pillTo: '#004d26' },
  NED: { primary: '#ff6600', secondary: '#ffffff', accent: '#21468b', pillFrom: '#ff6600', pillTo: '#21468b' },
  SWE: { primary: '#006aa7', secondary: '#f5c518', accent: '#fecc00', pillFrom: '#006aa7', pillTo: '#004d7a' },
  ESP: { primary: '#aa151b', secondary: '#f5c518', accent: '#f1bf00', pillFrom: '#aa151b', pillTo: '#8b0000' },
  GER: { primary: '#000000', secondary: '#f5c518', accent: '#dd0000', pillFrom: '#000000', pillTo: '#dd0000' },
  ARG: { primary: '#74acdf', secondary: '#ffffff', accent: '#f5c518', pillFrom: '#74acdf', pillTo: '#003087' },
  POR: { primary: '#006600', secondary: '#f5c518', accent: '#ff0000', pillFrom: '#006600', pillTo: '#ff0000' },
  URU: { primary: '#55acee', secondary: '#ffffff', accent: '#f5c518', pillFrom: '#55acee', pillTo: '#0038a8' },
  ITA: { primary: '#009246', secondary: '#ffffff', accent: '#ce2b37', pillFrom: '#009246', pillTo: '#ce2b37' },
};

const DEFAULT_THEME: TeamStickerTheme = {
  primary: '#3ebdb4',
  secondary: '#f5c518',
  accent: '#ef4444',
  pillFrom: '#ea580c',
  pillTo: '#dc2626',
};

function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function generatedThemeFromCode(code: string): TeamStickerTheme {
  const h = hashCode(code);
  const hue = h % 360;
  return {
    primary: `hsl(${hue}, 55%, 42%)`,
    secondary: '#f5c518',
    accent: `hsl(${(hue + 120) % 360}, 70%, 45%)`,
    pillFrom: `hsl(${hue}, 65%, 38%)`,
    pillTo: `hsl(${(hue + 30) % 360}, 70%, 35%)`,
  };
}

export function resolveCuratedTeamStickerTheme(code: string | null | undefined): TeamStickerTheme {
  const key = code?.trim().toUpperCase();
  if (key && CURATED_TEAM_STICKER_THEMES[key]) {
    return CURATED_TEAM_STICKER_THEMES[key];
  }
  if (key) return generatedThemeFromCode(key);
  return DEFAULT_THEME;
}

export type TeamStickerSource = {
  code?: string | null;
  shortCode?: string | null;
  stickerPrimaryColor?: string | null;
  stickerSecondaryColor?: string | null;
  stickerAccentColor?: string | null;
  stickerPillFromColor?: string | null;
  stickerPillToColor?: string | null;
};

export function resolveTeamStickerTheme(team: TeamStickerSource | null | undefined): TeamStickerTheme {
  if (
    team?.stickerPrimaryColor &&
    team?.stickerSecondaryColor &&
    team?.stickerAccentColor &&
    team?.stickerPillFromColor &&
    team?.stickerPillToColor
  ) {
    return {
      primary: team.stickerPrimaryColor,
      secondary: team.stickerSecondaryColor,
      accent: team.stickerAccentColor,
      pillFrom: team.stickerPillFromColor,
      pillTo: team.stickerPillToColor,
    };
  }

  const code = team?.shortCode ?? team?.code;
  if (code) {
    const catalog = WORLD_CUP_TEAM_CATALOG_BY_CODE.get(code.toUpperCase());
    if (catalog) return resolveCuratedTeamStickerTheme(catalog.shortCode);
  }

  return resolveCuratedTeamStickerTheme(code ?? null);
}

export function themeColorsForCatalogBackfill(code: string): Pick<
  TeamStickerSource,
  'stickerPrimaryColor' | 'stickerSecondaryColor' | 'stickerAccentColor' | 'stickerPillFromColor' | 'stickerPillToColor'
> {
  const theme = resolveCuratedTeamStickerTheme(code);
  return {
    stickerPrimaryColor: theme.primary,
    stickerSecondaryColor: theme.secondary,
    stickerAccentColor: theme.accent,
    stickerPillFromColor: theme.pillFrom,
    stickerPillToColor: theme.pillTo,
  };
}
