-- Pasos configurables en admin: gol, tarjetas y cambios en vivo
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
      'GOAL_SCORED',
      'GOAL_IMPACT',
      'YELLOW_CARD',
      'RED_CARD',
      'SUBSTITUTION'
    ) NOT NULL;
