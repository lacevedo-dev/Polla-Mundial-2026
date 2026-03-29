CREATE TABLE `AutomationRun` (
  `id` VARCHAR(191) NOT NULL,
  `correlationId` VARCHAR(191) NULL,
  `step` ENUM('MATCH_REMINDER','PREDICTION_CLOSING','RESULT_NOTIFICATION','PREDICTION_REPORT','RESULT_REPORT') NOT NULL,
  `status` ENUM('RUNNING','SUCCESS','WARNING','FAILED','SKIPPED') NOT NULL,
  `trigger` ENUM('SCHEDULER','MANUAL') NOT NULL DEFAULT 'SCHEDULER',
  `matchId` VARCHAR(191) NOT NULL,
  `leagueId` VARCHAR(191) NULL,
  `scheduledAt` DATETIME(3) NULL,
  `startedAt` DATETIME(3) NOT NULL,
  `finishedAt` DATETIME(3) NULL,
  `summary` TEXT NULL,
  `errorMessage` TEXT NULL,
  `details` JSON NULL,
  `audienceCount` INTEGER NULL,
  `deliveredCount` INTEGER NULL,
  `failedCount` INTEGER NULL,
  `warningCount` INTEGER NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  INDEX `AutomationRun_matchId_step_startedAt_idx`(`matchId`, `step`, `startedAt`),
  INDEX `AutomationRun_leagueId_step_startedAt_idx`(`leagueId`, `step`, `startedAt`),
  INDEX `AutomationRun_status_startedAt_idx`(`status`, `startedAt`),
  INDEX `AutomationRun_trigger_startedAt_idx`(`trigger`, `startedAt`),
  INDEX `AutomationRun_scheduledAt_idx`(`scheduledAt`),
  INDEX `AutomationRun_correlationId_idx`(`correlationId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AutomationRun`
  ADD CONSTRAINT `AutomationRun_matchId_fkey`
    FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `AutomationRun`
  ADD CONSTRAINT `AutomationRun_leagueId_fkey`
    FOREIGN KEY (`leagueId`) REFERENCES `League`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
