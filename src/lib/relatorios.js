// Relatórios por módulo (briefing §17). Cada relatório é derivado dos dados já
// carregados, com colunas próprias e suporte a filtro por período quando há um
// campo de data. Relatórios "snapshot" representam estado atual (sem período).

import { formatDateTime } from './format';
import { classifyValidade, readImage, isOpenValidade } from './validadeFaixas';

const DAY = 24 * 60 * 60 * 1000;

export const PERIODS = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'ontem', label: 'Ontem' },
  { key: '7d', label: 'Últimos 7 dias' },
  { key: '30d', label: 'Últimos 30 dias' },
  { key: 'mes', label: 'Este mês' },
  { key: 'custom', label: 'Personalizado' },
];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

// Devolve {start,end} em ms para o período escolhido. now é passado pelo chamador.
export const periodRange = (key, { now = Date.now(), customStart, customEnd } = {}) => {
  const todayStart = startOfDay(now);
  switch (key) {
    case 'hoje': return { start: todayStart, end: now };
    case 'ontem': return { start: todayStart - DAY, end: todayStart };
    case '7d': return { start: now - 7 * DAY, end: now };
    case '30d': return { start: now - 30 * DAY, end: now };
    case 'mes': { const d = new Date(now); return { start: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), end: now }; }
    case 'custom': return {
      start: customStart ? new Date(`${customStart}T00:00:00`).getTime() : 0,
      end: customEnd ? new Date(`${customEnd}T23:59:59.999`).getTime() : now,
    };
    default: return { start: 0, end: now };
  }
};

const inRange = (value, range) => {
  if (!range) return true;
  const t = value ? new Date(value).getTime() : 0;
  return t >= range.start && t <= range.end;
};

const groupCount = (rows, keyFn, labelFn) => {
  const map = new Map();
  for (const row of rows) {
    const k = keyFn(row);
    if (!k) continue;
    if (!map.has(k)) map.set(k, { key: k, label: labelFn ? labelFn(row) : k, count: 0 });
    map.get(k).count += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
};

// Lista de ações sensíveis (briefing §18.1).
export const SENSITIVE_ACTIONS = [
  'supervisor_assigned_user', 'supervisor_unassigned_user', 'supervisor_changed_role',
  'supervisor_changed_permission', 'supervisor_reset_password', 'supervisor_forced_logout',
  'supervisor_blocked_user', 'supervisor_unblocked_user', 'validade_treated', 'validade_resolved',
  'validade_deleted', 'entrada_corrected', 'entrada_item_adjusted', 'nota_audited', 'nota_reprinted',
];

const dt = (key, label) => ({ key, label, format: (r) => formatDateTime(r[key]) });

export const REPORTS = [
  // ── Validade ──
  {
    category: 'Validade', key: 'val_vencidos', label: 'Produtos vencidos', snapshot: true,
    columns: [{ key: 'codprod', label: 'Código' }, { key: 'descricao', label: 'Descrição' }, { key: 'lote', label: 'Lote' }, { key: 'quantidade', label: 'Qtd' }, { key: 'diasrestantes', label: 'Dias' }],
    rows: (d) => (d.validade || []).filter((r) => isOpenValidade(r) && Number(r.diasrestantes) < 0),
  },
  {
    category: 'Validade', key: 'val_proximos', label: 'Próximos do vencimento (≤30d)', snapshot: true,
    columns: [{ key: 'codprod', label: 'Código' }, { key: 'descricao', label: 'Descrição' }, { key: 'lote', label: 'Lote' }, { key: 'diasrestantes', label: 'Dias' }, { key: 'faixa', label: 'Faixa', format: (r) => classifyValidade(r.diasrestantes).label }],
    rows: (d) => (d.validade || []).filter((r) => isOpenValidade(r) && Number(r.diasrestantes) >= 0 && Number(r.diasrestantes) <= 30),
  },
  {
    category: 'Validade', key: 'val_tratados', label: 'Produtos tratados', dateKey: 'treatment_date',
    columns: [{ key: 'codprod', label: 'Código' }, { key: 'descricao', label: 'Descrição' }, { key: 'treatment_type', label: 'Tratativa' }, dt('treatment_date', 'Tratado em'), { key: 'user_name', label: 'Operador' }],
    rows: (d, range) => (d.validade || []).filter((r) => r.treatment_date && inRange(r.treatment_date, range)),
  },
  {
    category: 'Validade', key: 'val_pendentes', label: 'Produtos pendentes', snapshot: true,
    columns: [{ key: 'codprod', label: 'Código' }, { key: 'descricao', label: 'Descrição' }, { key: 'lote', label: 'Lote' }, { key: 'quantidade', label: 'Qtd' }, { key: 'diasrestantes', label: 'Dias' }],
    rows: (d) => (d.validade || []).filter(isOpenValidade),
  },
  {
    category: 'Validade', key: 'val_sem_imagem', label: 'Produtos sem imagem', snapshot: true,
    columns: [{ key: 'codprod', label: 'Código' }, { key: 'descricao', label: 'Descrição' }, { key: 'lote', label: 'Lote' }, { key: 'quantidade', label: 'Qtd' }],
    rows: (d) => (d.validade || []).filter((r) => isOpenValidade(r) && !readImage(r)),
  },
  // ── Recebimento ──
  {
    category: 'Recebimento', key: 'rec_notas', label: 'Notas / pedidos', dateKey: 'created_at',
    columns: [{ key: 'order_number', label: 'Pedido' }, { key: 'invoice_number', label: 'NF' }, { key: 'supplier_name', label: 'Fornecedor' }, { key: 'item_count', label: 'Itens' }, { key: 'status', label: 'Status' }],
    rows: (d, range) => (d.purchaseOrders || []).filter((r) => inRange(r.created_at, range)),
  },
  {
    category: 'Recebimento', key: 'rec_div_fornecedor', label: 'Divergências por fornecedor', snapshot: true,
    columns: [{ key: 'label', label: 'Fornecedor' }, { key: 'count', label: 'Divergências' }],
    rows: (d) => groupCount((d.conferenciaDivergencias || []).filter((r) => r.source !== 'saida' && String(r.status || 'pendente') !== 'resolvida'), (r) => r.supplier, (r) => r.supplier),
  },
  // ── Conferência ──
  {
    category: 'Conferência', key: 'conf_realizadas', label: 'Conferências finalizadas', dateKey: 'finished_at',
    columns: [{ key: 'ref', label: 'Referência', format: (r) => r.invoice_number || r.order_code || '-' }, { key: 'assigned_user_name', label: 'Responsável' }, { key: 'item_count', label: 'Itens' }, dt('finished_at', 'Finalizada em')],
    rows: (d, range) => [...(d.conferenciaBonusQueue || []), ...(d.conferenciaSaidaBonusQueue || [])].filter((r) => r.finished_at && inRange(r.finished_at, range)),
  },
  {
    category: 'Conferência', key: 'conf_por_operador', label: 'Conferências por operador', snapshot: true,
    columns: [{ key: 'label', label: 'Operador' }, { key: 'count', label: 'Conferências' }],
    rows: (d) => groupCount([...(d.conferenciaBonusQueue || []), ...(d.conferenciaSaidaBonusQueue || [])].filter((r) => r.assigned_user_name), (r) => r.assigned_user_name, (r) => r.assigned_user_name),
  },
  {
    category: 'Conferência', key: 'conf_divergencias', label: 'Divergências encontradas', dateKey: 'created_at',
    columns: [{ key: 'code', label: 'Código' }, { key: 'description', label: 'Descrição' }, { key: 'diff', label: 'Dif.' }, { key: 'status', label: 'Status' }, dt('created_at', 'Registrada em')],
    rows: (d, range) => (d.conferenciaDivergencias || []).filter((r) => inRange(r.created_at, range)),
  },
  // ── Supervisão / Auditoria ──
  {
    category: 'Supervisão', key: 'sup_atividade', label: 'Atividade por colaborador', dateKey: 'created_at',
    columns: [{ key: 'label', label: 'Colaborador' }, { key: 'count', label: 'Eventos' }],
    rows: (d, range) => groupCount((d.events || []).filter((r) => inRange(r.created_at, range)), (r) => r.actor_name, (r) => r.actor_name),
  },
  {
    category: 'Auditoria', key: 'aud_eventos', label: 'Eventos (todos)', dateKey: 'created_at',
    columns: [{ key: 'module', label: 'Módulo' }, { key: 'event_type', label: 'Evento' }, { key: 'actor_name', label: 'Ator' }, { key: 'entity_id', label: 'Entidade' }, dt('created_at', 'Quando')],
    rows: (d, range) => (d.events || []).filter((r) => inRange(r.created_at, range)),
  },
  {
    category: 'Auditoria', key: 'aud_sensiveis', label: 'Ações sensíveis', dateKey: 'created_at',
    columns: [{ key: 'module', label: 'Módulo' }, { key: 'event_type', label: 'Ação' }, { key: 'actor_name', label: 'Ator' }, dt('created_at', 'Quando')],
    rows: (d, range) => (d.events || []).filter((r) => SENSITIVE_ACTIONS.includes(r.event_type) && inRange(r.created_at, range)),
  },
];
