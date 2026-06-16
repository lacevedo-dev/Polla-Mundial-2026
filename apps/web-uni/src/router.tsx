import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTenantStore } from './stores/tenant.store';
import { useAuthStore } from './stores/auth.store';
import { STAFF_HOME, getHomeRoute, isStaffUser, isTenantAdmin } from './utils/tenantRole';

const LandingB2B = React.lazy(() => import('./views/LandingB2B'));
const Login = React.lazy(() => import('./views/Login'));
const ForgotPassword = React.lazy(() => import('./views/ForgotPassword'));
const Dashboard = React.lazy(() => import('./views/Dashboard'));
const Pollas = React.lazy(() => import('./views/Pollas'));
const Ranking = React.lazy(() => import('./views/Ranking'));
const JoinOrg = React.lazy(() => import('./views/JoinOrg'));
const Onboarding = React.lazy(() => import('./views/Onboarding'));
const ChangePassword = React.lazy(() => import('./views/ChangePassword'));
const UpdateAvatar = React.lazy(() => import('./views/UpdateAvatar'));
const AdminCorp = React.lazy(() => import('./views/AdminCorp'));
const AdminCorpMembers = React.lazy(() => import('./views/AdminCorpMembers'));
const AdminCorpLeagues = React.lazy(() => import('./views/AdminCorpLeagues'));
const PollaDetail = React.lazy(() => import('./views/PollaDetail'));
const Help = React.lazy(() => import('./views/Help'));
const AdminCorpSettings = React.lazy(() => import('./views/AdminCorpSettings'));
const AdminCorpRoles = React.lazy(() => import('./views/AdminCorpRoles'));
const AdminCorpParticipation = React.lazy(() => import('./views/AdminCorpParticipation'));
const AdminCorpMatches = React.lazy(() => import('./views/AdminCorpMatches'));
const ResetPassword = React.lazy(() => import('./views/ResetPassword'));

const Loader = () => (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-primary, #f59e0b)', borderTopColor: 'transparent' }} />
    </div>
);

function RequireAuth({ children }: { children: React.ReactNode }) {
    const user = useAuthStore((s) => s.user);
    if (!user) return <Navigate to="/login" replace />;
    // Si el admin corporativo aún no ha cambiado la contraseña temporal,
    // forzamos la pantalla de cambio antes de permitir el acceso al portal.
    if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
    if (user.needsAvatarUpdate) return <Navigate to="/update-avatar" replace />;
    return <>{children}</>;
}

/** Igual a RequireAuth pero NO bloquea por mustChangePassword (usado por /change-password). */
function RequireSession({ children }: { children: React.ReactNode }) {
    const user = useAuthStore((s) => s.user);
    if (!user) return <Navigate to="/login" replace />;
    return <>{children}</>;
}

/** Bloquea rutas de participante y admin general para usuarios STAFF. */
function BlockStaff({ children }: { children: React.ReactNode }) {
    const user = useAuthStore((s) => s.user);
    if (isStaffUser(user)) return <Navigate to={STAFF_HOME} replace />;
    return <>{children}</>;
}

/** Solo OWNER/ADMIN; STAFF y jugadores son redirigidos. */
function RequireTenantAdmin({ children }: { children: React.ReactNode }) {
    const user = useAuthStore((s) => s.user);
    if (isStaffUser(user)) return <Navigate to={STAFF_HOME} replace />;
    if (isTenantAdmin(user)) return <>{children}</>;
    return <Navigate to="/" replace />;
}

function HomeRoute() {
    const user = useAuthStore((s) => s.user);
    if (isStaffUser(user)) return <Navigate to={STAFF_HOME} replace />;
    return <Dashboard />;
}

function FallbackRedirect() {
    const user = useAuthStore((s) => s.user);
    return <Navigate to={getHomeRoute(user)} replace />;
}

export function AppRouter() {
    const phase = useTenantStore((s) => s.phase);

    if (phase === 'loading') {
        return <Loader />;
    }

    return (
        <Suspense fallback={<Loader />}>
            {phase === 'landing' ? (
                /* ── Sin tenant: dominio raíz zonapronosticos.com ── */
                <Routes>
                    <Route path="/" element={<Navigate to="/login" replace />} />
                    <Route path="/landing" element={<LandingB2B />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/join-org" element={<JoinOrg />} />
                    <Route path="*" element={<Navigate to="/login" replace />} />
                </Routes>
            ) : (
                /* ── Con tenant: empresa.zonapronosticos.com ── */
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
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
                        path="/update-avatar"
                        element={
                            <RequireSession>
                                <UpdateAvatar />
                            </RequireSession>
                        }
                    />
                    <Route
                        path="/"
                        element={
                            <RequireAuth>
                                <HomeRoute />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/pollas"
                        element={
                            <RequireAuth>
                                <BlockStaff>
                                    <Pollas />
                                </BlockStaff>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/ranking"
                        element={
                            <RequireAuth>
                                <BlockStaff>
                                    <Ranking />
                                </BlockStaff>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/pollas/:id"
                        element={
                            <RequireAuth>
                                <BlockStaff>
                                    <PollaDetail />
                                </BlockStaff>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/help"
                        element={
                            <RequireAuth>
                                <BlockStaff>
                                    <Help />
                                </BlockStaff>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/admin"
                        element={
                            <RequireAuth>
                                <RequireTenantAdmin>
                                    <AdminCorp />
                                </RequireTenantAdmin>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/admin/members"
                        element={
                            <RequireAuth>
                                <AdminCorpMembers />
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/admin/pollas"
                        element={
                            <RequireAuth>
                                <RequireTenantAdmin>
                                    <AdminCorpLeagues />
                                </RequireTenantAdmin>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/admin/settings"
                        element={
                            <RequireAuth>
                                <RequireTenantAdmin>
                                    <AdminCorpSettings />
                                </RequireTenantAdmin>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/admin/roles"
                        element={
                            <RequireAuth>
                                <RequireTenantAdmin>
                                    <AdminCorpRoles />
                                </RequireTenantAdmin>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/admin/participation"
                        element={
                            <RequireAuth>
                                <RequireTenantAdmin>
                                    <AdminCorpParticipation />
                                </RequireTenantAdmin>
                            </RequireAuth>
                        }
                    />
                    <Route
                        path="/admin/matches"
                        element={
                            <RequireAuth>
                                <RequireTenantAdmin>
                                    <AdminCorpMatches />
                                </RequireTenantAdmin>
                            </RequireAuth>
                        }
                    />
                    <Route path="*" element={<FallbackRedirect />} />
                </Routes>
            )}
        </Suspense>
    );
}
