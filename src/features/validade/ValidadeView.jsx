import { useMemo, useState, useEffect } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { SeverityBadge } from '../../components/SeverityBadge';
import { FilterChips } from '../../components/FilterChips';
import { RowActions } from '../../components/RowActions';
import { Drawer } from '../../components/Drawer';
import { SelectFilter } from '../../components/SelectFilter';
import { SearchInput } from '../../components/SearchInput';
import { BeforeAfter } from '../../components/BeforeAfter';
import { useConfirm } from '../../hooks/useConfirm';
import { adminApi } from '../../services/adminApi';
import { toast } from '../../lib/toast';
import { exportCsv } from '../../lib/csv';
import { hasReason, VALIDATION_MESSAGES } from '../../lib/validations';
import { formatDateTime, truncate } from '../../lib/format';
import { classifyValidade, readImage, hasImageField, isOpenValidade, isDirectImageUrl, loadFaixasConfig } from '../../lib/validadeFaixas';

// Vocabulário canônico de tratativa de validade — MESMOS códigos do app (EN) que o
// CHECK do banco (ck_validade_treatment_type) aceita: sold/exchanged/returned/expired.
const VALIDADE_TREATMENTS = {
  sold: 'Vendido',
  exchanged: 'Trocado',
  returned: 'Devolvido',
  expired: 'Vencido',
};
const DEFAULT_TREATMENT = 'sold';
const treatmentLabel = (value) => VALIDADE_TREATMENTS[value] || value || '-';

const FAIXA_OPTIONS = [
  { value: 'vencido', label: 'Vencidos' },
  { value: 'hoje', label: 'Vence hoje' },
  { value: 'critico', label: 'Crítico' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'monitorar', label: 'Monitorar' },
  { value: 'seguro', label: 'Seguro' },
];

const ORDER_OPTIONS = [
  { value: 'validade', label: 'Validade (mais próxima)' },
  { value: 'validade_desc', label: 'Validade (mais distante)' },
  { value: 'quantidade', label: 'Maior quantidade' },
  { value: 'nome', label: 'Nome (A-Z)' },
];

export const ValidadeView = ({ validade, onRefresh }) => {
  const { confirm, ConfirmModalNode } = useConfirm();
  const [statusValue, setStatusValue] = useState('');
  const [faixaValue, setFaixaValue] = useState('');
  const [semImagem, setSemImagem] = useState(false);
  const [order, setOrder] = useState('validade');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('cards'); // cards | table
  const [imagePreview, setImagePreview] = useState(null);
  const [treatmentState, setTreatmentState] = useState({
    row: null,
    treatment_type: DEFAULT_TREATMENT,
    observacao: '',
    loading: false,
  });

  const rows = validade || [];
  const imageTrackable = useMemo(() => hasImageField(rows), [rows]);
  // Faixas configuráveis carregadas uma vez (evita reler localStorage por linha).
  const faixasConfig = useMemo(() => loadFaixasConfig(), []);

  // Resolve URLs assinadas para os caminhos do bucket privado product-images.
  const [imageUrls, setImageUrls] = useState({});
  useEffect(() => {
    const paths = rows
      .map((r) => readImage(r))
      .filter((value) => value && !isDirectImageUrl(value));
    if (!paths.length) { setImageUrls({}); return undefined; }
    let active = true;
    adminApi.createSignedProductImageUrls(paths)
      .then((map) => { if (active) setImageUrls(map); })
      .catch(() => {});
    return () => { active = false; };
  }, [rows]);

  // URL exibível: URL direta passa reto; caminho de storage usa a versão assinada.
  const resolveImg = (row) => {
    const raw = readImage(row);
    if (!raw) return null;
    return isDirectImageUrl(raw) ? raw : (imageUrls[raw] || null);
  };

  // Cards de resumo (§13.3) alinhados 1:1 às faixas reais (respeitam a config).
  const summary = useMemo(() => {
    const open = rows.filter(isOpenValidade);
    const count = (key) => open.filter((r) => classifyValidade(r.diasrestantes, faixasConfig).key === key).length;
    return {
      vencidos: count('vencido'),
      hoje: count('hoje'),
      critico: count('critico'),
      atencao: count('atencao'),
      monitorar: count('monitorar'),
      tratados: rows.filter((r) => !isOpenValidade(r)).length,
      semImagem: imageTrackable ? open.filter((r) => !readImage(r)).length : null,
    };
  }, [rows, imageTrackable, faixasConfig]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (statusValue && row.status !== statusValue) return false;
      if (faixaValue && classifyValidade(row.diasrestantes, faixasConfig).key !== faixaValue) return false;
      if (semImagem && readImage(row)) return false;
      if (term) {
        const hay = `${row.codprod || ''} ${row.descricao || ''} ${row.lote || ''} ${row.ean || ''}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
    // Comparadores NaN-safe: valores não numéricos vão para o fim.
    const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : Infinity; };
    const sorters = {
      validade: (a, b) => num(a.diasrestantes) - num(b.diasrestantes),
      validade_desc: (a, b) => num(b.diasrestantes) - num(a.diasrestantes),
      quantidade: (a, b) => num(b.quantidade) - num(a.quantidade),
      nome: (a, b) => String(a.descricao || '').localeCompare(String(b.descricao || ''), 'pt-BR'),
    };
    return [...list].sort(sorters[order] || sorters.validade);
  }, [rows, statusValue, faixaValue, semImagem, search, order, faixasConfig]);

  const treatmentHistory = useMemo(
    () => rows.filter((row) => row.treatment_date)
      .sort((l, r) => new Date(r.treatment_date) - new Date(l.treatment_date)),
    [rows],
  );

  const reasonRequired = treatmentState.treatment_type === 'expired';
  const reasonOk = !reasonRequired || hasReason(treatmentState.observacao);

  const closeTreatment = () => setTreatmentState({ row: null, treatment_type: DEFAULT_TREATMENT, observacao: '', loading: false });

  const applyTreatment = async () => {
    if (!treatmentState.row) return;
    if (reasonRequired && !reasonOk) { toast.error(VALIDATION_MESSAGES.reason); return; }
    const loadingId = toast.loading('Aplicando tratativa...');
    setTreatmentState((current) => ({ ...current, loading: true }));
    try {
      await adminApi.applyValidadeTreatment(treatmentState.row.id, {
        treatment_type: treatmentState.treatment_type,
        observacao: treatmentState.observacao,
        status: 'treated',
      });
      await onRefresh?.();
      toast.success('Tratativa aplicada com sucesso.');
      closeTreatment();
    } catch (error) {
      toast.error(error?.message || 'Falha ao aplicar tratativa.');
      setTreatmentState((current) => ({ ...current, loading: false }));
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const resolveItem = async (row) => {
    const approved = await confirm({
      title: 'Marcar item como resolvido?',
      description: `O item ${row.codprod || '-'} será marcado como resolvido.`,
      confirmLabel: 'Marcar como resolvido',
    });
    if (!approved) return;
    const loadingId = toast.loading('Atualizando item...');
    try {
      await adminApi.resolveValidadeItem(row.id);
      await onRefresh?.();
      toast.success('Item marcado como resolvido.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao atualizar o item.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const openTreatment = (row) => setTreatmentState({
    row,
    treatment_type: VALIDADE_TREATMENTS[row.treatment_type] ? row.treatment_type : DEFAULT_TREATMENT,
    observacao: '',
    loading: false,
  });

  // Cada card mapeia para uma faixa real (filtro casa 1:1), evitando key vazia.
  const summaryCards = [
    { key: 'vencido', label: 'Vencidos', value: summary.vencidos, tone: 'danger' },
    { key: 'hoje', label: 'Vence hoje', value: summary.hoje, tone: 'danger' },
    { key: 'critico', label: `Crítico (≤${faixasConfig.criticoDias}d)`, value: summary.critico, tone: 'danger' },
    { key: 'atencao', label: `Atenção (≤${faixasConfig.atencaoDias}d)`, value: summary.atencao, tone: 'warning' },
    { key: 'monitorar', label: `Monitorar (≤${faixasConfig.monitorarDias}d)`, value: summary.monitorar, tone: 'monitor' },
    { key: 'treated', label: 'Tratados', value: summary.tratados, tone: 'success', isStatus: true },
    ...(imageTrackable ? [{ key: 'semimg', label: 'Sem imagem', value: summary.semImagem, tone: 'info', isImage: true }] : []),
  ];

  const applyCardFilter = (card) => {
    if (card.isStatus) { setStatusValue('treated'); setFaixaValue(''); setSemImagem(false); }
    else if (card.isImage) { setSemImagem(true); setFaixaValue(''); setStatusValue(''); }
    else { setFaixaValue(card.key); setStatusValue(''); setSemImagem(false); }
  };

  return (
    <>
      {ConfirmModalNode}

      {imagePreview ? (
        <div className="image-preview-overlay" role="presentation" onClick={() => setImagePreview(null)}>
          <div className="image-preview" onClick={(e) => e.stopPropagation()}>
            <img src={imagePreview.src} alt={imagePreview.alt} />
            <button type="button" className="ghost-button" onClick={() => setImagePreview(null)}>Fechar</button>
          </div>
        </div>
      ) : null}

      <Drawer open={Boolean(treatmentState.row)} title={`Aplicar tratativa em ${treatmentState.row?.codprod || ''}`} onClose={closeTreatment}>
        <div className="form-stack">
          <label className="builder-field">
            <span>Tratativa</span>
            <select value={treatmentState.treatment_type} onChange={(event) => setTreatmentState((current) => ({ ...current, treatment_type: event.target.value }))}>
              {Object.entries(VALIDADE_TREATMENTS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="builder-field">
            <span>Observação{reasonRequired ? ' (obrigatória)' : ''}</span>
            <textarea value={treatmentState.observacao} onChange={(event) => setTreatmentState((current) => ({ ...current, observacao: event.target.value.slice(0, 300) }))} rows={4} placeholder={reasonRequired ? 'Descreva o motivo da perda/baixa' : 'Observação opcional'} />
          </label>
          {treatmentState.row ? (
            <BeforeAfter
              before={[{ label: 'Status', value: treatmentState.row.status }, { label: 'Tratativa', value: treatmentLabel(treatmentState.row.treatment_type) }]}
              after={[{ label: 'Status', value: 'treated' }, { label: 'Tratativa', value: treatmentLabel(treatmentState.treatment_type) }]}
              reason={treatmentState.observacao || null}
            />
          ) : null}
          {reasonRequired && !reasonOk ? <div className="feedback warning">{VALIDATION_MESSAGES.reason}</div> : null}
          <button type="button" className="primary-button button-inline" onClick={applyTreatment} disabled={treatmentState.loading || !reasonOk}>
            {treatmentState.loading ? 'Salvando...' : 'Aplicar tratativa'}
          </button>
        </div>
      </Drawer>

      <PanelSection
        title="Controle de validade"
        subtitle="Acompanhe produtos vencidos, próximos do vencimento, tratados e pendentes."
        kicker="Rastreabilidade"
      >
        <div className="validade-summary">
          {summaryCards.map((card) => (
            <button key={card.label} type="button" className={`validade-summary-card sev-stripe-${card.tone}`} onClick={() => applyCardFilter(card)}>
              <span className="validade-summary-value">{card.value ?? '—'}</span>
              <span className="validade-summary-label">{card.label}</span>
            </button>
          ))}
        </div>

        <div className="filter-bar validade-toolbar">
          <SelectFilter value={faixaValue} onChange={setFaixaValue} placeholder="Todas as faixas" options={FAIXA_OPTIONS} />
          <SelectFilter value={statusValue} onChange={setStatusValue} placeholder="Todos os status" options={Array.from(new Set(rows.map((r) => r.status).filter(Boolean))).map((v) => ({ value: v, label: v }))} />
          <SelectFilter value={order} onChange={setOrder} placeholder="Ordenar por" options={ORDER_OPTIONS} />
          {imageTrackable ? (
            <label className="toggle-filter">
              <input type="checkbox" checked={semImagem} onChange={(e) => setSemImagem(e.target.checked)} /> Sem imagem
            </label>
          ) : null}
          <div className="search-expand">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar produto, código, lote, EAN" />
          </div>
          <div className="segmented" role="tablist" aria-label="Modo de exibição">
            <button type="button" className={viewMode === 'cards' ? 'segmented-btn active' : 'segmented-btn'} onClick={() => setViewMode('cards')}>Cards</button>
            <button type="button" className={viewMode === 'table' ? 'segmented-btn active' : 'segmented-btn'} onClick={() => setViewMode('table')}>Tabela</button>
          </div>
        </div>

        <FilterChips
          chips={[
            faixaValue && { key: 'faixa', label: `Faixa: ${FAIXA_OPTIONS.find((o) => o.value === faixaValue)?.label || faixaValue}`, onRemove: () => setFaixaValue('') },
            statusValue && { key: 'status', label: `Status: ${statusValue}`, onRemove: () => setStatusValue('') },
            semImagem && { key: 'semimg', label: 'Sem imagem', onRemove: () => setSemImagem(false) },
            search && { key: 'busca', label: `Busca: "${search}"`, onRemove: () => setSearch('') },
          ]}
          onClear={() => { setFaixaValue(''); setStatusValue(''); setSemImagem(false); setSearch(''); }}
        />

        {viewMode === 'cards' ? (
          filtered.length ? (
            <div className="validade-grid">
              {filtered.slice(0, 60).map((row) => {
                const faixa = classifyValidade(row.diasrestantes, faixasConfig);
                const img = resolveImg(row);
                return (
                  <article key={row.id} className={`validade-card sev-stripe-${faixa.tone}`}>
                    <div className="validade-card-media">
                      {img ? (
                        <img src={img} alt={row.descricao || row.codprod} onClick={() => setImagePreview({ src: img, alt: row.descricao })} />
                      ) : (
                        <div className="validade-card-noimg" title="Sem imagem">{(row.descricao || row.codprod || '?').slice(0, 2).toUpperCase()}</div>
                      )}
                      <SeverityBadge severity={faixa.tone === 'danger' ? 'critico' : faixa.tone === 'warning' ? 'atencao' : faixa.tone === 'monitor' ? 'monitorar' : 'resolvido'} label={faixa.label} />
                    </div>
                    <div className="validade-card-body">
                      <strong className="validade-card-title">{truncate(row.descricao, 40)}</strong>
                      <div className="validade-card-meta">Cód. {row.codprod || '-'}{row.lote ? ` · Lote ${row.lote}` : ''}</div>
                      <div className="validade-card-meta">Qtd {row.quantidade ?? '-'} · {row.user_name || row.user_email || 'sem responsável'}</div>
                      <div className="validade-card-foot">
                        <StatusBadge value={row.status} />
                        <span className="validade-card-upd">{formatDateTime(row.updated_at)}</span>
                      </div>
                    </div>
                    <div className="validade-card-actions">
                      <button type="button" className="table-action-button" onClick={() => openTreatment(row)}>Tratar</button>
                      <button type="button" className="table-action-button" onClick={() => resolveItem(row)}>Resolver</button>
                      {img ? <button type="button" className="table-action-button" onClick={() => setImagePreview({ src: img, alt: row.descricao })}>Imagem</button> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <div className="empty-state">Nenhum produto encontrado com os filtros atuais.</div>
        ) : (
          <DataTable
            rows={filtered}
            pageSize={20}
            sortable
            rowClassName={(row) => `sev-stripe-${classifyValidade(row.diasrestantes, faixasConfig).tone}`}
            columns={[
              { key: 'user_name', label: 'Operador', render: (row) => row.user_name || row.user_email || '-' },
              { key: 'codprod', label: 'Código' },
              { key: 'descricao', label: 'Descrição', render: (row) => truncate(row.descricao, 52) },
              { key: 'lote', label: 'Lote' },
              { key: 'quantidade', label: 'Qtd' },
              { key: 'diasrestantes', label: 'Faixa', render: (row) => { const f = classifyValidade(row.diasrestantes, faixasConfig); return <SeverityBadge severity={f.tone === 'danger' ? 'critico' : f.tone === 'warning' ? 'atencao' : f.tone === 'monitor' ? 'monitorar' : 'resolvido'} label={f.label} />; } },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              { key: 'treatment_type', label: 'Tratativa', render: (row) => treatmentLabel(row.treatment_type) },
              { key: 'updated_at', label: 'Atualização', render: (row) => formatDateTime(row.updated_at) },
              {
                key: 'actions', label: 'Ações',
                render: (row) => (
                  <RowActions actions={[
                    { label: 'Tratar', onClick: () => openTreatment(row) },
                    { label: 'Marcar como resolvido', onClick: () => resolveItem(row) },
                  ]} />
                ),
              },
            ]}
            emptyMessage="Nenhum produto de validade encontrado."
          />
        )}
      </PanelSection>

      <PanelSection
        title={`Histórico de tratativas (${treatmentHistory.length})`}
        subtitle="Auditoria: quem tratou cada produto, quando e com qual tipo"
        kicker="Rastreabilidade"
        actions={treatmentHistory.length > 0 ? (
          <button type="button" className="ghost-button" onClick={() => exportCsv(treatmentHistory, [
            { key: 'user_name', label: 'Operador' },
            { key: 'codprod', label: 'Código' },
            { key: 'descricao', label: 'Descrição' },
            { key: 'lote', label: 'Lote' },
            { key: 'treatment', label: 'Tratativa', format: (row) => treatmentLabel(row.treatment_type) },
            { key: 'treatment_note', label: 'Observação' },
            { key: 'treatment_date', label: 'Data', format: (row) => formatDateTime(row.treatment_date) },
          ], 'tratativas-validade')}>Exportar CSV</button>
        ) : null}
      >
        <DataTable
          rows={treatmentHistory}
          searchable
          sortable
          pageSize={15}
          columns={[
            { key: 'user_name', label: 'Operador', render: (row) => row.user_name || row.user_email || '—' },
            { key: 'codprod', label: 'Código' },
            { key: 'descricao', label: 'Descrição', render: (row) => truncate(row.descricao, 48) },
            { key: 'lote', label: 'Lote' },
            { key: 'treatment_type', label: 'Tratativa', render: (row) => treatmentLabel(row.treatment_type) },
            { key: 'treatment_note', label: 'Observação', render: (row) => row.treatment_note || '—' },
            { key: 'treatment_date', label: 'Tratado em', render: (row) => formatDateTime(row.treatment_date) },
          ]}
          emptyMessage="Nenhuma tratativa registrada ainda."
        />
      </PanelSection>
    </>
  );
};
