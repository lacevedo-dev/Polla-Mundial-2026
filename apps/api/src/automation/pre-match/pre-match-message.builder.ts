import type { EscalationCheckpointId } from '../types/automation.types';
import type { MissingMemberForLeague } from '../audience/match-audience.resolver';
import {
  formatCloseLineBogota,
  formatKickoffLineBogota,
  formatMatchDateTimeBogota,
  formatModifyUntilLineBogota,
  formatPredictionCloseDateTimeBogota,
} from '../config/automation-datetime.util';
import {
  WA_MISSING_NAMES_DISPLAY_LIMIT,
  formatMinutesBeforeKickoff,
} from '../config/automation-timing.util';

export function buildT60ReminderMessage(params: {
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  closeMinutes: number;
  allComplete: boolean;
  pendingLeagueNames: string[];
  totalPollas: number;
  pollasWithPrediction: number;
}): { title: string; body: string } {
  const { homeTeam, awayTeam, closeMinutes, allComplete, matchDate } = params;
  const title = 'Recordatorio de partido';
  const kickoffLine = formatKickoffLineBogota(matchDate);
  const modifyLine = formatModifyUntilLineBogota(matchDate, closeMinutes);

  if (allComplete) {
    const pollasLabel =
      params.totalPollas === 1
        ? 'tu polla'
        : `tus ${params.totalPollas} pollas`;
    return {
      title,
      body: `${homeTeam} vs ${awayTeam}. ${kickoffLine} Tu pronóstico está guardado en ${pollasLabel}. ${modifyLine}`,
    };
  }

  const pending = params.pendingLeagueNames;
  const pendingList =
    pending.length <= 3
      ? pending.join(', ')
      : `${pending.slice(0, 2).join(', ')} y ${pending.length - 2} más`;

  return {
    title: 'Recordatorio — pronóstico pendiente',
    body: `${homeTeam} vs ${awayTeam}. ${kickoffLine} Te falta pronosticar en: ${pendingList}. ${modifyLine}`,
  };
}

export function buildEscalationUserMessage(params: {
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  minutesBeforeKickoff: number;
  closeMinutes: number;
  pendingLeagueNames: string[];
  checkpoint: EscalationCheckpointId;
}): { title: string; body: string } {
  const pendingList = params.pendingLeagueNames.join(', ');
  const kickoffLine = formatKickoffLineBogota(params.matchDate);
  const closeAt = formatPredictionCloseDateTimeBogota(
    params.matchDate,
    params.closeMinutes,
  );

  const urgency =
    params.checkpoint === 'T_FINAL'
      ? `Última oportunidad: el cierre es a las ${closeAt} (hora Bogotá).`
      : `Quedan ${params.minutesBeforeKickoff} min para el inicio (${formatMatchDateTimeBogota(params.matchDate)} hora Bogotá).`;

  return {
    title: 'Predicción pendiente',
    body: `${urgency} ${params.homeTeam} vs ${params.awayTeam}. ${kickoffLine} Te falta en: ${pendingList}.`,
  };
}

export function buildPreMatchEscalationWaCaption(params: {
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  minutesBeforeKickoff: number;
  closeMinutes: number;
  missingMembers: MissingMemberForLeague[];
  predictedCount: number;
  totalMembers: number;
  checkpoint: EscalationCheckpointId;
}): string {
  const header =
    params.checkpoint === 'T_FINAL'
      ? `Última oportunidad (${formatMinutesBeforeKickoff(params.minutesBeforeKickoff)})`
      : `Faltan pronósticos (${formatMinutesBeforeKickoff(params.minutesBeforeKickoff)})`;

  const lines = [
    `${header} | ${params.leagueName}`,
    `${params.homeTeam} vs ${params.awayTeam}`,
    formatKickoffLineBogota(params.matchDate),
    formatCloseLineBogota(params.matchDate, params.closeMinutes),
    '',
  ];

  if (params.missingMembers.length === 0) {
    lines.push('Todos los miembros activos ya pronosticaron.');
  } else {
    lines.push(`Sin pronóstico (${params.missingMembers.length}):`);
    const shown = params.missingMembers.slice(0, WA_MISSING_NAMES_DISPLAY_LIMIT);
    for (const member of shown) {
      lines.push(`- ${member.displayName}`);
    }
    const hidden = params.missingMembers.length - shown.length;
    if (hidden > 0) {
      lines.push(`- … y ${hidden} más (ver app)`);
    }
  }

  lines.push('');
  lines.push(
    `Con pronóstico: ${params.predictedCount}/${params.totalMembers}`,
  );

  if (params.checkpoint === 'T_FINAL') {
    lines.push(
      `Cierra en ${params.closeMinutes} min (${formatPredictionCloseDateTimeBogota(params.matchDate, params.closeMinutes)} hora Bogotá).`,
    );
  }

  return lines.join('\n');
}

export function escalationDedupeKey(
  checkpoint: EscalationCheckpointId,
  matchId: string,
  leagueId: string,
): string {
  return `PRE_MATCH_ESCALATION:${checkpoint}:${matchId}:${leagueId}`;
}

export function escalationNotificationDataKey(
  checkpoint: EscalationCheckpointId,
  matchId: string,
): string {
  return `"escalationStep":"${checkpoint}","matchId":"${matchId}"`;
}
