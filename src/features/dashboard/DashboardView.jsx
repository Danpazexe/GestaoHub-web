import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime } from '../../lib/format';
import { useChartTheme } from '../../lib/chartTheme';

const formatShortDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
};

// Segmento "Análise" da tela Início: tendência (tratativas) + risco (validade)
// + tabela histórica. KPIs e timeline ao vivo ficam no segmento "Tempo real".
export const DashboardView = ({ tratativas = [], validade = [], onSelectView }) => {
  const theme = useChartTheme();

  const tratativasSeries = useMemo(() => {
    const grouped = new Map();
    (tratativas || []).forEach((row) => {
      const dateKey = formatShortDate(row.updated_at || row.created_at);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, { date: dateKey, ABERTA: 0, 'EM ANDAMENTO': 0, ENCERRADA: 0 });
      }
      const bucket = grouped.get(dateKey);
      if (bucket[row.status] !== undefined) bucket[row.status] += 1;
    });
    return Array.from(grouped.values()).slice(-30);
  }, [tratativas]);

  const validadeBuckets = useMemo(() => {
    const buckets = [
      { name: 'Até 7 dias', value: 0, fill: theme.danger },
      { name: '8 a 15 dias', value: 0, fill: theme.warning },
      { name: '16 a 30 dias', value: 0, fill: theme.accent },
      { name: 'Mais de 30 dias', value: 0, fill: theme.success },
    ];
    (validade || []).forEach((row) => {
      if (row.status === 'resolved' || row.status === 'treated') return;
      const days = Number(row.diasrestantes);
      if (days <= 7) buckets[0].value += 1;
      else if (days <= 15) buckets[1].value += 1;
      else if (days <= 30) buckets[2].value += 1;
      else buckets[3].value += 1;
    });
    return buckets;
  }, [validade, theme]);

  const recentTratativas = useMemo(() => (tratativas || []).slice(0, 8), [tratativas]);

  const tooltipStyle = {
    background: theme.surface,
    border: `1px solid ${theme.line}`,
    borderRadius: 8,
    boxShadow: '0 10px 28px rgba(30,41,59,0.12)',
    fontSize: 12,
    color: theme.ink,
  };
  const axisTick = { fontSize: 11, fill: theme.muted };

  return (
    <>
      <div className="content-grid two-columns">
        <PanelSection
          title="Tratativas por status"
          subtitle="Distribuição diária — últimos 30 registros"
          kicker="Análise"
        >
          {tratativasSeries.length ? (
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={tratativasSeries} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid horizontal vertical={false} stroke={theme.line} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tick={axisTick} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} width={28} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: theme.line }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: theme.muted }} />
                  <Area type="monotone" dataKey="ABERTA" stroke={theme.warning} fill={theme.warning} fillOpacity={0.14} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  <Area type="monotone" dataKey="EM ANDAMENTO" stroke={theme.info} fill={theme.info} fillOpacity={0.14} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  <Area type="monotone" dataKey="ENCERRADA" stroke={theme.success} fill={theme.success} fillOpacity={0.14} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Sem tratativas suficientes para o gráfico.</div>
          )}
        </PanelSection>

        <PanelSection
          title="Urgência de validade"
          subtitle="Faixas de vencimento na operação"
          kicker="Análise"
        >
          {validadeBuckets.some((bucket) => bucket.value > 0) ? (
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={validadeBuckets} layout="vertical" margin={{ top: 8, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} vertical stroke={theme.line} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={axisTick} />
                  <YAxis type="category" dataKey="name" width={92} tickLine={false} axisLine={false} tick={axisTick} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: theme.line }} />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={26}>
                    {validadeBuckets.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Sem itens de validade para distribuir.</div>
          )}
        </PanelSection>
      </div>

      <PanelSection
        title="Tratativas recentes"
        subtitle="Ocorrências de recebimento mais atualizadas"
        kicker="Operação"
        actions={(
          <button type="button" className="ghost-button" onClick={() => onSelectView?.('tratativas')} title="Ver todas as tratativas">
            Ver todas
          </button>
        )}
      >
        <DataTable
          rows={recentTratativas}
          columns={[
            { key: 'doc_number', label: 'Documento' },
            { key: 'supplier_code', label: 'Fornecedor', render: (row) => row.supplier_code || '-' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            { key: 'updated_at', label: 'Atualização', render: (row) => formatDateTime(row.updated_at) },
          ]}
          emptyMessage="Sem tratativas sincronizadas."
        />
      </PanelSection>
    </>
  );
};
