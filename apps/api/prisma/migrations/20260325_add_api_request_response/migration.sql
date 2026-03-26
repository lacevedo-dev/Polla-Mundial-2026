-- Add externalId and responseBody to ApiFootballRequest for per-match API history
ALTER TABLE `ApiFootballRequest`
  ADD COLUMN `externalId` VARCHAR(191) NULL,
  ADD COLUMN `responseBody` LONGTEXT NULL;

CREATE INDEX `ApiFootballRequest_externalId_idx` ON `ApiFootballRequest`(`externalId`);
