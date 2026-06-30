-- Marcador de tanda de penales (API-Football score.penalty), distinto de homeScore/awayScore (90'+ET)
ALTER TABLE `Match` ADD COLUMN `penaltyHomeScore` INTEGER NULL;
ALTER TABLE `Match` ADD COLUMN `penaltyAwayScore` INTEGER NULL;
