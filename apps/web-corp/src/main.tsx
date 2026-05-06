import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { useTenantStore } from './stores/tenant.store';
import { useAuthStore } from './stores/auth.store';
import { AppRouter } from './router';

function BootLoader() {
    const bootstrap = useTenantStore((s) => s.bootstrap);
    const restoreSession = useAuthStore((s) => s.restoreSession);
    const phase = useTenantStore((s) => s.phase);

    useEffect(() => {
        restoreSession();
        bootstrap();
    }, []);

    if (phase === 'loading') {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Cargando portal...</p>
                </div>
            </div>
        );
    }

    return <AppRouter />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <BootLoader />
        </BrowserRouter>
    </React.StrictMode>,
);
