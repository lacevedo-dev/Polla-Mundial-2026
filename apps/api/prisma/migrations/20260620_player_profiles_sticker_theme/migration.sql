-- Perfiles de jugador cacheados (API-Football /players/profiles + squads)
CREATE TABLE `PlayerProfile` (
    `id` VARCHAR(191) NOT NULL,
    `apiFootballPlayerId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `firstname` VARCHAR(191) NULL,
    `lastname` VARCHAR(191) NULL,
    `photoUrl` VARCHAR(512) NULL,
    `nationality` VARCHAR(191) NULL,
    `birthDate` VARCHAR(32) NULL,
    `height` VARCHAR(32) NULL,
    `weight` VARCHAR(32) NULL,
    `jerseyNumber` INTEGER NULL,
    `teamApiFootballId` INTEGER NULL,
    `profileFetchedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PlayerProfile_apiFootballPlayerId_key`(`apiFootballPlayerId`),
    INDEX `PlayerProfile_teamApiFootballId_idx`(`teamApiFootballId`),
    INDEX `PlayerProfile_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Tema visual del sticker por selección
ALTER TABLE `Team`
    ADD COLUMN `stickerPrimaryColor` VARCHAR(7) NULL,
    ADD COLUMN `stickerSecondaryColor` VARCHAR(7) NULL,
    ADD COLUMN `stickerAccentColor` VARCHAR(7) NULL,
    ADD COLUMN `stickerPillFromColor` VARCHAR(7) NULL,
    ADD COLUMN `stickerPillToColor` VARCHAR(7) NULL;

-- ID externo del jugador en eventos de partido
ALTER TABLE `MatchEvent`
    ADD COLUMN `playerExternalId` INTEGER NULL,
    ADD COLUMN `assistExternalId` INTEGER NULL;

CREATE INDEX `MatchEvent_playerExternalId_idx` ON `MatchEvent`(`playerExternalId`);
