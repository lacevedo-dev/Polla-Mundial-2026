import React from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { resolveDevelopmentSurfaceFlags, type DevelopmentSurfaceFlags } from './runtime-flags';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';

// Vistas públicas
import Landing from './views/Landing';
import Login from './views/Login';
import Register from './views/Register';
import EmailVerification from './views/EmailVerification';
import JoinLeague from './views/JoinLeague';
import Checkout from './views/Checkout';

// Vistas protegidas (con sidebar)
import Dashboard from './views/Dashboard';
import Predictions from './views/Predictions';
import Ranking from './views/Ranking';
import CreateLeague from './views/CreateLeague';
import ManagePayments from './views/ManagePayments';
import Help from './views/Help';
import DesignSystem from './views/DesignSystem';
import BeforeAfter from './views/BeforeAfter';

const publicRoutes: RouteObject[] = [
    { path: '/', element: <Landing /> },
    { path: '/login', element: <Login /> },
    { path: '/register', element: <Register /> },
    { path: '/verify-email', element: <EmailVerification /> },
    { path: '/join/:code', element: <JoinLeague /> },
    { path: '/join', element: <JoinLeague /> },
    { path: '/checkout', element: <Checkout /> },
];

const appRoutes: RouteObject[] = [
    { path: '/dashboard', element: <Dashboard /> },
    { path: '/predictions', element: <Predictions /> },
    { path: '/ranking', element: <Ranking /> },
    { path: '/create-league', element: <CreateLeague /> },
    { path: '/manage-payments', element: <ManagePayments /> },
    { path: '/help', element: <Help /> },
];

const developmentOnlyRoutes: RouteObject[] = [
    { path: '/design-system', element: <DesignSystem /> },
    { path: '/before-after', element: <BeforeAfter /> },
];

export { resolveDevelopmentSurfaceFlags } from './runtime-flags';

export function buildRoutes({ includeDevRoutes }: DevelopmentSurfaceFlags): RouteObject[] {
    return [
        {
            element: <PublicLayout />,
            children: publicRoutes,
        },
        {
            element: <AppLayout />,
            children: includeDevRoutes ? [...appRoutes, ...developmentOnlyRoutes] : appRoutes,
        },
    ];
}

const routerFlags = resolveDevelopmentSurfaceFlags({
    mode: import.meta.env.MODE,
    enableDevRoutes: import.meta.env.VITE_ENABLE_DEV_ROUTES,
});

export const router = createBrowserRouter(buildRoutes(routerFlags));
