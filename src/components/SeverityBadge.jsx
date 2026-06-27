import { severityMeta, priorityMeta } from '../lib/severity';
import { slaStatusMeta } from '../lib/sla';

// Chip de gravidade padronizado (briefing §15). Reaproveita o visual de
// .status-badge e aplica o tom da gravidade (.sev-tone-*).
export const SeverityBadge = ({ severity, label }) => {
  const meta = severityMeta(severity);
  return (
    <span className={`status-badge sev-tone-${meta.tone}`}>{label || meta.label}</span>
  );
};

// Chip de prioridade operacional (alta/média/baixa) — mapeia para a gravidade.
export const PriorityBadge = ({ priority }) => {
  const meta = priorityMeta(priority);
  const tone = priority === 'alta' ? 'danger' : priority === 'media' ? 'warning' : 'monitor';
  return <span className={`status-badge sev-tone-${tone}`}>Prioridade {meta.label}</span>;
};

// Chip de status de SLA (dentro/próximo/atrasado/crítico).
export const SlaBadge = ({ sla, compact = false }) => {
  if (!sla) return null;
  const meta = slaStatusMeta(sla.status);
  return (
    <span className={`status-badge sev-tone-${meta.tone}`} title={`${sla.ruleLabel} — ${sla.text}`}>
      {compact ? meta.label : `${meta.label} · ${sla.text}`}
    </span>
  );
};
