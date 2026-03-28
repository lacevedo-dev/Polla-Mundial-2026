ALTER TABLE `User`
  ADD COLUMN `status` ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX `User_status_idx` ON `User`(`status`);
