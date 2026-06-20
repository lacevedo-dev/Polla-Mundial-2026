import type { GenerateStickerDto } from './dto/generate-sticker.dto';

export function buildPremiumStickerPrompt(dto: GenerateStickerDto): string {
  const {
    playerName,
    birthDate,
    height,
    weight,
    countryCode,
    countryName,
    cardCode,
    stickerNumber,
    mainNumber = '10',
  } = dto;

  const jerseyDigits = mainNumber.padStart(2, '0').slice(-2);
  const digitLeft = jerseyDigits[0] ?? '1';
  const digitRight = jerseyDigits[1] ?? '0';

  return `
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
- huge stylized background numerals: orange "${digitLeft}" on the left and green "${digitRight}" on the right
- top-right generic football tournament badge in white and teal with the word "FOOTBALL"
- do not use any official FIFA logo, Panini logo, club logo, or copyrighted tournament branding
- right side circular flag badge of ${countryName}
- right side vertical stacked country letters: "${countryCode}"
- bottom large red rounded name panel
- bottom segmented footer with player code and sticker number

PLAYER TREATMENT:
- improve the source photo so it looks like a professional sports poster portrait
- avoid passport photo or ID photo feeling
- add subtle athletic posture and premium sports-card lighting while preserving identity
- white football jersey with green trim and subtle geometric fabric texture
- jersey number "${mainNumber}" on chest
- use a generic ${countryName}-inspired football crest, but do not copy any official logo exactly
- blend the lower body into brush strokes and paint textures
- add cyan rim light, soft shadow, glow, and graphic overlays around shoulders and torso
- make the player visually embedded into the artwork

TEXT TO RENDER EXACTLY:
Player name: "${playerName}"
Stats line: "${birthDate} • ${height} • ${weight}"
Left footer code: "${cardCode}"
Center footer number: "${stickerNumber}"
Right-side vertical letters: "${countryCode}"
Top-right badge text: "FOOTBALL"

DESIGN DETAILS:
- bottom main panel in vivid red with white bold uppercase text
- footer left capsule in red with white text "${cardCode}"
- center shield/badge in teal with white number "${stickerNumber}"
- footer right capsule in orange/red with halftone dot pattern
- dominant palette: teal, cyan, orange, green, white, and red
- crisp polished collectible-card aesthetic
- high detail, sharp finish, premium football sticker result
- original design inspired by collectible football stickers, not a direct copy of any real brand.
`.trim();
}
