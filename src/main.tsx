import React from 'react';
import ReactDOM from 'react-dom/client';
import { Providers } from './app/providers';
import Navigation from './app/Navigation';
import AppRoutes from './app/routes';
import './index.css';
import './firebase';

function App() {
  return (
    <Providers>
      <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
        <Navigation />
        <main className="flex-1 min-w-0">
          <AppRoutes />
        </main>
      </div>
    </Providers>
  );
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
