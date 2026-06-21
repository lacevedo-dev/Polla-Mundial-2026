import type { GenerateStickerDto } from './dto/generate-sticker.dto';

export const STICKER_PROMPT_PLACEHOLDERS = [
  'PLAYER_NAME',
  'BIRTH_DATE',
  'HEIGHT',
  'WEIGHT',
  'COUNTRY_CODE',
  'COUNTRY_NAME',
  'PLAYER_NUMBER',
  'TEAM_KIT_DESCRIPTION',
  'REFERENCE_IMAGES',
] as const;

export type StickerPromptReferenceContext = {
  globalReferences: Array<{
    label: string;
    promptHint: string;
    attached: boolean;
    source?: string;
  }>;
  teamReference: {
    label: string;
    attached: boolean;
    source?: string;
  };
  teamKitDescription: string;
};

export const DEFAULT_STICKER_PROMPT_TEMPLATE = `
Create a premium collectible football sticker card in portrait orientation, highly consistent with the provided reference layout.

REFERENCE USAGE:
{{REFERENCE_IMAGES}}

MAIN GOAL:
Generate a football sticker that strongly matches the established series design, keeping the same visual system, same proportions, same structure, and same layout across all players. The only main changing elements should be the player identity, the player name, the stats, the national team uniform, the country, and the player number.

STYLE:
- premium football sticker card
- polished collectible-card aesthetic
- clean, sharp, vivid, high contrast
- modern football album style
- dynamic but organized composition
- visually rich but consistent
- slightly stylized realism
- professional sports-poster look
- crisp typography
- bright colors
- elegant textures and subtle halftone details

CARD STRUCTURE:
- vertical sticker format
- rounded white outer border
- turquoise / teal background
- very large background number "26" behind the player, with the "2" in orange on the left and the "6" in green on the right
- the "26" must be large, bold, integrated into the background, and slightly faded / blended / textured, so it feels embedded and not flat
- player centered and dominant in the composition
- top-right 2026 tournament logo must match the tournament logo reference when provided in REFERENCE USAGE
- right-side circular country flag
- right-side vertical country code letters
- bottom large red rounded name panel
- lower red footer strip
- central shield/tab at bottom containing the player's number
- bottom yellow strip containing the website
- bottom-right circular badge for "POLLA MUNDIALISTA 2026"

PLAYER TREATMENT:
- the player must not look like a pasted ID photo
- transform the source into a premium sports portrait
- preserve identity faithfully
- {{TEAM_KIT_DESCRIPTION}}
- the jersey must clearly show the player number "{{PLAYER_NUMBER}}" on the chest
- the player should be shown from chest to mid torso
- realistic football-shirt fabric texture
- subtle lighting glow around the player edges
- soft integration between player and background
- clean cutout with premium sports-card finish

LAYOUT DETAILS:
- top-right logo fixed and consistent
- large faded background 26
- red lower name panel with white uppercase text
- smaller white stats line below the name
- bottom center shield must contain the player number "{{PLAYER_NUMBER}}"
- right-side vertical country code must read "{{COUNTRY_CODE}}"
- circular flag badge must match "{{COUNTRY_NAME}}"
- bottom yellow strip must include the exact text: "www.tupollamundial.com"
- bottom-right circular badge must read "POLLA MUNDIALISTA 2026"
- the circular badge should be yellow and red, inspired by classic collectible sticker branding, with a distinctive central monogram "PM"
- keep badge placement and style consistent across the whole series

TEXT TO RENDER EXACTLY:
Player name: "{{PLAYER_NAME}}"
Stats line: "{{BIRTH_DATE}} | {{HEIGHT}} | {{WEIGHT}}"
Country code: "{{COUNTRY_CODE}}"
Website: "www.tupollamundial.com"
Circular badge text: "POLLA MUNDIALISTA 2026"
Bottom shield number: "{{PLAYER_NUMBER}}"
Jersey number: "{{PLAYER_NUMBER}}"
Top-right logo text: "FIFA"

IMPORTANT CONSISTENCY RULES:
- keep the same layout proportions in every generation
- keep the same top-right logo design in every generation
- keep the same circular badge design in every generation
- keep the same border thickness in every generation
- keep the same placement of the name box, stats line, website strip, flag, and country code
- keep the same color language and design hierarchy
- keep the same visual identity across the full sticker collection

DO NOT:
- do not invent a different top-right logo
- do not change the tournament logo structure
- do not replace the large faded 26 with other shapes
- do not change the position of the nameplate
- do not create random extra logos
- do not add unnecessary text
- do not use a different country code than "{{COUNTRY_CODE}}"
- do not use a different player number than "{{PLAYER_NUMBER}}"
- do not make the player look like a passport photo
- do not distort the face
- do not create multiple players
- do not make the sticker look like a different card series

FINAL RESULT:
A highly consistent football collectible sticker that matches the reference series very closely, with the same general layout and branding structure, but customized for the specific player.

This image is part of a fixed sticker collection series.
Maintain the same visual template, same composition logic, same logo treatment, same footer treatment, same spacing, and same branding placement as the series master reference.
Variation should be minimal and limited only to the player identity, player text, country flag, and jersey details.
`.trim();

function normalizeHeight(height: string): string {
  const trimmed = height.trim();
  if (!trimmed) return trimmed;
  if (/\s+m$/i.test(trimmed)) return trimmed;
  if (/m$/i.test(trimmed)) {
    return trimmed.replace(/m$/i, ' m');
  }
  return trimmed;
}

export function resolvePlayerNumber(dto: GenerateStickerDto): string {
  if (dto.mainNumber?.trim()) return dto.mainNumber.trim();
  return '';
}

export function buildReferenceImagesBlock(
  dto: GenerateStickerDto,
  ctx: StickerPromptReferenceContext,
): string {
  const lines = [
    '- Image A (attached): player identity reference for {{PLAYER_NAME}} — preserve face, skin tone, hairstyle, beard and recognizability.',
  ];

  for (const ref of ctx.globalReferences) {
    if (ref.attached) {
      lines.push(
        `- ${ref.label} (attached, ${ref.source ?? 'upload'}): ${ref.promptHint || 'Use this reference exactly as described.'}`,
      );
    } else {
      lines.push(
        `- ${ref.label}: not attached — ${ref.promptHint || 'Follow the layout rules in this prompt instead.'}`,
      );
    }
  }

  if (ctx.teamReference.attached) {
    lines.push(
      `- ${ctx.teamReference.label} (attached, ${ctx.teamReference.source ?? 'upload'}): {{COUNTRY_CODE}} / {{COUNTRY_NAME}} team uniform or country sticker — match kit colors, trim, crest and fabric.`,
    );
  } else {
    lines.push(
      `- ${ctx.teamReference.label}: not attached for {{COUNTRY_CODE}} — infer national team kit from {{TEAM_KIT_DESCRIPTION}} and the series master reference.`,
    );
  }

  const simpleVars: Record<string, string> = {
    PLAYER_NAME: dto.playerName.trim().toUpperCase(),
    COUNTRY_CODE: dto.countryCode.trim().toUpperCase().slice(0, 3),
    COUNTRY_NAME: dto.countryName,
    TEAM_KIT_DESCRIPTION: ctx.teamKitDescription,
  };

  return lines.join('\n').replace(/\{\{(\w+)\}\}/g, (_, key: string) => simpleVars[key] ?? '');
}

export function buildStickerPromptVariables(
  dto: GenerateStickerDto,
  referenceContext?: StickerPromptReferenceContext,
): Record<string, string> {
  const playerNumber = resolvePlayerNumber(dto);
  const height = normalizeHeight(dto.height);
  const refCtx: StickerPromptReferenceContext = referenceContext ?? {
    globalReferences: [],
    teamReference: {
      label: 'Uniforme selección',
      attached: false,
    },
    teamKitDescription:
      'Official national team kit for {{COUNTRY_NAME}}. Stay consistent with the series master reference.',
  };

  const referenceImages = buildReferenceImagesBlock(dto, refCtx);

  return {
    PLAYER_NAME: dto.playerName.trim().toUpperCase(),
    BIRTH_DATE: dto.birthDate,
    HEIGHT: height,
    WEIGHT: dto.weight,
    COUNTRY_CODE: dto.countryCode.trim().toUpperCase().slice(0, 3),
    COUNTRY_NAME: dto.countryName,
    PLAYER_NUMBER: playerNumber,
    TEAM_KIT_DESCRIPTION: refCtx.teamKitDescription,
    REFERENCE_IMAGES: referenceImages,
    // Compatibilidad con plantillas antiguas en BD
    playerName: dto.playerName.trim().toUpperCase(),
    birthDate: dto.birthDate,
    height,
    weight: dto.weight,
    countryCode: dto.countryCode.trim().toUpperCase().slice(0, 3),
    countryName: dto.countryName,
    mainNumber: playerNumber,
    cardCode: dto.cardCode,
    stickerNumber: dto.stickerNumber,
    digitLeft: '2',
    digitRight: '6',
  };
}

export function applyStickerPromptTemplate(
  template: string,
  dto: GenerateStickerDto,
  referenceContext?: StickerPromptReferenceContext,
): string {
  const vars = buildStickerPromptVariables(dto, referenceContext);
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export function buildPremiumStickerPrompt(
  dto: GenerateStickerDto,
  template?: string | null,
  referenceContext?: StickerPromptReferenceContext,
): string {
  const tpl = template?.trim() || DEFAULT_STICKER_PROMPT_TEMPLATE;
  return applyStickerPromptTemplate(tpl, dto, referenceContext);
}
