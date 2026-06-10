-- Migración: Tabla Notification para notificaciones in-app en BD corporativa

CREATE TABLE IF NOT EXISTS `Notification` (
  `id`      VARCHAR(191) NOT NULL,
  `userId`  VARCHAR(191) NOT NULL,
  `type`    ENUM('MATCH_REMINDER','PREDICTION_CLOSED','RESULT_PUBLISHED','RANKING_CHANGE','INVITE_RECEIVED','PAYMENT_CONFIRMED','LEAGUE_UPDATE','GOAL_SCORED') NOT NULL,
  `title`   VARCHAR(191) NOT NULL,
  `body`    TEXT NOT NULL,
  `data`    LONGTEXT NULL,
  `read`    BOOLEAN NOT NULL DEFAULT false,
  `channel` ENUM('IN_APP','PUSH','EMAIL') NOT NULL DEFAULT 'IN_APP',
  `sentAt`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `Notification_userId_read_idx` (`userId`, `read`),
  INDEX `Notification_sentAt_idx` (`sentAt`),
  CONSTRAINT `Notification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
