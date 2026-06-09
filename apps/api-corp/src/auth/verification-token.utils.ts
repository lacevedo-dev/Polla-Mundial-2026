import { randomBytes } from 'crypto';

export function generateVerificationToken(): string {
    return randomBytes(16).toString('hex');
}

export function isTokenExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
}

export function hasTokenExpired(expiresAt: Date): boolean {
    return isTokenExpired(expiresAt);
}

export function calculateTokenExpiration(hoursFromNow: number = 72): Date {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hoursFromNow);
    return expiresAt;
}
