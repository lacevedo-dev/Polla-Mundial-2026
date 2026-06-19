import {
  getDefaultChannelEnabled,
  resolveChannelOverride,
} from './automation-channel-defaults.util';

describe('automation-channel-defaults', () => {
  it('WA personal está OFF por defecto (opt-in)', () => {
    expect(getDefaultChannelEnabled('whatsapp')).toBe(false);
    expect(getDefaultChannelEnabled('push')).toBe(true);
    expect(getDefaultChannelEnabled('waGroup')).toBe(true);
  });

  it('WA personal solo activo con override explícito true', () => {
    expect(resolveChannelOverride('whatsapp', undefined)).toBe(false);
    expect(resolveChannelOverride('whatsapp', false)).toBe(false);
    expect(resolveChannelOverride('whatsapp', true)).toBe(true);
  });

  it('otros canales ON por defecto salvo override false', () => {
    expect(resolveChannelOverride('push', undefined)).toBe(true);
    expect(resolveChannelOverride('push', false)).toBe(false);
    expect(resolveChannelOverride('waGroup', undefined)).toBe(true);
  });
});
