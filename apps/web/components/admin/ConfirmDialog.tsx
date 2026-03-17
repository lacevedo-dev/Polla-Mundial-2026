import React from 'react';
import { AlertTriangle } from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
    isLoading?: boolean;
    onConfirm: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    variant = 'danger',
    isLoading = false,
    onConfirm,
}) => {
    const confirmClass =
        variant === 'danger'
            ? 'bg-rose-500 hover:bg-rose-600 text-white'
            : variant === 'warning'
            ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
            : 'bg-slate-900 hover:bg-slate-800 text-white';

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />
                <DialogPrimitive.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm mx-4 bg-white rounded-[1.75rem] shadow-2xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle size={18} className="text-rose-500" />
                        </div>
                        <div>
                            <DialogPrimitive.Title className="font-black text-slate-900 text-base">
                                {title}
                            </DialogPrimitive.Title>
                            <DialogPrimitive.Description className="text-sm text-slate-500 mt-1">
                                {description}
                            </DialogPrimitive.Description>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={() => onOpenChange(false)}
                            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-60 ${confirmClass}`}
                        >
                            {isLoading ? 'Procesando...' : confirmLabel}
                        </button>
                    </div>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
};

export default ConfirmDialog;
