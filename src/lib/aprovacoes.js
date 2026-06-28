// Workflow de aprovação (briefing §34.6). Fila de solicitações de aprovação
// para ações críticas, com auditoria obrigatória (quem solicitou/aprovou,
// quando, motivo, antes/depois). Persistida no Supabase (tabela
// approval_requests, migrations/0002 + 0009) — não mais em localStorage.

import { adminApi } from '../services/adminApi';

// Ações que podem exigir aprovação (briefing §34.6).
export const APPROVAL_ACTIONS = [
  'Excluir produto',
  'Marcar produto como perda',
  'Corrigir quantidade de entrada',
  'Cancelar nota',
  'Resolver divergência grande',
  'Alterar permissão',
  'Desbloquear usuário',
  'Ajustar entrada já finalizada',
];

// Lista as solicitações (mais recentes primeiro). Retorna [] se a tabela ausente.
export const loadAprovacoes = () => adminApi.getAprovacoes(200);

export const createAprovacao = ({ type, description, before, after, requestedBy }) =>
  adminApi.createAprovacao({
    type,
    description: String(description || '').trim(),
    before: String(before || '').trim(),
    after: String(after || '').trim(),
    requestedByName: requestedBy || 'Admin',
  });

export const decideAprovacao = (id, { status, decidedBy, decisionReason }) =>
  adminApi.decideAprovacao(id, {
    status,
    decidedByName: decidedBy || 'Admin',
    decisionReason: String(decisionReason || '').trim(),
  });
