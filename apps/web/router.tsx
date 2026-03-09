import React, { Suspense } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router-dom';
import { resolveDevelopmentSurfaceFlags, type DevelopmentSurfaceFlags } from './runtime-flags';

// Layouts
import PublicLayout from './layouts/PublicLayout';
import AppLayout from './layouts/AppLayout';

// Vistas públicas - static imports (critical path)
import Landing from './views/Landing';
import Login from './views/Login';
import Register from './views/Register';

// Vistas públicas - lazy loaded
const EmailVerification = React.lazy(() => import('./views/EmailVerification'));
const JoinLeague = React.lazy(() => import('./views/JoinLeague'));
const Checkout = React.lazy(() => import('./views/Checkout'));

// Vistas protegidas - lazy loaded
const Dashboard = React.lazy(() => import('./views/Dashboard'));
const Predictions = React.lazy(() => import('./views/Predictions'));
const Ranking = React.lazy(() => import('./views/Ranking'));
const CreateLeague = React.lazy(() => import('./views/CreateLeague'));
const ManagePayments = React.lazy(() => import('./views/ManagePayments'));
const OrderHistory = React.lazy(() => import('./views/OrderHistory'));
const Help = React.lazy(() => import('./views/Help'));
const DesignSystem = React.lazy(() => import('./views/DesignSystem'));
const BeforeAfter = React.lazy(() => import('./views/BeforeAfter'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lime-600"></div>
  </div>
);

const publicRoutes: RouteObject[] = [
    { path: '/', element: <Landing /> },
    { path: '/login', element: <Login /> },
    { path: '/register', element: <Register /> },
    { path: '/verify-email', element: <Suspense fallback={<LoadingFallback />}><EmailVerification /></Suspense> },
    { path: '/join/:code', element: <Suspense fallback={<LoadingFallback />}><JoinLeague /></Suspense> },
    { path: '/join', element: <Suspense fallback={<LoadingFallback />}><JoinLeague /></Suspense> },
    { path: '/checkout', element: <Suspense fallback={<LoadingFallback />}><Checkout /></Suspense> },
];

const appRoutes: RouteObject[] = [
    { path: '/dashboard', element: <Suspense fallback={<LoadingFallback />}><Dashboard /></Suspense> },
    { path: '/predictions', element: <Suspense fallback={<LoadingFallback />}><Predictions /></Suspense> },
    { path: '/ranking', element: <Suspense fallback={<LoadingFallback />}><Ranking /></Suspense> },
    { path: '/create-league', element: <Suspense fallback={<LoadingFallback />}><CreateLeague /></Suspense> },
    { path: '/manage-payments', element: <Suspense fallback={<LoadingFallback />}><ManagePayments /></Suspense> },
    { path: '/orders', element: <Suspense fallback={<LoadingFallback />}><OrderHistory /></Suspense> },
    { path: '/help', element: <Suspense fallback={<LoadingFallback />}><Help /></Suspense> },
];

const developmentOnlyRoutes: RouteObject[] = [
    { path: '/design-system', element: <Suspense fallback={<LoadingFallback />}><DesignSystem /></Suspense> },
    { path: '/before-after', element: <Suspense fallback={<LoadingFallback />}><BeforeAfter /></Suspense> },
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
