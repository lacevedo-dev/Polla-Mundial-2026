-- Add PENDING_PAYMENT state to LeagueMember.status for paid invitation onboarding.
ALTER TABLE `LeagueMember`
    MODIFY `status` ENUM('PENDING', 'PENDING_PAYMENT', 'ACTIVE', 'REJECTED', 'BANNED') NOT NULL DEFAULT 'PENDING';

-- CreateTable ParticipationObligation
CREATE TABLE `ParticipationObligation` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `leagueId` VARCHAR(191) NOT NULL,
    `matchId` VARCHAR(191) NULL,
    `category` ENUM('PRINCIPAL', 'MATCH', 'GROUP', 'ROUND', 'PHASE') NOT NULL,
    `referenceId` VARCHAR(191) NULL,
    `referenceLabel` VARCHAR(191) NOT NULL,
    `source` ENUM('PREDICTION', 'INVITATION', 'ADMIN', 'SYSTEM') NOT NULL DEFAULT 'PREDICTION',
    `unitAmount` INTEGER NOT NULL,
    `multiplier` INTEGER NOT NULL DEFAULT 1,
    `totalAmount` INTEGER NOT NULL,
    `currency` ENUM('COP', 'MXN', 'ARS', 'USD', 'CLP', 'PEN', 'BRL') NOT NULL DEFAULT 'COP',
    `status` ENUM('PENDING_PAYMENT', 'PAID', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
    `deadlineAt` DATETIME(3) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `reminder30SentAt` DATETIME(3) NULL,
    `reminder10SentAt` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `expiredAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `ParticipationObligation_userId_status_idx` ON `ParticipationObligation`(`userId`, `status`);
CREATE INDEX `ParticipationObligation_leagueId_category_status_idx` ON `ParticipationObligation`(`leagueId`, `category`, `status`);
CREATE INDEX `ParticipationObligation_deadlineAt_status_idx` ON `ParticipationObligation`(`deadlineAt`, `status`);
CREATE INDEX `ParticipationObligation_matchId_idx` ON `ParticipationObligation`(`matchId`);
CREATE INDEX `ParticipationObligation_orderId_idx` ON `ParticipationObligation`(`orderId`);

ALTER TABLE `ParticipationObligation`
    ADD CONSTRAINT `ParticipationObligation_userId_fkey`
        FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `ParticipationObligation_leagueId_fkey`
        FOREIGN KEY (`leagueId`) REFERENCES `League`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `ParticipationObligation_matchId_fkey`
        FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
