import React from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Bell, BellOff, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

/**
 * Componente de debug para verificar el estado de las notificaciones push
 * Muestra información detallada sobre el estado actual del navegador/dispositivo
 */
export const PushNotificationDebug: React.FC = () => {
  const { supported, permission, subscribed, loading, error, subscribe, unsubscribe } =
    usePushNotifications();

  const [swStatus, setSwStatus] = React.useState<'checking' | 'active' | 'inactive'>('checking');
  const [subDetails, setSubDetails] = React.useState<any>(null);

  React.useEffect(() => {
    const checkServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready;
          setSwStatus(reg.active ? 'active' : 'inactive');
          const sub = await reg.pushManager.getSubscription();
          setSubDetails(sub ? { endpoint: sub.endpoint.slice(0, 50) + '...' } : null);
        } catch {
          setSwStatus('inactive');
        }
      }
    };
    checkServiceWorker();
  }, [subscribed]);

  const getPermissionIcon = () => {
    switch (permission) {
      case 'granted':
        return <CheckCircle2 size={16} className="text-green-600" />;
      case 'denied':
        return <XCircle size={16} className="text-red-600" />;
      case 'unsupported':
        return <XCircle size={16} className="text-gray-400" />;
      default:
        return <AlertCircle size={16} className="text-yellow-600" />;
    }
  };

  const getPermissionText = () => {
    switch (permission) {
      case 'granted':
        return 'Concedido ✓';
      case 'denied':
        return 'Bloqueado ✗';
      case 'unsupported':
        return 'No soportado';
      default:
        return 'No solicitado';
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Bell size={18} className="text-slate-700" />
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
          Estado Push Notifications
        </h3>
      </div>

      <div className="space-y-2 text-xs">
        {/* Soporte del navegador */}
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
          <span className="font-medium text-slate-600">Soporte del navegador:</span>
          <div className="flex items-center gap-1.5">
            {supported ? (
              <>
                <CheckCircle2 size={14} className="text-green-600" />
                <span className="font-bold text-green-700">Soportado</span>
              </>
            ) : (
              <>
                <XCircle size={14} className="text-red-600" />
                <span className="font-bold text-red-700">No soportado</span>
              </>
            )}
          </div>
        </div>

        {/* Permisos */}
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
          <span className="font-medium text-slate-600">Permiso de notificaciones:</span>
          <div className="flex items-center gap-1.5">
            {getPermissionIcon()}
            <span className="font-bold text-slate-700">{getPermissionText()}</span>
          </div>
        </div>

        {/* Service Worker */}
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
          <span className="font-medium text-slate-600">Service Worker:</span>
          <div className="flex items-center gap-1.5">
            {swStatus === 'active' ? (
              <>
                <CheckCircle2 size={14} className="text-green-600" />
                <span className="font-bold text-green-700">Activo</span>
              </>
            ) : swStatus === 'inactive' ? (
              <>
                <XCircle size={14} className="text-red-600" />
                <span className="font-bold text-red-700">Inactivo</span>
              </>
            ) : (
              <>
                <AlertCircle size={14} className="text-yellow-600" />
                <span className="font-bold text-yellow-700">Verificando...</span>
              </>
            )}
          </div>
        </div>

        {/* Estado de suscripción */}
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
          <span className="font-medium text-slate-600">Suscripción en este dispositivo:</span>
          <div className="flex items-center gap-1.5">
            {subscribed ? (
              <>
                <Bell size={14} className="text-lime-600" />
                <span className="font-bold text-lime-700">Activa</span>
              </>
            ) : (
              <>
                <BellOff size={14} className="text-slate-400" />
                <span className="font-bold text-slate-500">No activa</span>
              </>
            )}
          </div>
        </div>

        {/* Detalles de suscripción */}
        {subDetails && (
          <div className="rounded-lg bg-lime-50 px-3 py-2">
            <span className="font-medium text-lime-800">Endpoint:</span>
            <p className="mt-1 break-all font-mono text-[10px] text-lime-600">
              {subDetails.endpoint}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-600" />
              <span className="font-medium text-red-700">{error}</span>
            </div>
          </div>
        )}
      </div>

      {/* Botones de acción */}
      <div className="mt-4 flex gap-2">
        {!subscribed && permission !== 'denied' && (
          <button
            onClick={subscribe}
            disabled={loading || !supported}
            className="flex-1 rounded-xl bg-lime-400 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Activando...' : 'Activar en este navegador'}
          </button>
        )}
        {subscribed && (
          <button
            onClick={unsubscribe}
            disabled={loading}
            className="flex-1 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-slate-700 transition hover:border-red-400 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Desactivando...' : 'Desactivar'}
          </button>
        )}
      </div>

      {/* Información adicional */}
      <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2">
        <p className="text-[10px] font-medium text-blue-800">
          ℹ️ Cada navegador/dispositivo necesita activar las notificaciones por separado. Si
          funcionan en Chrome pero no en Firefox, actívalas nuevamente en Firefox.
        </p>
      </div>
    </div>
  );
};
