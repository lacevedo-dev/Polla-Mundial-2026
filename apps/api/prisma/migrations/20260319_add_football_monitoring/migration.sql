-- Agregar relación de logs a Match
-- ALTER TABLE `Match` modificado para incluir syncLogs (solo es relación virtual)

-- Crear tabla de logs de sincronización
CREATE TABLE `FootballSyncLog` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('MANUAL_SYNC', 'AUTO_SYNC', 'CRON_SYNC', 'MATCH_SYNC', 'DAILY_PLAN', 'EMERGENCY_SYNC', 'TEST_SYNC') NOT NULL,
    `status` ENUM('SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED') NOT NULL,
    `matchId` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NULL,
    `message` TEXT NOT NULL,
    `details` LONGTEXT NULL,
    `requestsUsed` INTEGER NOT NULL DEFAULT 0,
    `matchesUpdated` INTEGER NOT NULL DEFAULT 0,
    `duration` INTEGER NULL,
    `error` LONGTEXT NULL,
    `triggeredBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FootballSyncLog_type_status_idx`(`type`, `status`),
    INDEX `FootballSyncLog_createdAt_idx`(`createdAt`),
    INDEX `FootballSyncLog_matchId_idx`(`matchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crear tabla de configuración de sincronización
CREATE TABLE `FootballSyncConfig` (
    `id` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `minSyncInterval` INTEGER NOT NULL DEFAULT 5,
    `maxSyncInterval` INTEGER NOT NULL DEFAULT 30,
    `dailyRequestLimit` INTEGER NOT NULL DEFAULT 100,
    `alertThreshold` INTEGER NOT NULL DEFAULT 90,
    `autoSyncEnabled` BOOLEAN NOT NULL DEFAULT true,
    `peakHoursSyncEnabled` BOOLEAN NOT NULL DEFAULT true,
    `emergencyModeThreshold` INTEGER NOT NULL DEFAULT 10,
    `notifyOnError` BOOLEAN NOT NULL DEFAULT true,
    `notifyOnLimit` BOOLEAN NOT NULL DEFAULT true,
    `updatedBy` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FootballSyncConfig_updatedAt_idx`(`updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Crear tabla de alertas de sincronización
CREATE TABLE `FootballSyncAlert` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('RATE_LIMIT_WARNING', 'RATE_LIMIT_EXCEEDED', 'SYNC_FAILURE', 'API_ERROR', 'CONFIGURATION_CHANGE', 'EMERGENCY_MODE', 'NO_MATCHES_UPDATED') NOT NULL,
    `severity` ENUM('INFO', 'WARNING', 'ERROR', 'CRITICAL') NOT NULL,
    `message` TEXT NOT NULL,
    `details` LONGTEXT NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedBy` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FootballSyncAlert_resolved_severity_idx`(`resolved`, `severity`),
    INDEX `FootballSyncAlert_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Agregar foreign key constraint para FootballSyncLog -> Match
ALTER TABLE `FootballSyncLog` ADD CONSTRAINT `FootballSyncLog_matchId_fkey` FOREIGN KEY (`matchId`) REFERENCES `Match`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Insertar configuración inicial
INSERT INTO `FootballSyncConfig` (
    `id`,
    `enabled`,
    `minSyncInterval`,
    `maxSyncInterval`,
    `dailyRequestLimit`,
    `alertThreshold`,
    `autoSyncEnabled`,
    `peakHoursSyncEnabled`,
    `emergencyModeThreshold`,
    `notifyOnError`,
    `notifyOnLimit`,
    `updatedAt`,
    `createdAt`
) VALUES (
    'default_config',
    true,
    5,
    30,
    100,
    90,
    true,
    true,
    10,
    true,
    true,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
);
