import { describe, expect, it } from 'vitest';
import { getInitials, resolveUserAvatarSrc } from './UserAvatar';

describe('getInitials', () => {
    it('returns first and last initial for full names', () => {
        expect(getInitials('Luis Angel Acevedo')).toBe('LA');
    });

    it('returns up to two chars for a single name', () => {
        expect(getInitials('Juan')).toBe('JU');
    });

    it('returns question mark for empty names', () => {
        expect(getInitials('   ')).toBe('?');
    });
});

describe('resolveUserAvatarSrc', () => {
    it('ignores ui-avatars fallback URLs', () => {
        expect(resolveUserAvatarSrc('https://ui-avatars.com/api/?name=Juan')).toBeUndefined();
    });

    it('returns undefined for empty values', () => {
        expect(resolveUserAvatarSrc('')).toBeUndefined();
        expect(resolveUserAvatarSrc(null)).toBeUndefined();
    });
});
