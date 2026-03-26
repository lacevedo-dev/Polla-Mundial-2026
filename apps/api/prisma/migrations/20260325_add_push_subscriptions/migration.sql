-- Add PushSubscription table for Web Push notifications
CREATE TABLE `PushSubscription` (
  `id`        VARCHAR(191) NOT NULL,
  `userId`    VARCHAR(191) NOT NULL,
  `endpoint`  LONGTEXT     NOT NULL,
  `p256dh`    LONGTEXT     NOT NULL,
  `auth`      LONGTEXT     NOT NULL,
  `userAgent` VARCHAR(512) NULL,
  `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `PushSubscription_userId_idx` (`userId`),
  CONSTRAINT `PushSubscription_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
