import { AppIcon } from './AppIcon';
import { Sparkline } from './Sparkline';

// Card de indicador com hierarquia: ícone tonal, rótulo, valor forte, tendência
// opcional (nó React) e sparkline opcional. `hero` deixa maior/mais destacado.
export const StatCard = ({ icon, label, value, tone = 'info', trend, series, hint, hero = false }) => (
  <article className={`stat-card${hero ? ' stat-card-hero' : ''}`}>
    <div className="stat-card-head">
      {icon ? <span className={`stat-card-icon sev-tone-${tone}`}><AppIcon name={icon} size={hero ? 18 : 15} /></span> : null}
      <span className="stat-card-label">{label}</span>
      {trend ? <span className="stat-card-trend">{trend}</span> : null}
    </div>
    <strong className="stat-card-value">{value}</strong>
    {series && series.length > 1 ? (
      <div className={`stat-card-spark sev-tone-${tone}`}><Sparkline data={series} /></div>
    ) : null}
    {hint ? <span className="stat-card-hint">{hint}</span> : null}
  </article>
);
