import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiFootballClient } from './api-football-client.service';
import { RateLimiterService } from './rate-limiter.service';
import { SyncPlanService } from './sync-plan.service';
import {
  parsePlayerProfileResponse,
  parseSquadPlayersResponse,
  type ParsedPlayerProfile,
} from './player-profile.util';
import { WORLD_CUP_TEAM_CATALOG } from '../catalog/world-cup-team-catalog';
import type { PlayerProfile } from '@prisma/client';

const PROFILE_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export type PlayerProfilePrewarmResult = {
  teamsProcessed: number;
  squadsFetched: number;
  playersUpserted: number;
  profilesEnriched: number;
  skippedNoBudget: number;
  errors: string[];
};

@Injectable()
export class PlayerProfileCacheService {
  private readonly logger = new Logger(PlayerProfileCacheService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiClient: ApiFootballClient,
    private readonly rateLimiter: RateLimiterService,
    private readonly syncPlan: SyncPlanService,
  ) {}

  async getCached(apiFootballPlayerId: number): Promise<PlayerProfile | null> {
    return this.prisma.playerProfile.findUnique({
      where: { apiFootballPlayerId },
    });
  }

  /**
   * Devuelve perfil cacheado o lo obtiene de /players/profiles.
   * En gol en vivo: 0 requests si ya está en DB (precarga de plantillas).
   */
  async ensureProfile(
    apiFootballPlayerId: number,
    options: {
      teamApiFootballId?: number | null;
      jerseyNumber?: number | null;
      allowApiFetch?: boolean;
    } = {},
  ): Promise<PlayerProfile | null> {
    const existing = await this.getCached(apiFootballPlayerId);
    const isFresh =
      existing?.profileFetchedAt != null &&
      Date.now() - existing.profileFetchedAt.getTime() < PROFILE_STALE_MS;

    if (existing && isFresh && existing.height && existing.photoUrl) {
      return existing;
    }

    if (options.allowApiFetch === false) {
      return existing;
    }

    if (!(await this.rateLimiter.canMakeRequest())) {
      this.logger.warn(
        `Player profile ${apiFootballPlayerId}: sin presupuesto API — usando cache parcial`,
      );
      return existing;
    }

    try {
      const response = await this.apiClient.getPlayerProfile(apiFootballPlayerId);
      await this.rateLimiter.logRequest(
        '/players/profiles',
        { player: apiFootballPlayerId, source: 'player-profile-cache' },
        200,
        undefined,
      );
      await this.syncPlan.incrementRequestsUsed(1);

      const parsed = parsePlayerProfileResponse(apiFootballPlayerId, response);
      if (!parsed) return existing;

      if (options.jerseyNumber != null && parsed.jerseyNumber == null) {
        parsed.jerseyNumber = options.jerseyNumber;
      }

      return this.upsertParsedProfile(parsed, {
        teamApiFootballId: options.teamApiFootballId ?? existing?.teamApiFootballId ?? null,
        profileFetchedAt: new Date(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Player profile fetch failed (${apiFootballPlayerId}): ${msg}`);
      return existing;
    }
  }

  async upsertParsedProfile(
    parsed: ParsedPlayerProfile,
    options: {
      teamApiFootballId?: number | null;
      profileFetchedAt?: Date | null;
    } = {},
  ): Promise<PlayerProfile> {
    return this.prisma.playerProfile.upsert({
      where: { apiFootballPlayerId: parsed.apiFootballPlayerId },
      create: {
        apiFootballPlayerId: parsed.apiFootballPlayerId,
        name: parsed.name,
        firstname: parsed.firstname,
        lastname: parsed.lastname,
        photoUrl: parsed.photoUrl,
        nationality: parsed.nationality,
        birthDate: parsed.birthDate,
        height: parsed.height,
        weight: parsed.weight,
        jerseyNumber: parsed.jerseyNumber,
        teamApiFootballId: options.teamApiFootballId ?? null,
        profileFetchedAt: options.profileFetchedAt ?? null,
      },
      update: {
        name: parsed.name,
        firstname: parsed.firstname ?? undefined,
        lastname: parsed.lastname ?? undefined,
        photoUrl: parsed.photoUrl ?? undefined,
        nationality: parsed.nationality ?? undefined,
        birthDate: parsed.birthDate ?? undefined,
        height: parsed.height ?? undefined,
        weight: parsed.weight ?? undefined,
        jerseyNumber: parsed.jerseyNumber ?? undefined,
        ...(options.teamApiFootballId != null
          ? { teamApiFootballId: options.teamApiFootballId }
          : {}),
        profileFetchedAt: options.profileFetchedAt ?? undefined,
      },
    });
  }

  /**
   * Precarga plantillas del catálogo WC: 1 request /players/squads por equipo.
   * Opcionalmente enriquece perfiles completos mientras haya presupuesto.
   */
  async prewarmWorldCupSquads(options: {
    season?: number;
    enrichProfiles?: boolean;
    maxProfileFetches?: number;
  } = {}): Promise<PlayerProfilePrewarmResult> {
    const season = options.season ?? 2026;
    const enrichProfiles = options.enrichProfiles ?? false;
    const maxProfileFetches = options.maxProfileFetches ?? 50;
    const result: PlayerProfilePrewarmResult = {
      teamsProcessed: 0,
      squadsFetched: 0,
      playersUpserted: 0,
      profilesEnriched: 0,
      skippedNoBudget: 0,
      errors: [],
    };

    for (const team of WORLD_CUP_TEAM_CATALOG) {
      result.teamsProcessed++;

      if (!(await this.rateLimiter.canMakeRequest())) {
        result.skippedNoBudget++;
        result.errors.push(`Sin presupuesto antes de squad ${team.shortCode}`);
        break;
      }

      try {
        const response = await this.apiClient.getPlayersSquads(team.apiFootballTeamId, season);
        await this.rateLimiter.logRequest(
          '/players/squads',
          { team: team.apiFootballTeamId, season, source: 'prewarm-squad' },
          200,
          undefined,
        );
        await this.syncPlan.incrementRequestsUsed(1);
        result.squadsFetched++;

        const squadPlayers = parseSquadPlayersResponse(response);
        for (const squadPlayer of squadPlayers) {
          await this.prisma.playerProfile.upsert({
            where: { apiFootballPlayerId: squadPlayer.apiFootballPlayerId },
            create: {
              apiFootballPlayerId: squadPlayer.apiFootballPlayerId,
              name: squadPlayer.name,
              photoUrl: squadPlayer.photoUrl,
              jerseyNumber: squadPlayer.jerseyNumber,
              nationality: squadPlayer.nationality,
              teamApiFootballId: team.apiFootballTeamId,
            },
            update: {
              name: squadPlayer.name,
              photoUrl: squadPlayer.photoUrl ?? undefined,
              jerseyNumber: squadPlayer.jerseyNumber ?? undefined,
              nationality: squadPlayer.nationality ?? undefined,
              teamApiFootballId: team.apiFootballTeamId,
            },
          });
          result.playersUpserted++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`${team.shortCode}: ${msg}`);
      }
    }

    if (enrichProfiles && result.profilesEnriched < maxProfileFetches) {
      const partialProfiles = await this.prisma.playerProfile.findMany({
        where: {
          OR: [{ profileFetchedAt: null }, { height: null }],
        },
        take: maxProfileFetches,
        orderBy: { updatedAt: 'asc' },
      });

      for (const row of partialProfiles) {
        if (result.profilesEnriched >= maxProfileFetches) break;
        if (!(await this.rateLimiter.canMakeRequest())) {
          result.skippedNoBudget++;
          break;
        }
        const enriched = await this.ensureProfile(row.apiFootballPlayerId, {
          teamApiFootballId: row.teamApiFootballId,
          jerseyNumber: row.jerseyNumber,
        });
        if (enriched?.profileFetchedAt) result.profilesEnriched++;
      }
    }

    this.logger.log(
      `Player prewarm: ${result.squadsFetched} squads, ${result.playersUpserted} players, ${result.profilesEnriched} profiles enriched`,
    );

    return result;
  }
}
