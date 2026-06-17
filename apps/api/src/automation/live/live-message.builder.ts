import { AutomationStep } from '@prisma/client';
import type { LeagueGoalImpactSummary } from './goal-impact-analyzer.service';
import type { LivePhaseEventId } from '../types/automation.types';
import { BOGOTA_TIME_LABEL } from '../config/automation-datetime.util';

export function liveEventNotificationDataKey(
  event: LivePhaseEventId,
  matchId: string,
): string {
  return `"liveEvent":"${event}","matchId":"${matchId}"`;
}

export function liveEventToAutomationStep(event: LivePhaseEventId): AutomationStep {
  switch (event) {
    case 'MATCH_START':
      return AutomationStep.MATCH_START;
    case 'HALFTIME':
      return AutomationStep.HALFTIME;
    case 'SECOND_HALF_START':
      return AutomationStep.SECOND_HALF_START;
    case 'MATCH_LIVE_END':
      return AutomationStep.MATCH_LIVE_END;
    case 'GOAL_IMPACT':
      return AutomationStep.GOAL_IMPACT;
  }
}

function formatScoreLine(
  homeTeam: string,
  awayTeam: string,
  homeScore: number | null,
  awayScore: number | null,
  elapsed: number | null,
): string {
  const score =
    homeScore !== null && awayScore !== null
      ? `${homeScore}-${awayScore}`
      : '0-0';
  const minute = elapsed !== null ? ` (${elapsed}')` : '';
  return `${homeTeam} ${score} ${awayTeam}${minute}`;
}

export function buildLiveUserMessage(params: {
  event: LivePhaseEventId;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  elapsed: number | null;
}): { title: string; body: string } {
  const line = formatScoreLine(
    params.homeTeam,
    params.awayTeam,
    params.homeScore,
    params.awayScore,
    params.elapsed,
  );

  switch (params.event) {
    case 'MATCH_START':
      return {
        title: '¡Arrancó el partido!',
        body: `${line}. Sigue el marcador en vivo en la app.`,
      };
    case 'HALFTIME':
      return {
        title: 'Medio tiempo',
        body: `${line}. Descanso — vuelve pronto la 2.ª parte.`,
      };
    case 'SECOND_HALF_START':
      return {
        title: 'Segunda parte',
        body: `${line}. ¡Comenzó la 2.ª parte!`,
      };
    case 'MATCH_LIVE_END':
      return {
        title: 'Partido terminado',
        body: `${line}. Estamos calculando tus puntos — te avisamos en breve.`,
      };
    default:
      return { title: 'Actualización en vivo', body: line };
  }
}

export function buildLiveWaCaption(params: {
  event: LivePhaseEventId;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  elapsed: number | null;
}): string {
  const line = formatScoreLine(
    params.homeTeam,
    params.awayTeam,
    params.homeScore,
    params.awayScore,
    params.elapsed,
  );

  const header = `*${params.leagueName}*`;
  switch (params.event) {
    case 'MATCH_START':
      return `${header}\n⚽ *¡Arrancó el partido!*\n${line}\n_${BOGOTA_TIME_LABEL}_`;
    case 'HALFTIME':
      return `${header}\n⏸️ *Medio tiempo*\n${line}`;
    case 'SECOND_HALF_START':
      return `${header}\n▶️ *Segunda parte*\n${line}`;
    case 'MATCH_LIVE_END':
      return `${header}\n🏁 *Partido terminado*\n${line}\nCalculando puntos…`;
    default:
      return `${header}\n${line}`;
  }
}

export function buildGoalImpactWaCaption(params: {
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  elapsed: number | null;
  scoringTeam: string | null;
  scorerName?: string | null;
  summary: LeagueGoalImpactSummary;
}): string {
  const line = formatScoreLine(
    params.homeTeam,
    params.awayTeam,
    params.homeScore,
    params.awayScore,
    params.elapsed,
  );

  const scorerLine = params.scorerName
    ? `\nGol: ${params.scorerName}${params.scoringTeam ? ` (${params.scoringTeam})` : ''}`
    : params.scoringTeam
      ? `\nGol de ${params.scoringTeam}`
      : '';

  const exactLine =
    params.summary.exactScoreCount > 0
      ? `\n🎯 Marcador exacto ahora: ${params.summary.exactScoreCount} (${params.summary.exactScoreNames.join(', ')})`
      : '\n🎯 Nadie tiene el marcador exacto por ahora';

  const scoringLine = `\n📊 Con este resultado suman puntos: ${params.summary.scoringCount} participante(s)`;

  const topLine =
    params.summary.topScorers.length > 0
      ? `\n⭐ Top del partido: ${params.summary.topScorers
          .map((s) => `${s.displayName} ${s.points} pts`)
          .join(', ')}`
      : '';

  const popularLine =
    params.summary.popularPredictions.length > 0
      ? `\n📋 Más pronosticado: ${params.summary.popularPredictions
          .map((p) => `${p.score} (${p.count})`)
          .join(', ')}`
      : '';

  const rankingLine =
    params.summary.provisionalRanking.length > 0
      ? `\n🏆 Ranking provisional:\n${params.summary.provisionalRanking
          .map((row) => {
            const move =
              row.positionChange > 0
                ? ` ↑${row.positionChange}`
                : row.positionChange < 0
                  ? ` ↓${Math.abs(row.positionChange)}`
                  : '';
            return `${row.provisionalPosition}. ${row.displayName} — ${row.provisionalPoints} pts${move}`;
          })
          .join('\n')}`
      : '';

  return `*${params.leagueName}*\n📈 *Impacto en la polla*\n${line}${scorerLine}${exactLine}${scoringLine}${topLine}${popularLine}${rankingLine}`;
}

export function goalImpactDedupeKey(
  matchId: string,
  leagueId: string,
  homeScore: number,
  awayScore: number,
): string {
  return `GOAL_IMPACT:${matchId}:${leagueId}:${homeScore}-${awayScore}`;
}
