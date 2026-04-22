import React from 'react';
import { request } from '../api';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface PushState {
  supported: boolean;
  permission: PermissionState;
  subscribed: boolean;
  loading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const [state, setState] = React.useState<PushState>({
    supported: false,
    permission: 'default',
    subscribed: false,
    loading: false,
    error: null,
  });

  React.useEffect(() => {
    const checkPushStatus = async () => {
      // 1. Verificar soporte del navegador
      const supported =
        'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

      if (!supported) {
        setState((s) => ({ ...s, supported: false, permission: 'unsupported' }));
        return;
      }

      // 2. Obtener estado actual de permisos
      const permission = Notification.permission as PermissionState;

      // 3. Verificar si hay suscripción activa
      try {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.getSubscription();
        
        // 4. Actualizar estado completo
        setState((s) => ({
          ...s,
          supported: true,
          permission,
          subscribed: !!subscription, // true solo si hay suscripción activa
        }));
      } catch (error) {
        // Service Worker no disponible o error
        setState((s) => ({
          ...s,
          supported: true,
          permission,
          subscribed: false,
          error: 'Service Worker no disponible. Recarga la página.',
        }));
      }
    };

    checkPushStatus();

    // Re-verificar cuando la página vuelve a estar visible (cambio de tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkPushStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const subscribe = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      // 1. Verificar si ya hay una suscripción activa
      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      // Si ya existe una suscripción, primero desuscribirse
      if (subscription) {
        await subscription.unsubscribe();
      }

      // 2. Obtener clave VAPID del servidor
      const { publicKey } = await request<{ publicKey: string }>('/push/vapid-key');
      if (!publicKey) throw new Error('Push no está configurado en el servidor');

      // 3. Solicitar permiso al usuario
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState((s) => ({ ...s, loading: false, permission: permission as PermissionState }));
        return;
      }

      // 4. Crear nueva suscripción
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      // 5. Guardar suscripción en el backend
      await request('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription.toJSON()),
      });

      // 6. Actualizar estado local
      setState((s) => ({ ...s, loading: false, subscribed: true, permission: 'granted' }));
    } catch (e: any) {
      console.error('Error al suscribir notificaciones push:', e);
      setState((s) => ({ 
        ...s, 
        loading: false, 
        subscribed: false,
        error: e?.message ?? 'Error al activar notificaciones' 
      }));
    }
  }, []);

  const unsubscribe = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await request('/push/unsubscribe', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState((s) => ({ ...s, loading: false, subscribed: false }));
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e?.message ?? 'Error al desactivar notificaciones' }));
    }
  }, []);

  return { ...state, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
