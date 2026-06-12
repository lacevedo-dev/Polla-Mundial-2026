-- Add whatsappGroupId to League
ALTER TABLE `League` ADD COLUMN `whatsappGroupId` VARCHAR(64) NULL;

-- Create WhatsappGroupJobType enum inline (stored as VARCHAR in MySQL)
-- Create WhatsappJobStatus enum inline (stored as VARCHAR in MySQL)

-- Create WhatsappGroupJob table
CREATE TABLE `WhatsappGroupJob` (
  `id`           VARCHAR(191)  NOT NULL,
  `type`         ENUM('RESULT_REPORT', 'PREDICTION_REPORT') NOT NULL,
  `status`       ENUM('PENDING', 'SENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `matchId`      VARCHAR(191)  NOT NULL,
  `leagueId`     VARCHAR(191)  NOT NULL,
  `groupId`      VARCHAR(64)   NOT NULL,
  `dedupeKey`    VARCHAR(191)  NOT NULL,
  `caption`      LONGTEXT      NOT NULL,
  `attemptCount` INT           NOT NULL DEFAULT 0,
  `lastError`    TEXT          NULL,
  `sentAt`       DATETIME(3)   NULL,
  `createdAt`    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)   NOT NULL,

  UNIQUE INDEX `WhatsappGroupJob_dedupeKey_key` (`dedupeKey`),
  INDEX `WhatsappGroupJob_status_createdAt_idx` (`status`, `createdAt`),
  INDEX `WhatsappGroupJob_matchId_idx` (`matchId`),
  INDEX `WhatsappGroupJob_leagueId_idx` (`leagueId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add foreign key from WhatsappGroupJob.leagueId → League.id
ALTER TABLE `WhatsappGroupJob`
  ADD CONSTRAINT `WhatsappGroupJob_leagueId_fkey`
  FOREIGN KEY (`leagueId`) REFERENCES `League`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
