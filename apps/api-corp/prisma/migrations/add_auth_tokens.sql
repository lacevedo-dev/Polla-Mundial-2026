-- Migración: Agregar tablas de tokens de autenticación al schema corporativo
-- Necesario para que funcionen forgot-password, reset-password y verificación de email

CREATE TABLE IF NOT EXISTS `VerificationToken` (
  `id`        VARCHAR(191) NOT NULL,
  `token`     VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3)  NOT NULL,
  `usedAt`    DATETIME(3)  NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `VerificationToken_token_key` (`token`),
  INDEX       `VerificationToken_userId_idx` (`userId`),
  INDEX       `VerificationToken_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`),

  CONSTRAINT `VerificationToken_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `PasswordResetToken` (
  `id`        VARCHAR(191) NOT NULL,
  `token`     VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3)  NOT NULL,
  `usedAt`    DATETIME(3)  NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `PasswordResetToken_token_key` (`token`),
  INDEX       `PasswordResetToken_userId_idx` (`userId`),
  INDEX       `PasswordResetToken_expiresAt_idx` (`expiresAt`),
  PRIMARY KEY (`id`),

  CONSTRAINT `PasswordResetToken_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
