import { PanelSection } from '../../components/PanelSection';
import { MetricCard } from '../../components/MetricCard';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { formatRelativeMinutes, formatDateTime } from '../../lib/format';

export const OverviewView = ({
  summaryCards,
  activeUsers,
  tratativas,
  avarias,
  validade,
  conferenciaRecebimentos,
  onSelectView,
}) => {
  const quickCards = [
    {
      label: 'Produtos ≤ 7 dias',
      value: (validade || []).filter((item) => Number(item.diasrestantes) <= 7).length,
      accent: 'linear-gradient(135deg, #bf3b2f 0%, #e2806f 100%)',
      note: 'Urgência crítica do módulo de validade.',
      target: 'validade',
    },
    {
      label: 'Avarias não resolvidas',
      value: (avarias || []).filter((item) => item.item_status === 'damaged').length,
      accent: 'linear-gradient(135deg, #a05a10 0%, #ffb319 100%)',
      note: 'Itens ainda pendentes de ação.',
      target: 'avarias',
    },
    {
      label: 'Conferências com divergência',
      value: (conferenciaRecebimentos || []).filter((item) => Number(item.divergences_count) > 0).length,
      accent: 'linear-gradient(135deg, #1d55c8 0%, #7da2ff 100%)',
      note: 'Recebimentos com divergência registrada.',
      target: 'recebimento',
    },
  ];

  return (
    <>
      <section className="metrics-grid metrics-grid-five" aria-label="Resumo operacional">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className="metrics-grid metrics-grid-three" aria-label="Alertas rápidos">
        {quickCards.map((card) => (
          <button
            key={card.label}
            type="button"
            className="metric-button-reset"
            onClick={() => onSelectView(card.target)}
            title={`Abrir ${card.label}`}
          >
            <MetricCard {...card} />
          </button>
        ))}
      </section>

      <div className="content-grid two-columns">
        <PanelSection
          title="Usuários online"
          subtitle="Heartbeat mais recente registrado pelo app"
          kicker="Presença"
          actions={(
            <button type="button" className="ghost-button" onClick={() => onSelectView('users')} title="Ver todos os usuários">
              Ver todos
            </button>
          )}
        >
          <DataTable
            rows={activeUsers.slice(0, 8)}
            rowClassName={(row) => {
              const diffMs = Date.now() - new Date(row.last_heartbeat_at).getTime();
              if (row.status === 'online') return 'row-online-soft';
              if (row.status === 'offline' && diffMs > 30 * 60 * 1000) return 'row-offline-soft';
              return '';
            }}
            columns={[
              {
                key: 'name',
                label: 'Usuário',
                render: (row) => (
                  <div>
                    <strong className="table-main-text">{row.name || '-'}</strong>
                    <div className="cell-subtext">{row.email || '-'}</div>
                  </div>
                ),
              },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge value={row.status} />,
              },
              {
                key: 'current_module',
                label: 'Módulo',
                render: (row) => row.current_module || '-',
              },
              {
                key: 'last_heartbeat_at',
                label: 'Último ping',
                render: (row) => formatRelativeMinutes(row.last_heartbeat_at),
              },
            ]}
            emptyMessage="Nenhum usuário online no momento."
          />
        </PanelSection>

        <PanelSection
          title="Tratativas recentes"
          subtitle="Ocorrências de recebimento mais atualizadas"
          kicker="Operação"
          actions={(
            <button type="button" className="ghost-button" onClick={() => onSelectView('tratativas')} title="Ver todas as tratativas">
              Ver todos
            </button>
          )}
        >
          <DataTable
            rows={tratativas.slice(0, 8)}
            columns={[
              { key: 'doc_number', label: 'Documento' },
              { key: 'supplier_code', label: 'Fornecedor' },
              {
                key: 'status',
                label: 'Status',
                render: (row) => <StatusBadge value={row.status} />,
              },
              {
                key: 'updated_at',
                label: 'Atualização',
                render: (row) => formatDateTime(row.updated_at),
              },
            ]}
            emptyMessage="Sem tratativas sincronizadas."
          />
        </PanelSection>
      </div>
    </>
  );
};
