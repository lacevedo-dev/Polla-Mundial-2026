-- Add primaryTournamentId to League
ALTER TABLE `League` ADD COLUMN `primaryTournamentId` VARCHAR(191) NULL;
ALTER TABLE `League` ADD INDEX `League_primaryTournamentId_idx` (`primaryTournamentId`);
ALTER TABLE `League` ADD CONSTRAINT `League_primaryTournamentId_fkey`
  FOREIGN KEY (`primaryTournamentId`) REFERENCES `Tournament`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Create LeagueTournament join table
CREATE TABLE `LeagueTournament` (
  `id`           VARCHAR(191) NOT NULL,
  `leagueId`     VARCHAR(191) NOT NULL,
  `tournamentId` VARCHAR(191) NOT NULL,
  `addedAt`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  UNIQUE INDEX `LeagueTournament_leagueId_tournamentId_key` (`leagueId`, `tournamentId`),
  INDEX `LeagueTournament_leagueId_idx` (`leagueId`),
  INDEX `LeagueTournament_tournamentId_idx` (`tournamentId`),

  CONSTRAINT `LeagueTournament_leagueId_fkey`
    FOREIGN KEY (`leagueId`) REFERENCES `League`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `LeagueTournament_tournamentId_fkey`
    FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
