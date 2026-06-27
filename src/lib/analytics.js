// Agregações analíticas derivadas dos dados já carregados (sem chamadas extras):
//  - Fornecedores (briefing §22)
//  - Qualidade de cadastro (briefing §21)
//  - Ranking de produtos problemáticos (briefing §23)

const normName = (value) => String(value || '').toUpperCase().replace(/\s+/g, ' ').trim();
const latest = (a, b) => {
  const ta = a ? new Date(a).getTime() : 0;
  const tb = b ? new Date(b).getTime() : 0;
  return ta >= tb ? a : b;
};

// ── Fornecedores ─────────────────────────────────────────────────────────────
// Agrega pedidos de compra, divergências de recebimento e avarias por fornecedor.
export const buildSuppliers = ({ purchaseOrders = [], conferenciaDivergencias = [], avarias = [] } = {}) => {
  const map = new Map();
  const ensure = (name, document) => {
    const key = normName(name);
    if (!key) return null;
    if (!map.has(key)) {
      map.set(key, {
        key,
        name: name || '—',
        document: document || null,
        orders: 0,
        items: 0,
        divergences: 0,
        returns: 0,
        avarias: 0,
        lastInvoice: null,
        lastInvoiceAt: null,
      });
    }
    const entry = map.get(key);
    if (document && !entry.document) entry.document = document;
    return entry;
  };

  for (const order of purchaseOrders) {
    const entry = ensure(order.supplier_name, order.supplier_document);
    if (!entry) continue;
    entry.orders += 1;
    entry.items += Number(order.item_count || 0);
    if (['pendente', 'realizada', 'solicitada'].includes(String(order.return_status || ''))) entry.returns += 1;
    const at = order.issued_at || order.created_at;
    if (at && (!entry.lastInvoiceAt || new Date(at) > new Date(entry.lastInvoiceAt))) {
      entry.lastInvoiceAt = at;
      entry.lastInvoice = order.invoice_number || order.order_number || entry.lastInvoice;
    }
  }

  for (const div of conferenciaDivergencias) {
    if (div.source === 'saida') continue; // saída não tem fornecedor
    const entry = ensure(div.supplier);
    if (!entry) continue;
    entry.divergences += 1;
  }

  for (const av of avarias) {
    const entry = ensure(av.supplier);
    if (!entry) continue;
    entry.avarias += 1;
  }

  return Array.from(map.values())
    .map((s) => ({ ...s, problems: s.divergences + s.returns + s.avarias }))
    .sort((a, b) => b.problems - a.problems || b.orders - a.orders);
};

// ── Qualidade de cadastro ────────────────────────────────────────────────────
// Avalia a completude de cada produto de validade. As checagens de imagem/EAN/
// setor são tolerantes: se o campo não existir em NENHUM registro, o indicador
// é marcado como "não rastreável" para não dar falso negativo.
const QUALITY_CHECKS = [
  { key: 'descricao', label: 'Sem descrição', has: (r) => Boolean(String(r.descricao || '').trim()) },
  { key: 'codprod', label: 'Sem código', has: (r) => Boolean(String(r.codprod || '').trim()) },
  { key: 'ean', label: 'Sem EAN', has: (r) => Boolean(String(r.ean || r.codbar || '').trim()) },
  { key: 'lote', label: 'Sem lote', has: (r) => Boolean(String(r.lote || '').trim()) },
  { key: 'quantidade', label: 'Sem quantidade', has: (r) => Number(r.quantidade) > 0 },
  { key: 'validade', label: 'Sem validade', has: (r) => r.diasrestantes !== null && r.diasrestantes !== undefined && r.diasrestantes !== '' },
  { key: 'imagem', label: 'Sem imagem', has: (r) => Boolean(r.image_url || r.imagem || r.photo_url) },
  { key: 'setor', label: 'Sem setor', has: (r) => Boolean(r.sector || r.setor || r.area) },
];

export const buildCadastroQuality = (validade = []) => {
  const total = validade.length;
  const fieldPresence = {}; // quantos registros têm o campo preenchido
  const missingByCheck = {};
  QUALITY_CHECKS.forEach((c) => { fieldPresence[c.key] = 0; missingByCheck[c.key] = 0; });

  const incompleteRows = [];

  for (const row of validade) {
    const missing = [];
    for (const check of QUALITY_CHECKS) {
      const ok = check.has(row);
      if (ok) fieldPresence[check.key] += 1;
      else { missingByCheck[check.key] += 1; missing.push(check.label); }
    }
    if (missing.length) incompleteRows.push({ ...row, _missing: missing });
  }

  // Um campo é "rastreável" se ao menos 1 registro o tem preenchido.
  const checks = QUALITY_CHECKS.map((c) => ({
    key: c.key,
    label: c.label,
    missing: missingByCheck[c.key],
    trackable: fieldPresence[c.key] > 0,
  }));

  // Completude considera só os campos rastreáveis.
  const trackableKeys = checks.filter((c) => c.trackable).map((c) => c.key);
  const completeRows = validade.filter((row) =>
    QUALITY_CHECKS.filter((c) => trackableKeys.includes(c.key)).every((c) => c.has(row)),
  ).length;
  const completePct = total ? Math.round((completeRows / total) * 100) : 100;

  return {
    total,
    incompleteCount: incompleteRows.length,
    completePct,
    checks,
    incompleteRows: incompleteRows.sort((a, b) => b._missing.length - a._missing.length),
  };
};

// ── Ranking de produtos problemáticos ────────────────────────────────────────
// Soma ocorrências por produto (chave = código, ou descrição quando sem código).
export const buildProductRanking = ({ validade = [], avarias = [], conferenciaDivergencias = [], tratativas = [] } = {}) => {
  const map = new Map();
  const ensure = (code, description) => {
    const key = String(code || description || '').toUpperCase().trim();
    if (!key) return null;
    if (!map.has(key)) {
      map.set(key, {
        key,
        code: code || '—',
        description: description || '—',
        vencimentos: 0,
        avarias: 0,
        divergencias: 0,
        tratativas: 0,
        semImagem: 0,
        total: 0,
        lastAt: null,
      });
    }
    return map.get(key);
  };

  for (const row of validade) {
    if (row.status === 'resolved') continue;
    const e = ensure(row.codprod, row.descricao);
    if (!e) continue;
    e.vencimentos += 1;
    if (!(row.image_url || row.imagem)) e.semImagem += 1;
    e.lastAt = latest(e.lastAt, row.updated_at);
    if (e.description === '—' && row.descricao) e.description = row.descricao;
  }
  for (const row of avarias) {
    const e = ensure(row.codprod, row.descricao);
    if (!e) continue;
    e.avarias += 1;
    e.lastAt = latest(e.lastAt, row.item_updated_at);
  }
  for (const row of conferenciaDivergencias) {
    const e = ensure(row.code, row.description);
    if (!e) continue;
    e.divergencias += 1;
    e.lastAt = latest(e.lastAt, row.created_at);
  }
  for (const row of tratativas) {
    // tratativas não têm código de produto; agrupa por documento como proxy fraco
    if (!row.doc_number) continue;
    const e = ensure(row.doc_number, `Tratativa ${row.doc_number}`);
    if (!e) continue;
    e.tratativas += 1;
    e.lastAt = latest(e.lastAt, row.updated_at);
  }

  return Array.from(map.values())
    .map((e) => ({ ...e, total: e.vencimentos + e.avarias + e.divergencias + e.tratativas }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total);
};
