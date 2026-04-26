import { formatNumber } from '../lib/format';

export const MetricCard = ({ label, value, accent, note }) => (
  <article className="metric-card">
    <div className="metric-accent" style={{ background: accent }} aria-hidden="true" />
    <div className="metric-body">
      <div className="metric-kicker-row">
        <span className="metric-label">{label}</span>
        <span className="metric-dot" style={{ background: accent }} aria-hidden="true" />
      </div>
      <strong className="metric-value">{formatNumber(value)}</strong>
      <span className="metric-note">{note}</span>
    </div>
  </article>
);
