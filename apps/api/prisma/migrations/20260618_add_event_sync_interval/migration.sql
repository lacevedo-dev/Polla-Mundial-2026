ALTER TABLE `FootballSyncConfig`
  ADD COLUMN `eventSyncIntervalMinutes` INT NOT NULL DEFAULT 1 AFTER `eventSyncEnabled`;

ALTER TABLE `DailySyncPlan`
  ADD COLUMN `lastEventPollAt` DATETIME(3) NULL AFTER `lastSyncAt`;
