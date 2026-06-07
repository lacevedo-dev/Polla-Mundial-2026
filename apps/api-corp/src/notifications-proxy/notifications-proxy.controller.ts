import { Controller, Get, Headers, Param, Patch, Query } from '@nestjs/common';
import { NotificationsProxyService } from './notifications-proxy.service';

@Controller('notifications')
export class NotificationsProxyController {
    constructor(private readonly proxy: NotificationsProxyService) {}

    @Get()
    async getMyNotifications(
        @Headers() headers: Record<string, string>,
        @Query('limit') limit?: string,
        @Query('tenantSlug') tenantSlug?: string,
    ) {
        const params: Record<string, string> = {};
        if (limit) params.limit = limit;
        if (tenantSlug) params.tenantSlug = tenantSlug;

        return this.proxy.proxyRequest('GET', '/notifications', headers, params);
    }

    @Patch(':id/read')
    async markRead(
        @Headers() headers: Record<string, string>,
        @Param('id') id: string,
    ) {
        return this.proxy.proxyRequest('PATCH', `/notifications/${id}/read`, headers);
    }

    @Patch('read-all')
    async markAllRead(
        @Headers() headers: Record<string, string>,
    ) {
        return this.proxy.proxyRequest('PATCH', '/notifications/read-all', headers);
    }
}
