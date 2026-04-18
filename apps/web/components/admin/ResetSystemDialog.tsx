import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import type { ResetOptions } from '../../stores/admin.store';

interface ResetSystemDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (options: ResetOptions) => void;
    isLoading?: boolean;
}

const ResetSystemDialog: React.FC<ResetSystemDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    isLoading = false,
}) => {
    const [selectedOptions, setSelectedOptions] = React.useState<ResetOptions>({
        predictions: true,
        participations: true,
        leagues: true,
        payments: true,
        notifications: true,
        matches: true,
        auditLogs: false,
        emailLogs: false,
        automationLogs: false,
        footballSyncLogs: false,
        syncPlans: false,
    });

    const handleToggle = (key: keyof ResetOptions) => {
        setSelectedOptions(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleConfirm = () => {
        onConfirm(selectedOptions);
    };

    const hasSelection = Object.values(selectedOptions).some(v => v);

    const mainDataOptions = [
        { key: 'predictions' as const, label: 'Predicciones', description: 'Eliminar todas las predicciones de usuarios' },
        { key: 'participations' as const, label: 'Participaciones', description: 'Eliminar participaciones en ligas' },
        { key: 'leagues' as const, label: 'Ligas', description: 'Eliminar todas las ligas creadas' },
        { key: 'payments' as const, label: 'Pagos y Órdenes', description: 'Eliminar registros de pagos y órdenes' },
        { key: 'notifications' as const, label: 'Notificaciones', description: 'Eliminar notificaciones relacionadas con ligas' },
        { key: 'matches' as const, label: 'Partidos', description: 'Eliminar todos los partidos y resultados' },
    ];

    const logOptions = [
        { key: 'auditLogs' as const, label: 'Logs de Auditoría', description: 'Eliminar registros de acciones de usuarios' },
        { key: 'emailLogs' as const, label: 'Logs de Emails', description: 'Eliminar registros de emails enviados y pendientes' },
        { key: 'automationLogs' as const, label: 'Logs de Automatización', description: 'Eliminar registros de ejecuciones automáticas' },
        { key: 'footballSyncLogs' as const, label: 'Logs de Sincronización', description: 'Eliminar logs de sincronización con API Football' },
        { key: 'syncPlans' as const, label: 'Planes de Sincronización', description: 'Eliminar planificación de sincronizaciones' },
    ];

    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={onClose}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in" />
                <DialogPrimitive.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-3xl shadow-2xl z-50 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
                    <div className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-5">
                            <div className="flex items-start gap-3">
                                <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center shrink-0">
                                    <AlertTriangle size={24} className="text-rose-600" />
                                </div>
                                <div>
                                    <DialogPrimitive.Title className="text-lg font-black text-slate-900 uppercase tracking-tight">
                                        Reiniciar Sistema
                                    </DialogPrimitive.Title>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Selecciona qué componentes deseas reiniciar
                                    </p>
                                </div>
                            </div>
                            <DialogPrimitive.Close className="text-slate-400 hover:text-slate-600 transition-colors">
                                <X size={20} />
                            </DialogPrimitive.Close>
                        </div>

                        {/* Warning */}
                        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                            <p className="text-xs font-bold text-amber-900 flex items-center gap-2">
                                <AlertTriangle size={14} />
                                Esta acción NO se puede deshacer
                            </p>
                            <p className="text-xs text-amber-700 mt-1">
                                Los datos seleccionados serán eliminados permanentemente del sistema.
                            </p>
                        </div>

                        {/* Options */}
                        <div className="space-y-4 mb-6">
                            {/* DATOS PRINCIPALES */}
                            <div>
                                <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2 px-1">
                                    Datos Principales
                                </h3>
                                <div className="space-y-2">
                                    {mainDataOptions.map(option => (
                                        <label
                                            key={option.key}
                                            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                selectedOptions[option.key]
                                                    ? 'bg-rose-50 border-rose-300'
                                                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedOptions[option.key]}
                                                onChange={() => handleToggle(option.key)}
                                                className="mt-0.5 w-4 h-4 rounded border-2 border-slate-300 text-rose-600 focus:ring-2 focus:ring-rose-500 focus:ring-offset-0 cursor-pointer"
                                            />
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                                                    {option.label}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {option.description}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* LOGS Y PROCESOS */}
                            <div>
                                <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2 px-1">
                                    Logs y Procesos
                                </h3>
                                <div className="space-y-2">
                                    {logOptions.map(option => (
                                        <label
                                            key={option.key}
                                            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                selectedOptions[option.key]
                                                    ? 'bg-amber-50 border-amber-300'
                                                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedOptions[option.key]}
                                                onChange={() => handleToggle(option.key)}
                                                className="mt-0.5 w-4 h-4 rounded border-2 border-slate-300 text-amber-600 focus:ring-2 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer"
                                            />
                                            <div className="flex-1">
                                                <p className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                                                    {option.label}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {option.description}
                                                </p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={isLoading}
                                className="flex-1 h-12 rounded-2xl border-2 border-slate-200 bg-white font-bold text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isLoading || !hasSelection}
                                className="flex-1 h-12 rounded-2xl bg-rose-600 font-bold text-sm text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={16} />
                                        Reiniciar Seleccionados
                                    </>
                                )}
                            </button>
                        </div>

                        {!hasSelection && (
                            <p className="text-xs text-amber-600 text-center mt-3 font-bold">
                                Debes seleccionar al menos una opción
                            </p>
                        )}
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

export default ResetSystemDialog;
