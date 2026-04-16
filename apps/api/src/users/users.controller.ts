import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get('search')
    @UseGuards(JwtAuthGuard)
    async searchUsers(@Query('q') query: string) {
        if (!query || query.trim().length < 2) {
            return [];
        }

        const result = await this.usersService.findAllPaginated({
            page: 1,
            limit: 10,
            search: query.trim(),
            includeInactive: false,
        });

        return result.data.map(user => ({
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            avatar: user.avatar,
        }));
    }
}
