// Helpers de timeline operacional (briefing §9) e de indicadores por
// colaborador (briefing §11/§12). Trabalham sobre operational_events e
// purchase_order_actions já carregados/buscados.

// Tom (cor) de cada módulo, para o ponto da linha do tempo.
const MODULE_TONE = {
  validade: 'monitor',
  avarias: 'danger',
  avaria: 'danger',
  conferencia: 'info',
  recebimento: 'warning',
  tratativas: 'warning',
  tratativa: 'warning',
  pedidos: 'warning',
  users: 'info',
};

export const moduleTone = (module) => MODULE_TONE[String(module || '').toLowerCase()] || 'info';

// Converte um operational_event em item de timeline.
export const eventToTimelineItem = (event = {}) => ({
  id: event.id,
  time: event.created_at,
  title: [event.module, event.event_type].filter(Boolean).join(' · ') || 'Evento',
  description: [
    event.entity_type ? `${event.entity_type}${event.entity_id ? ` ${event.entity_id}` : ''}` : null,
    event.order_ref ? `Pedido/NF ${event.order_ref}` : null,
    event.batch_ref ? `Lote ${event.batch_ref}` : null,
  ].filter(Boolean).join(' · '),
  actor: event.actor_name || null,
  tone: moduleTone(event.module),
});

// Converte uma ação de pedido (purchase_order_action) em item de timeline.
export const orderActionToTimelineItem = (action = {}) => ({
  id: action.id,
  time: action.created_at,
  title: action.action_label || 'Ação no pedido',
  description: [
    action.invoice_number ? `NF ${action.invoice_number}` : null,
    action.supplier_name || null,
  ].filter(Boolean).join(' · '),
  actor: action.created_by_name || null,
  tone: 'warning',
});

// Agrega indicadores de produtividade de um colaborador a partir dos eventos
// (briefing §11 indicadores + §12 dashboard individual).
export const summarizeUserActivity = (events = [], { now = Date.now() } = {}) => {
  const byModule = {};
  const byType = {};
  let last7 = 0;
  let lastEventAt = null;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  for (const event of events) {
    const mod = event.module || 'outros';
    byModule[mod] = (byModule[mod] || 0) + 1;
    const type = event.event_type || 'evento';
    byType[type] = (byType[type] || 0) + 1;

    const t = event.created_at ? new Date(event.created_at).getTime() : 0;
    if (t >= weekAgo) last7 += 1;
    if (!lastEventAt || t > new Date(lastEventAt).getTime()) lastEventAt = event.created_at;
  }

  return {
    total: events.length,
    last7days: last7,
    byModule,
    byType,
    lastEventAt,
    modulesRanked: Object.entries(byModule).sort((a, b) => b[1] - a[1]),
  };
};
