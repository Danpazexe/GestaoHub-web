// Workflow de aprovação (briefing §34.6). Fila de solicitações de aprovação
// para ações críticas, com auditoria obrigatória (quem solicitou/aprovou,
// quando, motivo, antes/depois). Persistida em localStorage; preparada para
// futura integração com a tabela approval_requests (docs/migrations/0002).

const STORAGE_KEY = 'gh-aprovacoes-v1';

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

export const loadAprovacoes = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
};

const persist = (list) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 200))); return true; } catch { return false; }
};

export const createAprovacao = ({ type, description, before, after, requestedBy }) => {
  const list = loadAprovacoes();
  const registro = {
    id: `apr-${Date.now()}-${Math.round(Math.random() * 1e5)}`,
    type,
    description: String(description || '').trim(),
    before: String(before || '').trim(),
    after: String(after || '').trim(),
    status: 'pendente',
    requestedBy: requestedBy || 'Admin',
    requestedAt: new Date().toISOString(),
    decidedBy: null,
    decidedAt: null,
    decisionReason: '',
  };
  list.unshift(registro);
  persist(list);
  return registro;
};

export const decideAprovacao = (id, { status, decidedBy, decisionReason }) => {
  const list = loadAprovacoes();
  const next = list.map((r) => (r.id === id
    ? { ...r, status, decidedBy: decidedBy || 'Admin', decidedAt: new Date().toISOString(), decisionReason: String(decisionReason || '').trim() }
    : r));
  persist(next);
  return next;
};
