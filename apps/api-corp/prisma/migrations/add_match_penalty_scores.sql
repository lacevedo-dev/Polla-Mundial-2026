-- Marcador de tanda de penales (API-Football score.penalty), distinto de homeScore/awayScore (90'+ET)
-- Ejecutar en polla_corp si el contenedor aún no aplica db push automático.

ALTER TABLE `Match` ADD COLUMN IF NOT EXISTS `penaltyHomeScore` INTEGER NULL;
ALTER TABLE `Match` ADD COLUMN IF NOT EXISTS `penaltyAwayScore` INTEGER NULL;
