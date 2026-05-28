-- Migración: Password Reset Token + OAuth fields
-- Ejecutar en producción después de desplegar

ALTER TABLE `User`
  ADD COLUMN `googleId` VARCHAR(191) NULL AFTER `mustChangePassword`,
  ADD COLUMN `githubId` VARCHAR(191) NULL AFTER `googleId`,
  ADD UNIQUE INDEX `User_googleId_key` (`googleId`),
  ADD UNIQUE INDEX `User_githubId_key` (`githubId`),
  MODIFY COLUMN `passwordHash` VARCHAR(191) NULL;

CREATE TABLE `PasswordResetToken` (
  `id`        VARCHAR(191) NOT NULL,
  `token`     VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `usedAt`    DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PasswordResetToken_token_key` (`token`),
  INDEX `PasswordResetToken_userId_idx` (`userId`),
  INDEX `PasswordResetToken_expiresAt_idx` (`expiresAt`),
  CONSTRAINT `PasswordResetToken_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
