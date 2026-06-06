import { Controller, Get, Param } from '@nestjs/common';
import { TenantService } from './tenant.service';

@Controller('tenant')
export class TenantController {
    constructor(private readonly tenantService: TenantService) {}

    @Get(':slug/context')
    async getPublicContext(@Param('slug') slugOrDomain: string) {
        return this.tenantService.getPublicContext(slugOrDomain);
    }
}
