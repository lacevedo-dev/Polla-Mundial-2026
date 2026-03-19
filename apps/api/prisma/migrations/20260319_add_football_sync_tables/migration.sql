-- NOTE:
-- Las columnas de sincronización en `Match` no se crean aquí para evitar
-- duplicar cambios ya existentes en bases donde esos campos fueron añadidos
-- previamente. Esta migración solo crea tablas auxiliares de sincronización.

-- CreateTable ApiFootballRequest
CREATE TABLE `ApiFootballRequest` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endpoint` VARCHAR(191) NOT NULL,
    `params` JSON NULL,
    `responseStatus` INTEGER NOT NULL,
    `matchesFetched` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex on date
CREATE INDEX `ApiFootballRequest_date_idx` ON `ApiFootballRequest`(`date`);

-- CreateTable DailySyncPlan
CREATE TABLE `DailySyncPlan` (
    `id` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `totalMatches` INTEGER NOT NULL,
    `intervalMinutes` INTEGER NOT NULL,
    `requestsUsed` INTEGER NOT NULL DEFAULT 0,
    `requestsBudget` INTEGER NOT NULL,
    `strategy` ENUM('AGGRESSIVE', 'BALANCED', 'CONSERVATIVE', 'EMERGENCY') NOT NULL,
    `lastSyncAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex on date
CREATE UNIQUE INDEX `DailySyncPlan_date_key` ON `DailySyncPlan`(`date`);
CREATE INDEX `DailySyncPlan_date_idx` ON `DailySyncPlan`(`date`);
