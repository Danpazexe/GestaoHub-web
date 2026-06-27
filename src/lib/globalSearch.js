// Central de busca global (briefing §10). Procura, em memória, sobre os dados
// já carregados pelo painel: produto, código interno, EAN/DUN, nota fiscal,
// fornecedor, colaborador, avaria, conferência, divergência e validade.
// Não faz chamadas extras ao Supabase.

const norm = (value) => String(value ?? '').toLowerCase().trim();

// Cada fonte declara: como extrair texto pesquisável, rótulo, sub-rótulo,
// categoria e a view de destino. A ordem define a prioridade na exibição.
const SOURCES = [
  {
    key: 'validade',
    category: 'Validade',
    viewKey: 'validade',
    rows: (d) => d.validade,
    fields: (r) => [r.codprod, r.descricao, r.lote, r.ean],
    label: (r) => r.descricao || r.codprod || 'Produto',
    sublabel: (r) => `Cód. ${r.codprod || '-'}${r.lote ? ` · Lote ${r.lote}` : ''} · ${r.diasrestantes ?? '-'} dias`,
  },
  {
    key: 'avaria',
    category: 'Avaria',
    viewKey: 'avarias',
    rows: (d) => d.avarias,
    fields: (r) => [r.codprod, r.descricao, r.supplier, r.damage_type],
    label: (r) => r.descricao || r.codprod || 'Avaria',
    sublabel: (r) => `Cód. ${r.codprod || '-'}${r.supplier ? ` · ${r.supplier}` : ''} · ${r.item_status === 'resolved' ? 'resolvida' : 'aberta'}`,
  },
  {
    key: 'divergencia',
    category: 'Divergência',
    viewKey: 'conferencia',
    rows: (d) => d.conferenciaDivergencias,
    fields: (r) => [r.code, r.description, r.order_code, r.invoice, r.supplier],
    label: (r) => r.description || r.code || 'Divergência',
    sublabel: (r) => `${r.source === 'saida' ? 'Saída' : 'Recebimento'} ${r.order_code || r.invoice || r.supplier || '-'} · dif ${r.diff ?? '-'}`,
  },
  {
    key: 'tratativa',
    category: 'Tratativa',
    viewKey: 'tratativas',
    rows: (d) => d.tratativas,
    fields: (r) => [r.doc_number, r.origin_invoice_number, r.supplier_code, r.occurrence_type],
    label: (r) => `Tratativa ${r.doc_number || ''}`.trim(),
    sublabel: (r) => `${r.occurrence_type || 'Ocorrência'}${r.origin_invoice_number ? ` · NF ${r.origin_invoice_number}` : ''} · ${r.status || '-'}`,
  },
  {
    key: 'pedido',
    category: 'Nota / Pedido',
    viewKey: 'recebimento',
    rows: (d) => d.purchaseOrders,
    fields: (r) => [r.order_number, r.invoice_number, r.supplier_name],
    label: (r) => `Pedido ${r.order_number || r.invoice_number || ''}`.trim(),
    sublabel: (r) => `${r.supplier_name || '-'}${r.invoice_number ? ` · NF ${r.invoice_number}` : ''} · ${r.item_count ?? '-'} itens`,
  },
  {
    key: 'conf-entrada',
    category: 'Conferência (entrada)',
    viewKey: 'conferencia',
    rows: (d) => d.conferenciaBonusQueue,
    fields: (r) => [r.invoice_number, r.supplier_name, r.assigned_user_name],
    label: (r) => `NF ${r.invoice_number || '-'}`,
    sublabel: (r) => `${r.supplier_name || '-'} · ${r.item_count ?? '-'} itens · ${r.status || '-'}`,
  },
  {
    key: 'conf-saida',
    category: 'Conferência (saída)',
    viewKey: 'conferencia',
    rows: (d) => d.conferenciaSaidaBonusQueue,
    fields: (r) => [r.order_code, r.customer_name, r.route_code, r.assigned_user_name],
    label: (r) => `Pedido ${r.order_code || '-'}`,
    sublabel: (r) => `${r.customer_name || r.route_code || '-'} · ${r.item_count ?? '-'} itens · ${r.status || '-'}`,
  },
  {
    key: 'colaborador',
    category: 'Colaborador',
    viewKey: 'users',
    rows: (d) => d.activeUsers,
    fields: (r) => [r.name, r.email, r.current_module],
    label: (r) => r.name || r.email || 'Colaborador',
    sublabel: (r) => `${r.email || '-'} · ${r.status || 'offline'}${r.current_module ? ` · ${r.current_module}` : ''}`,
  },
];

// Executa a busca e devolve grupos por categoria, cada um com até `perCategory`
// itens. `term` curto (< 2 chars) devolve vazio.
export const searchGlobal = (data = {}, term, { perCategory = 6, totalLimit = 40 } = {}) => {
  const q = norm(term);
  if (q.length < 2) return [];

  const groups = [];
  let total = 0;

  for (const source of SOURCES) {
    if (total >= totalLimit) break;
    const rows = source.rows(data) || [];
    const matches = [];

    for (const row of rows) {
      const haystack = norm(source.fields(row).filter(Boolean).join(' '));
      if (haystack.includes(q)) {
        matches.push({
          key: `${source.key}:${row.id || row.item_id || row.user_id || matches.length}`,
          label: source.label(row),
          sublabel: source.sublabel(row),
          viewKey: source.viewKey,
        });
        if (matches.length >= perCategory) break;
      }
    }

    if (matches.length) {
      groups.push({ category: source.category, viewKey: source.viewKey, items: matches });
      total += matches.length;
    }
  }

  return groups;
};

export const countResults = (groups = []) => groups.reduce((sum, g) => sum + g.items.length, 0);
