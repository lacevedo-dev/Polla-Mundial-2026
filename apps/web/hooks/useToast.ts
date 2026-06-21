import React from 'react';

export interface ToastMessage {
    id: string;
    message: string;
    type: 'success' | 'error';
}

export function useToast() {
    const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

    const showToast = React.useCallback((
        message: string,
        type: 'success' | 'error' | 'warning' | 'info' = 'success',
    ) => {
        const id = `${Date.now()}-${Math.random()}`;
        const normalized: ToastMessage['type'] =
            type === 'warning' ? 'error' : type === 'info' ? 'success' : type;
        setToasts((prev) => [...prev, { id, message, type: normalized }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3000);
    }, []);

    const dismissToast = React.useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return { toasts, showToast, dismissToast };
}
