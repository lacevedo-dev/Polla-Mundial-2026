import { randomBytes } from 'crypto';

/**
 * Generates a cryptographically secure random verification token (UUID format)
 * @returns A 32-character random string
 */
export function generateVerificationToken(): string {
    return randomBytes(16).toString('hex');
}

/**
 * Checks if a token has expired based on expiration timestamp
 * @param expiresAt DateTime of token expiration
 * @returns true if token has expired, false otherwise
 */
export function isTokenExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
}

/**
 * Checks if a verification token has expired
 * @param expiresAt DateTime of token expiration
 * @returns true if token has expired, false otherwise
 */
export function hasTokenExpired(expiresAt: Date): boolean {
    return isTokenExpired(expiresAt);
}

/**
 * Calculates the expiration time for a verification token
 * Default: 72 hours from now (259,200 seconds)
 * @param hoursFromNow Number of hours until expiration (default: 72)
 * @returns DateTime of expiration
 */
export function calculateTokenExpiration(hoursFromNow: number = 72): Date {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + hoursFromNow);
    return expiresAt;
}
