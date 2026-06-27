// Notificações internas (briefing §20). Deriva notificações dos dados já
// carregados: pendências de alta prioridade + eventos recentes (com destaque
// para ações sensíveis). Estado lida/não-lida persistido em localStorage por id.

import { buildPendencias } from './pendencias';
import { severityMeta } from './severity';
import { SENSITIVE_ACTIONS } from './relatorios';

const READ_KEY = 'gh-notif-read-v1';

export const loadReadIds = () => {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); }
};

export const saveReadIds = (set) => {
  try { localStorage.setItem(READ_KEY, JSON.stringify(Array.from(set))); return true; } catch { return false; }
};

// Constrói a lista de notificações (id estável para casar com o estado lido).
export const buildNotificacoes = (data = {}) => {
  const out = [];

  // 1) Pendências de alta prioridade viram notificações acionáveis.
  const pendencias = buildPendencias(data).filter((p) => p.priority === 'alta').slice(0, 20);
  for (const p of pendencias) {
    out.push({
      id: `pend:${p.id}`,
      title: p.title,
      description: `${p.module} · ${p.statusText}`,
      module: p.module,
      viewKey: 'pendencias',
      tone: severityMeta(p.severity).tone,
      priority: 'alta',
      time: p.since,
    });
  }

  // 2) Eventos recentes — ações sensíveis com destaque.
  const events = (data.events || []).slice(0, 15);
  for (const e of events) {
    const sensitive = SENSITIVE_ACTIONS.includes(e.event_type);
    out.push({
      id: `ev:${e.id}`,
      title: `${e.module || 'Evento'} · ${e.event_type || ''}`.trim(),
      description: `${e.actor_name || 'sistema'}${e.entity_id ? ` · ${e.entity_id}` : ''}`,
      module: e.module || 'Auditoria',
      viewKey: 'events',
      tone: sensitive ? 'warning' : 'info',
      priority: sensitive ? 'media' : 'baixa',
      time: e.created_at,
    });
  }

  // Ordena por tempo desc (sem tempo vai para o fim).
  return out.sort((a, b) => {
    const ta = a.time ? new Date(a.time).getTime() : 0;
    const tb = b.time ? new Date(b.time).getTime() : 0;
    return tb - ta;
  });
};

export const countUnread = (notificacoes, readIds) =>
  notificacoes.reduce((sum, n) => (readIds.has(n.id) ? sum : sum + 1), 0);
