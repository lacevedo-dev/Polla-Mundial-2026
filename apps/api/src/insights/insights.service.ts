import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
    apiKey: string;
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
  "personalInsight": "<análisis personalizado específico en español: menciona los equipos por nombre, cita datos reales como su estado de forma actual, resultados recientes concretos, jugadores clave, fortalezas/debilidades específicas del equipo en este torneo. Máximo 220 caracteres. NO uses frases genéricas como 'es un partido emocionante' o 'ambos equipos buscarán la victoria'.>"
}
Reglas:
- homeWin + draw + awayWin debe ser exactamente 100.
- scores: array de 3 strings con formato "goles_local-goles_visitante", ordenados [más_probable, equilibrado, sorpresa].
- homeForm y awayForm: basados en resultados REALES y recientes de cada equipo (últimas 5 apariciones).
- insight: frase táctica concisa y general (sin nombres de equipos).
- personalInsight: análisis detallado que SÍ menciona los equipos por nombre, cita estadísticas reales, resultados previos entre ellos si existen, y el contexto específico del encuentro.
- Responde ÚNICAMENTE con el JSON, sin texto adicional, sin markdown, sin comentarios.`;

@Injectable()
export class InsightsService {
    constructor(private readonly prisma: PrismaService) {}

    async getAiConfig(): Promise<AiConfig | null> {
        const record = await this.prisma.systemConfig.findUnique({ where: { key: 'ai_config' } });
        if (!record) return null;
        const value = record.value as Record<string, unknown>;
        if (!value?.apiKey) return null;
        return {
            provider: (value.provider as AiConfig['provider']) ?? 'anthropic',
            apiKey: value.apiKey as string,
            model: (value.model as string) || (value.provider === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001'),
            systemPrompt: (value.systemPrompt as string) || DEFAULT_SYSTEM_PROMPT,
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
            throw new BadRequestException('Smart Insights IA no está configurado. Contacta al administrador.');
        }

        const userMessage = `Analiza el partido: ${homeTeam} vs ${awayTeam}${phase ? `, fase: ${phase}` : ''}${group ? `, grupo: ${group}` : ''}.`;

        let rawJson: string;

        if (config.provider === 'openai') {
            rawJson = await this.callOpenAI(config, userMessage);
        } else {
            rawJson = await this.callAnthropic(config, userMessage);
        }

        return this.parseAndValidate(rawJson, homeTeam, awayTeam);
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
            const err = await response.text();
            throw new BadRequestException(`Error al llamar API Anthropic: ${response.status} — ${err}`);
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
                max_tokens: 800,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: config.systemPrompt },
                    { role: 'user', content: userMessage },
                ],
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new BadRequestException(`Error al llamar API OpenAI: ${response.status} — ${err}`);
        }

        const data = await response.json() as any;
        return data?.choices?.[0]?.message?.content ?? '';
    }

    private parseAndValidate(rawJson: string, homeTeam: string, awayTeam: string): MatchInsightsResult {
        let parsed: any;
        try {
            // Strip markdown code fences if present
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
