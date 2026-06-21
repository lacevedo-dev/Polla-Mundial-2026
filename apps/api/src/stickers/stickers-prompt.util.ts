import type { GenerateStickerDto } from './dto/generate-sticker.dto';

export const STICKER_PROMPT_PLACEHOLDERS = [
  'playerName',
  'birthDate',
  'height',
  'weight',
  'countryCode',
  'countryName',
  'cardCode',
  'stickerNumber',
  'mainNumber',
  'digitLeft',
  'digitRight',
] as const;

export const DEFAULT_STICKER_PROMPT_TEMPLATE = `
Create a premium collectible football sticker card in portrait orientation.

Use the supplied player image as the identity reference.
Preserve the player's face, beard, skin tone, facial proportions, and general identity.
Transform the source photo into a polished high-end football trading card portrait.
The player must feel naturally integrated into the graphic design, not pasted on top.

STYLE:
- premium football sticker / collectible sports card
- high contrast, vivid color, clean composition
- cinematic sports lighting
- realistic portrait blended with graphic overlays
- strong teal/cyan rim glow around the player silhouette
- dynamic paint strokes, halftone dots, shards, splashes, diagonal lines, and textured brush effects
- elegant layered composition with depth
- modern football album sticker aesthetic

COMPOSITION:
- vertical portrait card, 1024x1536
- rounded white border around the full card
- teal/turquoise main background
- centered player bust/torso, large and dominant
- off-white textured central graphic area behind the player
- huge stylized background numerals: orange "{{digitLeft}}" on the left and green "{{digitRight}}" on the right
- top-right generic football tournament badge in white and teal with the word "FOOTBALL"
- do not use any official FIFA logo, Panini logo, club logo, or copyrighted tournament branding
- right side circular flag badge of {{countryName}}
- right side vertical stacked country letters: "{{countryCode}}"
- bottom large red rounded name panel
- bottom segmented footer with player code and sticker number

PLAYER TREATMENT:
- improve the source photo so it looks like a professional sports poster portrait
- avoid passport photo or ID photo feeling
- add subtle athletic posture and premium sports-card lighting while preserving identity
- white football jersey with green trim and subtle geometric fabric texture
- jersey number "{{mainNumber}}" clearly visible on the chest (large, readable, like official national team kit)
- use a generic {{countryName}}-inspired football crest, but do not copy any official logo exactly
- blend the lower body into brush strokes and paint textures
- add cyan rim light, soft shadow, glow, and graphic overlays around shoulders and torso
- make the player visually embedded into the artwork

TEXT TO RENDER EXACTLY:
Player name: "{{playerName}}"
Stats line: "{{birthDate}} • {{height}} • {{weight}}"
Left footer code: "{{cardCode}}"
Center footer number: "{{stickerNumber}}"
Right-side vertical letters: "{{countryCode}}"
Top-right badge text: "FOOTBALL"

DESIGN DETAILS:
- bottom main panel in vivid red with white bold uppercase text
- footer left capsule in red with white text "{{cardCode}}"
- center shield/badge in teal with white number "{{stickerNumber}}"
- footer right capsule in orange/red with halftone dot pattern
- dominant palette: teal, cyan, orange, green, white, and red
- crisp polished collectible-card aesthetic
- high detail, sharp finish, premium football sticker result
- original design inspired by collectible football stickers, not a direct copy of any real brand.
`.trim();

export function buildStickerPromptVariables(dto: GenerateStickerDto): Record<string, string> {
  const mainNumber = dto.mainNumber ?? '10';
  const jerseyDigits = mainNumber.padStart(2, '0').slice(-2);

  return {
    playerName: dto.playerName,
    birthDate: dto.birthDate,
    height: dto.height,
    weight: dto.weight,
    countryCode: dto.countryCode,
    countryName: dto.countryName,
    cardCode: dto.cardCode,
    stickerNumber: dto.stickerNumber,
    mainNumber,
    digitLeft: jerseyDigits[0] ?? '1',
    digitRight: jerseyDigits[1] ?? '0',
  };
}

export function applyStickerPromptTemplate(
  template: string,
  dto: GenerateStickerDto,
): string {
  const vars = buildStickerPromptVariables(dto);
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

export function buildPremiumStickerPrompt(
  dto: GenerateStickerDto,
  template?: string | null,
): string {
  const tpl = template?.trim() || DEFAULT_STICKER_PROMPT_TEMPLATE;
  return applyStickerPromptTemplate(tpl, dto);
}
