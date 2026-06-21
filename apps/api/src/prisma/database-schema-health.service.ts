import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';

const REQUIRED_TABLES: Array<{ table: string; migrationHint: string }> = [
  {
    table: 'WhatsappPersonalLog',
    migrationHint: '20260620_whatsapp_personal_log',
  },
];

const REQUIRED_COLUMNS: Array<{ table: string; column: string; migrationHint: string }> = [
  {
    table: 'PlayerProfile',
    column: 'premiumStickerUrl',
    migrationHint: '20260620_player_premium_sticker_cache',
  },
];

@Injectable()
export class DatabaseSchemaHealthService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSchemaHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.validateSchema();
  }

  private async validateSchema(): Promise<void> {
    try {
      for (const { table, migrationHint } of REQUIRED_TABLES) {
        const exists = await this.tableExists(table);
        if (!exists) {
          this.logger.error(
            JSON.stringify({
              event: 'database_schema_health',
              status: 'failed',
              reason: 'table_missing',
              table,
              hint: `Redeploy API (entrypoint ejecuta migrate deploy) o manual: npx prisma migrate deploy (${migrationHint}).`,
            }),
          );
        }
      }

      for (const { table, column, migrationHint } of REQUIRED_COLUMNS) {
        const exists = await this.columnExists(table, column);
        if (!exists) {
          this.logger.error(
            JSON.stringify({
              event: 'database_schema_health',
              status: 'failed',
              reason: 'column_missing',
              table,
              column,
              hint: `npx prisma migrate deploy (${migrationHint}).`,
            }),
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        JSON.stringify({
          event: 'database_schema_health',
          status: 'skipped',
          reason: message,
        }),
      );
    }
  }

  private async tableExists(table: string): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ cnt: bigint | number }>>(
      `SELECT COUNT(*) AS cnt FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = ?`,
      table,
    );
    return Number(rows[0]?.cnt ?? 0) > 0;
  }

  private async columnExists(table: string, column: string): Promise<boolean> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ cnt: bigint | number }>>(
      `SELECT COUNT(*) AS cnt FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
      table,
      column,
    );
    return Number(rows[0]?.cnt ?? 0) > 0;
  }
}
