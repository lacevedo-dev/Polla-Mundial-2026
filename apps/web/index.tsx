
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { router } from './router';
import { TenantThemeProvider } from './components/TenantThemeProvider';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <TenantThemeProvider>
    <RouterProvider router={router} />
  </TenantThemeProvider>
);
