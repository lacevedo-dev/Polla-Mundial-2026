-- Cache de sticker premium generado con OpenAI (una sola generación por jugador)
ALTER TABLE `PlayerProfile`
    ADD COLUMN `premiumStickerUrl` VARCHAR(512) NULL,
    ADD COLUMN `premiumStickerGeneratedAt` DATETIME(3) NULL;
