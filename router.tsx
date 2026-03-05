import React from 'react';
import { createBrowserRouter } from 'react-router-dom';

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

export const router = createBrowserRouter([
    // Rutas públicas (sin sidebar)
    {
        element: <PublicLayout />,
        children: [
            { path: '/', element: <Landing /> },
            { path: '/login', element: <Login /> },
            { path: '/register', element: <Register /> },
            { path: '/verify-email', element: <EmailVerification /> },
            { path: '/join/:code', element: <JoinLeague /> },
            { path: '/join', element: <JoinLeague /> },
            { path: '/checkout', element: <Checkout /> },
        ],
    },
    // Rutas de la app (con sidebar)
    {
        element: <AppLayout />,
        children: [
            { path: '/dashboard', element: <Dashboard /> },
            { path: '/predictions', element: <Predictions /> },
            { path: '/ranking', element: <Ranking /> },
            { path: '/create-league', element: <CreateLeague /> },
            { path: '/manage-payments', element: <ManagePayments /> },
            { path: '/help', element: <Help /> },
            { path: '/design-system', element: <DesignSystem /> },
            { path: '/before-after', element: <BeforeAfter /> },
        ],
    },
]);
