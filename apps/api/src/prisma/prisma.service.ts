import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { createPool } from 'mariadb';
import { resolveDatabaseUrlForMariaDb } from './database-url.util';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private static readonly DATABASE_PING_QUERY = 'SELECT 1';

    constructor() {
        const rawDatabaseUrl = process.env.DATABASE_URL;
        if (!rawDatabaseUrl?.trim()) {
            throw new Error('DATABASE_URL is required for Prisma runtime initialization.');
        }

        const resolvedUrl = resolveDatabaseUrlForMariaDb(rawDatabaseUrl);

        if (resolvedUrl.normalizedFromMysqlScheme) {
            console.warn('[prisma] DATABASE_URL uses mysql:// scheme; normalizing to mariadb:// for Prisma MariaDB adapter compatibility.');
        }

        let pool: ReturnType<typeof createPool>;
        try {
            pool = createPool(resolvedUrl.connectionUrl);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(
                `DATABASE_URL has an invalid format for MariaDB adapter. Use mariadb:// (preferred) or mysql://. Details: ${message}`,
            );
        }
        const adapter = new PrismaMariaDb(pool as any);

        super({
            adapter: adapter as any,
        });
    }

    async onModuleInit() {
        try {
            await this.$connect();
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Database connection failed during startup. Verify DATABASE_URL and network reachability. Details: ${message}`);
        }
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    async checkDatabaseConnectivity(): Promise<boolean> {
        try {
            await this.$queryRawUnsafe(PrismaService.DATABASE_PING_QUERY);
            return true;
        } catch {
            return false;
        }
    }
}
