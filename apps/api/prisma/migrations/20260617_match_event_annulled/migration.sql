-- Gol reportado y luego anulado (VAR, fuera de juego, etc.)
ALTER TABLE `MatchEvent`
    ADD COLUMN `annulled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `annulledReason` VARCHAR(191) NULL;
