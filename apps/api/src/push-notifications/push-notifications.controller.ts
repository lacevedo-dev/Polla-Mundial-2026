import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushNotificationsService } from './push-notifications.service';

class PushKeysDto {
  @IsString() p256dh: string;
  @IsString() auth: string;
}

class SaveSubscriptionDto {
  @IsString() endpoint: string;
  @IsOptional() expirationTime?: number | null;
  @IsObject() @ValidateNested() @Type(() => PushKeysDto) keys: PushKeysDto;
}

class RemoveSubscriptionDto {
  @IsString() endpoint: string;
}

@ApiTags('push')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push')
export class PushNotificationsController {
  constructor(private readonly push: PushNotificationsService) {}

  @Get('vapid-key')
  @ApiOperation({ summary: 'Get VAPID public key for push subscription' })
  getVapidKey() {
    return { publicKey: this.push.getVapidPublicKey() };
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a push subscription for the current user' })
  async subscribe(@Body() dto: SaveSubscriptionDto, @Req() req: any) {
    const userAgent = req.headers?.['user-agent'];
    await this.push.saveSubscription(req.user.id, dto, userAgent);
    return { ok: true };
  }

  @Delete('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a push subscription' })
  async unsubscribe(@Body() dto: RemoveSubscriptionDto) {
    await this.push.removeSubscription(dto.endpoint);
  }
}
