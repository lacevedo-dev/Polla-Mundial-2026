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
    const supported =
      'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

    const permission = supported
      ? (Notification.permission as PermissionState)
      : 'unsupported';

    if (!supported) {
      setState((s) => ({ ...s, supported: false, permission: 'unsupported' }));
      return;
    }

    setState((s) => ({ ...s, supported: true, permission }));

    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setState((s) => ({ ...s, subscribed: true }));
      });
    });
  }, []);

  const subscribe = React.useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      // Get VAPID public key from server
      const { publicKey } = await request<{ publicKey: string }>('/push/vapid-key');
      if (!publicKey) throw new Error('Push no está configurado en el servidor');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState((s) => ({ ...s, loading: false, permission: permission as PermissionState }));
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await request('/push/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription.toJSON()),
      });

      setState((s) => ({ ...s, loading: false, subscribed: true, permission: 'granted' }));
    } catch (e: any) {
      setState((s) => ({ ...s, loading: false, error: e?.message ?? 'Error al activar notificaciones' }));
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
