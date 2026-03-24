import { Injectable, Logger } from '@nestjs/common';
import { Phase } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiFootballClient } from './api-football-client.service';
import { RateLimiterService } from './rate-limiter.service';

/* ─── helpers ──────────────────────────────────────────────────────────── */

/** Maps API-Football round strings to Phase enum */
function mapRoundToPhase(round: string): Phase {
  const r = round.toLowerCase();
  if (r.includes('group') || r.includes('regular') || r.includes('jornada')) return Phase.GROUP;
  if (r.includes('round of 32') || r.includes('last 32') || r.includes('round of 64')) return Phase.ROUND_OF_32;
  if (r.includes('round of 16') || r.includes('last 16') || r.includes('8th')) return Phase.ROUND_OF_16;
  if (r.includes('quarter')) return Phase.QUARTER;
  if (r.includes('semi')) return Phase.SEMI;
  if (r.includes('3rd') || r.includes('third') || r.includes('bronze') || r.includes('tercer')) return Phase.THIRD_PLACE;
  if (r.includes('final')) return Phase.FINAL;
  return Phase.GROUP;
}

/** Normalize team name for fuzzy matching */
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/* ─── types ─────────────────────────────────────────────────────────────── */

export interface LeagueSearchResult {
  id: number;
  name: string;
  country: string;
  countryCode?: string;
  type: string;
  logoUrl?: string;
  currentSeason?: number;
  seasons: number[];
}

export interface TournamentPreview {
  league: LeagueSearchResult;
  season: number;
  totalFixtures: number;
  rounds: string[];
  teams: Array<{ id: number; name: string; logo?: string; alreadyExists: boolean }>;
  newTeamsCount: number;
  existingFixturesCount: number;
}

export interface ImportResult {
  tournamentId: string;
  tournamentName: string;
  fixturesImported: number;
  fixturesUpdated: number;
  teamsCreated: number;
  teamsLinked: number;
  skipped: number;
  errors: string[];
  dryRun: boolean;
}

export interface ImportOptions {
  createTeams: boolean;
  overwriteExisting: boolean;
  dryRun: boolean;
}

@Injectable()
export class TournamentImportService {
  private readonly logger = new Logger(TournamentImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClient: ApiFootballClient,
    private readonly rateLimiter: RateLimiterService,
  ) {}

  /* ─── Search leagues ─────────────────────────────────────────────────── */

  async searchLeagues(query: string, country?: string): Promise<LeagueSearchResult[]> {
    const numericId = query && /^\d+$/.test(query.trim()) ? Number(query.trim()) : null;

    const response = await this.apiClient.getLeagues(
      numericId
        ? { id: numericId }
        : { search: query || undefined, country: country || undefined },
    );

    await this.rateLimiter.logRequest('/leagues', { search: query, country }, 200, 0);

    const results: LeagueSearchResult[] = [];

    for (const item of ((response.response as any[]) ?? []).slice(0, 20)) {
      const league = item.league;
      const countryData = item.country;
      const seasons: number[] = ((item.seasons ?? []) as any[])
        .map((s: any) => Number(s.year))
        .sort((a: number, b: number) => b - a);
      const currentSeason = ((item.seasons ?? []) as any[]).find((s: any) => s.current)?.year;

      results.push({
        id: league.id,
        name: league.name,
        country: countryData?.name ?? 'Internacional',
        countryCode: countryData?.code,
        type: league.type ?? 'Cup',
        logoUrl: league.logo,
        currentSeason: currentSeason ? Number(currentSeason) : undefined,
        seasons,
      });
    }

    return results;
  }

  /* ─── Preview import ─────────────────────────────────────────────────── */

  async previewImport(leagueId: number, season: number): Promise<TournamentPreview> {
    // Fetch league info by ID only (without season — avoids empty response when season has no data yet)
    const leagueRes = await this.apiClient.getLeagues({ id: leagueId });
    await this.rateLimiter.logRequest('/leagues', { id: leagueId }, 200, 0);

    const leagueData = (leagueRes.response as any[])?.[0];
    if (!leagueData) {
      throw new Error(`League ${leagueId} not found in API-Football`);
    }

    // Fetch fixtures for the specific season
    const fixturesRes = await this.apiClient.getFixturesByLeague(leagueId, season);
    await this.rateLimiter.logRequest('/fixtures', { league: leagueId, season }, 200, fixturesRes.results ?? 0);

    const fixtures = fixturesRes.response ?? [];

    // Collect unique rounds and teams
    const rounds = [...new Set(fixtures.map((f: any) => f.league?.round as string).filter(Boolean))];
    const teamMap = new Map<number, { id: number; name: string; logo?: string }>();

    for (const f of fixtures) {
      const home = f.teams?.home;
      const away = f.teams?.away;
      if (home?.id) teamMap.set(home.id, { id: home.id, name: home.name, logo: home.logo });
      if (away?.id) teamMap.set(away.id, { id: away.id, name: away.name, logo: away.logo });
    }

    // Check which teams already exist
    const apiTeamIds = [...teamMap.keys()];
    const existingTeams = await this.prisma.team.findMany({
      where: { apiFootballTeamId: { in: apiTeamIds } },
      select: { apiFootballTeamId: true },
    });
    const existingTeamIds = new Set(existingTeams.map((t) => t.apiFootballTeamId));

    // Check existing fixtures
    const externalIds = fixtures.map((f: any) => String(f.fixture?.id)).filter(Boolean);
    const existingFixtures = await this.prisma.match.count({
      where: { externalId: { in: externalIds } },
    });

    const availableSeasons: number[] = ((leagueData.seasons ?? []) as any[])
      .map((s: any) => Number(s.year))
      .sort((a: number, b: number) => b - a);

    const league: LeagueSearchResult = {
      id: leagueData.league.id,
      name: leagueData.league.name,
      country: (leagueData.country as any)?.name ?? 'Internacional',
      countryCode: (leagueData.country as any)?.code,
      type: (leagueData.league as any).type ?? 'Cup',
      logoUrl: leagueData.league.logo,
      seasons: availableSeasons,
      currentSeason: season,
    };

    const teams = [...teamMap.values()].map((t) => ({
      ...t,
      alreadyExists: existingTeamIds.has(t.id),
    }));

    return {
      league,
      season,
      totalFixtures: fixtures.length,
      rounds,
      teams,
      newTeamsCount: teams.filter((t) => !t.alreadyExists).length,
      existingFixturesCount: existingFixtures,
    };
  }

  /* ─── Import tournament ──────────────────────────────────────────────── */

  async importTournament(
    leagueId: number,
    season: number,
    options: ImportOptions,
  ): Promise<ImportResult> {
    const result: ImportResult = {
      tournamentId: '',
      tournamentName: '',
      fixturesImported: 0,
      fixturesUpdated: 0,
      teamsCreated: 0,
      teamsLinked: 0,
      skipped: 0,
      errors: [],
      dryRun: options.dryRun,
    };

    try {
      // 1. Fetch league info by ID only (season filter causes empty response when season has no fixtures yet)
      const leagueRes = await this.apiClient.getLeagues({ id: leagueId });
      await this.rateLimiter.logRequest('/leagues', { id: leagueId }, 200, 0);
      const leagueData = (leagueRes.response as any[])?.[0];
      if (!leagueData) throw new Error(`League ${leagueId} not found`);

      const leagueName = leagueData.league.name;
      const leagueType = (leagueData.league as any).type ?? 'Cup';
      const leagueCountry = (leagueData.country as any)?.name ?? 'Internacional';
      const leagueLogo = leagueData.league.logo;

      result.tournamentName = leagueName;

      // 2. Fetch all fixtures
      const fixturesRes = await this.apiClient.getFixturesByLeague(leagueId, season);
      await this.rateLimiter.logRequest('/fixtures', { league: leagueId, season }, 200, fixturesRes.results ?? 0);
      const fixtures = fixturesRes.response ?? [];

      if (fixtures.length === 0) {
        throw new Error(`No fixtures found for league ${leagueId} season ${season}`);
      }

      this.logger.log(`Importing ${fixtures.length} fixtures for ${leagueName} ${season}`);

      if (options.dryRun) {
        result.fixturesImported = fixtures.length;
        return result;
      }

      // 3. Upsert Tournament record
      const tournament = await this.prisma.tournament.upsert({
        where: { apiFootballLeagueId: leagueId },
        create: {
          name: leagueName,
          country: leagueCountry,
          type: leagueType,
          logoUrl: leagueLogo,
          apiFootballLeagueId: leagueId,
          season,
          active: true,
        },
        update: {
          name: leagueName,
          country: leagueCountry,
          type: leagueType,
          logoUrl: leagueLogo,
          season,
          active: true,
        },
      });

      result.tournamentId = tournament.id;

      // 4. Fetch teams if needed
      let teamApiIdToLocalId = new Map<number, string>();

      if (options.createTeams) {
        const teamsRes = await this.apiClient.getTeamsByLeague(leagueId, season);
        await this.rateLimiter.logRequest('/teams', { league: leagueId, season }, 200, 0);

        for (const item of (teamsRes.response as any[]) ?? []) {
          const t = (item as any).team;
          if (!t?.id) continue;

          // Check if exists by apiFootballTeamId or name
          const existing = await this.prisma.team.findFirst({
            where: {
              OR: [
                { apiFootballTeamId: t.id },
                { name: { equals: t.name } },
              ],
            },
          });

          if (existing) {
            // Link if needed
            if (!existing.apiFootballTeamId) {
              await this.prisma.team.update({
                where: { id: existing.id },
                data: { apiFootballTeamId: t.id, flagUrl: t.logo ?? existing.flagUrl },
              });
              result.teamsLinked++;
            }
            teamApiIdToLocalId.set(t.id, existing.id);
          } else {
            // Create team
            const teamCode = (t.code ?? t.name.substring(0, 3)).toUpperCase().slice(0, 3);
            const safeName = await this.getUniqueTeamName(t.name);
            const safeCode = await this.getUniqueTeamCode(teamCode);

            // venue info from team if available
            const newTeam = await this.prisma.team.create({
              data: {
                name: safeName,
                code: safeCode,
                shortCode: teamCode.slice(0, 8),
                flagUrl: t.logo,
                apiFootballTeamId: t.id,
              },
            });
            teamApiIdToLocalId.set(t.id, newTeam.id);
            result.teamsCreated++;
          }
        }
      } else {
        // Build map from existing teams only
        const apiIds = [...new Set(fixtures.flatMap((f: any) => [f.teams?.home?.id, f.teams?.away?.id].filter(Boolean)))];
        const existingTeams = await this.prisma.team.findMany({
          where: { apiFootballTeamId: { in: apiIds } },
          select: { id: true, apiFootballTeamId: true },
        });
        existingTeams.forEach((t) => {
          if (t.apiFootballTeamId) teamApiIdToLocalId.set(t.apiFootballTeamId, t.id);
        });
      }

      // 5. Import fixtures
      for (const fixture of fixtures) {
        try {
          const fixtureData = fixture.fixture;
          const teams = fixture.teams;
          const goals = fixture.goals;
          const leagueInfo = fixture.league;

          const homeApiId = teams?.home?.id;
          const awayApiId = teams?.away?.id;
          const externalId = String(fixtureData?.id);
          const round = leagueInfo?.round ?? 'Regular';
          const phase = mapRoundToPhase(round);

          const homeTeamId = teamApiIdToLocalId.get(homeApiId);
          const awayTeamId = teamApiIdToLocalId.get(awayApiId);

          if (!homeTeamId || !awayTeamId) {
            result.skipped++;
            this.logger.warn(`Skipping fixture ${externalId}: teams not found (home:${homeApiId}, away:${awayApiId})`);
            continue;
          }

          const matchDate = fixtureData?.date ? new Date(fixtureData.date) : new Date();
          const apiStatus = fixtureData?.status?.short;
          const matchStatus = this.mapApiStatus(apiStatus);

          // All score info from API
          const homeScore = goals?.home ?? null;
          const awayScore = goals?.away ?? null;
          const venueName = fixtureData?.venue?.name ?? null;
          const venueCity = fixtureData?.venue?.city ?? null;
          const venueDisplay = [venueName, venueCity].filter(Boolean).join(', ') || null;
          const matchNumber = fixtureData?.id ? Number(String(fixtureData.id).slice(-4)) : null;

          // Check if exists
          const existing = await this.prisma.match.findUnique({ where: { externalId } });

          if (existing) {
            if (options.overwriteExisting) {
              await this.prisma.match.update({
                where: { externalId },
                data: {
                  homeScore, awayScore, status: matchStatus,
                  matchDate, round, tournamentId: tournament.id,
                  phase, venue: venueDisplay, matchNumber,
                  lastSyncAt: new Date(),
                },
              });
              result.fixturesUpdated++;
            } else {
              result.skipped++;
            }
          } else {
            await this.prisma.match.create({
              data: {
                homeTeamId, awayTeamId,
                homeScore, awayScore,
                phase, round,
                matchDate,
                status: matchStatus,
                externalId,
                tournamentId: tournament.id,
                venue: venueDisplay,
                matchNumber,
                lastSyncAt: new Date(),
              },
            });
            result.fixturesImported++;
          }
        } catch (err: any) {
          result.errors.push(`Fixture ${fixture?.fixture?.id}: ${err.message}`);
          this.logger.error(`Error importing fixture ${fixture?.fixture?.id}:`, err.message);
        }
      }

      this.logger.log(
        `Tournament import complete: ${result.fixturesImported} imported, ${result.fixturesUpdated} updated, ${result.teamsCreated} teams created`,
      );
    } catch (err: any) {
      this.logger.error('Tournament import failed:', err.message);
      result.errors.push(err.message);
    }

    return result;
  }

  /* ─── Search fixtures by date ───────────────────────────────────────── */

  async searchFixturesByDate(date: string) {
    const res = await this.apiClient.getFixturesByDate(date, 'America/Bogota');
    await this.rateLimiter.logRequest('/fixtures', { date }, 200, res.results ?? 0);

    return ((res.response ?? []) as any[]).map((f: any) => {
      const existing = null; // checked below in batch
      return {
        fixtureId: f.fixture?.id,
        date: f.fixture?.date,
        status: f.fixture?.status?.short,
        statusLong: f.fixture?.status?.long,
        homeTeam: { id: f.teams?.home?.id, name: f.teams?.home?.name, logo: f.teams?.home?.logo },
        awayTeam: { id: f.teams?.away?.id, name: f.teams?.away?.name, logo: f.teams?.away?.logo },
        homeScore: f.goals?.home ?? null,
        awayScore: f.goals?.away ?? null,
        league: { id: f.league?.id, name: f.league?.name, country: f.league?.country, logo: f.league?.logo, round: f.league?.round },
        venue: f.fixture?.venue?.name ?? null,
      };
    });
  }

  async searchFixturesByDateWithStatus(date: string) {
    const fixtures = await this.searchFixturesByDate(date);
    if (fixtures.length === 0) return fixtures;

    // Check which fixtures already exist in DB
    const fixtureIds = fixtures.map((f) => String(f.fixtureId));
    const existing = await this.prisma.match.findMany({
      where: { externalId: { in: fixtureIds } },
      select: { externalId: true },
    });
    const existingSet = new Set(existing.map((m) => m.externalId));

    return fixtures.map((f) => ({
      ...f,
      alreadyImported: existingSet.has(String(f.fixtureId)),
    }));
  }

  /* ─── Import specific fixture IDs ───────────────────────────────────── */

  async importFixtures(
    fixtureIds: number[],
    options: Pick<ImportOptions, 'createTeams' | 'overwriteExisting'>,
    tournamentName = 'Amistosos',
  ): Promise<ImportResult> {
    const result: ImportResult = {
      tournamentId: '',
      tournamentName,
      fixturesImported: 0,
      fixturesUpdated: 0,
      teamsCreated: 0,
      teamsLinked: 0,
      skipped: 0,
      errors: [],
      dryRun: false,
    };

    for (const fixtureId of fixtureIds) {
      try {
        const res = await this.apiClient.getFixtureById(fixtureId);
        await this.rateLimiter.logRequest('/fixtures', { id: fixtureId }, 200, res.results ?? 0);
        const f = (res.response as any[])?.[0];
        if (!f) { result.skipped++; continue; }

        const homeTeamData = f.teams?.home;
        const awayTeamData = f.teams?.away;
        const leagueInfo = f.league;

        // Resolve or create teams
        const homeTeamId = await this.resolveTeam(homeTeamData, options.createTeams, result);
        const awayTeamId = await this.resolveTeam(awayTeamData, options.createTeams, result);

        if (!homeTeamId || !awayTeamId) {
          result.skipped++;
          result.errors.push(`Fixture ${fixtureId}: equipos no encontrados o no creados`);
          continue;
        }

        const externalId = String(f.fixture?.id);
        const matchDate = f.fixture?.date ? new Date(f.fixture.date) : new Date();
        const round = leagueInfo?.round ?? 'Amistoso';
        const phase = mapRoundToPhase(round);
        const matchStatus = this.mapApiStatus(f.fixture?.status?.short);
        const homeScore = f.goals?.home ?? null;
        const awayScore = f.goals?.away ?? null;
        const venue = f.fixture?.venue?.name ?? null;

        const existing = await this.prisma.match.findUnique({ where: { externalId } });

        if (existing) {
          if (options.overwriteExisting) {
            await this.prisma.match.update({
              where: { externalId },
              data: { homeScore, awayScore, status: matchStatus, matchDate, round, phase, venue, lastSyncAt: new Date() },
            });
            result.fixturesUpdated++;
          } else {
            result.skipped++;
          }
        } else {
          await this.prisma.match.create({
            data: {
              homeTeamId, awayTeamId, homeScore, awayScore,
              phase, round, matchDate, status: matchStatus,
              externalId, venue, lastSyncAt: new Date(),
            },
          });
          result.fixturesImported++;
        }
      } catch (err: any) {
        result.errors.push(`Fixture ${fixtureId}: ${err.message}`);
      }
    }

    return result;
  }

  private async resolveTeam(
    teamData: any,
    createIfMissing: boolean,
    result: ImportResult,
  ): Promise<string | null> {
    if (!teamData?.id) return null;

    const existing = await this.prisma.team.findFirst({
      where: {
        OR: [
          { apiFootballTeamId: teamData.id },
          { name: { equals: teamData.name } },
        ],
      },
    });

    if (existing) {
      if (!existing.apiFootballTeamId) {
        await this.prisma.team.update({
          where: { id: existing.id },
          data: { apiFootballTeamId: teamData.id, flagUrl: teamData.logo ?? existing.flagUrl },
        });
        result.teamsLinked++;
      }
      return existing.id;
    }

    if (!createIfMissing) return null;

    const teamCode = (teamData.code ?? teamData.name.substring(0, 3)).toUpperCase().slice(0, 3);
    const safeName = await this.getUniqueTeamName(teamData.name);
    const safeCode = await this.getUniqueTeamCode(teamCode);

    const newTeam = await this.prisma.team.create({
      data: {
        name: safeName,
        code: safeCode,
        shortCode: teamCode.slice(0, 8),
        flagUrl: teamData.logo,
        apiFootballTeamId: teamData.id,
      },
    });
    result.teamsCreated++;
    return newTeam.id;
  }

  /* ─── Diagnose API-Football response ────────────────────────────────── */

  async diagnose(leagueId: number, season: number) {
    const leagueRes = await this.apiClient.getLeagues({ id: leagueId });
    await this.rateLimiter.logRequest('/leagues', { id: leagueId }, 200, 0);
    const leagueData = (leagueRes.response as any[])?.[0];

    const fixturesRes = await this.apiClient.getFixturesByLeague(leagueId, season);
    await this.rateLimiter.logRequest('/fixtures', { league: leagueId, season }, 200, fixturesRes.results ?? 0);

    const availableSeasons = ((leagueData?.seasons ?? []) as any[])
      .map((s: any) => ({ year: Number(s.year), current: Boolean(s.current) }))
      .sort((a: any, b: any) => b.year - a.year);

    return {
      league: leagueData
        ? { id: leagueData.league?.id, name: leagueData.league?.name, type: leagueData.league?.type, country: leagueData.country?.name }
        : null,
      requestedSeason: season,
      availableSeasons,
      fixturesCount: fixturesRes.results ?? 0,
      firstFixtures: ((fixturesRes.response ?? []) as any[]).slice(0, 3).map((f: any) => ({
        id: f.fixture?.id,
        date: f.fixture?.date,
        status: f.fixture?.status?.short,
        home: f.teams?.home?.name,
        away: f.teams?.away?.name,
        round: f.league?.round,
      })),
      errors: leagueRes.errors ?? fixturesRes.errors ?? [],
    };
  }

  /* ─── List imported tournaments ─────────────────────────────────────── */

  async listTournaments() {
    return this.prisma.tournament.findMany({
      orderBy: [{ active: 'desc' }, { season: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, country: true, season: true, logoUrl: true, type: true, active: true },
    });
  }

  /* ─── private helpers ────────────────────────────────────────────────── */

  private mapApiStatus(short: string): 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' {
    if (!short) return 'SCHEDULED';
    if (['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'].includes(short)) return 'LIVE';
    if (['FT', 'AET', 'PEN'].includes(short)) return 'FINISHED';
    if (['PST', 'SUSP', 'INT'].includes(short)) return 'POSTPONED';
    if (['CANC', 'ABD', 'AWD', 'WO'].includes(short)) return 'CANCELLED';
    return 'SCHEDULED';
  }

  private async getUniqueTeamName(name: string): Promise<string> {
    const existing = await this.prisma.team.findUnique({ where: { name } });
    if (!existing) return name;
    return `${name} (imp)`;
  }

  private async getUniqueTeamCode(code: string): Promise<string> {
    const base = code.slice(0, 3).toUpperCase();
    const existing = await this.prisma.team.findUnique({ where: { code: base } });
    if (!existing) return base;
    // Try adding a suffix
    for (let i = 1; i <= 9; i++) {
      const candidate = `${base.slice(0, 2)}${i}`;
      const exists = await this.prisma.team.findUnique({ where: { code: candidate } });
      if (!exists) return candidate;
    }
    return `${base}X`;
  }
}
