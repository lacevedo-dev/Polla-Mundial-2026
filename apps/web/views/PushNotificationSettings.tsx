import React from 'react';
import { NotificationToggle } from '../components/PWAPrompt';
import { PushNotificationDebug } from '../components/PushNotificationDebug';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Vista completa de configuración de notificaciones push
 * Incluye el toggle principal y el panel de debug
 */
export const PushNotificationSettings: React.FC = () => {
  const navigate = useNavigate();
  const [showDebug, setShowDebug] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-slate-950 px-4 pb-6 pt-safe">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Volver
          </button>
          <h1 className="text-2xl font-black text-white">Notificaciones Push</h1>
          <p className="mt-1 text-sm text-slate-400">
            Configura las notificaciones en este dispositivo
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="space-y-4">
          {/* Toggle principal */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-600">
              Estado de notificaciones
            </h2>
            <NotificationToggle />
          </div>

          {/* Información importante */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <h3 className="mb-2 text-xs font-black uppercase tracking-wider text-blue-900">
              📱 Importante
            </h3>
            <ul className="space-y-2 text-xs text-blue-800">
              <li className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>
                  <strong>Cada navegador es independiente:</strong> Si activas las notificaciones
                  en Chrome, debes activarlas nuevamente en Firefox, Edge, Safari, etc.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>
                  <strong>Cada dispositivo es independiente:</strong> Activa las notificaciones en
                  cada móvil, tablet o computadora donde quieras recibirlas.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>
                  <strong>iOS requiere instalación:</strong> En iPhone/iPad, primero instala la app
                  (Compartir → Agregar a pantalla de inicio).
                </span>
              </li>
            </ul>
          </div>

          {/* Toggle para mostrar debug */}
          <button
            onClick={() => setShowDebug(!showDebug)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
          >
            {showDebug ? '▼ Ocultar información técnica' : '▶ Mostrar información técnica'}
          </button>

          {/* Panel de debug */}
          {showDebug && <PushNotificationDebug />}

          {/* Guía de solución de problemas */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-slate-600">
              🔧 Solución de problemas
            </h3>
            <div className="space-y-3 text-xs text-slate-700">
              <div>
                <p className="font-bold text-slate-900">
                  ❌ "Notificaciones bloqueadas" o "Permiso denegado"
                </p>
                <p className="mt-1 text-slate-600">
                  Ve a la configuración de tu navegador → Privacidad y seguridad → Permisos del
                  sitio → Notificaciones → Permitir para este sitio.
                </p>
              </div>
              <div>
                <p className="font-bold text-slate-900">
                  ❌ "Service Worker no disponible"
                </p>
                <p className="mt-1 text-slate-600">
                  Recarga la página (Ctrl+R o Cmd+R). Si persiste, borra la caché del navegador.
                </p>
              </div>
              <div>
                <p className="font-bold text-slate-900">❌ No funciona en iOS</p>
                <p className="mt-1 text-slate-600">
                  Asegúrate de tener iOS 16.4 o superior. Instala la app desde Safari (botón
                  Compartir → Agregar a pantalla de inicio). Las notificaciones solo funcionan en
                  la app instalada, no en el navegador.
                </p>
              </div>
              <div>
                <p className="font-bold text-slate-900">
                  ❌ Funciona en un navegador pero no en otro
                </p>
                <p className="mt-1 text-slate-600">
                  Esto es normal. Activa las notificaciones en cada navegador donde quieras
                  recibirlas. El botón debe mostrar "Activar notificaciones" si no está activo en
                  ese navegador específico.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
