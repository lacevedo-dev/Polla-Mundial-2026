-- Migración inicial para BD Corporativa
-- Ejecutar manualmente en el servidor de producción

-- Crear base de datos corporativa (si no existe)
CREATE DATABASE IF NOT EXISTS `polla_corp` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `polla_corp`;

-- Este archivo se genera automáticamente con: npx prisma migrate dev --name init
-- Por ahora, ejecutar: npx prisma db push para crear las tablas
