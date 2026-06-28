// Notificações internas (briefing §20). Deriva notificações dos dados já
// carregados: pendências de alta prioridade + eventos recentes (com destaque
// para ações sensíveis). Estado lida/não-lida persistido por usuário no Supabase
// (usuario_preferencias/chave 'notif_lidas') — não mais em localStorage.

import { buildPendencias } from './pendencias';
import { severityMeta } from './severity';
import { SENSITIVE_ACTIONS } from './relatorios';
import { adminApi } from '../services/adminApi';

const PREF_KEY = 'notif_lidas';

// Carrega os ids lidos do usuário atual (Set). Retorna Set vazio se indisponível.
export const loadReadIds = async () => {
  const arr = await adminApi.getUserPref(PREF_KEY, []);
  return new Set(Array.isArray(arr) ? arr : []);
};

// Persiste os ids lidos do usuário atual (best-effort).
export const saveReadIds = (set) => adminApi.saveUserPref(PREF_KEY, Array.from(set));

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
