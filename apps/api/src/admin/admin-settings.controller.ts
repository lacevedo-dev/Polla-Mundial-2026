import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { StickerAiConfigService } from '../stickers/sticker-ai-config.service';
import { StickerGlobalReferenceService } from '../stickers/sticker-global-reference.service';
import { StickerReferenceStorageService, type StickerUploadFile } from '../stickers/sticker-reference-storage.service';
import { StickerTeamReferenceService } from '../stickers/sticker-team-reference.service';

const PUBLIC_REGISTRATION_CONFIG_KEY = 'public_registration';

function normalizePublicRegistrationConfig(value: any) {
    return {
        requireParticipationCode: value?.requireParticipationCode !== false,
        defaultLeagueCode: typeof value?.defaultLeagueCode === 'string' ? value.defaultLeagueCode.trim().toUpperCase() : '',
    };
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPERADMIN')
@Controller('admin/settings')
export class AdminSettingsController {
    constructor(
        private readonly adminService: AdminService,
        private readonly stickerAiConfig: StickerAiConfigService,
        private readonly stickerTeamReferences: StickerTeamReferenceService,
        private readonly stickerReferenceStorage: StickerReferenceStorageService,
        private readonly stickerGlobalReferences: StickerGlobalReferenceService,
    ) {}

    @Get('ai')
    @ApiOperation({ summary: 'Get AI integration configuration' })
    async getAiConfig() {
        const record = await this.adminService.getSystemConfig('ai_config');
        if (!record) {
            return {
                provider: 'anthropic',
                apiKeys: [],
                activeKeyIndex: 0,
                model: 'claude-haiku-4-5-20251001',
                systemPrompt: '',
            };
        }
        const value = record.value as any;

        // Support legacy single apiKey and new apiKeys array
        const rawKeys: string[] = Array.isArray(value.apiKeys)
            ? (value.apiKeys as string[]).filter(Boolean)
            : typeof value.apiKey === 'string' && value.apiKey
              ? [value.apiKey]
              : [];

        // Mask all keys for the response
        const apiKeys = rawKeys.map((k) =>
            k.length > 4
                ? `${'*'.repeat(Math.max(8, k.length - 4))}${k.slice(-4)}`
                : '****',
        );

        return {
            provider: value.provider ?? 'anthropic',
            apiKeys,
            activeKeyIndex: value.activeKeyIndex ?? 0,
            model: value.model ?? 'claude-haiku-4-5-20251001',
            systemPrompt: value.systemPrompt ?? '',
        };
    }

    @Post('credits/reset')
    @ApiOperation({ summary: 'Reset all users AI credits globally' })
    async resetAllCredits() {
        const resetAt = new Date().toISOString();
        await this.adminService.setSystemConfig('si_credits_reset', { resetAt });
        return { ok: true, resetAt };
    }

    @Get('public-registration')
    @ApiOperation({ summary: 'Get public registration configuration' })
    async getPublicRegistrationConfig() {
        const record = await this.adminService.getSystemConfig(PUBLIC_REGISTRATION_CONFIG_KEY);
        const config = normalizePublicRegistrationConfig(record?.value);
        const defaultLeague = config.defaultLeagueCode
            ? await this.adminService.getLeagueByCode(config.defaultLeagueCode)
            : null;

        return {
            ...config,
            defaultLeagueName: defaultLeague?.name ?? 'Polla Mundialista 2026',
            defaultLeague,
        };
    }

    @Patch('public-registration')
    @ApiOperation({ summary: 'Save public registration configuration' })
    async savePublicRegistrationConfig(@Body() dto: {
        requireParticipationCode?: boolean;
        defaultLeagueCode?: string;
    }) {
        const requireParticipationCode = dto.requireParticipationCode !== false;
        const defaultLeagueCode = typeof dto.defaultLeagueCode === 'string' ? dto.defaultLeagueCode.trim().toUpperCase() : '';
        const defaultLeague = defaultLeagueCode ? await this.adminService.getLeagueByCode(defaultLeagueCode) : null;

        if (!requireParticipationCode && !defaultLeague) {
            throw new BadRequestException('Debes configurar un código de polla válido cuando el registro no solicita código.');
        }

        const value = {
            requireParticipationCode,
            defaultLeagueCode: defaultLeague?.code ?? defaultLeagueCode,
        };

        await this.adminService.setSystemConfig(PUBLIC_REGISTRATION_CONFIG_KEY, value);

        return {
            ok: true,
            ...value,
            defaultLeagueName: defaultLeague?.name ?? 'Polla Mundialista 2026',
            defaultLeague,
        };
    }

    @Patch('ai')
    @ApiOperation({ summary: 'Save AI integration configuration' })
    async saveAiConfig(@Body() dto: {
        provider: string;
        apiKeys?: string[];
        activeKeyIndex?: number;
        model: string;
        systemPrompt: string;
    }) {
        const existing = await this.adminService.getSystemConfig('ai_config');
        const existingValue = existing?.value as any;

        // Load existing unmasked keys for resolution
        const existingKeys: string[] = Array.isArray(existingValue?.apiKeys)
            ? (existingValue.apiKeys as string[]).filter(Boolean)
            : typeof existingValue?.apiKey === 'string' && existingValue.apiKey
              ? [existingValue.apiKey]
              : [];

        // Resolve incoming keys:
        //   - Masked (****xxxx) → find the original by matching the suffix
        //   - Full key (sk-...) → keep as new
        //   - Empty string → skip
        const resolvedKeys = (dto.apiKeys ?? [])
            .map((k: string) => {
                const trimmed = k.trim();
                if (!trimmed) return null;
                if (/^\*{4,}/.test(trimmed)) {
                    // Masked — recover original by suffix match
                    const suffix = trimmed.replace(/^\*+/, '');
                    return existingKeys.find((ek) => ek.endsWith(suffix)) ?? null;
                }
                return trimmed; // new full key
            })
            .filter(Boolean) as string[];

        // Safety net: if resolution yielded no keys but there were keys before, keep existing.
        // This prevents accidental config wipe when the frontend sends an empty or unresolvable array.
        const finalKeys = resolvedKeys.length > 0 ? resolvedKeys : existingKeys;

        const config = {
            provider: dto.provider,
            apiKeys: finalKeys,
            activeKeyIndex: Math.min(dto.activeKeyIndex ?? 0, Math.max(0, finalKeys.length - 1)),
            model: dto.model,
            systemPrompt: dto.systemPrompt,
        };

        await this.adminService.setSystemConfig('ai_config', config);
        return { ok: true, keysCount: finalKeys.length };
    }

    @Get('sticker-ai')
    @ApiOperation({ summary: 'Get OpenAI sticker generation configuration' })
    async getStickerAiConfig() {
        return this.stickerAiConfig.getAdminConfig();
    }

    @Patch('sticker-ai')
    @ApiOperation({ summary: 'Save OpenAI sticker generation configuration' })
    async saveStickerAiConfig(@Body() dto: {
        apiKeys?: string[];
        activeKeyIndex?: number;
        model: string;
        quality: string;
        systemPrompt: string;
    }) {
        const result = await this.stickerAiConfig.saveAdminConfig(dto);
        return { ok: true, keysCount: result.keysCount };
    }

    @Get('sticker-ai/references')
    @ApiOperation({ summary: 'List global and per-team OpenAI sticker reference images' })
    async getStickerReferences() {
        return this.stickerTeamReferences.getAdminView();
    }

    @Patch('sticker-ai/references/teams/:countryCode')
    @ApiOperation({ summary: 'Save kit description and image label for a team sticker reference' })
    async saveTeamStickerReference(
        @Param('countryCode') countryCode: string,
        @Body() dto: { kitDescription?: string; imageLabel?: string },
    ) {
        await this.stickerTeamReferences.saveTeamReference(countryCode, dto);
        return { ok: true };
    }

    @Post('sticker-ai/references/global')
    @ApiOperation({ summary: 'Create a labeled global sticker reference slot' })
    async createGlobalStickerReference(@Body() dto: { label: string; promptHint?: string }) {
        return this.stickerGlobalReferences.createItem(dto);
    }

    @Patch('sticker-ai/references/global/:id')
    @ApiOperation({ summary: 'Update label, prompt hint or sort order of a global reference' })
    async updateGlobalStickerReference(
        @Param('id') id: string,
        @Body() dto: { label?: string; promptHint?: string; sortOrder?: number },
    ) {
        return this.stickerGlobalReferences.updateItem(id, dto);
    }

    @Delete('sticker-ai/references/global/:id')
    @ApiOperation({ summary: 'Delete a global sticker reference slot and its upload' })
    async deleteGlobalStickerReference(@Param('id') id: string) {
        await this.stickerGlobalReferences.deleteItem(id);
        return { ok: true };
    }

    @Post('sticker-ai/references/global/:id/upload')
    @ApiOperation({ summary: 'Upload image for a labeled global sticker reference' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            limits: { fileSize: 8 * 1024 * 1024 },
        }),
    )
    async uploadGlobalStickerReference(
        @Param('id') id: string,
        @UploadedFile() file?: StickerUploadFile,
    ) {
        if (!file) throw new BadRequestException('Archivo requerido');
        return this.stickerGlobalReferences.saveUpload(id, file);
    }

    @Delete('sticker-ai/references/global/:id/upload')
    @ApiOperation({ summary: 'Remove uploaded global reference image (falls back to bundled if any)' })
    async deleteGlobalStickerReferenceUpload(@Param('id') id: string) {
        return this.stickerGlobalReferences.deleteUpload(id);
    }

    @Post('sticker-ai/references/upload/team-uniform/:countryCode')
    @ApiOperation({ summary: 'Upload Image D — team uniform / country sticker reference' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        FileInterceptor('file', {
            storage: memoryStorage(),
            limits: { fileSize: 8 * 1024 * 1024 },
        }),
    )
    async uploadTeamUniform(
        @Param('countryCode') countryCode: string,
        @UploadedFile() file?: StickerUploadFile,
    ) {
        if (!file) throw new BadRequestException('Archivo requerido');
        await this.stickerReferenceStorage.saveTeamUniformUpload(countryCode, file);
        return { ok: true, countryCode };
    }

    @Delete('sticker-ai/references/upload/team-uniform/:countryCode')
    @ApiOperation({ summary: 'Remove uploaded team uniform reference (falls back to bundled if any)' })
    async deleteTeamUniform(@Param('countryCode') countryCode: string) {
        const removed = this.stickerReferenceStorage.deleteTeamUniform(countryCode);
        return { ok: true, removed };
    }
}
