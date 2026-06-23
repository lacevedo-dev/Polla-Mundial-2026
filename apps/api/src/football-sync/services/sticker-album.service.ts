import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { GoalStickerParams } from '../../whatsapp/whatsapp-image.service';
import { buildGoalStickerParams } from './goal-sticker-payload.util';
import { resolveTeamStickerTheme } from '../catalog/team-sticker-theme.util';
import { resolveGoalPlayerTeamIdFromStored } from '../../matches/match-events.util';

export type StickerAlbumPlayer = {
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

export type StickerAlbumTeam = {
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

export type StickerAlbumResponse = {
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

const DEMO_TEAMS: StickerAlbumTeam[] = [
  {
    teamId: null,
    name: 'Colombia',
    code: 'COL',
    flagUrl: 'https://media.api-sports.io/football/teams/8.png',
    apiFootballTeamId: 8,
    playerCount: 1,
    theme: resolveTeamStickerTheme({ code: 'COL', shortCode: 'COL' }),
    players: [
      {
        apiFootballPlayerId: 0,
        name: 'James Rodríguez',
        photoUrl: null,
        jerseyNumber: 10,
        birthDate: '12-7-1991',
        height: '1,80 m',
        weight: '77 kg',
        nationality: 'Colombia',
        isDemo: true,
      },
    ],
  },
  {
    teamId: null,
    name: 'España',
    code: 'ESP',
    flagUrl: 'https://media.api-sports.io/football/teams/9.png',
    apiFootballTeamId: 9,
    playerCount: 1,
    theme: resolveTeamStickerTheme({ code: 'ESP', shortCode: 'ESP' }),
    players: [
      {
        apiFootballPlayerId: 0,
        name: 'Mikel Merino',
        photoUrl: null,
        jerseyNumber: 23,
        birthDate: '22-6-1996',
        height: '1,89 m',
        weight: '83 kg',
        nationality: 'Spain',
        isDemo: true,
      },
    ],
  },
];

@Injectable()
export class StickerAlbumService {
  constructor(private readonly prisma: PrismaService) {}

  async getAlbum(): Promise<StickerAlbumResponse> {
    await this.reconcileOwnGoalProfileTeams();

    const [teams, profiles] = await Promise.all([
      this.prisma.team.findMany({
        where: { apiFootballTeamId: { not: null } },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          code: true,
          shortCode: true,
          flagUrl: true,
          apiFootballTeamId: true,
          stickerPrimaryColor: true,
          stickerSecondaryColor: true,
          stickerAccentColor: true,
          stickerPillFromColor: true,
          stickerPillToColor: true,
        },
      }),
      this.prisma.playerProfile.findMany({
        orderBy: [{ teamApiFootballId: 'asc' }, { jerseyNumber: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const profilesByTeamApiId = new Map<number, StickerAlbumPlayer[]>();
    for (const profile of profiles) {
      if (profile.teamApiFootballId == null) continue;
      const list = profilesByTeamApiId.get(profile.teamApiFootballId) ?? [];
      list.push({
        apiFootballPlayerId: profile.apiFootballPlayerId,
        name: profile.name,
        photoUrl: profile.photoUrl,
        jerseyNumber: profile.jerseyNumber,
        birthDate: profile.birthDate,
        height: profile.height,
        weight: profile.weight,
        nationality: profile.nationality,
      });
      profilesByTeamApiId.set(profile.teamApiFootballId, list);
    }

    const albumTeams: StickerAlbumTeam[] = teams.map((team) => {
      const theme = resolveTeamStickerTheme(team);
      const teamPlayers =
        team.apiFootballTeamId != null
          ? profilesByTeamApiId.get(team.apiFootballTeamId) ?? []
          : [];

      return {
        teamId: team.id,
        name: team.name,
        code: team.shortCode ?? team.code,
        flagUrl: team.flagUrl,
        apiFootballTeamId: team.apiFootballTeamId,
        playerCount: teamPlayers.length,
        theme: {
          primary: theme.primary,
          secondary: theme.secondary,
          accent: theme.accent,
          pillFrom: theme.pillFrom,
          pillTo: theme.pillTo,
        },
        players: teamPlayers,
      };
    });

    const orphanProfiles = profiles.filter((p) => {
      if (p.teamApiFootballId == null) return true;
      return !teams.some((t) => t.apiFootballTeamId === p.teamApiFootballId);
    });

    if (orphanProfiles.length > 0) {
      albumTeams.push({
        teamId: null,
        name: 'Sin selección asignada',
        code: '—',
        flagUrl: null,
        apiFootballTeamId: null,
        playerCount: orphanProfiles.length,
        theme: resolveTeamStickerTheme(null),
        players: orphanProfiles.map((profile) => ({
          apiFootballPlayerId: profile.apiFootballPlayerId,
          name: profile.name,
          photoUrl: profile.photoUrl,
          jerseyNumber: profile.jerseyNumber,
          birthDate: profile.birthDate,
          height: profile.height,
          weight: profile.weight,
          nationality: profile.nationality,
        })),
      });
    }

    const teamsWithPlayers = albumTeams.filter((t) => t.players.length > 0);
    const useDemos = profiles.length === 0;

    return {
      totalPlayers: profiles.length,
      totalTeams: useDemos ? DEMO_TEAMS.length : teamsWithPlayers.length,
      previewContext: {
        homeTeam: 'Colombia',
        awayTeam: 'Brasil',
        homeScore: 2,
        awayScore: 1,
        minute: 67,
        leagueName: 'Polla Mundialista 2026',
      },
      teams: useDemos ? DEMO_TEAMS : teamsWithPlayers,
    };
  }

  /** Corrige perfiles asignados al beneficiario del autogol en lugar del club del jugador. */
  private async reconcileOwnGoalProfileTeams(): Promise<void> {
    const ownGoals = await this.prisma.matchEvent.findMany({
      where: {
        type: 'GOAL',
        detail: 'Own Goal',
        playerExternalId: { not: null },
        teamId: { not: null },
      },
      select: {
        playerExternalId: true,
        teamId: true,
        match: {
          select: {
            homeTeamId: true,
            awayTeamId: true,
            homeTeam: { select: { apiFootballTeamId: true } },
            awayTeam: { select: { apiFootballTeamId: true } },
          },
        },
      },
    });

    for (const event of ownGoals) {
      const playerExternalId = event.playerExternalId;
      const match = event.match;
      if (playerExternalId == null || !match || !event.teamId) continue;

      const playerTeamId = resolveGoalPlayerTeamIdFromStored(
        { teamId: event.teamId, detail: 'Own Goal' },
        { homeTeamId: match.homeTeamId, awayTeamId: match.awayTeamId },
      );
      const playerTeamApiId =
        playerTeamId === match.homeTeamId
          ? match.homeTeam.apiFootballTeamId
          : playerTeamId === match.awayTeamId
            ? match.awayTeam.apiFootballTeamId
            : null;
      if (playerTeamApiId == null) continue;

      await this.prisma.playerProfile.updateMany({
        where: {
          apiFootballPlayerId: playerExternalId,
          NOT: { teamApiFootballId: playerTeamApiId },
        },
        data: { teamApiFootballId: playerTeamApiId },
      });
    }
  }

  async resolvePreviewPayload(
    playerApiId: number,
    teamCode?: string,
  ): Promise<GoalStickerParams> {
    const album = await this.getAlbum();
    const ctx = album.previewContext;

    if (playerApiId <= 0 && teamCode) {
      const demoTeam = DEMO_TEAMS.find(
        (t) => t.code.toUpperCase() === teamCode.toUpperCase(),
      );
      const demoPlayer = demoTeam?.players[0];
      if (demoTeam && demoPlayer) {
        return buildGoalStickerParams({
          playerName: demoPlayer.name,
          teamName: demoTeam.name,
          minute: ctx.minute,
          homeTeam: ctx.homeTeam,
          awayTeam: ctx.awayTeam,
          homeScore: ctx.homeScore,
          awayScore: ctx.awayScore,
          leagueName: ctx.leagueName,
          team: { code: demoTeam.code, shortCode: demoTeam.code },
          teamFlagUrl: demoTeam.flagUrl,
          profile: {
            ...demoPlayer,
            firstname: null,
            lastname: null,
            profileFetchedAt: null,
            teamApiFootballId: demoTeam.apiFootballTeamId,
            createdAt: new Date(),
            updatedAt: new Date(),
            id: 'demo',
          } as never,
        });
      }
    }

    const profile = await this.prisma.playerProfile.findUnique({
      where: { apiFootballPlayerId: playerApiId },
    });
    if (!profile) {
      throw new Error('Jugador no encontrado en caché');
    }

    const team = profile.teamApiFootballId
      ? await this.prisma.team.findFirst({
          where: { apiFootballTeamId: profile.teamApiFootballId },
        })
      : teamCode
        ? await this.prisma.team.findFirst({
            where: { OR: [{ code: teamCode }, { shortCode: teamCode }] },
          })
        : null;

    return buildGoalStickerParams({
      playerName: profile.name,
      teamName: team?.name ?? profile.nationality ?? 'Selección',
      minute: ctx.minute,
      homeTeam: ctx.homeTeam,
      awayTeam: ctx.awayTeam,
      homeScore: ctx.homeScore,
      awayScore: ctx.awayScore,
      leagueName: ctx.leagueName,
      team,
      teamFlagUrl: team?.flagUrl ?? null,
      profile,
    });
  }
}
