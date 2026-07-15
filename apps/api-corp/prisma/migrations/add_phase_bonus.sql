-- Migración: tabla PhaseBonus para bonos de clasificados en ranking corporativo.
-- Aplicar manualmente en polla_corp. Sin esta tabla, GET /corp/ranking no suma +N bono.
-- El entrypoint no ejecuta db push por defecto.

CREATE TABLE IF NOT EXISTS `PhaseBonus` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `leagueId`  VARCHAR(191) NOT NULL,
  `phase`     ENUM('GROUP','ROUND_OF_32','ROUND_OF_16','QUARTER','SEMI','THIRD_PLACE','FINAL') NOT NULL,
  `points`    DOUBLE NOT NULL,
  `awardedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `PhaseBonus_userId_leagueId_phase_key` (`userId`, `leagueId`, `phase`),
  INDEX `PhaseBonus_leagueId_idx` (`leagueId`),
  INDEX `PhaseBonus_userId_idx` (`userId`),
  CONSTRAINT `PhaseBonus_leagueId_fkey` FOREIGN KEY (`leagueId`) REFERENCES `League`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `PhaseBonus_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
