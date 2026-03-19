-- CreateTable
CREATE TABLE `AiUsageRecord` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `leagueId` VARCHAR(191) NULL,
    `matchId` VARCHAR(191) NULL,
    `feature` VARCHAR(191) NOT NULL,
    `creditsUsed` INTEGER NOT NULL DEFAULT 1,
    `requestData` LONGTEXT NULL,
    `responseData` LONGTEXT NULL,
    `insightGenerated` BOOLEAN NOT NULL DEFAULT false,
    `clientInfo` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiUsageRecord_userId_createdAt_idx`(`userId`, `createdAt` DESC),
    INDEX `AiUsageRecord_leagueId_createdAt_idx`(`leagueId`, `createdAt` DESC),
    INDEX `AiUsageRecord_feature_createdAt_idx`(`feature`, `createdAt` DESC),
    INDEX `AiUsageRecord_createdAt_idx`(`createdAt` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserAiCredits` (
    `userId` VARCHAR(191) NOT NULL,
    `plan` ENUM('FREE', 'GOLD', 'DIAMOND') NOT NULL,
    `totalCredits` INTEGER NOT NULL,
    `usedCredits` INTEGER NOT NULL DEFAULT 0,
    `lastResetAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UserAiCredits_plan_idx`(`plan`),
    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AiUsageRecord` ADD CONSTRAINT `AiUsageRecord_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
