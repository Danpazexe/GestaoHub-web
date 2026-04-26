export const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const formatRelativeMinutes = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes <= 0) return 'agora';
  if (diffMinutes === 1) return '1 min atrás';
  if (diffMinutes < 60) return `${diffMinutes} min atrás`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return '1 h atrás';
  if (diffHours < 24) return `${diffHours} h atrás`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '1 dia atrás';
  return `${diffDays} dias atrás`;
};

export const formatNumber = (value) => {
  const number = Number(value || 0);
  return new Intl.NumberFormat('pt-BR').format(number);
};

export const truncate = (value, max = 40) => {
  const text = String(value || '').trim();
  if (!text) return '-';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
