import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificationsProxyController } from './notifications-proxy.controller';
import { NotificationsProxyService } from './notifications-proxy.service';

@Module({
    imports: [
        HttpModule.register({
            timeout: 15000,
            maxRedirects: 3,
        }),
    ],
    controllers: [NotificationsProxyController],
    providers: [NotificationsProxyService],
})
export class NotificationsProxyModule {}
