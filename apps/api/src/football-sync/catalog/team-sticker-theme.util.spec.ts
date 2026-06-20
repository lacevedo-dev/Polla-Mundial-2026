import { resolveCuratedTeamStickerTheme, resolveTeamStickerTheme } from '../catalog/team-sticker-theme.util';

describe('team-sticker-theme.util', () => {
  it('returns curated palette for Colombia', () => {
    const theme = resolveCuratedTeamStickerTheme('COL');
    expect(theme.primary).toBeTruthy();
    expect(theme.pillFrom).toBeTruthy();
  });

  it('prefers team DB overrides', () => {
    const theme = resolveTeamStickerTheme({
      code: 'COL',
      shortCode: 'COL',
      stickerPrimaryColor: '#111111',
      stickerSecondaryColor: '#222222',
      stickerAccentColor: '#333333',
      stickerPillFromColor: '#444444',
      stickerPillToColor: '#555555',
    });
    expect(theme.primary).toBe('#111111');
  });
});
