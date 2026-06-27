// Dashboards por módulo (briefing §13), comparativo por período (briefing §24)
// e progresso de metas (briefing §14). Tudo derivado dos dados já carregados.

const DAY = 24 * 60 * 60 * 1000;
const ms = (value) => (value ? new Date(value).getTime() : 0);
const inWindow = (t, start, end) => t >= start && t < end;

const countWindow = (rows, getTime, start, end) =>
  (rows || []).reduce((sum, row) => (inWindow(ms(getTime(row)), start, end) ? sum + 1 : sum), 0);

// ── KPIs por módulo ──────────────────────────────────────────────────────────
export const buildModuleDashboards = (data = {}) => {
  const validade = data.validade || [];
  const openValidade = validade.filter((r) => r.status !== 'treated' && r.status !== 'resolved');
  const vencidos = openValidade.filter((r) => Number(r.diasrestantes) < 0).length;
  const venceHoje = openValidade.filter((r) => Number(r.diasrestantes) === 0).length;
  const vence7 = openValidade.filter((r) => Number(r.diasrestantes) > 0 && Number(r.diasrestantes) <= 7).length;
  const vence30 = openValidade.filter((r) => Number(r.diasrestantes) > 7 && Number(r.diasrestantes) <= 30).length;

  const entrada = data.conferenciaBonusQueue || [];
  const saida = data.conferenciaSaidaBonusQueue || [];
  const allConf = [...entrada, ...saida];
  const confFinalizadas = allConf.filter((r) => ['finalizada', 'entrada_realizada', 'saida_realizada'].includes(r.status)).length;
  const confEmConf = allConf.filter((r) => r.status === 'em_conferencia').length;
  const confAbertas = allConf.filter((r) => ['nao_iniciado', 'em_conferencia'].includes(r.status)).length;
  const divPend = (data.conferenciaDivergencias || []).filter((r) => String(r.status || 'pendente') !== 'resolvida').length;

  const orders = data.purchaseOrders || [];
  const ordersAbertos = orders.filter((r) => !['encerrado', 'auditado', 'cancelado'].includes(String(r.status || ''))).length;
  const entryPend = orders.filter((r) => String(r.entry_status || '') === 'pendente').length;
  const returnPend = orders.filter((r) => String(r.return_status || '') === 'pendente').length;

  const avarias = data.avarias || [];
  const avAbertas = avarias.filter((r) => r.item_status === 'damaged').length;
  const avResolvidas = avarias.filter((r) => r.item_status === 'resolved').length;

  const users = data.activeUsers || [];
  const online = users.filter((r) => r.status === 'online').length;
  const idle = users.filter((r) => r.status === 'idle').length;
  const offline = users.filter((r) => ['offline', 'signed_out'].includes(r.status)).length;

  const events = data.events || [];
  const events7 = countWindow(events, (r) => r.created_at, Date.now() - 7 * DAY, Date.now());
  const modulosDistintos = new Set(events.map((e) => e.module).filter(Boolean)).size;

  return [
    {
      key: 'validade', label: 'Validade', icon: 'validade', kpis: [
        { label: 'Vencidos', value: vencidos, tone: 'danger' },
        { label: 'Vencem hoje', value: venceHoje, tone: 'danger' },
        { label: 'Em até 7 dias', value: vence7, tone: 'warning' },
        { label: 'Em até 30 dias', value: vence30, tone: 'monitor' },
      ],
    },
    {
      key: 'conferencia', label: 'Conferência', icon: 'conferencia', kpis: [
        { label: 'Filas abertas', value: confAbertas, tone: 'warning' },
        { label: 'Em conferência', value: confEmConf, tone: 'info' },
        { label: 'Finalizadas', value: confFinalizadas, tone: 'success' },
        { label: 'Divergências pendentes', value: divPend, tone: 'danger' },
      ],
    },
    {
      key: 'recebimento', label: 'Recebimento', icon: 'recebimento', kpis: [
        { label: 'Pedidos em aberto', value: ordersAbertos, tone: 'warning' },
        { label: 'Entrada pendente', value: entryPend, tone: 'monitor' },
        { label: 'Devolução pendente', value: returnPend, tone: 'danger' },
        { label: 'Total de pedidos', value: orders.length, tone: 'info' },
      ],
    },
    {
      key: 'avarias', label: 'Avarias', icon: 'avarias', kpis: [
        { label: 'Abertas', value: avAbertas, tone: 'danger' },
        { label: 'Resolvidas', value: avResolvidas, tone: 'success' },
      ],
    },
    {
      key: 'colaboradores', label: 'Colaboradores', icon: 'users', kpis: [
        { label: 'Online', value: online, tone: 'success' },
        { label: 'Ociosos', value: idle, tone: 'monitor' },
        { label: 'Offline', value: offline, tone: 'info' },
      ],
    },
    {
      key: 'auditoria', label: 'Auditoria', icon: 'events', kpis: [
        { label: 'Eventos (total)', value: events.length, tone: 'info' },
        { label: 'Eventos (7 dias)', value: events7, tone: 'info' },
        { label: 'Módulos distintos', value: modulosDistintos, tone: 'monitor' },
      ],
    },
  ];
};

// ── Comparativo por período (briefing §24) ───────────────────────────────────
export const buildComparativo = (data = {}, { now = Date.now() } = {}) => {
  const curStart = now - 7 * DAY;
  const prevStart = now - 14 * DAY;
  const make = (label, rows, getTime, betterWhenLower = false) => {
    const current = countWindow(rows, getTime, curStart, now);
    const previous = countWindow(rows, getTime, prevStart, curStart);
    const deltaPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : (current > 0 ? 100 : 0);
    return { label, current, previous, deltaPct, betterWhenLower };
  };

  return [
    make('Atividade operacional', data.events, (r) => r.created_at),
    make('Divergências registradas', data.conferenciaDivergencias, (r) => r.created_at, true),
    make('Avarias movimentadas', data.avarias, (r) => r.item_updated_at, true),
    make('Conferências finalizadas', [...(data.conferenciaBonusQueue || []), ...(data.conferenciaSaidaBonusQueue || [])], (r) => r.finished_at),
  ];
};

// ── Progresso de metas (briefing §14) ────────────────────────────────────────
export const computeMetaProgress = (data = {}, metas = {}) => {
  const validade = data.validade || [];
  const openValidade = validade.filter((r) => r.status !== 'treated' && r.status !== 'resolved');
  const allConf = [...(data.conferenciaBonusQueue || []), ...(data.conferenciaSaidaBonusQueue || [])];
  const divergencias = data.conferenciaDivergencias || [];
  const avarias = data.avarias || [];
  const orders = data.purchaseOrders || [];

  const sources = {
    validade_vencidos: {
      current: openValidade.filter((r) => Number(r.diasrestantes) < 0).length,
      universe: validade.length,
    },
    validade_7dias: {
      current: openValidade.filter((r) => Number(r.diasrestantes) >= 0 && Number(r.diasrestantes) <= 7).length,
      universe: validade.length,
    },
    conferencia_finalizadas: {
      current: allConf.filter((r) => ['nao_iniciado', 'em_conferencia'].includes(r.status)).length,
      universe: allConf.length,
    },
    divergencias_resolvidas: {
      current: divergencias.filter((r) => String(r.status || 'pendente') !== 'resolvida').length,
      universe: divergencias.length,
    },
    avarias_tratadas: {
      current: avarias.filter((r) => r.item_status === 'damaged').length,
      universe: avarias.length,
    },
    pedidos_pendentes: {
      current: orders.filter((r) => !['encerrado', 'auditado', 'cancelado'].includes(String(r.status || ''))).length,
      universe: orders.length,
    },
  };

  return Object.entries(metas).map(([key, meta]) => {
    const src = sources[key] || { current: 0, universe: 0 };
    const { current, universe } = src;
    const pct = universe > 0 ? Math.round(((universe - current) / universe) * 100) : (current === 0 ? 100 : 0);
    const achieved = current <= (meta.target ?? 0);
    const tone = achieved ? 'success' : pct >= 66 ? 'warning' : 'danger';
    return { key, ...meta, current, universe, pct, achieved, tone };
  });
};
