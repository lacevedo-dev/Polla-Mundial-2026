-- CreateTable
CREATE TABLE `LeagueMatch` (
    `id` VARCHAR(191) NOT NULL,
    `leagueId` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `addedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `addedBy` VARCHAR(191) NULL,

    INDEX `LeagueMatch_leagueId_active_idx`(`leagueId`, `active`),
    INDEX `LeagueMatch_matchId_idx`(`matchId`),
    UNIQUE INDEX `LeagueMatch_leagueId_matchId_key`(`leagueId`, `matchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `LeagueMatch` ADD CONSTRAINT `LeagueMatch_leagueId_fkey` FOREIGN KEY (`leagueId`) REFERENCES `League`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LeagueMatch` ADD CONSTRAINT `LeagueMatch_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
