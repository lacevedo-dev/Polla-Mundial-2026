-- Marcador de tanda de penales (API-Football score.penalty), distinto de homeScore/awayScore (90'+ET)
-- Aplicar manualmente en polla_corp. El entrypoint no ejecuta db push por defecto.

ALTER TABLE `Match` ADD COLUMN IF NOT EXISTS `penaltyHomeScore` INTEGER NULL;
ALTER TABLE `Match` ADD COLUMN IF NOT EXISTS `penaltyAwayScore` INTEGER NULL;
