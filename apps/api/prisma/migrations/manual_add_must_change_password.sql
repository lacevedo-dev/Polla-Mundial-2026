-- Agrega flag mustChangePassword para flujo de provisión corporativa
-- Cuando un superadmin provisiona un OWNER con contraseña temporal, este flag
-- se setea en true y el frontend obliga a cambiar la contraseña en el primer login.

ALTER TABLE `User`
  ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false AFTER `passwordHash`;

-- Rollback:
-- ALTER TABLE `User` DROP COLUMN `mustChangePassword`;
