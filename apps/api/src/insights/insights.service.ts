import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { parseSystemConfigValue, serializeSystemConfigValue } from '../system-config/system-config.util';

export interface MatchInsightsResult {
    homeWin: number;
    draw: number;
    awayWin: number;
    homeForm: Array<'W' | 'D' | 'L'>;
    awayForm: Array<'W' | 'D' | 'L'>;
    scores: string[];
    smartPick: string;
    insight: string;
    personalInsight: string;
}

interface AiConfig {
    provider: 'anthropic' | 'openai';
    apiKey: string;        // currently active key
    apiKeys: string[];     // all available keys for rotation
    activeKeyIndex: number;
    model: string;
    systemPrompt: string;
}

const DEFAULT_SYSTEM_PROMPT = `Eres un analista experto del Mundial FIFA 2026 con acceso a estadísticas reales de los equipos.
Dado un partido de fútbol, devuelve SOLO un objeto JSON válido con esta estructura exacta:
{
  "homeWin": <número entero 0-100>,
  "draw": <número entero 0-100>,
  "awayWin": <número entero 0-100>,
  "homeForm": ["W","D","L","W","W"],
  "awayForm": ["L","W","D","W","L"],
  "scores": ["2-1","1-1","0-2"],
  "smartPick": "<recomendación táctica concisa, ej: 'Local gana', 'Empate sin goles', 'Visitante anota', 'Local +1.5 goles'. Máximo 35 caracteres.>",
  "insight": "<análisis táctico general en español, máximo 100 caracteres, SIN mencionar nombres de equipos>",
  "personalInsight": "<análisis personalizado específico en español. EJEMPLOS del nivel requerido: 'México domina en casa (3 de 5 ganados). Sudáfrica muestra debilidad defensiva como visitante.' | 'Francia viene imparable (5/5 victorias). Canadá sufre contra equipos top europeos.' | 'Brasil lidera con Vinicius en forma (4 goles). Serbia cede espacios en transición.' Máximo 210 caracteres. OBLIGATORIO mencionar ambos equipos por nombre y citar datos de forma real.>"
}
Reglas:
- homeWin + draw + awayWin debe ser exactamente 100.
- scores: array de 3 strings con formato "goles_local-goles_visitante", ordenados [más_probable, equilibrado, sorpresa].
- homeForm y awayForm: basados en resultados REALES y recientes de cada equipo (últimas 5 apariciones).
- insight: frase táctica concisa y general (sin nombres de equipos).
- personalInsight: análisis OBLIGATORIAMENTE menciona ambos equipos por nombre, cita estadísticas concretas (ej: "3 de 5 ganados", "sin perder en 4"), jugadores clave si relevante, y el contexto específico del partido.
- Responde ÚNICAMENTE con el JSON, sin texto adicional, sin markdown, sin comentarios.`;

@Injectable()
export class InsightsService {
    constructor(private readonly prisma: PrismaService) {}

    async getAiConfig(): Promise<AiConfig | null> {
        const record = await this.prisma.systemConfig.findUnique({ where: { key: 'ai_config' } });
        if (!record) return null;
        const value = parseSystemConfigValue<any>(record.value);

        // Support legacy single apiKey and new apiKeys array
        const apiKeys: string[] = Array.isArray(value.apiKeys)
            ? (value.apiKeys as string[]).filter(Boolean)
            : typeof value.apiKey === 'string' && value.apiKey
              ? [value.apiKey]
              : [];

        if (apiKeys.length === 0) return null; // generateInsights will throw descriptive error

        const activeKeyIndex = typeof value.activeKeyIndex === 'number'
            ? Math.min(value.activeKeyIndex, apiKeys.length - 1)
            : 0;

        const stored = value.systemPrompt as string | undefined;

        return {
            provider: (value.provider as AiConfig['provider']) ?? 'anthropic',
            apiKey: apiKeys[activeKeyIndex],
            apiKeys,
            activeKeyIndex,
            model: (value.model as string) || (value.provider === 'openai' ? 'gpt-4.1-mini' : 'claude-haiku-4-5-20251001'),
            systemPrompt: stored && stored.includes('personalInsight') ? stored : DEFAULT_SYSTEM_PROMPT,
        };
    }

    async generateInsights(
        homeTeam: string,
        awayTeam: string,
        phase?: string,
        group?: string,
    ): Promise<MatchInsightsResult> {
        const config = await this.getAiConfig();

        if (!config) {
            throw new BadRequestException('Smart Insights IA no está configurado o no tiene API keys. Ve a Admin → Configuración → Smart Insights para agregar una API key.');
        }

        const userMessage = `Analiza el partido: ${homeTeam} vs ${awayTeam}${phase ? `, fase: ${phase}` : ''}${group ? `, grupo: ${group}` : ''}.`;

        let lastError: unknown;

        // Try each key in round-robin rotation starting from the active index
        for (let attempt = 0; attempt < config.apiKeys.length; attempt++) {
            const keyIdx = (config.activeKeyIndex + attempt) % config.apiKeys.length;
            const attemptConfig = { ...config, apiKey: config.apiKeys[keyIdx] };

            try {
                let rawJson: string;
                if (config.provider === 'openai') {
                    rawJson = await this.callOpenAI(attemptConfig, userMessage);
                } else {
                    rawJson = await this.callAnthropic(attemptConfig, userMessage);
                }

                // Persist new active index if we rotated
                if (attempt > 0) {
                    void this.persistActiveKeyIndex(keyIdx);
                }

                return this.parseAndValidate(rawJson, homeTeam, awayTeam);
            } catch (err) {
                if (this.isRateLimitError(err)) {
                    lastError = err;
                    continue; // try next key
                }
                throw err;
            }
        }

        const detail = lastError instanceof Error ? lastError.message : String(lastError ?? 'sin detalle');
        throw new BadRequestException(
            `Todos los API keys fallaron. Detalle: ${detail}`,
        );
    }

    /** Returns true for rate-limit / quota errors that warrant trying the next key. */
    private isRateLimitError(err: unknown): boolean {
        const msg = err instanceof Error ? err.message : String(err);
        return (
            msg.includes('429') ||
            msg.includes('402') ||
            msg.toLowerCase().includes('rate_limit') ||
            msg.toLowerCase().includes('rate limit') ||
            msg.toLowerCase().includes('quota') ||
            msg.toLowerCase().includes('insufficient_quota')
        );
    }

    /** Non-blocking — updates the stored active key index after a rotation. */
    private async persistActiveKeyIndex(newIndex: number): Promise<void> {
        try {
            const record = await this.prisma.systemConfig.findUnique({ where: { key: 'ai_config' } });
            if (!record) return;
            const value = parseSystemConfigValue<any>(record.value);
            await this.prisma.systemConfig.update({
                where: { key: 'ai_config' },
                data: { value: serializeSystemConfigValue({ ...value, activeKeyIndex: newIndex }) },
            });
        } catch { /* non-critical */ }
    }

    private async callAnthropic(config: AiConfig, userMessage: string): Promise<string> {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                model: config.model,
                max_tokens: 800,
                system: config.systemPrompt,
                messages: [{ role: 'user', content: userMessage }],
            }),
        });

        if (!response.ok) {
            const body = await response.json().catch(() => null) as any;
            const msg = body?.error?.message ?? body?.message ?? `HTTP ${response.status}`;
            throw new BadRequestException(`Anthropic ${response.status}: ${msg}`);
        }

        const data = await response.json() as any;
        return data?.content?.[0]?.text ?? '';
    }

    private async callOpenAI(config: AiConfig, userMessage: string): Promise<string> {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: config.model,
                max_completion_tokens: 800,
                messages: [
                    { role: 'system', content: config.systemPrompt },
                    { role: 'user', content: userMessage },
                ],
            }),
        });

        if (!response.ok) {
            const body = await response.json().catch(() => null) as any;
            const msg = body?.error?.message ?? body?.message ?? `HTTP ${response.status}`;
            throw new BadRequestException(`OpenAI ${response.status}: ${msg}`);
        }

        const data = await response.json() as any;
        return data?.choices?.[0]?.message?.content ?? '';
    }

    private parseAndValidate(rawJson: string, homeTeam: string, awayTeam: string): MatchInsightsResult {
        let parsed: any;
        try {
            const clean = rawJson.replace(/```(?:json)?/gi, '').trim();
            parsed = JSON.parse(clean);
        } catch {
            throw new BadRequestException('La IA devolvió una respuesta en formato inválido. Inténtalo de nuevo.');
        }

        const homeWin = Math.max(0, Math.min(100, Number(parsed.homeWin) || 0));
        const draw    = Math.max(0, Math.min(100, Number(parsed.draw)    || 0));
        const awayWin = Math.max(0, 100 - homeWin - draw);

        const validForm = (arr: unknown): Array<'W' | 'D' | 'L'> => {
            if (!Array.isArray(arr)) return ['W', 'D', 'L', 'W', 'D'];
            return arr.slice(0, 5).map((v) => (['W', 'D', 'L'].includes(String(v)) ? String(v) as 'W' | 'D' | 'L' : 'D'));
        };

        const scores = Array.isArray(parsed.scores)
            ? parsed.scores.slice(0, 3).map((s: unknown) => String(s))
            : ['1-0', '1-1', '0-1'];

        return {
            homeWin,
            draw,
            awayWin,
            homeForm: validForm(parsed.homeForm),
            awayForm: validForm(parsed.awayForm),
            scores,
            smartPick: parsed.smartPick || homeTeam,
            insight: parsed.insight || '',
            personalInsight: parsed.personalInsight || '',
        };
    }
}
