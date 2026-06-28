import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { initGlobalLogger } from './lib/logger';
// CSS dividido por área (briefing §28). A ORDEM importa para a cascata: tokens →
// base → layout → componentes/features → responsivo → módulos.
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/features.css';
import './styles/components.css';
import './styles/responsive.css';
import './styles/modules.css';

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

// Observabilidade leve (briefing §34.17): Web Vitals → logs_tecnicos, só em
// produção. Carregado sob demanda para não pesar no boot.
if (import.meta.env.PROD) {
  import('./lib/vitals').then((m) => m.initWebVitals()).catch(() => { /* ignore */ });
}
