// Motor central de pendências (briefing §5 prioridade automática + §6 fila
// inteligente). Agrega ocorrências de todos os módulos operacionais a partir
// dos dados já carregados pelo painel, atribui prioridade/gravidade/SLA e
// produz uma lista única ordenada por risco operacional.
//
// Nenhuma chamada extra ao Supabase: trabalha sobre o dataState do App.

import { computeSla } from './sla';
import { priorityWeight, severityWeight } from './severity';

// Campos de localização ainda não existem no schema (briefing §2/§3). Lemos de
// forma tolerante para que, quando a migração adicionar setor/filial, a UI já
// passe a exibir sem mudança de código.
export const readSector = (row = {}) => row.sector || row.setor || row.area || row.local || null;
export const readBranch = (row = {}) => row.branch || row.filial || row.store || row.loja || null;

const isOpenValidade = (row) => row.status !== 'treated' && row.status !== 'resolved';
const isOpenTratativa = (status) => ['ABERTA', 'EM ANDAMENTO', 'AGUARDANDO'].includes(String(status || '').toUpperCase());

// ── Validade ────────────────────────────────────────────────────────────────
const fromValidade = (validade = []) => {
  const out = [];
  for (const row of validade) {
    if (!isOpenValidade(row)) continue;
    const dias = Number(row.diasrestantes);
    if (!Number.isFinite(dias)) continue;
    if (dias > 30) continue; // acima de 30 dias não entra na central

    let priority;
    let severity;
    let type;
    let statusText;
    if (dias < 0) {
      priority = 'alta'; severity = 'critico'; type = 'validade_vencido';
      statusText = `vencido há ${Math.abs(dias)} dia(s)`;
    } else if (dias === 0) {
      priority = 'alta'; severity = 'critico'; type = 'validade_hoje';
      statusText = 'vence hoje';
    } else if (dias <= 7) {
      priority = 'media'; severity = 'atencao'; type = 'validade_proximo';
      statusText = `vence em ${dias} dia(s)`;
    } else {
      priority = 'baixa'; severity = 'monitorar'; type = 'validade_monitorar';
      statusText = `vence em ${dias} dia(s)`;
    }

    out.push({
      id: `validade:${row.id}`,
      source: 'validade',
      module: 'Validade',
      viewKey: 'validade',
      type,
      title: row.descricao || row.codprod || 'Produto de validade',
      subtitle: `Cód. ${row.codprod || '-'}${row.lote ? ` · Lote ${row.lote}` : ''} · Qtd ${row.quantidade ?? '-'}`,
      reference: row.codprod || '-',
      responsible: row.user_name || row.user_email || null,
      sector: readSector(row),
      branch: readBranch(row),
      priority,
      severity,
      statusText,
      metric: dias,
      since: row.updated_at || null,
      sla: null,
      raw: row,
    });
  }
  return out;
};

// ── Divergências de conferência ──────────────────────────────────────────────
const fromDivergencias = (divergencias = [], now) => {
  const out = [];
  for (const row of divergencias) {
    if (String(row.status || 'pendente') === 'resolvida') continue;
    const sla = computeSla({ type: 'divergencia', since: row.created_at, now });
    const reference = row.order_code || row.invoice || row.supplier || '-';
    out.push({
      id: `divergencia:${row.id || `${reference}-${row.code}`}`,
      source: 'divergencia',
      module: 'Conferência',
      viewKey: 'conferencia',
      type: 'divergencia',
      title: `Divergência: ${row.description || row.code || 'item'}`,
      subtitle: `${row.source === 'saida' ? 'Saída' : 'Recebimento'} ${reference} · esperado ${row.expected_qty ?? '-'} / conferido ${row.checked_qty ?? '-'} (dif ${row.diff ?? '-'})`,
      reference,
      responsible: row.user_name || row.user_email || null,
      sector: readSector(row),
      branch: readBranch(row),
      priority: 'alta',
      // Item sempre aberto: nunca rotular como "resolvido" só porque ainda está
      // dentro do prazo de SLA (piso de gravidade em "atenção").
      severity: sla.severity === 'resolvido' ? 'atencao' : sla.severity,
      statusText: `divergência ${sla.text}`,
      metric: Number(row.diff) || 0,
      since: row.created_at || null,
      sla,
      raw: row,
    });
  }
  return out;
};

// ── Avarias ──────────────────────────────────────────────────────────────────
const fromAvarias = (avarias = [], now) => {
  const out = [];
  for (const row of avarias) {
    if (row.item_status !== 'damaged') continue;
    const sla = computeSla({ type: 'avaria', since: row.item_updated_at, now });
    out.push({
      id: `avaria:${row.item_id}`,
      source: 'avaria',
      module: 'Avarias',
      viewKey: 'avarias',
      type: 'avaria',
      title: `Avaria: ${row.descricao || row.codprod || 'item'}`,
      subtitle: `Cód. ${row.codprod || '-'} · Qtd ${row.quantidade ?? '-'}${row.supplier ? ` · ${row.supplier}` : ''}${row.damage_type ? ` · ${row.damage_type}` : ''}`,
      reference: row.codprod || '-',
      responsible: row.user_name || row.user_email || null,
      sector: readSector(row),
      branch: readBranch(row),
      priority: sla.status === 'critico' || sla.status === 'atrasado' ? 'alta' : 'media',
      // Avaria aberta nunca deve aparecer como "resolvido" dentro do prazo.
      severity: sla.severity === 'resolvido' ? 'atencao' : sla.severity,
      statusText: `avaria aberta ${sla.text}`,
      metric: Number(row.quantidade) || 0,
      since: row.item_updated_at || null,
      sla,
      raw: row,
    });
  }
  return out;
};

// ── Tratativas ───────────────────────────────────────────────────────────────
const fromTratativas = (tratativas = [], now) => {
  const out = [];
  for (const row of tratativas) {
    if (!isOpenTratativa(row.status)) continue;
    const sla = computeSla({ type: 'tratativa', since: row.created_at || row.updated_at, now });
    out.push({
      id: `tratativa:${row.id}`,
      source: 'tratativa',
      module: 'Tratativas',
      viewKey: 'tratativas',
      type: 'tratativa',
      title: `Tratativa ${row.doc_number || ''}`.trim(),
      subtitle: `${row.occurrence_type || 'Ocorrência'}${row.origin_invoice_number ? ` · NF ${row.origin_invoice_number}` : ''}${row.supplier_code ? ` · Forn. ${row.supplier_code}` : ''} · ${row.status}`,
      reference: row.doc_number || row.origin_invoice_number || '-',
      responsible: row.user_name || row.user_email || null,
      sector: readSector(row),
      branch: readBranch(row),
      priority: String(row.status || '').toUpperCase() === 'ABERTA' ? 'alta' : 'media',
      severity: sla.severity === 'resolvido' ? 'atencao' : sla.severity,
      statusText: `aberta ${sla.text}`,
      metric: 0,
      since: row.created_at || row.updated_at || null,
      sla,
      raw: row,
    });
  }
  return out;
};

// ── Conferências (paradas / sem responsável) ─────────────────────────────────
const fromConferenciaQueue = (queue = [], { now, isSaida }) => {
  const out = [];
  for (const row of queue) {
    const status = String(row.status || '');
    if (!['nao_iniciado', 'em_conferencia'].includes(status)) continue;

    const reference = isSaida ? (row.order_code || '-') : (row.invoice_number || '-');
    const who = isSaida ? (row.customer_name || row.route_code) : row.supplier_name;
    const baseSubtitle = `${reference}${who ? ` · ${who}` : ''} · ${row.item_count ?? '-'} itens`;
    const hasResponsible = Boolean(row.assigned_user_id || row.assigned_user_name);

    if (!hasResponsible) {
      out.push({
        id: `conf-sem-resp:${row.id}`,
        source: isSaida ? 'conferencia_saida' : 'conferencia',
        module: 'Conferência',
        viewKey: 'conferencia',
        type: 'conferencia',
        title: `Conferência sem responsável (${isSaida ? 'saída' : 'entrada'})`,
        subtitle: baseSubtitle,
        reference,
        responsible: null,
        sector: readSector(row),
        branch: readBranch(row),
        priority: 'alta',
        severity: 'critico',
        statusText: 'sem responsável atribuído',
        metric: 0,
        since: row.created_at || row.started_at || null,
        sla: null,
        raw: row,
      });
      continue;
    }

    if (status === 'em_conferencia') {
      const sla = computeSla({ type: 'conferencia_parada', since: row.started_at, now });
      // Só vira pendência quando passou do limite de "fluxo" (>= 75% do SLA).
      if (sla.status !== 'dentro') {
        out.push({
          id: `conf-parada:${row.id}`,
          source: isSaida ? 'conferencia_saida' : 'conferencia',
          module: 'Conferência',
          viewKey: 'conferencia',
          type: 'conferencia_parada',
          title: `Conferência parada (${isSaida ? 'saída' : 'entrada'})`,
          subtitle: `${baseSubtitle} · ${row.assigned_user_name || 'responsável'}`,
          reference,
          responsible: row.assigned_user_name || null,
          sector: readSector(row),
          branch: readBranch(row),
          priority: 'alta',
          severity: sla.severity,
          statusText: `parada ${sla.text}`,
          metric: 0,
          since: row.started_at || null,
          sla,
          raw: row,
        });
      }
    }
  }
  return out;
};

// ── Pedidos de compra em aberto ──────────────────────────────────────────────
const fromPurchaseOrders = (orders = []) => {
  const out = [];
  for (const row of orders) {
    const status = String(row.status || '');
    if (['encerrado', 'auditado', 'cancelado'].includes(status)) continue;
    const pendingEntry = String(row.entry_status || '') === 'pendente';
    const pendingReturn = String(row.return_status || '') === 'pendente';
    if (!pendingEntry && !pendingReturn && status === 'pedido_criado') {
      // pedido recém-criado sem ação pendente: monitorar apenas
    }
    out.push({
      id: `pedido:${row.id}`,
      source: 'purchase_order',
      module: 'Recebimento',
      viewKey: 'recebimento',
      type: pendingReturn ? 'correcao_entrada' : 'correcao_entrada',
      title: `Pedido ${row.order_number || row.invoice_number || ''}`.trim(),
      subtitle: `${row.supplier_name || '-'} · ${row.item_count ?? '-'} itens${pendingReturn ? ' · devolução pendente' : ''}${pendingEntry ? ' · entrada pendente' : ''}`,
      reference: row.order_number || row.invoice_number || '-',
      responsible: null,
      sector: readSector(row),
      branch: readBranch(row),
      priority: pendingReturn ? 'media' : 'baixa',
      severity: pendingReturn ? 'atencao' : 'monitorar',
      statusText: pendingReturn ? 'devolução pendente' : 'pedido em aberto',
      metric: 0,
      since: row.created_at || null,
      sla: null,
      raw: row,
    });
  }
  return out;
};

// Pressão de SLA (0..1) usada como critério de desempate na ordenação.
const slaPressure = (p) => {
  if (!p.sla || !p.sla.limitMinutes) return p.severity === 'critico' ? 1 : 0;
  return Math.min(2, p.sla.elapsedMinutes / p.sla.limitMinutes);
};

// Ordena a fila inteligente: prioridade → gravidade → pressão de SLA → mais antigo.
export const sortPendencias = (a, b) => {
  const byPriority = priorityWeight(b.priority) - priorityWeight(a.priority);
  if (byPriority) return byPriority;
  const bySeverity = severityWeight(b.severity) - severityWeight(a.severity);
  if (bySeverity) return bySeverity;
  const byPressure = slaPressure(b) - slaPressure(a);
  if (byPressure) return byPressure;
  const aSince = a.since ? new Date(a.since).getTime() : Infinity;
  const bSince = b.since ? new Date(b.since).getTime() : Infinity;
  return aSince - bSince;
};

// Constrói a lista única de pendências a partir do dataState.
export const buildPendencias = (data = {}, { now = Date.now() } = {}) => {
  const list = [
    ...fromValidade(data.validade),
    ...fromDivergencias(data.conferenciaDivergencias, now),
    ...fromAvarias(data.avarias, now),
    ...fromTratativas(data.tratativas, now),
    ...fromConferenciaQueue(data.conferenciaBonusQueue, { now, isSaida: false }),
    ...fromConferenciaQueue(data.conferenciaSaidaBonusQueue, { now, isSaida: true }),
    ...fromPurchaseOrders(data.purchaseOrders),
  ];
  return list.sort(sortPendencias);
};

// Resumo agregado para cards/indicadores.
export const summarizePendencias = (pendencias = []) => {
  const summary = {
    total: pendencias.length,
    alta: 0, media: 0, baixa: 0,
    critico: 0, atencao: 0, monitorar: 0,
    semResponsavel: 0,
    atrasadas: 0,
    porModulo: {},
  };
  for (const p of pendencias) {
    summary[p.priority] = (summary[p.priority] || 0) + 1;
    summary[p.severity] = (summary[p.severity] || 0) + 1;
    if (!p.responsible) summary.semResponsavel += 1;
    if (p.sla && (p.sla.status === 'atrasado' || p.sla.status === 'critico')) summary.atrasadas += 1;
    summary.porModulo[p.module] = (summary.porModulo[p.module] || 0) + 1;
  }
  return summary;
};

// Fila recomendada (briefing §6): agrupa as pendências por categoria operacional
// na ordem sugerida pelo briefing, mostrando contagem por grupo.
export const buildFilaRecomendada = (pendencias = []) => {
  const groups = [
    { key: 'vencidos', label: 'Resolver produtos vencidos', match: (p) => p.type === 'validade_vencido' || p.type === 'validade_hoje' },
    { key: 'divergencias', label: 'Corrigir notas com divergência', match: (p) => p.type === 'divergencia' },
    { key: 'conferencias', label: 'Finalizar conferências paradas / sem responsável', match: (p) => p.source === 'conferencia' || p.source === 'conferencia_saida' },
    { key: 'avarias', label: 'Tratar avarias abertas', match: (p) => p.source === 'avaria' },
    { key: 'validade7', label: 'Tratar produtos vencendo em até 7 dias', match: (p) => p.type === 'validade_proximo' },
    { key: 'pedidos', label: 'Concluir pedidos em aberto', match: (p) => p.source === 'purchase_order' },
  ];
  return groups
    .map((group) => {
      const items = pendencias.filter(group.match);
      return { ...group, count: items.length, items };
    })
    .filter((group) => group.count > 0);
};
