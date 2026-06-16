-- Fase en vivo v2: inicio, HT, 2.ª parte, fin live, impacto de gol
ALTER TABLE `AutomationRun`
  MODIFY COLUMN `step`
    ENUM(
      'MATCH_REMINDER',
      'PREDICTION_CLOSING',
      'RESULT_NOTIFICATION',
      'PREDICTION_REPORT',
      'RESULT_REPORT',
      'ESCALATION_T45',
      'ESCALATION_T30',
      'ESCALATION_FINAL',
      'MATCH_START',
      'HALFTIME',
      'SECOND_HALF_START',
      'MATCH_LIVE_END',
      'GOAL_IMPACT'
    ) NOT NULL;

ALTER TABLE `WhatsappGroupJob`
  MODIFY COLUMN `type`
    ENUM(
      'RESULT_REPORT',
      'PREDICTION_REPORT',
      'MATCH_REMINDER',
      'PREDICTION_CLOSED',
      'RESULT_NOTIFICATION',
      'GOAL_SCORED',
      'PRE_MATCH_ESCALATION',
      'MATCH_START',
      'HALFTIME',
      'SECOND_HALF_START',
      'MATCH_LIVE_END',
      'GOAL_IMPACT'
    ) NOT NULL;
