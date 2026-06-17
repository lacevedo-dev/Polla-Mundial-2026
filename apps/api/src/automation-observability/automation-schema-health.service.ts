import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AutomationStep, WhatsappGroupJobType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const REQUIRED_AUTOMATION_STEPS = ['GOAL_IMPACT'] as const;
const REQUIRED_WA_JOB_TYPES = ['GOAL_IMPACT'] as const;

@Injectable()
export class AutomationSchemaHealthService implements OnModuleInit {
  private readonly logger = new Logger(AutomationSchemaHealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.validatePrismaClientEnums();
    await this.validateDatabaseEnums();
  }

  private validatePrismaClientEnums(): void {
    for (const step of REQUIRED_AUTOMATION_STEPS) {
      const value = AutomationStep[step];
      if (value !== step) {
        this.logger.error(
          JSON.stringify({
            event: 'automation_schema_health',
            status: 'failed',
            reason: 'prisma_client_enum_missing',
            step,
            hint: 'Rebuild API con npx prisma generate (schema desactualizado en imagen Docker).',
          }),
        );
      }
    }

    for (const jobType of REQUIRED_WA_JOB_TYPES) {
      const value = WhatsappGroupJobType[jobType];
      if (value !== jobType) {
        this.logger.error(
          JSON.stringify({
            event: 'automation_schema_health',
            status: 'failed',
            reason: 'prisma_client_enum_missing',
            jobType,
            hint: 'Rebuild API con npx prisma generate (schema desactualizado en imagen Docker).',
          }),
        );
      }
    }
  }

  private async validateDatabaseEnums(): Promise<void> {
    try {
      const [stepColumn, jobTypeColumn] = await Promise.all([
        this.readColumnType('AutomationRun', 'step'),
        this.readColumnType('WhatsappGroupJob', 'type'),
      ]);

      for (const step of REQUIRED_AUTOMATION_STEPS) {
        if (!stepColumn.includes(step)) {
          this.logger.error(
            JSON.stringify({
              event: 'automation_schema_health',
              status: 'failed',
              reason: 'database_enum_missing',
              table: 'AutomationRun',
              column: 'step',
              missingValue: step,
              columnType: stepColumn,
              hint: 'Ejecutar en producción: cd apps/api && npx prisma migrate deploy (migración 20260617_automation_live_steps).',
            }),
          );
        }
      }

      for (const jobType of REQUIRED_WA_JOB_TYPES) {
        if (!jobTypeColumn.includes(jobType)) {
          this.logger.error(
            JSON.stringify({
              event: 'automation_schema_health',
              status: 'failed',
              reason: 'database_enum_missing',
              table: 'WhatsappGroupJob',
              column: 'type',
              missingValue: jobType,
              columnType: jobTypeColumn,
              hint: 'Ejecutar en producción: cd apps/api && npx prisma migrate deploy (migración 20260617_automation_live_steps).',
            }),
          );
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        JSON.stringify({
          event: 'automation_schema_health',
          status: 'skipped',
          reason: message,
        }),
      );
    }
  }

  private async readColumnType(table: string, field: string): Promise<string> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ Type: string }>>(
      `SHOW COLUMNS FROM \`${table}\` WHERE Field = ?`,
      field,
    );
    return rows[0]?.Type ?? '';
  }
}
