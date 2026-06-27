import { useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { SelectFilter } from '../../components/SelectFilter';
import { SearchInput } from '../../components/SearchInput';
import { SeverityBadge, PriorityBadge, SlaBadge } from '../../components/SeverityBadge';
import { FilterChips } from '../../components/FilterChips';
import { exportCsv } from '../../lib/csv';
import { formatRelativeMinutes } from '../../lib/format';
import { severityMeta } from '../../lib/severity';
import {
  buildPendencias,
  summarizePendencias,
  buildFilaRecomendada,
} from '../../lib/pendencias';

const PRIORITY_OPTIONS = [
  { value: 'alta', label: 'Prioridade alta' },
  { value: 'media', label: 'Prioridade média' },
  { value: 'baixa', label: 'Prioridade baixa' },
];

// Apenas as gravidades realmente produzidas pelo motor de pendências.
const SEVERITY_OPTIONS = [
  { value: 'critico', label: 'Crítico' },
  { value: 'atencao', label: 'Atenção' },
  { value: 'monitorar', label: 'Monitorar' },
];

// Central de pendências (briefing §5 prioridade automática + §6 fila inteligente).
// Deriva tudo dos dados já carregados pelo painel — sem chamadas extras.
export const PendenciasView = ({
  validade = [],
  conferenciaDivergencias = [],
  avarias = [],
  tratativas = [],
  conferenciaBonusQueue = [],
  conferenciaSaidaBonusQueue = [],
  purchaseOrders = [],
  onSelectView,
}) => {
  const [priority, setPriority] = useState('');
  const [severity, setSeverity] = useState('');
  const [moduleValue, setModuleValue] = useState('');
  const [responsible, setResponsible] = useState('');
  const [search, setSearch] = useState('');

  const pendencias = useMemo(
    () => buildPendencias({
      validade,
      conferenciaDivergencias,
      avarias,
      tratativas,
      conferenciaBonusQueue,
      conferenciaSaidaBonusQueue,
      purchaseOrders,
    }),
    [validade, conferenciaDivergencias, avarias, tratativas, conferenciaBonusQueue, conferenciaSaidaBonusQueue, purchaseOrders],
  );

  const summary = useMemo(() => summarizePendencias(pendencias), [pendencias]);
  const fila = useMemo(() => buildFilaRecomendada(pendencias), [pendencias]);

  const moduleOptions = useMemo(
    () => Array.from(new Set(pendencias.map((p) => p.module))).map((value) => ({ value, label: value })),
    [pendencias],
  );
  const responsibleOptions = useMemo(
    () => Array.from(new Set(pendencias.map((p) => p.responsible).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .map((value) => ({ value, label: value })),
    [pendencias],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pendencias.filter((p) => {
      if (priority && p.priority !== priority) return false;
      if (severity && p.severity !== severity) return false;
      if (moduleValue && p.module !== moduleValue) return false;
      if (responsible && p.responsible !== responsible) return false;
      if (term) {
        const haystack = `${p.title} ${p.subtitle} ${p.reference} ${p.responsible || ''}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [pendencias, priority, severity, moduleValue, responsible, search]);

  const cards = [
    { key: 'total', label: 'Pendências abertas', value: summary.total, tone: 'info' },
    { key: 'alta', label: 'Prioridade alta', value: summary.alta, tone: 'danger' },
    { key: 'atrasadas', label: 'Fora do prazo (SLA)', value: summary.atrasadas, tone: 'warning' },
    { key: 'semResp', label: 'Sem responsável', value: summary.semResponsavel, tone: 'monitor' },
  ];

  return (
    <>
      <PanelSection
        title="Central de pendências"
        subtitle="Tudo o que precisa de atenção, ordenado automaticamente por risco operacional"
        kicker="Prioridade automática"
        actions={pendencias.length > 0 ? (
          <button
            type="button"
            className="ghost-button"
            onClick={() => exportCsv(filtered, [
              { key: 'priority', label: 'Prioridade' },
              { key: 'severity', label: 'Gravidade', format: (r) => severityMeta(r.severity).label },
              { key: 'module', label: 'Módulo' },
              { key: 'title', label: 'Ocorrência' },
              { key: 'subtitle', label: 'Detalhe' },
              { key: 'reference', label: 'Referência' },
              { key: 'responsible', label: 'Responsável' },
              { key: 'statusText', label: 'Status' },
              { key: 'since', label: 'Desde' },
            ], 'pendencias')}
            title="Exportar pendências"
          >
            Exportar CSV
          </button>
        ) : null}
      >
        <div className="pendencia-cards">
          {cards.map((card) => (
            <article key={card.key} className={`pendencia-card sev-stripe-${card.tone}`}>
              <span className="pendencia-card-value">{card.value}</span>
              <span className="pendencia-card-label">{card.label}</span>
            </article>
          ))}
        </div>
      </PanelSection>

      {fila.length > 0 ? (
        <PanelSection
          title="Fila recomendada para hoje"
          subtitle="Sequência sugerida para resolver o que mais impacta a operação primeiro"
          kicker="Fila inteligente"
        >
          <ol className="fila-list">
            {fila.map((group, index) => (
              <li key={group.key} className="fila-item">
                <span className="fila-index">{index + 1}</span>
                <span className="fila-label">{group.label}</span>
                <span className="fila-count">{group.count}</span>
              </li>
            ))}
          </ol>
        </PanelSection>
      ) : null}

      <PanelSection
        title={`Pendências (${filtered.length})`}
        subtitle="Ordenadas por prioridade, gravidade, pressão de SLA e tempo de espera"
        kicker="Operação"
      >
        <div className="filter-bar">
          <SelectFilter value={priority} onChange={setPriority} placeholder="Todas as prioridades" options={PRIORITY_OPTIONS} />
          <SelectFilter value={severity} onChange={setSeverity} placeholder="Todas as gravidades" options={SEVERITY_OPTIONS} />
          <SelectFilter value={moduleValue} onChange={setModuleValue} placeholder="Todos os módulos" options={moduleOptions} />
          <SelectFilter value={responsible} onChange={setResponsible} placeholder="Todos os responsáveis" options={responsibleOptions} />
          <div className="search-expand">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar pendência, NF, código, responsável" />
          </div>
        </div>

        <FilterChips
          chips={[
            priority && { key: 'prio', label: `Prioridade: ${PRIORITY_OPTIONS.find((o) => o.value === priority)?.label || priority}`, onRemove: () => setPriority('') },
            severity && { key: 'sev', label: `Gravidade: ${SEVERITY_OPTIONS.find((o) => o.value === severity)?.label || severity}`, onRemove: () => setSeverity('') },
            moduleValue && { key: 'mod', label: `Módulo: ${moduleValue}`, onRemove: () => setModuleValue('') },
            responsible && { key: 'resp', label: `Responsável: ${responsible}`, onRemove: () => setResponsible('') },
            search && { key: 'busca', label: `Busca: "${search}"`, onRemove: () => setSearch('') },
          ]}
          onClear={() => { setPriority(''); setSeverity(''); setModuleValue(''); setResponsible(''); setSearch(''); }}
        />

        <DataTable
          rows={filtered}
          pageSize={25}
          rowClassName={(row) => `sev-stripe-${severityMeta(row.severity).tone}`}
          columns={[
            {
              key: 'severity',
              label: 'Gravidade',
              render: (row) => <SeverityBadge severity={row.severity} />,
            },
            {
              key: 'priority',
              label: 'Prioridade',
              render: (row) => <PriorityBadge priority={row.priority} />,
            },
            {
              key: 'title',
              label: 'Ocorrência',
              render: (row) => (
                <div>
                  <strong className="pendencia-title">{row.title}</strong>
                  <div className="cell-subtext">{row.subtitle}</div>
                </div>
              ),
            },
            { key: 'module', label: 'Módulo' },
            {
              key: 'responsible',
              label: 'Responsável',
              render: (row) => row.responsible || <span className="pendencia-muted">— sem responsável</span>,
            },
            {
              key: 'status',
              label: 'Status / SLA',
              render: (row) => (
                <div className="pendencia-status">
                  <span>{row.statusText}</span>
                  {row.sla ? <SlaBadge sla={row.sla} compact /> : null}
                </div>
              ),
            },
            {
              key: 'since',
              label: 'Desde',
              render: (row) => formatRelativeMinutes(row.since),
            },
            {
              key: 'actions',
              label: 'Ações',
              render: (row) => (
                <button
                  type="button"
                  className="table-action-button"
                  onClick={() => onSelectView?.(row.viewKey)}
                  title={`Abrir ${row.module}`}
                >
                  Abrir
                </button>
              ),
            },
          ]}
          emptyMessage="Nenhuma pendência aberta. Operação em dia! ✅"
        />
      </PanelSection>
    </>
  );
};
