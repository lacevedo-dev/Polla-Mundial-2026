import { Injectable, Logger } from '@nestjs/common';
import { EmailJob, EmailJobPriority, EmailJobStatus, Prisma } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { EmailProviderConfig, EmailProviderConfigService } from './email-provider-config.service';
import { EmailBlacklistService } from './email-blacklist.service';
import { USER_STATUS } from '../users/user-status.constants';

export interface QueueEmailInput {
  type: Prisma.EmailJobCreateInput['type'];
  priority: Prisma.EmailJobCreateInput['priority'];
  required: boolean;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
  dedupeKey: string;
  matchId?: string;
  leagueId?: string;
  scheduledAt?: Date;
}

@Injectable()
export class EmailQueueService {
  private static readonly DEFAULT_DISPATCH_BATCH = 30;
  private static readonly MAX_REQUIRED_ATTEMPTS = 6;
  private static readonly MAX_OPTIONAL_ATTEMPTS = 1; // Fail-fast: no reintentar errores de destinatario
  private static readonly CONNECTION_BACKOFF_MS = 15 * 60_000;
  private readonly logger = new Logger(EmailQueueService.name);
  private readonly transporterCache = new Map<string, nodemailer.Transporter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerConfigService: EmailProviderConfigService,
    private readonly emailBlacklistService: EmailBlacklistService,
  ) {}

  async enqueueEmail(input: QueueEmailInput): Promise<boolean> {
    // Verificar si el email está en la lista negra
    const blacklistCheck = await this.emailBlacklistService.isBlacklisted(input.recipientEmail);
    if (blacklistCheck.isBlacklisted) {
      this.logger.debug(
        `Skipping blacklisted email: ${input.recipientEmail} (reason: ${blacklistCheck.reason})`,
      );
      return false;
    }

    try {
      await this.prisma.emailJob.create({
        data: this.toEmailJobCreateInput(input),
      });
      return true;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return false;
      }
      throw error;
    }
  }

  async enqueueEmails(inputs: QueueEmailInput[]): Promise<{ queued: number; skipped: number }> {
    if (inputs.length === 0) {
      return { queued: 0, skipped: 0 };
    }

    const filteredInputs: QueueEmailInput[] = [];
    let skippedBlacklist = 0;

    for (const input of inputs) {
      const blacklistCheck = await this.emailBlacklistService.isBlacklisted(input.recipientEmail);
      if (blacklistCheck.isBlacklisted) {
        skippedBlacklist++;
        continue;
      }
      filteredInputs.push(input);
    }

    if (filteredInputs.length === 0) {
      return { queued: 0, skipped: inputs.length };
    }

    const result = await this.prisma.emailJob.createMany({
      data: filteredInputs.map((input) => this.toEmailJobCreateInput(input)),
      skipDuplicates: true,
    });

    return {
      queued: result.count,
      skipped: skippedBlacklist + (filteredInputs.length - result.count),
    };
  }

  async enqueueForUser(userId: string, input: Omit<QueueEmailInput, 'recipientEmail'>): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: USER_STATUS.ACTIVE },
      select: { email: true, emailVerified: true },
    });

    if (!user?.email || !user.emailVerified) {
      return false;
    }

    return this.enqueueEmail({
      ...input,
      recipientEmail: user.email,
    });
  }

  async dispatchPendingJobs(limit = EmailQueueService.DEFAULT_DISPATCH_BATCH): Promise<{ processed: number; sent: number }> {
    const now = new Date();
    const candidates = await this.prisma.emailJob.findMany({
      where: {
        status: { in: [EmailJobStatus.PENDING, EmailJobStatus.DEFERRED] },
        availableAt: { lte: now },
      },
      take: limit * 5,
      orderBy: [{ availableAt: 'asc' }, { scheduledAt: 'asc' }],
    });

    const jobs = candidates
      .sort((left, right) => this.priorityRank(left.priority) - this.priorityRank(right.priority) || left.scheduledAt.getTime() - right.scheduledAt.getTime())
      .slice(0, limit);

    let processed = 0;
    let sent = 0;

    for (const job of jobs) {
      const claimed = await this.claimJob(job.id, now);
      if (!claimed) {
        continue;
      }

      processed += 1;
      sent += (await this.processClaimedJob(job, now)) ? 1 : 0;
    }

    return { processed, sent };
  }

  private toEmailJobCreateInput(input: QueueEmailInput): Prisma.EmailJobCreateManyInput {
    const scheduledAt = input.scheduledAt ?? new Date();

    return {
      type: input.type,
      priority: input.priority,
      required: input.required,
      recipientEmail: input.recipientEmail.trim().toLowerCase(),
      subject: input.subject,
      html: input.html,
      text: input.text,
      dedupeKey: input.dedupeKey,
      matchId: input.matchId,
      leagueId: input.leagueId,
      scheduledAt,
      availableAt: scheduledAt,
    };
  }

  async dispatchJobById(
    jobId: string,
    options?: { providerKey?: string },
  ): Promise<{ processed: boolean; sent: boolean; job: EmailJob }> {
    const now = new Date();
    const job = await this.prisma.emailJob.findUniqueOrThrow({
      where: { id: jobId },
    });

    const claimed = await this.claimJob(job.id, now);
    if (!claimed) {
      const currentJob = await this.prisma.emailJob.findUniqueOrThrow({
        where: { id: jobId },
      });
      return { processed: false, sent: currentJob.status === EmailJobStatus.SENT, job: currentJob };
    }

    const sent = await this.processClaimedJob(job, now, options?.providerKey);
    const currentJob = await this.prisma.emailJob.findUniqueOrThrow({
      where: { id: jobId },
    });

    return { processed: true, sent, job: currentJob };
  }

  private async claimJob(jobId: string, now: Date): Promise<boolean> {
    const claimed = await this.prisma.emailJob.updateMany({
      where: {
        id: jobId,
        status: { in: [EmailJobStatus.PENDING, EmailJobStatus.DEFERRED] },
        availableAt: { lte: now },
      },
      data: {
        status: EmailJobStatus.SENDING,
        lastAttemptAt: now,
        attemptCount: { increment: 1 },
      },
    });

    return claimed.count > 0;
  }

  private async processClaimedJob(job: EmailJob, now: Date, forcedProviderKey?: string): Promise<boolean> {
    const provider = await this.resolveProvider(job.priority, now, forcedProviderKey);
    if (!provider) {
      await this.deferJobForCapacity(job.id, job.required, now);
      return false;
    }

    try {
      const transporter = this.getTransporter(provider);
      await transporter.sendMail({
        from: formatFrom(provider),
        to: job.recipientEmail,
        subject: job.subject,
        html: job.html,
        text: job.text,
      });

      await this.recordProviderSuccess(provider.key, now);
      await this.prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: EmailJobStatus.SENT,
          providerKey: provider.key,
          sentAt: now,
          availableAt: now,
          lastError: null,
        },
      });
      return true;
    } catch (error) {
      await this.handleSendFailure(job.id, job.required, provider, now, error);
      return false;
    }
  }

  private async resolveProvider(
    priority: Prisma.EmailJobCreateInput['priority'],
    now: Date,
    forcedProviderKey?: string,
  ): Promise<EmailProviderConfig | null> {
    if (!forcedProviderKey) {
      return this.selectProvider(priority, now);
    }

    const providers = await this.providerConfigService.getProviders();
    return providers.find((provider) => provider.key === forcedProviderKey) ?? null;
  }

  private async selectProvider(priority: Prisma.EmailJobCreateInput['priority'], now: Date): Promise<EmailProviderConfig | null> {
    const providers = await this.providerConfigService.getProviders();
    if (providers.length === 0) {
      return null;
    }

    const quotaWindowStart = getQuotaWindowStart(now);
    const usages = await this.prisma.emailProviderUsage.findMany({
      where: {
        providerKey: { in: providers.map((provider) => provider.key) },
        quotaWindowStart,
      },
    });

    const usageByProvider = new Map(usages.map((usage) => [usage.providerKey, usage]));
    const eligible = providers
      .filter((provider) => this.canUseProvider(provider, priority, usageByProvider.get(provider.key), now))
      .sort((left, right) => {
        const leftUsage = usageByProvider.get(left.key)?.sentCount ?? 0;
        const rightUsage = usageByProvider.get(right.key)?.sentCount ?? 0;
        return leftUsage - rightUsage || left.key.localeCompare(right.key);
      });

    return eligible[0] ?? null;
  }

  private canUseProvider(
    provider: EmailProviderConfig,
    priority: Prisma.EmailJobCreateInput['priority'],
    usage: { sentCount: number; blockedUntil: Date | null } | undefined,
    now: Date,
  ): boolean {
    if ((provider.blockedUntil && provider.blockedUntil > now) || (usage?.blockedUntil && usage.blockedUntil > now)) {
      return false;
    }

    const sentCount = usage?.sentCount ?? 0;
    if (priority === EmailJobPriority.HIGH) {
      return sentCount < provider.dailyLimit;
    }

    return sentCount < provider.dailyLimit - provider.reservedHighPriority;
  }

  private async deferJobForCapacity(jobId: string, required: boolean, now: Date): Promise<void> {
    await this.prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: required ? EmailJobStatus.PENDING : EmailJobStatus.DEFERRED,
        availableAt: required ? new Date(now.getTime() + 15 * 60_000) : getNextQuotaWindowStart(now),
        lastError: required
          ? 'No SMTP provider is currently available for this required email job.'
          : 'Daily provider quota exhausted for optional email jobs.',
      },
    });
  }

  private async handleSendFailure(
    jobId: string,
    required: boolean,
    provider: EmailProviderConfig,
    now: Date,
    error: unknown,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const isRateLimited = this.isRateLimitError(message);
    const isTransientConnectionFailure = this.isTransientConnectionError(message);
    const isRecipientError = this.isRecipientError(message);

    // Si es error de destinatario (bounce, dirección inválida), registrar en blacklist
    if (isRecipientError) {
      const job = await this.prisma.emailJob.findUnique({
        where: { id: jobId },
        select: { recipientEmail: true },
      });
      if (job) {
        const blacklistResult = await this.emailBlacklistService.recordFailure(
          job.recipientEmail,
          message,
        );
        if (blacklistResult.blocked) {
          this.logger.warn(
            `Recipient ${job.recipientEmail} auto-blocked after bounce/invalid address`,
          );
        }
      }
    }

    if (isRateLimited) {
      await this.blockProvider(provider.key, now, message, 60 * 60_000);
    } else if (isTransientConnectionFailure) {
      await this.blockProvider(provider.key, now, message, EmailQueueService.CONNECTION_BACKOFF_MS);
    }

    const currentJob = await this.prisma.emailJob.findUnique({
      where: { id: jobId },
      select: { attemptCount: true },
    });
    const attempts = currentJob?.attemptCount ?? 1;
    const maxAttempts = required
      ? EmailQueueService.MAX_REQUIRED_ATTEMPTS
      : EmailQueueService.MAX_OPTIONAL_ATTEMPTS;
    // Errores de destinatario: no reintentar, marcar directo como fallido
    const shouldRetry = attempts < maxAttempts && !isRecipientError;
    const exhaustedStatus = isRecipientError
      ? EmailJobStatus.DROPPED
      : required
        ? EmailJobStatus.FAILED
        : EmailJobStatus.DROPPED;

    await this.prisma.emailJob.update({
      where: { id: jobId },
      data: {
        status: shouldRetry ? EmailJobStatus.DEFERRED : exhaustedStatus,
        availableAt: shouldRetry
          ? new Date(now.getTime() + this.computeBackoffMs(attempts, isRateLimited, isTransientConnectionFailure))
          : now,
        providerKey: provider.key,
        lastError: message,
      },
    });

    this.logger.error(`Email job ${jobId} failed via provider ${provider.key}: ${message}`);
  }

  private async recordProviderSuccess(providerKey: string, now: Date): Promise<void> {
    const quotaWindowStart = getQuotaWindowStart(now);

    await this.prisma.emailProviderUsage.upsert({
      where: {
        providerKey_quotaWindowStart: {
          providerKey,
          quotaWindowStart,
        },
      },
      create: {
        providerKey,
        quotaWindowStart,
        sentCount: 1,
        blockedUntil: null,
        lastError: null,
      },
      update: {
        sentCount: { increment: 1 },
        blockedUntil: null,
        lastError: null,
      },
    });

    await this.prisma.emailProviderAccount.updateMany({
      where: { key: providerKey, deletedAt: null },
      data: {
        blockedUntil: null,
        lastError: null,
        lastUsedAt: now,
      },
    });
  }

  private async blockProvider(providerKey: string, now: Date, message: string, durationMs: number): Promise<void> {
    const quotaWindowStart = getQuotaWindowStart(now);
    const blockedUntil = new Date(now.getTime() + durationMs);

    await this.prisma.emailProviderUsage.upsert({
      where: {
        providerKey_quotaWindowStart: {
          providerKey,
          quotaWindowStart,
        },
      },
      create: {
        providerKey,
        quotaWindowStart,
        sentCount: 0,
        blockedUntil,
        lastError: message,
      },
      update: {
        blockedUntil,
        lastError: message,
      },
    });

    await this.prisma.emailProviderAccount.updateMany({
      where: { key: providerKey, deletedAt: null },
      data: {
        blockedUntil,
        lastError: message,
      },
    });
  }

  private getTransporter(provider: EmailProviderConfig): nodemailer.Transporter {
    const cacheKey = `${provider.key}:${provider.cacheKey}`;
    const cached = this.transporterCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const transporter = nodemailer.createTransport({
      host: provider.host,
      port: provider.port,
      secure: provider.secure,
      auth: provider.user && provider.pass ? { user: provider.user, pass: provider.pass } : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    } as nodemailer.TransportOptions);

    this.transporterCache.set(cacheKey, transporter);
    return transporter;
  }

  private isRateLimitError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('451') || normalized.includes('rate limit') || normalized.includes('ratelimit');
  }

  private isTransientConnectionError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('greeting never received')
      || normalized.includes('connection timeout')
      || normalized.includes('etimedout')
      || normalized.includes('econnreset')
      || normalized.includes('socket closed unexpectedly')
      || normalized.includes('unable to establish tls')
      || normalized.includes('read econnreset');
  }

  private isRecipientError(message: string): boolean {
    const normalized = message.toLowerCase();
    return normalized.includes('invalid address')
      || normalized.includes('mailbox not found')
      || normalized.includes('user unknown')
      || normalized.includes('recipient rejected')
      || normalized.includes('address rejected')
      || normalized.includes('no such user')
      || normalized.includes('550 5.1.1')  // Mailbox not found
      || normalized.includes('550 5.7.1')  // Relay denied
      || normalized.includes('551 5.1.1')  // User unknown
      || normalized.includes('554 5.7.1'); // Relay access denied
  }

  private computeBackoffMs(attemptCount: number, rateLimited: boolean, transientConnectionFailure: boolean): number {
    if (rateLimited) {
      return 60 * 60_000;
    }

    if (transientConnectionFailure) {
      return EmailQueueService.CONNECTION_BACKOFF_MS;
    }

    return Math.min(15 * 60_000, Math.max(1, attemptCount) * 2 * 60_000);
  }

  private priorityRank(priority: Prisma.EmailJobCreateInput['priority']): number {
    switch (priority) {
      case EmailJobPriority.HIGH:
        return 0;
      case EmailJobPriority.MEDIUM:
        return 1;
      default:
        return 2;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}

function formatFrom(provider: EmailProviderConfig): string {
  return provider.fromName ? `${provider.fromName} <${provider.fromEmail}>` : provider.fromEmail;
}

function getQuotaWindowStart(date: Date): Date {
  const utc = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const bogota = new Date(date.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const offset = utc.getTime() - bogota.getTime();
  const start = new Date(date.getTime() - offset);
  start.setHours(0, 0, 0, 0);
  return new Date(start.getTime() + offset);
}

function getNextQuotaWindowStart(date: Date): Date {
  return new Date(getQuotaWindowStart(date).getTime() + 24 * 60 * 60_000);
}
