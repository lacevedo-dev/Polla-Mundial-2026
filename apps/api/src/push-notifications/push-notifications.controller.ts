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
  Logger,
  InternalServerErrorException,
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
  private readonly logger = new Logger(PushNotificationsController.name);
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
    try {
      const userAgent = req.headers?.['user-agent'];
      await this.push.saveSubscription(req.user.id, dto, userAgent);
      return { ok: true };
    } catch (err: any) {
      this.logger.error(`subscribe failed for user ${req.user?.id}: ${err.message}`, err.stack);
      throw new InternalServerErrorException('Error al guardar la suscripción push');
    }
  }

  @Delete('unsubscribe')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a push subscription' })
  async unsubscribe(@Body() dto: RemoveSubscriptionDto) {
    await this.push.removeSubscription(dto.endpoint);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test push notification to the current user' })
  async testPush(@Req() req: any) {
    const result = await this.push.sendTestToUser(req.user.id);
    return {
      ok: result.sent > 0,
      sent: result.sent,
      failed: result.failed,
      devices: result.devices,
      message: result.devices === 0
        ? 'No hay dispositivos suscritos. Activa las notificaciones primero.'
        : result.sent > 0
        ? `Notificación enviada a ${result.sent} de ${result.devices} dispositivo(s).`
        : `Falló el envío a ${result.failed} dispositivo(s). Revisa las claves VAPID.`,
    };
  }
}
