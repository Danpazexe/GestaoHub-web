import { useEffect, useMemo, useState } from 'react';
import { buildPendencias } from '../../lib/pendencias';
import { formatRelativeMinutes } from '../../lib/format';
import { severityMeta } from '../../lib/severity';

const useClock = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
};

const Panel = ({ title, count, tone, children }) => (
  <section className={`tv-panel sev-stripe-${tone || 'info'}`}>
    <header className="tv-panel-head">
      <h2>{title}</h2>
      {typeof count === 'number' ? <span className={`tv-count sev-tone-${tone || 'info'}`}>{count}</span> : null}
    </header>
    <div className="tv-panel-body">{children}</div>
  </section>
);

// Modo TV / painel de monitoramento (briefing §16). Tela limpa, alto contraste,
// fonte grande e atualização automática (segue o polling/realtime do App).
export const TvView = ({ data = {}, lastRefresh, onExit }) => {
  const now = useClock();

  const online = (data.activeUsers || []).filter((u) => u.status === 'online');
  const emConferencia = [
    ...(data.conferenciaBonusQueue || []),
    ...(data.conferenciaSaidaBonusQueue || []),
  ].filter((r) => r.status === 'em_conferencia');

  const validadeCritica = (data.validade || [])
    .filter((r) => r.status !== 'treated' && r.status !== 'resolved' && Number(r.diasrestantes) <= 7)
    .sort((a, b) => Number(a.diasrestantes) - Number(b.diasrestantes));

  const notasPendentes = (data.purchaseOrders || [])
    .filter((r) => !['encerrado', 'auditado', 'cancelado'].includes(String(r.status || '')));

  const pendencias = useMemo(() => buildPendencias(data), [data]);
  const urgentes = pendencias.filter((p) => p.priority === 'alta').slice(0, 8);

  const ultimas = (data.events || []).slice(0, 8);

  const hh = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dd = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  return (
    <div className="tv-mode">
      <header className="tv-header">
        <div className="tv-brand">
          <div className="brand-mark" aria-hidden="true">GH</div>
          <div>
            <strong>GestãoHub — Operação ao vivo</strong>
            <span className="tv-sub">{dd}</span>
          </div>
        </div>
        <div className="tv-clock">
          <span className="tv-live"><span className="tv-live-dot" /> AO VIVO</span>
          <strong>{hh}</strong>
          <span className="tv-refresh">Dados: {lastRefresh || '-'}</span>
        </div>
        <button type="button" className="tv-exit" onClick={onExit} title="Sair do modo TV">✕ Sair</button>
      </header>

      <div className="tv-grid">
        <Panel title="Colaboradores online" count={online.length} tone="success">
          {online.length ? (
            <ul className="tv-list">
              {online.slice(0, 10).map((u) => (
                <li key={u.user_id}><span className="tv-dot sev-tone-success" />{u.name || u.email}<em>{u.current_module || '—'}</em></li>
              ))}
            </ul>
          ) : <div className="tv-empty">Ninguém online agora.</div>}
        </Panel>

        <Panel title="Conferências em andamento" count={emConferencia.length} tone="info">
          {emConferencia.length ? (
            <ul className="tv-list">
              {emConferencia.slice(0, 10).map((c) => (
                <li key={c.id}>{c.invoice_number || c.order_code || '—'}<em>{c.assigned_user_name || 'sem responsável'}</em></li>
              ))}
            </ul>
          ) : <div className="tv-empty">Nenhuma conferência em andamento.</div>}
        </Panel>

        <Panel title="Validades críticas (≤7 dias)" count={validadeCritica.length} tone="danger">
          {validadeCritica.length ? (
            <ul className="tv-list">
              {validadeCritica.slice(0, 10).map((v) => (
                <li key={v.id}>{v.descricao || v.codprod}<em className={Number(v.diasrestantes) < 0 ? 'tv-vencido' : ''}>{Number(v.diasrestantes) < 0 ? `vencido ${Math.abs(v.diasrestantes)}d` : `${v.diasrestantes}d`}</em></li>
              ))}
            </ul>
          ) : <div className="tv-empty">Sem validade crítica. ✅</div>}
        </Panel>

        <Panel title="Notas / pedidos pendentes" count={notasPendentes.length} tone="warning">
          {notasPendentes.length ? (
            <ul className="tv-list">
              {notasPendentes.slice(0, 10).map((o) => (
                <li key={o.id}>{o.order_number || o.invoice_number}<em>{o.supplier_name || '—'}</em></li>
              ))}
            </ul>
          ) : <div className="tv-empty">Sem pendências de recebimento.</div>}
        </Panel>

        <Panel title="Pendências urgentes" count={urgentes.length} tone="danger">
          {urgentes.length ? (
            <ul className="tv-list">
              {urgentes.map((p) => (
                <li key={p.id}><span className={`tv-dot sev-tone-${severityMeta(p.severity).tone}`} />{p.title}<em>{p.module}</em></li>
              ))}
            </ul>
          ) : <div className="tv-empty">Nenhuma pendência urgente. ✅</div>}
        </Panel>

        <Panel title="Últimas ocorrências" tone="info">
          {ultimas.length ? (
            <ul className="tv-list">
              {ultimas.map((e) => (
                <li key={e.id}>{e.module} · {e.event_type}<em>{formatRelativeMinutes(e.created_at)}</em></li>
              ))}
            </ul>
          ) : <div className="tv-empty">Sem ocorrências recentes.</div>}
        </Panel>
      </div>
    </div>
  );
};
