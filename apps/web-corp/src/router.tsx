import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTenantStore } from './stores/tenant.store';
import { useAuthStore } from './stores/auth.store';

const LandingB2B = React.lazy(() => import('./views/LandingB2B'));
const Login = React.lazy(() => import('./views/Login'));
const Dashboard = React.lazy(() => import('./views/Dashboard'));
const Pollas = React.lazy(() => import('./views/Pollas'));
const Ranking = React.lazy(() => import('./views/Ranking'));
const JoinOrg = React.lazy(() => import('./views/JoinOrg'));
const Onboarding = React.lazy(() => import('./views/Onboarding'));
const ChangePassword = React.lazy(() => import('./views/ChangePassword'));

const Loader = () => (
    <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
);

function RequireAuth({ children }: { children: React.ReactNode }) {
    const user = useAuthStore((s) => s.user);
    if (!user) return <Navigate to="/login" replace />;
    // Si el admin corporativo aún no ha cambiado la contraseña temporal,
    // forzamos la pantalla de cambio antes de permitir el acceso al portal.
    if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
    return <>{children}</>;
}

/** Igual a RequireAuth pero NO bloquea por mustChangePassword (usado por /change-password). */
function RequireSession({ children }: { children: React.ReactNode }) {
    const user = useAuthStore((s) => s.user);
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

export function AppRouter() {
    const phase = useTenantStore((s) => s.phase);

    return (
        <Suspense fallback={<Loader />}>
            {phase === 'landing' ? (
                /* ── Sin tenant: dominio raíz zonapronosticos.com ── */
                <Routes>
                    <Route path="/" element={<LandingB2B />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/join-org" element={<JoinOrg />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            ) : (
                /* ── Con tenant: empresa.zonapronosticos.com ── */
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/join-org" element={<JoinOrg />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route
                        path="/change-password"
                        element={
                            <RequireSession>
                                <ChangePassword />
                            </RequireSession>
                        }
                    />
                    <Route
                        path="/"
                        element={
                            <RequireAuth>
                                <Dashboard />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/pollas"
                        element={
                            <RequireAuth>
                                <Pollas />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/ranking"
                        element={
                            <RequireAuth>
                                <Ranking />
                            </RequireAuth>
                        }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            )}
        </Suspense>
    );
}
