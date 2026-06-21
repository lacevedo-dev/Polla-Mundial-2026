import type { PlayerProfile } from '@prisma/client';
import {
  resolveStickerCountryCode,
  type TeamStickerSource,
} from '../football-sync/catalog/team-sticker-theme.util';
import type { GenerateStickerDto } from './dto/generate-sticker.dto';

export type BuildStickerDtoInput = {
  profile: PlayerProfile;
  team?: TeamStickerSource | null;
  teamName: string;
  minute?: number | null;
};

function buildPremiumFooterCode(countryCode: string, jerseyNumber: number): string {
  const jersey = String(jerseyNumber).padStart(3, '0').slice(-3);
  return `${countryCode} ${jersey}`.trim().toUpperCase();
}

function buildPremiumCatalogNumber(jerseyNumber: number, minute: number | null): string {
  const jersey = String(jerseyNumber).padStart(2, '0');
  const min = String(minute ?? 0).padStart(1, '0');
  return `${jersey}${min}`.slice(0, 3);
}

export function buildGenerateStickerDto(input: BuildStickerDtoInput): GenerateStickerDto | null {
  const { profile, team, teamName } = input;
  if (!profile.photoUrl?.trim()) return null;

  const countryCode = resolveStickerCountryCode({
    code: team?.code,
    shortCode: team?.shortCode,
    teamName,
    nationality: profile.nationality,
  });

  const jersey = profile.jerseyNumber ?? 10;
  const minute = input.minute ?? null;

  return {
    playerApiFootballId: profile.apiFootballPlayerId,
    photoUrl: profile.photoUrl,
    playerName: profile.name.trim().toUpperCase(),
    birthDate: profile.birthDate ?? '—',
    height: profile.height ?? '—',
    weight: profile.weight ?? '—',
    countryCode,
    countryName: teamName,
    cardCode: buildPremiumFooterCode(countryCode, jersey),
    stickerNumber: buildPremiumCatalogNumber(jersey, minute),
    mainNumber: String(jersey),
  };
}
