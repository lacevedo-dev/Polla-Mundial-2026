# Sistema de Lista Negra de Emails - Guía de Implementación

## 📋 Resumen

Este sistema previene que correos problemáticos (rebotes, direcciones inválidas, cuentas de prueba) bloqueen tus cuentas SMTP al:
1. Detectar automáticamente emails que rebotan
2. Bloquear emails después de 3 fallos consecutivos
3. Prevenir envíos futuros a emails bloqueados
4. Proteger tus cuentas SMTP de bloqueos por spam

---

## 🚀 Pasos de Instalación

### 1. Generar la Migración de Prisma

```bash
cd apps/api
npx prisma migrate dev --name add-email-blacklist
```

Esto creará la tabla `EmailBlacklist` en tu base de datos.

### 2. Generar el Cliente de Prisma

```bash
npx prisma generate
```

### 3. Desbloquear las Cuentas SMTP Actuales

Ejecutá esta query en tu base de datos para desbloquear las cuentas:

```sql
-- Desbloquear todos los providers
UPDATE `EmailProviderAccount`
SET blockedUntil = NULL, lastError = NULL
WHERE deletedAt IS NULL;

-- Limpiar también el uso del día
UPDATE `EmailProviderUsage`
SET blockedUntil = NULL, lastError = NULL
WHERE quotaWindowStart >= CURDATE();
```

### 4. Bloquear Correos de Prueba Existentes

**Opción A: Vía API (recomendado)**

Una vez que el servidor esté corriendo, ejecutá:

```bash
curl -X POST http://localhost:3000/admin/email-blacklist/block-test-emails \
  -H "Authorization: Bearer TU_TOKEN_ADMIN"
```

**Opción B: Vía SQL Directa**

```sql
-- Bloquear todos los emails de dominios de prueba
INSERT INTO `EmailBlacklist` (id, email, reason, failureCount, lastFailure, autoBlocked, blockedAt, blockedBy, createdAt, updatedAt)
SELECT
  CONCAT('auto_', MD5(LOWER(TRIM(recipientEmail)))),
  LOWER(TRIM(recipientEmail)),
  'INVALID_ADDRESS',
  3,
  NOW(),
  1,
  NOW(),
  'system',
  NOW(),
  NOW()
FROM `EmailJob`
WHERE (
  recipientEmail LIKE '%@polla-test.com'
  OR recipientEmail LIKE '%@seed.local'
  OR recipientEmail LIKE '%@prueba.com'
)
AND status IN ('FAILED', 'DROPPED')
GROUP BY LOWER(TRIM(recipientEmail))
ON DUPLICATE KEY UPDATE
  failureCount = failureCount + 1,
  lastFailure = NOW(),
  updatedAt = NOW();
```

### 5. Reiniciar el Servidor

```bash
npm run dev
# o
npm run start:prod
```

---

## 📊 Cómo Funciona

### Detección Automática

El sistema detecta automáticamente estos errores y bloquea el email:

- **Rebotes (BOUNCE)**:
  - "invalid address"
  - "mailbox not found"
  - "user unknown"
  - "recipient rejected"
  - "550 5.1.1" (Mailbox not found)

- **Bloqueo después de 3 fallos (REPEATED_FAILURE)**:
  - Emails que fallan 3 veces por cualquier motivo

### Flujo de Bloqueo

```
1. Email falla al enviarse
   ↓
2. Sistema detecta tipo de error
   ↓
3a. Si es bounce/dirección inválida → Bloqueo INMEDIATO
3b. Si es otro error → Incrementa contador de fallos
   ↓
4. Si contador >= 3 → Bloqueo AUTOMÁTICO
   ↓
5. Futuros intentos son rechazados ANTES de enviar
```

---

## 🔧 API de Administración

Todos los endpoints requieren autenticación de admin.

### Listar Emails Bloqueados

```bash
GET /admin/email-blacklist?reason=BOUNCE&autoBlocked=true&limit=50
```

### Agregar Email a Lista Negra

```bash
POST /admin/email-blacklist
Content-Type: application/json

{
  "email": "test@example.com",
  "reason": "MANUAL",
  "notes": "Usuario reportó spam"
}
```

### Remover Email de Lista Negra

```bash
DELETE /admin/email-blacklist/test@example.com
```

### Bloquear Dominio Completo

```bash
POST /admin/email-blacklist/block-domain
Content-Type: application/json

{
  "domain": "spam-domain.com",
  "reason": "SPAM_COMPLAINT"
}
```

---

## 🗃️ Tabla `EmailBlacklist`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String | ID único |
| email | String | Email bloqueado (normalizado a minúsculas) |
| reason | Enum | Motivo del bloqueo |
| failureCount | Int | Número de fallos registrados |
| lastFailure | DateTime | Fecha del último fallo |
| lastError | String | Mensaje del último error |
| autoBlocked | Boolean | true si fue bloqueado automáticamente |
| blockedAt | DateTime | Fecha de bloqueo |
| blockedBy | String | Usuario que bloqueó (null si automático) |
| notes | String | Notas adicionales |

### Valores de `reason`

- `BOUNCE` - Email rebotó (dirección no existe)
- `INVALID_ADDRESS` - Formato de dirección inválido
- `SPAM_COMPLAINT` - Queja de spam
- `MANUAL` - Bloqueado manualmente por admin
- `REPEATED_FAILURE` - Bloqueado tras 3 fallos

---

## 🎯 Beneficios

### Antes (sin blacklist)
```
❌ Email de prueba falla
❌ Sistema reintenta 3 veces
❌ Hostinger detecta múltiples rebotes
❌ Hostinger bloquea tu cuenta SMTP por 15 minutos
❌ TODOS los emails (reales) se bloquean
❌ Los usuarios no reciben notificaciones
```

### Ahora (con blacklist)
```
✅ Email de prueba falla
✅ Sistema lo bloquea INMEDIATAMENTE
✅ Futuros intentos son rechazados SIN enviar
✅ Hostinger NO ve los rebotes
✅ Tus cuentas SMTP permanecen activas
✅ Los emails reales sí se envían
```

---

## 📈 Monitoreo

### Ver Estadísticas

```sql
-- Emails bloqueados por motivo
SELECT reason, COUNT(*) as total
FROM `EmailBlacklist`
GROUP BY reason;

-- Emails bloqueados hoy
SELECT COUNT(*) as blocked_today
FROM `EmailBlacklist`
WHERE blockedAt >= CURDATE();

-- Top dominios bloqueados
SELECT
  SUBSTRING_INDEX(email, '@', -1) as domain,
  COUNT(*) as total
FROM `EmailBlacklist`
GROUP BY domain
ORDER BY total DESC
LIMIT 10;
```

---

## ⚠️ Notas Importantes

1. **Cache**: La blacklist se cachea por 1 minuto para performance
2. **Normalización**: Todos los emails se convierten a minúsculas
3. **No Reintentos**: Emails con error de destinatario NO se reintentan
4. **Protección SMTP**: Previene bloqueos de tus cuentas de Hostinger

---

## 🐛 Troubleshooting

### Los emails aún fallan con "Greeting never received"

**Causa**: Las cuentas SMTP todavía están bloqueadas

**Solución**:
```sql
UPDATE `EmailProviderAccount` SET blockedUntil = NULL WHERE id = 'cmna0juoj0000z8uek9umgkm2';
```

### Un email legítimo fue bloqueado por error

**Solución**:
```bash
DELETE /admin/email-blacklist/email@legitimo.com
```

### Quiero ver todos los emails que fallarone

```sql
SELECT e.recipientEmail, e.lastError, e.attemptCount, e.status
FROM `EmailJob` e
LEFT JOIN `EmailBlacklist` b ON LOWER(e.recipientEmail) = b.email
WHERE e.status IN ('FAILED', 'DROPPED')
ORDER BY e.lastAttemptAt DESC
LIMIT 50;
```

---

## ✅ Verificación Post-Instalación

1. Verificá que la tabla existe:
   ```sql
   SHOW TABLES LIKE 'EmailBlacklist';
   ```

2. Bloqueá los emails de prueba (opción A o B arriba)

3. Verificá que se bloquearon:
   ```sql
   SELECT COUNT(*) FROM `EmailBlacklist`;
   ```

4. Desbloqueá las cuentas SMTP

5. Verificá que los emails empiezan a enviarse:
   ```sql
   SELECT * FROM `EmailJob` WHERE status = 'SENT' AND sentAt > NOW() - INTERVAL 5 MINUTE;
   ```

---

¿Dudas? Revisá los logs del servidor para ver el comportamiento del sistema en tiempo real.
