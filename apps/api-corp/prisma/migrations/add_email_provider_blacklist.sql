-- Migración: Agregar tablas de proveedor de email y lista negra al schema corporativo
-- Necesario para que funcione el sistema de cola de correos (EmailQueueService, EmailBlacklistService)

CREATE TABLE IF NOT EXISTS `EmailProviderUsage` (
  `id`               VARCHAR(191) NOT NULL,
  `providerKey`      VARCHAR(191) NOT NULL,
  `quotaWindowStart` DATETIME(3)  NOT NULL,
  `sentCount`        INT          NOT NULL DEFAULT 0,
  `blockedUntil`     DATETIME(3)  NULL,
  `lastError`        TEXT         NULL,
  `createdAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`        DATETIME(3)  NOT NULL,

  UNIQUE INDEX `EmailProviderUsage_providerKey_quotaWindowStart_key` (`providerKey`, `quotaWindowStart`),
  INDEX       `EmailProviderUsage_providerKey_blockedUntil_idx` (`providerKey`, `blockedUntil`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `EmailProviderAccount` (
  `id`                      VARCHAR(191) NOT NULL,
  `key`                     VARCHAR(191) NOT NULL,
  `name`                    VARCHAR(120) NOT NULL,
  `fromEmail`               VARCHAR(320) NOT NULL,
  `fromName`                VARCHAR(191) NULL,
  `smtpHost`                VARCHAR(255) NOT NULL,
  `smtpPort`                INT          NOT NULL DEFAULT 587,
  `secure`                  BOOLEAN      NOT NULL DEFAULT false,
  `smtpUser`                VARCHAR(320) NULL,
  `smtpPassEncrypted`       LONGTEXT     NULL,
  `dailyLimit`              INT          NOT NULL DEFAULT 100,
  `reservedHighPriority`    INT          NOT NULL DEFAULT 60,
  `maxRecipientsPerMessage` INT          NOT NULL DEFAULT 100,
  `maxEmailSizeMb`          INT          NOT NULL DEFAULT 35,
  `maxAttachmentSizeMb`     INT          NOT NULL DEFAULT 25,
  `active`                  BOOLEAN      NOT NULL DEFAULT true,
  `blockedUntil`            DATETIME(3)  NULL,
  `lastUsedAt`              DATETIME(3)  NULL,
  `lastError`               TEXT         NULL,
  `deletedAt`               DATETIME(3)  NULL,
  `createdAt`               DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`               DATETIME(3)  NOT NULL,

  UNIQUE INDEX `EmailProviderAccount_key_key` (`key`),
  INDEX       `EmailProviderAccount_active_deletedAt_idx` (`active`, `deletedAt`),
  INDEX       `EmailProviderAccount_key_blockedUntil_idx` (`key`, `blockedUntil`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `EmailBlacklist` (
  `id`           VARCHAR(191) NOT NULL,
  `email`        VARCHAR(320) NOT NULL,
  `reason`       ENUM('BOUNCE','INVALID_ADDRESS','SPAM_COMPLAINT','MANUAL','REPEATED_FAILURE') NOT NULL DEFAULT 'BOUNCE',
  `failureCount` INT          NOT NULL DEFAULT 1,
  `lastFailure`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `lastError`    TEXT         NULL,
  `autoBlocked`  BOOLEAN      NOT NULL DEFAULT true,
  `blockedAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `blockedBy`    VARCHAR(191) NULL,
  `notes`        TEXT         NULL,
  `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`    DATETIME(3)  NOT NULL,

  UNIQUE INDEX `EmailBlacklist_email_key` (`email`),
  INDEX       `EmailBlacklist_email_idx` (`email`),
  INDEX       `EmailBlacklist_reason_idx` (`reason`),
  INDEX       `EmailBlacklist_autoBlocked_idx` (`autoBlocked`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
