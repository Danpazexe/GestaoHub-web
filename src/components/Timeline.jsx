import { formatDateTime, formatRelativeMinutes } from '../lib/format';

// Linha do tempo operacional (briefing §9). Recebe itens normalizados:
// { id, time, title, description, actor, tone }.
export const Timeline = ({ items = [], emptyMessage = 'Sem eventos registrados.' }) => {
  if (!items.length) {
    return <div className="empty-state" role="status">{emptyMessage}</div>;
  }

  return (
    <ol className="timeline">
      {items.map((item) => (
        <li className="timeline-item" key={item.id || `${item.time}-${item.title}`}>
          <span className={`timeline-dot sev-tone-${item.tone || 'info'}`} aria-hidden="true" />
          <div className="timeline-content">
            <div className="timeline-head">
              <strong className="timeline-title">{item.title}</strong>
              <span className="timeline-time" title={formatDateTime(item.time)}>
                {formatRelativeMinutes(item.time)}
              </span>
            </div>
            {item.description ? <div className="timeline-desc">{item.description}</div> : null}
            <div className="timeline-meta">
              {item.actor ? <span>{item.actor}</span> : null}
              <span className="timeline-abs">{formatDateTime(item.time)}</span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
};
