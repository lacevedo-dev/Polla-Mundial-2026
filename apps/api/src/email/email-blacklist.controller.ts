import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EmailBlacklistService } from './email-blacklist.service';
import { EmailBlacklistReason } from '@prisma/client';

@Controller('admin/email-blacklist')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
export class EmailBlacklistController {
  constructor(private readonly blacklistService: EmailBlacklistService) {}

  @Get()
  async listBlacklist(
    @Query('reason') reason?: EmailBlacklistReason,
    @Query('autoBlocked') autoBlocked?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      ...(reason ? { reason } : {}),
      ...(autoBlocked ? { autoBlocked: autoBlocked === 'true' } : {}),
      ...(limit ? { limit: parseInt(limit, 10) } : {}),
    };

    const entries = await this.blacklistService.listBlacklist(filters);
    return {
      count: entries.length,
      entries: entries.map(e => ({
        email: e.email,
        reason: e.reason,
        blockedAt: e.blockedAt,
        blockedBy: e.blockedBy,
        lastError: e.lastError,
        notes: e.notes,
        autoBlocked: e.autoBlocked,
        failureCount: e.failureCount,
      })),
    };
  }

  @Post()
  async addToBlacklist(
    @Body('email') email: string,
    @Body('reason') reason: EmailBlacklistReason,
    @Body('notes') notes?: string,
  ) {
    await this.blacklistService.addToBlacklist(email, reason, notes, false, 'admin');
    return { success: true, message: `Email ${email} added to blacklist` };
  }

  @Delete(':email')
  async removeFromBlacklist(@Param('email') email: string) {
    const removed = await this.blacklistService.removeFromBlacklist(email);
    return {
      success: removed,
      message: removed ? `Email ${email} removed from blacklist` : 'Email not found in blacklist',
    };
  }

  @Post('block-domain')
  async blockDomain(
    @Body('domain') domain: string,
    @Body('reason') reason: EmailBlacklistReason,
  ) {
    const count = await this.blacklistService.blockDomain(domain, reason, 'admin');
    return {
      success: true,
      message: `Blocked ${count} emails from domain ${domain}`,
      count,
    };
  }

  @Post('block-test-emails')
  async blockTestEmails() {
    const testDomains = ['polla-test.com', 'seed.local', 'prueba.com'];
    let totalBlocked = 0;

    for (const domain of testDomains) {
      const count = await this.blacklistService.blockDomain(
        domain,
        EmailBlacklistReason.INVALID_ADDRESS,
        'system',
      );
      totalBlocked += count;
    }

    return {
      success: true,
      message: `Blocked ${totalBlocked} test emails from ${testDomains.join(', ')}`,
      totalBlocked,
      domains: testDomains,
    };
  }
}
