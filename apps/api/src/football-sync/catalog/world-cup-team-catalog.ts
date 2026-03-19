export interface WorldCupTeamCatalogEntry {
  name: string;
  code: string;
  shortCode: string;
  apiFootballTeamId: number;
  apiFootballName: string;
  apiFootballCode: string | null;
  flagUrl: string;
  group: string;
}

/**
 * Curated team catalog used to backfill the current tournament teams with
 * canonical compact codes and stable API-Football identifiers.
 *
 * Notes:
 * - `shortCode` is the UI-facing compact code we want across the system.
 * - `apiFootballCode` is preserved as delivered by API-Football for audit/debug.
 * - Some upstream codes are not ideal for compact UI (`SOU` is ambiguous), so we
 *   intentionally keep a separate curated `shortCode`.
 */
export const WORLD_CUP_TEAM_CATALOG: WorldCupTeamCatalogEntry[] = [
  {
    name: 'México',
    code: 'MEX',
    shortCode: 'MEX',
    apiFootballTeamId: 16,
    apiFootballName: 'Mexico',
    apiFootballCode: 'MEX',
    flagUrl: 'https://media.api-sports.io/football/teams/16.png',
    group: 'A',
  },
  {
    name: 'Sudáfrica',
    code: 'RSA',
    shortCode: 'RSA',
    apiFootballTeamId: 1531,
    apiFootballName: 'South Africa',
    apiFootballCode: 'SOU',
    flagUrl: 'https://media.api-sports.io/football/teams/1531.png',
    group: 'A',
  },
  {
    name: 'Corea del Sur',
    code: 'KOR',
    shortCode: 'KOR',
    apiFootballTeamId: 17,
    apiFootballName: 'South Korea',
    apiFootballCode: 'SOU',
    flagUrl: 'https://media.api-sports.io/football/teams/17.png',
    group: 'A',
  },
  {
    name: 'Dinamarca',
    code: 'DEN',
    shortCode: 'DEN',
    apiFootballTeamId: 21,
    apiFootballName: 'Denmark',
    apiFootballCode: 'DEN',
    flagUrl: 'https://media.api-sports.io/football/teams/21.png',
    group: 'A',
  },
  {
    name: 'Canadá',
    code: 'CAN',
    shortCode: 'CAN',
    apiFootballTeamId: 5529,
    apiFootballName: 'Canada',
    apiFootballCode: 'CAN',
    flagUrl: 'https://media.api-sports.io/football/teams/5529.png',
    group: 'B',
  },
  {
    name: 'Francia',
    code: 'FRA',
    shortCode: 'FRA',
    apiFootballTeamId: 2,
    apiFootballName: 'France',
    apiFootballCode: 'FRA',
    flagUrl: 'https://media.api-sports.io/football/teams/2.png',
    group: 'B',
  },
  {
    name: 'Nigeria',
    code: 'NGA',
    shortCode: 'NGA',
    apiFootballTeamId: 19,
    apiFootballName: 'Nigeria',
    apiFootballCode: 'NIG',
    flagUrl: 'https://media.api-sports.io/football/teams/19.png',
    group: 'B',
  },
  {
    name: 'Japón',
    code: 'JPN',
    shortCode: 'JPN',
    apiFootballTeamId: 12,
    apiFootballName: 'Japan',
    apiFootballCode: 'JAP',
    flagUrl: 'https://media.api-sports.io/football/teams/12.png',
    group: 'B',
  },
  {
    name: 'Estados Unidos',
    code: 'USA',
    shortCode: 'USA',
    apiFootballTeamId: 2384,
    apiFootballName: 'USA',
    apiFootballCode: 'USA',
    flagUrl: 'https://media.api-sports.io/football/teams/2384.png',
    group: 'C',
  },
  {
    name: 'Inglaterra',
    code: 'ENG',
    shortCode: 'ENG',
    apiFootballTeamId: 10,
    apiFootballName: 'England',
    apiFootballCode: 'ENG',
    flagUrl: 'https://media.api-sports.io/football/teams/10.png',
    group: 'C',
  },
  {
    name: 'Irán',
    code: 'IRN',
    shortCode: 'IRN',
    apiFootballTeamId: 22,
    apiFootballName: 'Iran',
    apiFootballCode: 'IRA',
    flagUrl: 'https://media.api-sports.io/football/teams/22.png',
    group: 'C',
  },
  {
    name: 'Chile',
    code: 'CHI',
    shortCode: 'CHI',
    apiFootballTeamId: 2383,
    apiFootballName: 'Chile',
    apiFootballCode: 'CHI',
    flagUrl: 'https://media.api-sports.io/football/teams/2383.png',
    group: 'C',
  },
  {
    name: 'Brasil',
    code: 'BRA',
    shortCode: 'BRA',
    apiFootballTeamId: 6,
    apiFootballName: 'Brazil',
    apiFootballCode: 'BRA',
    flagUrl: 'https://media.api-sports.io/football/teams/6.png',
    group: 'D',
  },
  {
    name: 'Colombia',
    code: 'COL',
    shortCode: 'COL',
    apiFootballTeamId: 8,
    apiFootballName: 'Colombia',
    apiFootballCode: 'COL',
    flagUrl: 'https://media.api-sports.io/football/teams/8.png',
    group: 'D',
  },
  {
    name: 'Polonia',
    code: 'POL',
    shortCode: 'POL',
    apiFootballTeamId: 24,
    apiFootballName: 'Poland',
    apiFootballCode: 'POL',
    flagUrl: 'https://media.api-sports.io/football/teams/24.png',
    group: 'D',
  },
  {
    name: 'Arabia Saudita',
    code: 'SAU',
    shortCode: 'SAU',
    apiFootballTeamId: 23,
    apiFootballName: 'Saudi Arabia',
    apiFootballCode: 'SAU',
    flagUrl: 'https://media.api-sports.io/football/teams/23.png',
    group: 'D',
  },
];

export const WORLD_CUP_TEAM_CATALOG_BY_CODE = new Map(
  WORLD_CUP_TEAM_CATALOG.map((team) => [team.code, team] as const),
);

export const WORLD_CUP_TEAM_CATALOG_BY_API_ID = new Map(
  WORLD_CUP_TEAM_CATALOG.map((team) => [team.apiFootballTeamId, team] as const),
);
