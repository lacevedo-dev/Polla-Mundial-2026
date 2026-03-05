import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { createConnection } from 'mariadb';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private static adapter: PrismaMariaDb;

    constructor() {
        // Definimos el adaptador antes de llamar a super() si es posible,
        // pero PrismaClient espera el adaptador en el objeto de configuración.
        super({
            // @ts-ignore - Prisma 7 adapter support
            adapter: PrismaService.adapter,
        });
    }

    async onModuleInit() {
        if (!PrismaService.adapter) {
            const connection = await createConnection(process.env.DATABASE_URL);
            PrismaService.adapter = new PrismaMariaDb(connection);

            // Reiniciamos el cliente con el adaptador si es necesario, 
            // pero en NestJS usaremos una aproximación más limpia:
            // Instanciaremos el cliente una vez que la conexión esté lista.
        }
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
