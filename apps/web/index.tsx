
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { router } from './router';
import { TenantThemeProvider } from './components/TenantThemeProvider';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

function hideBootSplash() {
  const splash = document.getElementById('app-boot-splash');
  if (!splash) return;

  splash.setAttribute('aria-busy', 'false');
  splash.classList.add('app-boot-splash--hide');

  const remove = () => splash.remove();
  splash.addEventListener('transitionend', remove, { once: true });
  window.setTimeout(remove, 500);
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <TenantThemeProvider>
    <RouterProvider router={router} />
  </TenantThemeProvider>
);

requestAnimationFrame(() => {
  requestAnimationFrame(hideBootSplash);
});
