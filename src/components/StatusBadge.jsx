const MAP = {
  online: 'is-online',
  idle: 'is-idle',
  offline: 'is-offline',
  signed_out: 'is-offline',
  ABERTA: 'is-warning',
  'EM ANDAMENTO': 'is-info',
  AGUARDANDO: 'is-muted',
  ENCERRADA: 'is-success',
  CANCELADA: 'is-offline',
  open: 'is-warning',
  concluded: 'is-success',
  damaged: 'is-danger',
  resolved: 'is-success',
  active: 'is-info',
  treated: 'is-warning',
  pendente: 'is-warning',
  resolvida: 'is-success',
  local_only: 'is-muted',
};

export const StatusBadge = ({ value, label }) => {
  const resolvedLabel = String(label || value || '-');
  const cls = MAP[String(value || '-')] || 'is-default';
  return <span className={`status-badge ${cls}`}>{resolvedLabel}</span>;
};
