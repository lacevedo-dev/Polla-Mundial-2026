import { Injectable, Logger } from '@nestjs/common';
import { EmailBlacklistReason } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface BlacklistCheckResult {
  isBlacklisted: boolean;
  reason?: EmailBlacklistReason;
  blockedAt?: Date;
  notes?: string;
}

@Injectable()
export class EmailBlacklistService {
  private static readonly AUTO_BLOCK_THRESHOLD = 3;
  private static readonly BOUNCE_PATTERNS = [
    /invalid.*address/i,
    /mailbox.*not.*found/i,
    /user.*unknown/i,
    /recipient.*rejected/i,
    /address.*rejected/i,
    /no.*such.*user/i,
    /550.*5\.1\.1/i, // Mailbox not found
    /550.*5\.7\.1/i, // Relay denied
    /551.*5\.1\.1/i, // User unknown
    /554.*5\.7\.1/i, // Relay access denied
  ];

  private static readonly TEST_DOMAINS = [
    'testpolla.local',
    'test.com',
    'prueba.com',
    'seed.local',
    'polla-test.com',
    'example.com',
    'testuser',
  ];

  private static readonly SPAM_PATTERNS = [
    /spam.*complaint/i,
    /abuse.*complaint/i,
    /unsubscribe/i,
  ];

  private readonly logger = new Logger(EmailBlacklistService.name);
  private blacklistCache = new Map<string, BlacklistCheckResult>();
  private cacheExpiry = Date.now();
  private static readonly CACHE_TTL_MS = 60_000; // 1 minuto

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica si un email está en la lista negra
   */
  async isBlacklisted(email: string): Promise<BlacklistCheckResult> {
    const normalized = this.normalizeEmail(email);
    const now = Date.now();

    // Check test domains proactively
    const isTestDomain = EmailBlacklistService.TEST_DOMAINS.some(
      (domain) => normalized.endsWith(`@${domain}`) || normalized.includes(`.${domain}`),
    );
    if (isTestDomain) {
      return {
        isBlacklisted: true,
        reason: EmailBlacklistReason.INVALID_ADDRESS,
        notes: 'Test domain detected',
      };
    }

    // Check cache
    if (now - this.cacheExpiry < EmailBlacklistService.CACHE_TTL_MS) {
      const cached = this.blacklistCache.get(normalized);
      if (cached) return cached;
    }

    // Check database
    const entry = await this.prisma.emailBlacklist.findUnique({
      where: { email: normalized },
      select: {
        reason: true,
        blockedAt: true,
        notes: true,
      },
    });

    const result: BlacklistCheckResult = entry
      ? {
          isBlacklisted: true,
          reason: entry.reason,
          blockedAt: entry.blockedAt,
          notes: entry.notes ?? undefined,
        }
      : { isBlacklisted: false };

    this.blacklistCache.set(normalized, result);
    return result;
  }

  /**
   * Registra un fallo de envío y bloquea automáticamente si supera el umbral
   */
  async recordFailure(
    email: string,
    error: string,
  ): Promise<{ blocked: boolean; reason?: EmailBlacklistReason }> {
    const normalized = this.normalizeEmail(email);
    const reason = this.detectFailureReason(error);

    // Si es bounce o dirección inválida, bloquear inmediatamente
    if (reason === EmailBlacklistReason.BOUNCE || reason === EmailBlacklistReason.INVALID_ADDRESS) {
      await this.addToBlacklist(normalized, reason, error, true);
      this.logger.warn(`Email ${normalized} auto-blocked: ${reason}`);
      return { blocked: true, reason };
    }

    // Para otros errores, incrementar contador
    const existing = await this.prisma.emailBlacklist.findUnique({
      where: { email: normalized },
    });

    if (existing) {
      const updated = await this.prisma.emailBlacklist.update({
        where: { email: normalized },
        data: {
          failureCount: { increment: 1 },
          lastFailure: new Date(),
          lastError: error,
        },
      });

      if (updated.failureCount >= EmailBlacklistService.AUTO_BLOCK_THRESHOLD) {
        this.logger.warn(
          `Email ${normalized} auto-blocked after ${updated.failureCount} failures`,
        );
        return { blocked: true, reason: EmailBlacklistReason.REPEATED_FAILURE };
      }

      return { blocked: false };
    }

    // Primera falla: crear registro
    await this.prisma.emailBlacklist.create({
      data: {
        email: normalized,
        reason: EmailBlacklistReason.REPEATED_FAILURE,
        failureCount: 1,
        lastFailure: new Date(),
        lastError: error,
        autoBlocked: false,
      },
    });

    return { blocked: false };
  }

  /**
   * Agrega un email a la lista negra manualmente
   */
  async addToBlacklist(
    email: string,
    reason: EmailBlacklistReason,
    notes?: string,
    autoBlocked = false,
    blockedBy?: string,
  ): Promise<void> {
    const normalized = this.normalizeEmail(email);

    await this.prisma.emailBlacklist.upsert({
      where: { email: normalized },
      create: {
        email: normalized,
        reason,
        notes,
        autoBlocked,
        blockedBy,
      },
      update: {
        reason,
        notes,
        blockedAt: new Date(),
        blockedBy,
      },
    });

    this.invalidateCache();
  }

  /**
   * Remueve un email de la lista negra
   */
  async removeFromBlacklist(email: string): Promise<boolean> {
    const normalized = this.normalizeEmail(email);
    const deleted = await this.prisma.emailBlacklist.deleteMany({
      where: { email: normalized },
    });

    if (deleted.count > 0) {
      this.invalidateCache();
      this.logger.log(`Email ${normalized} removed from blacklist`);
      return true;
    }

    return false;
  }

  /**
   * Obtiene la lista completa de emails bloqueados
   */
  async listBlacklist(filters?: {
    reason?: EmailBlacklistReason;
    autoBlocked?: boolean;
    limit?: number;
  }) {
    return this.prisma.emailBlacklist.findMany({
      where: {
        ...(filters?.reason ? { reason: filters.reason } : {}),
        ...(typeof filters?.autoBlocked === 'boolean'
          ? { autoBlocked: filters.autoBlocked }
          : {}),
      },
      orderBy: { blockedAt: 'desc' },
      take: filters?.limit ?? 100,
    });
  }

  /**
   * Bloquea todos los emails de un dominio
   */
  async blockDomain(
    domain: string,
    reason: EmailBlacklistReason,
    blockedBy?: string,
  ): Promise<number> {
    const pattern = `%@${domain}`;
    const emails = await this.prisma.$queryRaw<Array<{ email: string }>>`
      SELECT DISTINCT recipientEmail as email
      FROM EmailJob
      WHERE recipientEmail LIKE ${pattern}
        AND status IN ('FAILED', 'DROPPED')
    `;

    let blocked = 0;
    for (const { email } of emails) {
      await this.addToBlacklist(email, reason, `Blocked domain: ${domain}`, false, blockedBy);
      blocked++;
    }

    this.logger.log(`Blocked ${blocked} emails from domain ${domain}`);
    return blocked;
  }

  /**
   * Detecta el motivo del fallo basándose en el mensaje de error
   */
  private detectFailureReason(error: string): EmailBlacklistReason {
    for (const pattern of EmailBlacklistService.BOUNCE_PATTERNS) {
      if (pattern.test(error)) {
        return EmailBlacklistReason.BOUNCE;
      }
    }

    for (const pattern of EmailBlacklistService.SPAM_PATTERNS) {
      if (pattern.test(error)) {
        return EmailBlacklistReason.SPAM_COMPLAINT;
      }
    }

    return EmailBlacklistReason.REPEATED_FAILURE;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private invalidateCache(): void {
    this.blacklistCache.clear();
    this.cacheExpiry = 0;
  }
}
