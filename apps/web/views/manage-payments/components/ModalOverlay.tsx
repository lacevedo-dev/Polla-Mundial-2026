import React from 'react';

export const ModalOverlay: React.FC<{
    children: React.ReactNode;
    zIndexClass?: string;
}> = ({ children, zIndexClass = 'z-[100]' }) => (
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`}>
        {children}
    </div>
);

export const ModalSpinner: React.FC = () => (
    <div className="flex items-center justify-center py-8 text-slate-400 gap-2">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
        <span className="text-xs font-bold">Cargando…</span>
    </div>
);
