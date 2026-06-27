import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initGlobalLogger } from './lib/logger';
import './styles.css';

// Captura erros globais para a tela de Logs técnicos (briefing §34.17).
initGlobalLogger();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

// PWA (briefing §17): registra o service worker apenas em produção, para não
// interferir no hot-reload do dev. Falha silenciosa (HTTP, navegador sem suporte).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { /* ignore */ });
  });
}
