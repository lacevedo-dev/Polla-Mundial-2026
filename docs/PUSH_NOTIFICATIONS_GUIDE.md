# Guía de Notificaciones Push - Polla Mundial 2026

## 🎯 Resumen

Las notificaciones push web funcionan **por navegador y por dispositivo**. Cada combinación de navegador/dispositivo necesita activar las notificaciones de forma independiente.

## ✅ Mejoras Implementadas

### 1. Hook `usePushNotifications` mejorado

**Archivo:** `apps/web/hooks/usePushNotifications.ts`

**Mejoras:**
- ✅ Detección automática del estado de suscripción al cargar
- ✅ Re-verificación cuando la página vuelve a estar visible (cambio de tab)
- ✅ Manejo robusto de errores del Service Worker
- ✅ Limpieza de suscripciones antiguas antes de crear nuevas
- ✅ Logging detallado en consola para debugging

**Estados que detecta:**
```typescript
{
  supported: boolean;      // ¿El navegador soporta push?
  permission: 'default' | 'granted' | 'denied' | 'unsupported';
  subscribed: boolean;     // ¿Este navegador/dispositivo está suscrito?
  loading: boolean;        // ¿Está procesando una acción?
  error: string | null;    // Mensaje de error si hay
}
```

### 2. Componente `PushNotificationDebug`

**Archivo:** `apps/web/components/PushNotificationDebug.tsx`

Panel de debug que muestra:
- Estado de soporte del navegador
- Permisos de notificación
- Estado del Service Worker
- Suscripción activa en este dispositivo
- Endpoint de la suscripción
- Botones de acción contextuales

### 3. Vista `PushNotificationSettings`

**Archivo:** `apps/web/views/PushNotificationSettings.tsx`

Vista completa con:
- Toggle de notificaciones
- Información importante sobre independencia de navegadores
- Panel de debug (colapsable)
- Guía de solución de problemas

## 🔧 Cómo Funciona

### Flujo de Activación

```
1. Usuario abre la app en Chrome
   ↓
2. Hook detecta: subscribed = false
   ↓
3. Botón muestra: "Activar notificaciones"
   ↓
4. Usuario hace click
   ↓
5. Se solicita permiso (Notification.requestPermission)
   ↓
6. Si concede: se crea suscripción push
   ↓
7. Se guarda en backend (tabla push_subscriptions)
   ↓
8. Hook actualiza: subscribed = true
   ↓
9. Botón muestra: "Notificaciones activas"
```

### Independencia por Navegador

```
Usuario en Chrome Desktop:
  - subscribed = true ✅
  - Recibe notificaciones ✅

Mismo usuario en Firefox Desktop:
  - subscribed = false ❌ (diferente navegador)
  - Debe activar nuevamente
  - Botón muestra: "Activar notificaciones"

Mismo usuario en Chrome Mobile:
  - subscribed = false ❌ (diferente dispositivo)
  - Debe activar nuevamente
  - Botón muestra: "Activar notificaciones"
```

## 📱 Compatibilidad por Navegador

| Navegador | Desktop | Mobile | Notas |
|-----------|---------|--------|-------|
| Chrome | ✅ | ✅ | Soporte completo |
| Edge | ✅ | ✅ | Basado en Chromium |
| Firefox | ✅ | ✅ | Requiere HTTPS |
| Safari | ✅ (16.4+) | ⚠️ (16.4+) | iOS requiere PWA instalada |
| Opera | ✅ | ✅ | Basado en Chromium |
| Samsung Internet | - | ✅ | Android |

## 🚀 Uso en Componentes

### Opción 1: Componente Simple

```tsx
import { NotificationToggle } from '../components/PWAPrompt';

function MyComponent() {
  return (
    <div>
      <h2>Configuración</h2>
      <NotificationToggle />
    </div>
  );
}
```

### Opción 2: Vista Completa

```tsx
import { PushNotificationSettings } from '../views/PushNotificationSettings';

// En tu router
<Route path="/settings/notifications" element={<PushNotificationSettings />} />
```

### Opción 3: Hook Personalizado

```tsx
import { usePushNotifications } from '../hooks/usePushNotifications';

function CustomNotificationButton() {
  const { subscribed, loading, subscribe, unsubscribe } = usePushNotifications();

  return (
    <button onClick={subscribed ? unsubscribe : subscribe} disabled={loading}>
      {subscribed ? '🔔 Activas' : '🔕 Activar'}
    </button>
  );
}
```

## 🔍 Debugging

### Consola del Navegador

```javascript
// Verificar Service Worker
navigator.serviceWorker.getRegistrations().then(console.log);

// Verificar permisos
console.log('Permission:', Notification.permission);

// Verificar suscripción
navigator.serviceWorker.ready.then(reg => 
  reg.pushManager.getSubscription().then(console.log)
);
```

### Componente de Debug

```tsx
import { PushNotificationDebug } from '../components/PushNotificationDebug';

function DebugPage() {
  return <PushNotificationDebug />;
}
```

## ⚠️ Problemas Comunes

### "El botón siempre muestra 'Activar' aunque ya activé"

**Causa:** Estás en un navegador/dispositivo diferente.

**Solución:** Activa las notificaciones en cada navegador donde quieras recibirlas.

### "Funcionaba pero dejó de funcionar"

**Causa:** La suscripción expiró o el usuario limpió datos del navegador.

**Solución:** El sistema detecta automáticamente y muestra el botón para re-activar.

### "No funciona en iOS"

**Causa:** iOS requiere que la PWA esté instalada.

**Solución:**
1. Abrir en Safari
2. Compartir → Agregar a pantalla de inicio
3. Abrir desde el ícono instalado
4. Activar notificaciones

### "Service Worker no disponible"

**Causa:** El SW no se registró correctamente.

**Solución:**
1. Recargar la página (Ctrl+R)
2. Si persiste, limpiar caché del navegador
3. Verificar que estés en HTTPS (o localhost)

## 🧪 Testing

### Probar Suscripción

```bash
# Endpoint de prueba (requiere JWT)
curl -X POST https://tu-dominio.com/api/push/test \
  -H "Authorization: Bearer TU_TOKEN"
```

### Verificar en Base de Datos

```sql
-- Ver todas las suscripciones de un usuario
SELECT * FROM push_subscriptions WHERE userId = 'USER_ID';

-- Ver suscripciones por user agent (navegador)
SELECT userId, userAgent, createdAt 
FROM push_subscriptions 
WHERE userId = 'USER_ID';
```

## 📊 Backend

### Endpoints Disponibles

```
GET  /api/push/vapid-key        - Obtener clave pública VAPID
POST /api/push/subscribe        - Guardar suscripción
DELETE /api/push/unsubscribe    - Eliminar suscripción
POST /api/push/test             - Enviar notificación de prueba
```

### Enviar Notificación Programática

```typescript
import { PushNotificationsService } from './push-notifications.service';

// En cualquier servicio
constructor(private push: PushNotificationsService) {}

async sendNotification(userId: string) {
  await this.push.sendToUser(userId, {
    title: '⚽ Partido próximo',
    body: 'Colombia vs Argentina en 1 hora',
    icon: '/icons/pwa-192.png',
    data: { matchId: '123', url: '/match/123' },
  });
}
```

## 🔐 Variables de Entorno Requeridas

```bash
# apps/api/.env
VAPID_PUBLIC_KEY=tu_clave_publica
VAPID_PRIVATE_KEY=tu_clave_privada
VAPID_EMAIL=mailto:admin@polla2026.com
```

**Generar claves:**
```bash
npx web-push generate-vapid-keys
```

## 📝 Checklist de Implementación

- [x] Hook `usePushNotifications` mejorado
- [x] Detección automática de estado
- [x] Re-verificación al cambiar de tab
- [x] Componente `NotificationToggle`
- [x] Componente `PushNotificationDebug`
- [x] Vista `PushNotificationSettings`
- [x] Documentación completa
- [ ] Agregar ruta en el router (si aplica)
- [ ] Agregar enlace en configuración de usuario
- [ ] Testing en múltiples navegadores

## 🎓 Conceptos Clave

1. **Cada navegador = Suscripción independiente**
   - Chrome Desktop ≠ Firefox Desktop ≠ Chrome Mobile

2. **El estado `subscribed` es local al navegador actual**
   - No se sincroniza entre navegadores
   - Es correcto que sea `false` en un navegador nuevo

3. **El backend guarda todas las suscripciones**
   - Un usuario puede tener múltiples suscripciones
   - Cada una con su `endpoint` único
   - Al enviar notificación, se envía a todas

4. **El botón debe activarse/desactivarse automáticamente**
   - Si `subscribed = false` → Mostrar "Activar"
   - Si `subscribed = true` → Mostrar "Activas"
   - El hook ahora detecta esto correctamente

## 🔗 Referencias

- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [VAPID Protocol](https://datatracker.ietf.org/doc/html/rfc8292)
