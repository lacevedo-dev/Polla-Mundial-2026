-- ─── Migración: Corporate Tenant (Multi-tenant B2B) ─────────────────────────
-- Ejecutar en orden. Rollback al final del archivo.

-- 1. Nuevas tablas

CREATE TABLE `CorporateTenant` (
  `id`             VARCHAR(191)  NOT NULL,
  `slug`           VARCHAR(191)  NOT NULL,
  `name`           VARCHAR(191)  NOT NULL,
  `legalName`      VARCHAR(191)  NULL,
  `contactEmail`   VARCHAR(191)  NOT NULL,
  `status`         ENUM('PENDING_SETUP','ACTIVE','SUSPENDED','CANCELLED') NOT NULL DEFAULT 'PENDING_SETUP',
  `planTier`       ENUM('STARTER','BUSINESS','ENTERPRISE') NOT NULL DEFAULT 'STARTER',
  `allowedDomains` TEXT          NULL,
  `customDomain`   VARCHAR(191)  NULL,
  `ssoEnabled`     TINYINT(1)    NOT NULL DEFAULT 0,
  `ssoProvider`    VARCHAR(191)  NULL,
  `ssoConfig`      LONGTEXT      NULL,
  `maxUsers`       INT           NOT NULL DEFAULT 50,
  `maxLeagues`     INT           NOT NULL DEFAULT 3,
  `createdAt`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`      DATETIME(3)   NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `CorporateTenant_slug_key` (`slug`),
  UNIQUE KEY `CorporateTenant_customDomain_key` (`customDomain`),
  INDEX `CorporateTenant_status_idx` (`status`),
  INDEX `CorporateTenant_customDomain_idx` (`customDomain`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TenantBranding` (
  `id`                  VARCHAR(191) NOT NULL,
  `tenantId`            VARCHAR(191) NOT NULL,
  `logoUrl`             VARCHAR(191) NULL,
  `faviconUrl`          VARCHAR(191) NULL,
  `primaryColor`        VARCHAR(191) NOT NULL DEFAULT '#16a34a',
  `secondaryColor`      VARCHAR(191) NOT NULL DEFAULT '#15803d',
  `accentColor`         VARCHAR(191) NOT NULL DEFAULT '#bbf7d0',
  `fontFamily`          VARCHAR(191) NOT NULL DEFAULT 'Inter',
  `heroImageUrl`        VARCHAR(191) NULL,
  `companyDisplayName`  VARCHAR(191) NULL,
  `customCss`           LONGTEXT     NULL,
  `emailHeaderHtml`     TEXT         NULL,
  `emailFooterHtml`     TEXT         NULL,
  `emailInviteTemplate` TEXT         NULL,
  `createdAt`           DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`           DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `TenantBranding_tenantId_key` (`tenantId`),
  CONSTRAINT `TenantBranding_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `CorporateTenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TenantConfig` (
  `id`                     VARCHAR(191) NOT NULL,
  `tenantId`               VARCHAR(191) NOT NULL,
  `enablePayments`         TINYINT(1)   NOT NULL DEFAULT 1,
  `enableAiInsights`       TINYINT(1)   NOT NULL DEFAULT 0,
  `enablePublicLeagues`    TINYINT(1)   NOT NULL DEFAULT 0,
  `enableUserSelfRegister` TINYINT(1)   NOT NULL DEFAULT 0,
  `requireInvitation`      TINYINT(1)   NOT NULL DEFAULT 1,
  `enableEmailNotif`       TINYINT(1)   NOT NULL DEFAULT 1,
  `enablePushNotif`        TINYINT(1)   NOT NULL DEFAULT 1,
  `enableStageFees`        TINYINT(1)   NOT NULL DEFAULT 1,
  `createdAt`              DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`              DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `TenantConfig_tenantId_key` (`tenantId`),
  CONSTRAINT `TenantConfig_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `CorporateTenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TenantMember` (
  `id`        VARCHAR(191)  NOT NULL,
  `tenantId`  VARCHAR(191)  NOT NULL,
  `userId`    VARCHAR(191)  NOT NULL,
  `role`      ENUM('OWNER','ADMIN','PLAYER') NOT NULL DEFAULT 'PLAYER',
  `status`    ENUM('ACTIVE','INACTIVE','BANNED') NOT NULL DEFAULT 'ACTIVE',
  `invitedAt` DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `joinedAt`  DATETIME(3)   NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `TenantMember_tenantId_userId_key` (`tenantId`, `userId`),
  INDEX `TenantMember_tenantId_idx` (`tenantId`),
  INDEX `TenantMember_userId_idx` (`userId`),
  INDEX `TenantMember_status_idx` (`status`),
  CONSTRAINT `TenantMember_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `CorporateTenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `TenantMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TenantSubscription` (
  `id`               VARCHAR(191) NOT NULL,
  `tenantId`         VARCHAR(191) NOT NULL,
  `billingModel`     ENUM('FLAT_MONTHLY','PER_USER','ANNUAL','CUSTOM') NOT NULL DEFAULT 'FLAT_MONTHLY',
  `priceMonthly`     INT          NOT NULL DEFAULT 0,
  `priceSetup`       INT          NOT NULL DEFAULT 0,
  `currency`         ENUM('COP','MXN','ARS','USD','CLP','PEN','BRL') NOT NULL DEFAULT 'COP',
  `stripeSubId`      VARCHAR(191) NULL,
  `status`           VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `currentPeriodEnd` DATETIME(3)  NULL,
  `createdAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`        DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `TenantSubscription_tenantId_key` (`tenantId`),
  INDEX `TenantSubscription_tenantId_idx` (`tenantId`),
  CONSTRAINT `TenantSubscription_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `CorporateTenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TenantInvitation` (
  `id`          VARCHAR(191) NOT NULL,
  `tenantId`    VARCHAR(191) NOT NULL,
  `email`       VARCHAR(191) NOT NULL,
  `role`        ENUM('OWNER','ADMIN','PLAYER') NOT NULL DEFAULT 'PLAYER',
  `token`       VARCHAR(191) NOT NULL,
  `status`      ENUM('SENT','CLICKED','ACCEPTED','EXPIRED') NOT NULL DEFAULT 'SENT',
  `bulkBatchId` VARCHAR(191) NULL,
  `sentAt`      DATETIME(3)  NULL,
  `resendCount` INT          NOT NULL DEFAULT 0,
  `expiresAt`   DATETIME(3)  NULL,
  `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `TenantInvitation_token_key` (`token`),
  UNIQUE KEY `TenantInvitation_tenantId_email_key` (`tenantId`, `email`),
  INDEX `TenantInvitation_tenantId_idx` (`tenantId`),
  INDEX `TenantInvitation_status_idx` (`status`),
  CONSTRAINT `TenantInvitation_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `CorporateTenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Columnas en tablas existentes

ALTER TABLE `League`
  ADD COLUMN `tenantId` VARCHAR(191) NULL AFTER `primaryTournamentId`,
  ADD INDEX `League_tenantId_idx` (`tenantId`),
  ADD CONSTRAINT `League_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `CorporateTenant` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `AuditLog`
  ADD COLUMN `tenantId` VARCHAR(191) NULL AFTER `leagueId`,
  ADD INDEX `AuditLog_tenantId_createdAt_idx` (`tenantId`, `createdAt`);

-- ─── ROLLBACK (ejecutar si necesitas deshacer) ────────────────────────────────
-- ALTER TABLE `AuditLog` DROP INDEX `AuditLog_tenantId_createdAt_idx`, DROP COLUMN `tenantId`;
-- ALTER TABLE `League` DROP FOREIGN KEY `League_tenantId_fkey`, DROP INDEX `League_tenantId_idx`, DROP COLUMN `tenantId`;
-- DROP TABLE IF EXISTS `TenantInvitation`;
-- DROP TABLE IF EXISTS `TenantSubscription`;
-- DROP TABLE IF EXISTS `TenantMember`;
-- DROP TABLE IF EXISTS `TenantConfig`;
-- DROP TABLE IF EXISTS `TenantBranding`;
-- DROP TABLE IF EXISTS `CorporateTenant`;
