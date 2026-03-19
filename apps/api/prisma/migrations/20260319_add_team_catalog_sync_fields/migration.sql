-- Add canonical API-Football identity and compact display fields to Team
ALTER TABLE `Team`
  ADD COLUMN `shortCode` VARCHAR(8) NULL,
  ADD COLUMN `apiFootballTeamId` INTEGER NULL;

-- Backfill shortCode from the existing team code to keep current records usable
UPDATE `Team`
SET `shortCode` = `code`
WHERE `shortCode` IS NULL;

-- Add indexes for compact UI lookups and sync reconciliation
CREATE INDEX `Team_shortCode_idx` ON `Team`(`shortCode`);
CREATE UNIQUE INDEX `Team_apiFootballTeamId_key` ON `Team`(`apiFootballTeamId`);
