import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { MetricCard } from '../../components/MetricCard';
import { PanelSection } from '../../components/PanelSection';
import { StatusBadge } from '../../components/StatusBadge';
import { AppIcon } from '../../components/AppIcon';
import { formatDateTime, formatRelativeMinutes } from '../../lib/format';

const chartColors = ['#1b6b52', '#1d55c8', '#a05a10', '#bf3b2f', '#607870'];

const formatShortDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
};

export const DashboardView = ({
  summaryCards,
  tratativas,
  avarias,
  activeUsers,
  events,
  validade,
  onSelectView,
}) => {
  const tratativasSeries = useMemo(() => {
    const grouped = new Map();

    (tratativas || []).forEach((row) => {
      const dateKey = formatShortDate(row.updated_at || row.created_at);
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, { date: dateKey, ABERTA: 0, 'EM ANDAMENTO': 0, ENCERRADA: 0 });
      }

      const bucket = grouped.get(dateKey);
      if (bucket[row.status] !== undefined) {
        bucket[row.status] += 1;
      }
    });

    return Array.from(grouped.values()).slice(-30);
  }, [tratativas]);

  const avariaByType = useMemo(() => {
    const grouped = new Map();
    (avarias || []).forEach((row) => {
      const key = row.damage_type || 'Sem tipo';
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    return Array.from(grouped.entries()).map(([name, value]) => ({ name, value }));
  }, [avarias]);

  const validadeBuckets = useMemo(() => {
    const buckets = [
      { name: 'Até 7 dias', value: 0, fill: '#bf3b2f' },
      { name: '8 a 15 dias', value: 0, fill: '#a05a10' },
      { name: '16 a 30 dias', value: 0, fill: '#ffb319' },
      { name: 'Mais de 30 dias', value: 0, fill: '#1b6b52' },
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
  }, [validade]);

  return (
    <>
      <section className="metrics-grid metrics-grid-five" aria-label="Indicadores do dashboard">
        {summaryCards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <div className="content-grid two-columns">
        <PanelSection title="Tratativas por status" subtitle="Últimos registros por dia" kicker="Dashboard">
          {tratativasSeries.length ? (
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={tratativasSeries}>
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="ABERTA" stroke="#a05a10" fill="#a05a10" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="EM ANDAMENTO" stroke="#1d55c8" fill="#1d55c8" fillOpacity={0.15} strokeWidth={2} />
                  <Area type="monotone" dataKey="ENCERRADA" stroke="#1b6b52" fill="#1b6b52" fillOpacity={0.15} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Sem tratativas suficientes para o gráfico.</div>
          )}
        </PanelSection>

        <PanelSection title="Avarias por tipo" subtitle="Distribuição dos danos registrados" kicker="Dashboard">
          {avariaByType.length ? (
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={avariaByType} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                    {avariaByType.map((entry, index) => (
                      <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state">Sem avarias para consolidar.</div>
          )}
        </PanelSection>

        <PanelSection title="Urgência de validade" subtitle="Faixas de vencimento na operação" kicker="Dashboard">
          {validadeBuckets.some((bucket) => bucket.value > 0) ? (
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={validadeBuckets} layout="vertical">
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={90} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 8, 8, 0]}>
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

        <PanelSection
          title="Usuários online"
          subtitle="Máximo de 8 operadores em atividade agora"
          kicker="Presença"
          actions={(
            <button type="button" className="ghost-button" onClick={() => onSelectView('users')} title="Ver todos os usuários">
              Ver todos
            </button>
          )}
        >
          <div className="user-card-grid">
            {(activeUsers || []).slice(0, 8).map((user) => (
              <article className="user-card-compact" key={user.session_id}>
                <div className="profile-avatar" aria-hidden="true">
                  {(user.name || user.email || 'AD').slice(0, 2).toUpperCase()}
                </div>
                <div className="user-card-copy">
                  <strong>{user.name || '-'}</strong>
                  <span>{user.current_module || 'Sem módulo'} · {formatRelativeMinutes(user.last_heartbeat_at)}</span>
                </div>
                <StatusBadge value={user.status} />
              </article>
            ))}
            {!activeUsers?.length ? <div className="empty-state">Nenhum usuário online agora.</div> : null}
          </div>
        </PanelSection>
      </div>

      <PanelSection
        title="Eventos recentes"
        subtitle="Últimos 10 eventos operacionais"
        kicker="Auditoria"
        actions={(
          <button type="button" className="ghost-button" onClick={() => onSelectView('events')} title="Ver todos os eventos">
            Ver todos os eventos
          </button>
        )}
      >
        <div className="timeline-list">
          {(events || []).slice(0, 10).map((event) => (
            <div className="timeline-item" key={event.id}>
              <AppIcon name={event.module === 'conferencia' ? 'conferencia' : 'events'} size={16} className="timeline-icon" />
              <div className="timeline-copy">
                <strong>{event.module} · {event.event_type}</strong>
                <span>{event.actor_name || 'Sistema'} · {formatDateTime(event.created_at)}</span>
              </div>
            </div>
          ))}
          {!events?.length ? <div className="empty-state">Nenhum evento recente registrado.</div> : null}
        </div>
      </PanelSection>
    </>
  );
};
