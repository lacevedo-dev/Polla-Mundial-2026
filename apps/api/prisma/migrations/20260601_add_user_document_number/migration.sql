ALTER TABLE `User` ADD COLUMN `documentNumber` VARCHAR(64) NULL;

CREATE UNIQUE INDEX `User_documentNumber_key` ON `User`(`documentNumber`);
