-- CreateTable
CREATE TABLE `WhatsappPersonalLog` (
    `id` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SENDING', 'SENT', 'FAILED') NOT NULL,
    `source` ENUM('AUTOMATION', 'PAYMENT_REMINDER', 'LEAGUE_BROADCAST') NOT NULL,
    `automationStep` ENUM('MATCH_REMINDER', 'PREDICTION_CLOSING', 'RESULT_NOTIFICATION', 'PREDICTION_REPORT', 'RESULT_REPORT', 'ESCALATION_T45', 'ESCALATION_T30', 'ESCALATION_FINAL', 'MATCH_START', 'HALFTIME', 'SECOND_HALF_START', 'MATCH_LIVE_END', 'GOAL_SCORED', 'GOAL_IMPACT', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION') NULL,
    `notificationType` ENUM('MATCH_REMINDER', 'PREDICTION_CLOSED', 'RESULT_PUBLISHED', 'RANKING_CHANGE', 'INVITE_RECEIVED', 'PAYMENT_CONFIRMED', 'LEAGUE_UPDATE', 'GOAL_SCORED') NULL,
    `userId` VARCHAR(191) NULL,
    `userName` VARCHAR(120) NULL,
    `countryCode` VARCHAR(8) NOT NULL DEFAULT '+57',
    `phone` VARCHAR(32) NOT NULL,
    `message` LONGTEXT NOT NULL,
    `via` ENUM('WHATSAPP_WEB', 'TWILIO') NULL,
    `lastError` TEXT NULL,
    `leagueId` VARCHAR(191) NULL,
    `matchId` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WhatsappPersonalLog_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `WhatsappPersonalLog_userId_idx`(`userId`),
    INDEX `WhatsappPersonalLog_leagueId_idx`(`leagueId`),
    INDEX `WhatsappPersonalLog_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WhatsappPersonalLog` ADD CONSTRAINT `WhatsappPersonalLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WhatsappPersonalLog` ADD CONSTRAINT `WhatsappPersonalLog_leagueId_fkey` FOREIGN KEY (`leagueId`) REFERENCES `League`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
