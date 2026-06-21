import { Global, Module } from '@nestjs/common';
import { DatabaseSchemaHealthService } from './database-schema-health.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
    providers: [PrismaService, DatabaseSchemaHealthService],
    exports: [PrismaService],
})
export class PrismaModule { }
