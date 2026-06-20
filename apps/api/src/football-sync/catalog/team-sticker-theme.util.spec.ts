import { resolveCuratedTeamStickerTheme, resolveTeamStickerTheme, resolveStickerCountryCode } from '../catalog/team-sticker-theme.util';

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

  it('uses Panini palette for Ivory Coast (IVO → CIV)', () => {
    const theme = resolveCuratedTeamStickerTheme('IVO');
    expect(theme.primary).toBe('#3ebdb4');
    expect(theme.secondary).toBe('#f77f00');
    expect(theme.accent).toBe('#009e60');
  });

  it('maps IVO alias to CIV country code', () => {
    expect(
      resolveStickerCountryCode({ shortCode: 'IVO', teamName: 'Ivory Coast' }),
    ).toBe('CIV');
  });
});
