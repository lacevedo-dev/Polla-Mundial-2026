-- El email ya no es un identificador único: múltiples miembros corporativos
-- pueden compartir una misma dirección de correo. El documento (documentNumber)
-- es el identificador primario en el contexto corporativo.
-- Se elimina el índice único y se deja un índice normal para mantener rendimiento.

DROP INDEX `User_email_key` ON `User`;
