import type { GoalStickerParams } from '../../whatsapp/whatsapp-image.service';
import { resolveTeamStickerTheme, type TeamStickerSource } from '../catalog/team-sticker-theme.util';
import type { PlayerProfile } from '@prisma/client';

export type GoalStickerBuildInput = {
  playerName: string;
  teamName: string;
  minute: number | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  leagueName: string;
  assistName?: string | null;
  goalDetail?: string | null;
  team?: TeamStickerSource | null;
  teamFlagUrl?: string | null;
  profile?: PlayerProfile | null;
};

export function buildGoalStickerParams(input: GoalStickerBuildInput): GoalStickerParams {
  const theme = resolveTeamStickerTheme(input.team ?? {
    code: input.teamName,
    shortCode: null,
  });
  const countryCode =
    input.team?.shortCode ??
    input.team?.code ??
    input.profile?.nationality?.slice(0, 3).toUpperCase() ??
    null;

  return {
    playerName: input.profile?.name ?? input.playerName,
    teamName: input.teamName,
    minute: input.minute,
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    leagueName: input.leagueName,
    assistName: input.assistName,
    goalDetail: input.goalDetail,
    photoUrl: input.profile?.photoUrl ?? null,
    nationality: input.profile?.nationality ?? null,
    jerseyNumber: input.profile?.jerseyNumber ?? null,
    birthDate: input.profile?.birthDate ?? null,
    height: input.profile?.height ?? null,
    weight: input.profile?.weight ?? null,
    countryCode,
    teamFlagUrl: input.teamFlagUrl ?? null,
    themePrimary: theme.primary,
    themeSecondary: theme.secondary,
    themeAccent: theme.accent,
    themePillFrom: theme.pillFrom,
    themePillTo: theme.pillTo,
  };
}

export type EnrichedMatchEventProfile = {
  photoUrl: string | null;
  jerseyNumber: number | null;
  birthDate: string | null;
  height: string | null;
  weight: string | null;
  nationality: string | null;
};

export function mapPlayerProfileToEventSnippet(
  profile: PlayerProfile | null | undefined,
): EnrichedMatchEventProfile | null {
  if (!profile) return null;
  return {
    photoUrl: profile.photoUrl,
    jerseyNumber: profile.jerseyNumber,
    birthDate: profile.birthDate,
    height: profile.height,
    weight: profile.weight,
    nationality: profile.nationality,
  };
}
