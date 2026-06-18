import { WhatsappGroupJobType } from '@prisma/client';

/** Jobs que solo envían texto (sin generar PDF/imagen). */
export const TEXT_ONLY_WHATSAPP_GROUP_JOB_TYPES = new Set<WhatsappGroupJobType>([
  WhatsappGroupJobType.MATCH_REMINDER,
  WhatsappGroupJobType.PREDICTION_CLOSED,
  WhatsappGroupJobType.RESULT_NOTIFICATION,
  WhatsappGroupJobType.GOAL_SCORED,
  WhatsappGroupJobType.PRE_MATCH_ESCALATION,
  WhatsappGroupJobType.MATCH_START,
  WhatsappGroupJobType.HALFTIME,
  WhatsappGroupJobType.SECOND_HALF_START,
  WhatsappGroupJobType.MATCH_LIVE_END,
  WhatsappGroupJobType.GOAL_IMPACT,
  WhatsappGroupJobType.RED_CARD,
  WhatsappGroupJobType.YELLOW_CARD,
  WhatsappGroupJobType.SUBSTITUTION,
  WhatsappGroupJobType.GOAL_ANNULLED,
  WhatsappGroupJobType.PAYMENT_REMINDER,
]);

export function isTextOnlyWhatsappGroupJob(type: WhatsappGroupJobType): boolean {
  return TEXT_ONLY_WHATSAPP_GROUP_JOB_TYPES.has(type);
}
