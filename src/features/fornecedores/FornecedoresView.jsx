import { useMemo } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { exportCsv } from '../../lib/csv';
import { formatDateTime } from '../../lib/format';
import { buildSuppliers } from '../../lib/analytics';

// Módulo de fornecedores (briefing §22). Deriva fornecedores e indicadores dos
// pedidos de compra, divergências de recebimento e avarias já carregados.
export const FornecedoresView = ({ purchaseOrders = [], conferenciaDivergencias = [], avarias = [] }) => {
  const suppliers = useMemo(
    () => buildSuppliers({ purchaseOrders, conferenciaDivergencias, avarias }),
    [purchaseOrders, conferenciaDivergencias, avarias],
  );

  const topDivergencias = suppliers.filter((s) => s.divergences > 0).slice(0, 1)[0];
  const topDevolucoes = [...suppliers].sort((a, b) => b.returns - a.returns).filter((s) => s.returns > 0)[0];

  const cards = [
    { key: 'total', label: 'Fornecedores', value: suppliers.length, tone: 'info' },
    { key: 'div', label: 'Mais divergências', value: topDivergencias ? `${topDivergencias.name} (${topDivergencias.divergences})` : '—', tone: 'danger', text: true },
    { key: 'dev', label: 'Mais devoluções', value: topDevolucoes ? `${topDevolucoes.name} (${topDevolucoes.returns})` : '—', tone: 'warning', text: true },
  ];

  return (
    <PanelSection
      title="Fornecedores"
      subtitle="Histórico por fornecedor: notas recebidas, divergências, devoluções e avarias"
      kicker="Inteligência"
      actions={suppliers.length > 0 ? (
        <button
          type="button"
          className="ghost-button"
          onClick={() => exportCsv(suppliers, [
            { key: 'name', label: 'Fornecedor' },
            { key: 'document', label: 'CNPJ' },
            { key: 'orders', label: 'Notas/Pedidos' },
            { key: 'items', label: 'Itens' },
            { key: 'divergences', label: 'Divergências' },
            { key: 'returns', label: 'Devoluções' },
            { key: 'avarias', label: 'Avarias' },
            { key: 'lastInvoice', label: 'Última nota' },
            { key: 'lastInvoiceAt', label: 'Data', format: (r) => formatDateTime(r.lastInvoiceAt) },
          ], 'fornecedores')}
          title="Exportar fornecedores"
        >
          Exportar CSV
        </button>
      ) : null}
    >
      <div className="pendencia-cards pendencia-cards-3">
        {cards.map((card) => (
          <article key={card.key} className={`pendencia-card sev-stripe-${card.tone}`}>
            <span className={card.text ? 'pendencia-card-value-sm' : 'pendencia-card-value'}>{card.value}</span>
            <span className="pendencia-card-label">{card.label}</span>
          </article>
        ))}
      </div>

      <DataTable
        rows={suppliers}
        searchable
        sortable
        pageSize={20}
        rowClassName={(row) => (row.problems > 0 ? 'sev-stripe-warning' : '')}
        columns={[
          {
            key: 'name',
            label: 'Fornecedor',
            searchValue: (row) => `${row.name} ${row.document || ''}`,
            render: (row) => (
              <div>
                <strong className="table-main-text">{row.name}</strong>
                <div className="cell-subtext">{row.document || 'CNPJ não informado'}</div>
              </div>
            ),
          },
          { key: 'orders', label: 'Notas', sortValue: (r) => r.orders },
          { key: 'items', label: 'Itens', sortValue: (r) => r.items },
          { key: 'divergences', label: 'Divergências', sortValue: (r) => r.divergences, render: (r) => <span className={r.divergences > 0 ? 'days-warning' : ''}>{r.divergences}</span> },
          { key: 'returns', label: 'Devoluções', sortValue: (r) => r.returns, render: (r) => <span className={r.returns > 0 ? 'days-critical' : ''}>{r.returns}</span> },
          { key: 'avarias', label: 'Avarias', sortValue: (r) => r.avarias },
          { key: 'lastInvoice', label: 'Última nota', render: (r) => r.lastInvoice || '—' },
          { key: 'lastInvoiceAt', label: 'Em', render: (r) => formatDateTime(r.lastInvoiceAt) },
        ]}
        emptyMessage="Nenhum fornecedor identificado nos pedidos/recebimentos."
      />
    </PanelSection>
  );
};
