import { useMemo } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { StatusBadge } from '../../components/StatusBadge';
import { AppIcon } from '../../components/AppIcon';
import { formatRelativeMinutes, formatDateTime } from '../../lib/format';

const num = (v) => Number(v) || 0;
const TONE = { ok: 'is-ok', info: 'is-info', warn: 'is-warn', danger: 'is-danger' };

const moduleIcon = (mod) => {
  if (mod === 'conferencia') return 'conferencia';
  if (mod === 'avaria' || mod === 'avarias') return 'avarias';
  if (mod === 'validade') return 'validade';
  if (mod === 'recebimento') return 'recebimento';
  return 'events';
};

export const MonitorView = ({
  summary = {},
  activeUsers = [],
  conferenciaBonusQueue = [],
  conferenciaSaidaBonusQueue = [],
  conferenciaDivergencias = [],
  validade = [],
  events = [],
  lastRefresh,
  onSelectView,
}) => {
  const queues = useMemo(
    () => [...(conferenciaBonusQueue || []), ...(conferenciaSaidaBonusQueue || [])],
    [conferenciaBonusQueue, conferenciaSaidaBonusQueue],
  );
  const inConference = queues.filter((q) => q.status === 'em_conferencia').length;
  const queuesOpen = queues.filter((q) => q.status === 'nao_iniciado' || q.status === 'em_conferencia').length;

  const divergPending = useMemo(
    () => (conferenciaDivergencias || []).filter((d) => (d.status || 'pendente') !== 'resolvida').length,
    [conferenciaDivergencias],
  );
  const validadeUrgent = useMemo(
    () => (validade || []).filter((v) => v.status !== 'treated' && v.status !== 'resolved' && Number(v.diasrestantes) <= 7).length,
    [validade],
  );

  const onlineCount = (activeUsers || []).length;
  // summary pode chegar null (dados ainda não carregados) — o default param só
  // cobre undefined, então usamos optional chaining para não quebrar no 1º render.
  const tratativasOpen = num(summary?.open_tratativas);
  const avariasOpen = num(summary?.open_avaria_items);

  const tiles = [
    { label: 'Operadores online', value: onlineCount, tone: onlineCount > 0 ? 'ok' : 'info', icon: 'users', to: 'users' },
    { label: 'Filas abertas', value: queuesOpen, tone: queuesOpen > 0 ? 'info' : 'ok', icon: 'conferencia', to: 'conferencia', sub: `${inConference} em conferência` },
    { label: 'Tratativas abertas', value: tratativasOpen, tone: tratativasOpen > 0 ? 'warn' : 'ok', icon: 'tratativas', to: 'tratativas' },
    { label: 'Divergências', value: divergPending, tone: divergPending > 0 ? 'danger' : 'ok', icon: 'conferencia', to: 'conferencia' },
    { label: 'Validade ≤ 7 dias', value: validadeUrgent, tone: validadeUrgent > 0 ? 'danger' : 'ok', icon: 'validade', to: 'validade' },
    { label: 'Avarias abertas', value: avariasOpen, tone: avariasOpen > 0 ? 'warn' : 'ok', icon: 'avarias', to: 'avarias' },
  ];

  const alerts = [
    { tone: 'danger', icon: 'conferencia', label: 'Divergências pendentes', value: divergPending, hint: 'Itens conferidos fora do esperado', to: 'conferencia' },
    { tone: 'danger', icon: 'validade', label: 'Validade vencendo (≤ 7 dias)', value: validadeUrgent, hint: 'Produtos exigem tratativa', to: 'validade' },
    { tone: 'warn', icon: 'tratativas', label: 'Tratativas em aberto', value: tratativasOpen, hint: 'Espelhos de recebimento sem conclusão', to: 'tratativas' },
    { tone: 'warn', icon: 'avarias', label: 'Avarias pendentes', value: avariasOpen, hint: 'Itens com status danificado', to: 'avarias' },
    { tone: 'info', icon: 'conferencia', label: 'Bônus em conferência', value: inConference, hint: 'Tarefas em andamento na operação', to: 'conferencia' },
  ].filter((a) => a.value > 0);

  const idleCount = (activeUsers || []).filter((u) => u.status === 'idle').length;

  const inProgress = useMemo(() => {
    const mapKind = (rows, kind) => (rows || [])
      .filter((q) => q.status === 'em_conferencia')
      .map((q) => {
        const total = num(q.total_quantity);
        const checked = num(q.checked_quantity);
        const pct = total > 0 ? Math.min(100, Math.round((checked / total) * 100)) : 0;
        const startedAt = q.started_at ? new Date(q.started_at).getTime() : null;
        const mins = startedAt ? Math.max(0, Math.round((Date.now() - startedAt) / 60000)) : null;
        return {
          key: `${kind}-${q.id}`,
          name: kind === 'saida' ? (q.order_code || 'Pedido') : (q.invoice_number || 'NF'),
          sub: kind === 'saida' ? (q.customer_name || 'Saída') : (q.supplier_name || 'Recebimento'),
          operator: q.assigned_user_name || 'sem operador',
          pct,
          mins,
          stalled: mins != null && mins >= 30 && pct < 100,
        };
      });
    return [...mapKind(conferenciaBonusQueue, 'entrada'), ...mapKind(conferenciaSaidaBonusQueue, 'saida')]
      .sort((a, b) => (Number(b.stalled) - Number(a.stalled)) || ((b.mins || 0) - (a.mins || 0)));
  }, [conferenciaBonusQueue, conferenciaSaidaBonusQueue]);

  return (
    <>
      <section className="monitor-tiles" aria-label="Indicadores de monitoramento">
        {tiles.map((t) => (
          <button
            type="button"
            key={t.label}
            className={`monitor-tile ${TONE[t.tone]}`}
            onClick={() => onSelectView?.(t.to)}
            title={`Abrir ${t.label}`}
          >
            <span className="monitor-tile-icon"><AppIcon name={t.icon} size={18} /></span>
            <strong className="monitor-tile-value">{t.value}</strong>
            <span className="monitor-tile-label">{t.label}</span>
            {t.sub ? <span className="monitor-tile-sub">{t.sub}</span> : null}
          </button>
        ))}
      </section>

      <div className="content-grid two-columns">
        <PanelSection
          title="Operadores ao vivo"
          subtitle={`${onlineCount} em atividade${idleCount ? ` · ${idleCount} ocioso${idleCount > 1 ? 's' : ''}` : ''} · atualizado ${lastRefresh || '-'}`}
          kicker="Presença"
          actions={<button type="button" className="ghost-button" onClick={() => onSelectView?.('users')}>Ver todos</button>}
        >
          <div className="user-card-grid">
            {(activeUsers || []).slice(0, 10).map((u) => (
              <article className="user-card-compact" key={u.session_id}>
                <div className="profile-avatar" aria-hidden="true">{(u.name || u.email || 'AD').slice(0, 2).toUpperCase()}</div>
                <div className="user-card-copy">
                  <strong>{u.name || u.email || '-'}</strong>
                  <span>{u.current_module || 'sem módulo'}{u.current_screen ? ` · ${u.current_screen}` : ''} · {formatRelativeMinutes(u.last_heartbeat_at)}</span>
                </div>
                <StatusBadge value={u.status} />
              </article>
            ))}
            {!(activeUsers || []).length ? <div className="empty-state">Nenhum operador online agora.</div> : null}
          </div>
        </PanelSection>

        <PanelSection title="Precisa de atenção" subtitle="Pendências priorizadas da operação" kicker="Alertas">
          {alerts.length ? (
            <div className="monitor-alerts">
              {alerts.map((a) => (
                <button
                  type="button"
                  key={a.label}
                  className={`monitor-alert ${TONE[a.tone]}`}
                  onClick={() => onSelectView?.(a.to)}
                  title={`Abrir ${a.label}`}
                >
                  <span className="monitor-alert-icon"><AppIcon name={a.icon} size={16} /></span>
                  <span className="monitor-alert-copy">
                    <strong>{a.label}</strong>
                    <span>{a.hint}</span>
                  </span>
                  <span className="monitor-alert-count">{a.value}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">Tudo em dia — nenhuma pendência crítica. ✓</div>
          )}
        </PanelSection>
      </div>

      {inProgress.length ? (
        <PanelSection title="Filas em andamento" subtitle="Bônus sendo conferidos agora — progresso e tempo" kicker="Conferência">
          <div className="monitor-queues">
            {inProgress.map((q) => (
              <div className={`monitor-queue ${q.stalled ? 'is-stalled' : ''}`} key={q.key}>
                <div className="monitor-queue-head">
                  <strong>{q.name}</strong>
                  <span className="monitor-queue-meta">
                    {q.sub} · {q.operator}{q.mins != null ? ` · há ${q.mins} min` : ''}
                    {q.stalled ? <span className="monitor-queue-stalled">parada</span> : null}
                  </span>
                </div>
                <div className="monitor-prog">
                  <div className="monitor-prog-track"><div className="monitor-prog-fill" style={{ width: `${q.pct}%` }} /></div>
                  <span className="monitor-prog-label">{q.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </PanelSection>
      ) : null}

      <PanelSection
        title="Atividade recente"
        subtitle="Últimos eventos operacionais"
        kicker="Auditoria"
        actions={<button type="button" className="ghost-button" onClick={() => onSelectView?.('events')}>Ver auditoria</button>}
      >
        <div className="timeline-list">
          {(events || []).slice(0, 12).map((e) => (
            <div className="timeline-item" key={e.id}>
              <AppIcon name={moduleIcon(e.module)} size={16} className="timeline-icon" />
              <div className="timeline-copy">
                <strong>{e.module} · {e.event_type}</strong>
                <span>{e.actor_name || 'Sistema'} · {formatDateTime(e.created_at)}</span>
              </div>
            </div>
          ))}
          {!(events || []).length ? <div className="empty-state">Nenhum evento recente.</div> : null}
        </div>
      </PanelSection>
    </>
  );
};
