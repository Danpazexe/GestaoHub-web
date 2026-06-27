import { useMemo } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { exportCsv } from '../../lib/csv';
import { formatDateTime, truncate } from '../../lib/format';
import { buildProductRanking } from '../../lib/analytics';

// Ranking de produtos problemáticos (briefing §23). Soma ocorrências por
// produto (vencimentos, avarias, divergências, tratativas) para apoiar decisões
// de compra, estoque e prevenção.
export const RankingView = ({ validade = [], avarias = [], conferenciaDivergencias = [], tratativas = [] }) => {
  const ranking = useMemo(
    () => buildProductRanking({ validade, avarias, conferenciaDivergencias, tratativas }),
    [validade, avarias, conferenciaDivergencias, tratativas],
  );

  const topN = ranking.slice(0, 50);

  return (
    <PanelSection
      title="Ranking de produtos problemáticos"
      subtitle="Produtos com mais ocorrências — apoio à decisão de compra, estoque e prevenção"
      kicker="Inteligência"
      actions={ranking.length > 0 ? (
        <button
          type="button"
          className="ghost-button"
          onClick={() => exportCsv(ranking, [
            { key: 'code', label: 'Código' },
            { key: 'description', label: 'Descrição' },
            { key: 'vencimentos', label: 'Vencimentos' },
            { key: 'avarias', label: 'Avarias' },
            { key: 'divergencias', label: 'Divergências' },
            { key: 'tratativas', label: 'Tratativas' },
            { key: 'total', label: 'Total' },
            { key: 'lastAt', label: 'Última ocorrência', format: (r) => formatDateTime(r.lastAt) },
          ], 'ranking-produtos')}
          title="Exportar ranking"
        >
          Exportar CSV
        </button>
      ) : null}
    >
      <DataTable
        rows={topN}
        searchable
        sortable
        pageSize={25}
        rowClassName={(row) => (row.total >= 3 ? 'sev-stripe-danger' : row.total === 2 ? 'sev-stripe-warning' : '')}
        columns={[
          {
            key: 'rank',
            label: '#',
            render: (row) => <span className="rank-pos">{topN.indexOf(row) + 1}</span>,
          },
          {
            key: 'description',
            label: 'Produto',
            searchValue: (row) => `${row.code} ${row.description}`,
            render: (row) => (
              <div>
                <strong className="table-main-text">{truncate(row.description, 46)}</strong>
                <div className="cell-subtext">Cód. {row.code}</div>
              </div>
            ),
          },
          { key: 'vencimentos', label: 'Venc.', sortValue: (r) => r.vencimentos },
          { key: 'avarias', label: 'Avarias', sortValue: (r) => r.avarias },
          { key: 'divergencias', label: 'Diverg.', sortValue: (r) => r.divergencias },
          { key: 'tratativas', label: 'Tratativas', sortValue: (r) => r.tratativas },
          {
            key: 'total',
            label: 'Total',
            sortValue: (r) => r.total,
            render: (row) => <strong className="rank-total">{row.total}</strong>,
          },
          { key: 'lastAt', label: 'Última', render: (row) => formatDateTime(row.lastAt) },
        ]}
        emptyMessage="Nenhuma ocorrência registrada para ranquear."
      />
    </PanelSection>
  );
};
