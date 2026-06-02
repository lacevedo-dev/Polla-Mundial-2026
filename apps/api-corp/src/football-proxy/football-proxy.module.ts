import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FootballProxyService } from './football-proxy.service';
import { FootballProxyController } from './football-proxy.controller';

@Module({
    imports: [
        HttpModule.register({
            timeout: 10000,
            maxRedirects: 3,
        }),
    ],
    providers: [FootballProxyService],
    controllers: [FootballProxyController],
    exports: [FootballProxyService],
})
export class FootballProxyModule {}
