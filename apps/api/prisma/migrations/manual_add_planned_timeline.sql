-- ============================================================
-- Migración: Sistema Auto-Adaptable de Sincronización
-- Fecha: 2026-04-29
-- Base de datos: u515832100_polla_ui_prod
-- ============================================================

-- 1. Campos de persistencia del plan en DailySyncPlan
ALTER TABLE `DailySyncPlan`
  ADD COLUMN `plannedTimeline` JSON NULL AFTER `lastSyncAt`,
  ADD COLUMN `timelineVersion` INT NOT NULL DEFAULT 1 AFTER `plannedTimeline`;

-- 2. Campos del sistema auto-adaptable en FootballSyncConfig
ALTER TABLE `FootballSyncConfig`
  ADD COLUMN `syncMode`                    VARCHAR(20)  NOT NULL DEFAULT 'SEMI_AUTO'    AFTER `eventSyncEnabled`,
  ADD COLUMN `enableSmartGrouping`         TINYINT(1)   NOT NULL DEFAULT 1             AFTER `syncMode`,
  ADD COLUMN `groupingWindowMinutes`       INT          NOT NULL DEFAULT 15            AFTER `enableSmartGrouping`,
  ADD COLUMN `maxMatchesPerGroup`          INT          NOT NULL DEFAULT 10            AFTER `groupingWindowMinutes`,
  ADD COLUMN `enableResponseCache`         TINYINT(1)   NOT NULL DEFAULT 1             AFTER `maxMatchesPerGroup`,
  ADD COLUMN `cacheExpirationMinutes`      INT          NOT NULL DEFAULT 5             AFTER `enableResponseCache`,
  ADD COLUMN `maxCacheSize`               INT          NOT NULL DEFAULT 100           AFTER `cacheExpirationMinutes`,
  ADD COLUMN `enableDeduplication`         TINYINT(1)   NOT NULL DEFAULT 1             AFTER `maxCacheSize`,
  ADD COLUMN `minMinutesBetweenSyncs`      INT          NOT NULL DEFAULT 3             AFTER `enableDeduplication`,
  ADD COLUMN `skipUnchangedMatches`        TINYINT(1)   NOT NULL DEFAULT 1             AFTER `minMinutesBetweenSyncs`,
  ADD COLUMN `enableAutoAdjustment`        TINYINT(1)   NOT NULL DEFAULT 0             AFTER `skipUnchangedMatches`,
  ADD COLUMN `autoAdjustSensitivity`       VARCHAR(10)  NOT NULL DEFAULT 'MEDIUM'      AFTER `enableAutoAdjustment`,
  ADD COLUMN `maxAutoIntervalChange`       INT          NOT NULL DEFAULT 10            AFTER `autoAdjustSensitivity`,
  ADD COLUMN `autoAdjustCooldown`          INT          NOT NULL DEFAULT 30            AFTER `maxAutoIntervalChange`,
  ADD COLUMN `freshnessEfficiencyBalance`  INT          NOT NULL DEFAULT 50            AFTER `autoAdjustCooldown`,
  ADD COLUMN `notifyOnAdjustment`          TINYINT(1)   NOT NULL DEFAULT 1             AFTER `freshnessEfficiencyBalance`,
  ADD COLUMN `notifyOnAnomaly`             TINYINT(1)   NOT NULL DEFAULT 1             AFTER `notifyOnAdjustment`,
  ADD COLUMN `adjustmentNotificationEmail` VARCHAR(255) NULL                           AFTER `notifyOnAnomaly`;

-- 3. Tabla de logs de auto-ajuste
CREATE TABLE `AutoAdjustmentLog` (
  `id`               VARCHAR(30)  NOT NULL,
  `date`             VARCHAR(10)  NOT NULL,
  `triggerCondition` TEXT         NOT NULL,
  `actionTaken`      TEXT         NOT NULL,
  `reason`           TEXT         NULL,
  `beforeState`      JSON         NOT NULL,
  `afterState`       JSON         NOT NULL,
  `impact`           JSON         NULL,
  `approvedBy`       VARCHAR(255) NULL,
  `approvedAt`       DATETIME(3)  NULL,
  `createdAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `AutoAdjustmentLog_date_idx` (`date`),
  INDEX `AutoAdjustmentLog_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabla de métricas de optimización
CREATE TABLE `SyncOptimizationMetrics` (
  `id`                    VARCHAR(30)   NOT NULL,
  `date`                  VARCHAR(10)   NOT NULL,
  `requestsSaved`         INT           NOT NULL DEFAULT 0,
  `avgSyncDurationMs`     INT           NOT NULL DEFAULT 0,
  `duplicateSyncsAvoided` INT           NOT NULL DEFAULT 0,
  `cacheHitRate`          DOUBLE        NOT NULL DEFAULT 0,
  `autoAdjustmentsCount`  INT           NOT NULL DEFAULT 0,
  `quotaUtilization`      DOUBLE        NOT NULL DEFAULT 0,
  `missedMatches`         INT           NOT NULL DEFAULT 0,
  `staleDataIncidents`    INT           NOT NULL DEFAULT 0,
  `errorRate`             DOUBLE        NOT NULL DEFAULT 0,
  `groupingSavings`       INT           NOT NULL DEFAULT 0,
  `dedupSavings`          INT           NOT NULL DEFAULT 0,
  `cacheSavings`          INT           NOT NULL DEFAULT 0,
  `createdAt`             DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt`             DATETIME(3)   NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SyncOptimizationMetrics_date_key` (`date`),
  INDEX `SyncOptimizationMetrics_date_idx` (`date`),
  INDEX `SyncOptimizationMetrics_createdAt_idx` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Tabla de caché de respuestas API
CREATE TABLE `ApiResponseCache` (
  `id`         VARCHAR(100)  NOT NULL,
  `endpoint`   VARCHAR(255)  NOT NULL,
  `paramsHash` VARCHAR(64)   NOT NULL,
  `response`   LONGTEXT      NOT NULL,
  `matchIds`   TEXT          NULL,
  `hitCount`   INT           NOT NULL DEFAULT 0,
  `fetchedAt`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expiresAt`  DATETIME(3)   NOT NULL,
  `createdAt`  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `ApiResponseCache_endpoint_paramsHash_key` (`endpoint`, `paramsHash`),
  INDEX `ApiResponseCache_expiresAt_idx` (`expiresAt`),
  INDEX `ApiResponseCache_fetchedAt_idx` (`fetchedAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ROLLBACK (ejecutar solo si hay problemas):
-- ============================================================
-- ALTER TABLE `DailySyncPlan` DROP COLUMN `plannedTimeline`, DROP COLUMN `timelineVersion`;
-- ALTER TABLE `FootballSyncConfig` DROP COLUMN `syncMode`, DROP COLUMN `enableSmartGrouping`,
--   DROP COLUMN `groupingWindowMinutes`, DROP COLUMN `maxMatchesPerGroup`,
--   DROP COLUMN `enableResponseCache`, DROP COLUMN `cacheExpirationMinutes`, DROP COLUMN `maxCacheSize`,
--   DROP COLUMN `enableDeduplication`, DROP COLUMN `minMinutesBetweenSyncs`, DROP COLUMN `skipUnchangedMatches`,
--   DROP COLUMN `enableAutoAdjustment`, DROP COLUMN `autoAdjustSensitivity`, DROP COLUMN `maxAutoIntervalChange`,
--   DROP COLUMN `autoAdjustCooldown`, DROP COLUMN `freshnessEfficiencyBalance`,
--   DROP COLUMN `notifyOnAdjustment`, DROP COLUMN `notifyOnAnomaly`, DROP COLUMN `adjustmentNotificationEmail`;
-- DROP TABLE IF EXISTS `AutoAdjustmentLog`;
-- DROP TABLE IF EXISTS `SyncOptimizationMetrics`;
-- DROP TABLE IF EXISTS `ApiResponseCache`;
