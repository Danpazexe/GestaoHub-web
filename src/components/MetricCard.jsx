import { formatNumber } from '../lib/format';

export const MetricCard = ({ label, value, accent, note }) => (
  <article className="metric-card" style={accent ? { '--metric-accent': accent } : undefined}>
    <div className="metric-head">
      <span className="metric-label">{label}</span>
      <span className="metric-dot" aria-hidden="true" />
    </div>
    <strong className="metric-value">{formatNumber(value)}</strong>
    {note ? <span className="metric-note">{note}</span> : null}
  </article>
);
