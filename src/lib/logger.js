// Logs técnicos e erros (briefing §34.17). Registra erros relevantes do
// frontend num buffer persistido em localStorage, exibível na tela de Logs.
// Sem dependências externas (Sentry/LogRocket ficam como avaliação futura).

const STORAGE_KEY = 'gh-logs-v1';
const MAX = 100;

const read = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};
const write = (logs) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, MAX))); } catch { /* ignore */ }
};

// Registra um log. level: 'error' | 'warn' | 'info'.
export const logEvent = ({ level = 'error', message, context = '' }) => {
  const entry = {
    id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    at: new Date().toISOString(),
    level,
    message: String(message || 'Erro'),
    context: typeof context === 'string' ? context : safeStringify(context),
  };
  const logs = read();
  logs.unshift(entry);
  write(logs);
  return entry;
};

export const logError = (message, context) => logEvent({ level: 'error', message, context });
export const getLogs = () => read();
export const clearLogs = () => { write([]); };

const safeStringify = (value) => {
  try { return JSON.stringify(value); } catch { return String(value); }
};

// Instala listeners globais uma única vez (chamado no main.jsx).
let installed = false;
export const initGlobalLogger = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => {
    logError(event.message || 'Erro de runtime', `${event.filename || ''}:${event.lineno || ''}`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    logError('Promise rejeitada', event.reason?.message || String(event.reason || ''));
  });
};
