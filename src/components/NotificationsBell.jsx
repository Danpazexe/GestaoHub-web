import { useEffect, useMemo, useRef, useState } from 'react';
import { buildNotificacoes, loadReadIds, saveReadIds, countUnread } from '../lib/notificacoes';
import { formatRelativeMinutes } from '../lib/format';

// Sino de notificações internas no topbar (briefing §20). Deriva das pendências
// e eventos; lida/não-lida persiste por usuário no Supabase; clicar navega ao módulo.
export const NotificationsBell = ({ data, onNavigate }) => {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState(() => new Set());
  const containerRef = useRef(null);

  // Carrega os ids lidos do usuário (Supabase) ao montar.
  useEffect(() => {
    let alive = true;
    loadReadIds().then((set) => { if (alive) setReadIds(set); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const notificacoes = useMemo(() => buildNotificacoes(data || {}), [data]);
  const unread = countUnread(notificacoes, readIds);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  const persist = (set) => { setReadIds(new Set(set)); saveReadIds(set); };

  const markAllRead = () => {
    const next = new Set(readIds);
    notificacoes.forEach((n) => next.add(n.id));
    persist(next);
  };

  const handleClick = (n) => {
    const next = new Set(readIds);
    next.add(n.id);
    persist(next);
    onNavigate?.(n.viewKey);
    setOpen(false);
  };

  return (
    <div className="notif-bell" ref={containerRef}>
      <button
        type="button"
        className="ghost-button notif-bell-button"
        onClick={() => setOpen((o) => !o)}
        title="Notificações"
        aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ''}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 ? <span className="notif-badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>

      {open ? (
        <div className="notif-panel">
          <div className="notif-panel-head">
            <strong>Notificações</strong>
            {notificacoes.length > 0 ? (
              <button type="button" className="notif-mark" onClick={markAllRead}>Marcar todas como lidas</button>
            ) : null}
          </div>
          <div className="notif-list">
            {notificacoes.length === 0 ? (
              <div className="notif-empty">Nenhuma notificação. Tudo em dia! ✅</div>
            ) : (
              notificacoes.slice(0, 30).map((n) => (
                <button
                  type="button"
                  key={n.id}
                  className={`notif-item${readIds.has(n.id) ? ' is-read' : ''}`}
                  onClick={() => handleClick(n)}
                >
                  <span className={`sev-dot sev-tone-${n.tone}`} />
                  <span className="notif-item-body">
                    <span className="notif-item-title">{n.title}</span>
                    <span className="notif-item-desc">{n.description}</span>
                  </span>
                  <span className="notif-item-time">{formatRelativeMinutes(n.time)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
