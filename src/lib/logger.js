// Logs técnicos e erros (briefing §34.17). Mantém um buffer em memória da sessão
// (exibição imediata) e centraliza cada log no Supabase (tabela logs_tecnicos) —
// não usa mais localStorage. A tela de Logs lê o histórico via adminApi.

import { adminApi } from '../services/adminApi';

const MAX = 100;
let _buffer = []; // ring buffer da sessão atual (best-effort/imediato)

// Registra um log. level: 'error' | 'warn' | 'info'.
export const logEvent = ({ level = 'error', message, context = '' }) => {
  const entry = {
    id: `${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    at: new Date().toISOString(),
    level,
    message: String(message || 'Erro'),
    context: typeof context === 'string' ? context : safeStringify(context),
  };
  _buffer.unshift(entry);
  _buffer = _buffer.slice(0, MAX);
  // Envia ao Supabase sem bloquear (best-effort; degrada para o buffer local).
  // .catch evita unhandled rejection — insertLogTecnico já trata erros internamente.
  Promise.resolve(adminApi.insertLogTecnico({ level: entry.level, message: entry.message, context: entry.context })).catch(() => {});
  return entry;
};

export const logError = (message, context) => logEvent({ level: 'error', message, context });
export const getLogs = () => [..._buffer];
export const clearLogs = () => { _buffer = []; };

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
