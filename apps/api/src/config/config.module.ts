import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [ConfigController],
})
export class ConfigModule {}
