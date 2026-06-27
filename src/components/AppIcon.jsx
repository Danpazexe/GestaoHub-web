const icons = {
  monitor: (
    <path d="M3 12h3.5l2 6 3.5-13 2.5 9 1.5-4h5" />
  ),
  dashboard: (
    <>
      <path d="M5 19V9" />
      <path d="M12 19V5" />
      <path d="M19 19v-7" />
      <path d="M3 19h18" />
    </>
  ),
  overview: (
    <path d="M4 11 12 4l8 7v9H4zM9 20v-6h6v6" />
  ),
  users: (
    <>
      <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M15.5 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M4.5 19a4.5 4.5 0 0 1 9 0" />
      <path d="M13 19a3.5 3.5 0 0 1 7 0" />
    </>
  ),
  events: (
    <>
      <path d="M7 4v4M17 4v4M5 8h14M6 6h12a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1Z" />
      <path d="m9 13 2 2 4-4" />
    </>
  ),
  conferencia: (
    <>
      <path d="M5 7h14v10H5z" />
      <path d="M9 11h6M9 15h4" />
      <path d="M7 4h10" />
    </>
  ),
  recebimento: (
    <>
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </>
  ),
  tratativas: (
    <>
      <path d="M8 7h8" />
      <path d="M8 12h8" />
      <path d="M8 17h5" />
      <path d="M6 4h12a2 2 0 0 1 2 2v12l-4 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    </>
  ),
  avarias: (
    <>
      <path d="M12 4 4 8l8 4 8-4-8-4Z" />
      <path d="M4 12l8 4 8-4" />
      <path d="M4 16l8 4 8-4" />
    </>
  ),
  validade: (
    <>
      <path d="M8 4v6" />
      <path d="M16 4v6" />
      <path d="M6 10h12" />
      <path d="M7 20h10a2 2 0 0 0 2-2V8H5v10a2 2 0 0 0 2 2Z" />
      <path d="M10 14h4" />
    </>
  ),
  pendencias: (
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  fornecedores: (
    <>
      <path d="M3 9h18l-1.5 10.5a1 1 0 0 1-1 .5H5.5a1 1 0 0 1-1-.5L3 9Z" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
    </>
  ),
  qualidade: (
    <>
      <path d="M9 11l3 3 8-8" />
      <path d="M20 12a8 8 0 1 1-5-7.4" />
    </>
  ),
  ranking: (
    <>
      <path d="M7 20V10" />
      <path d="M12 20V4" />
      <path d="M17 20v-7" />
      <path d="M4 20h16" />
    </>
  ),
  tv: (
    <>
      <rect x="3" y="5" width="18" height="12" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
    </>
  ),
  admin: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>
  ),
  mapa: (
    <>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </>
  ),
  relatorios: (
    <>
      <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8M8 17h5" />
    </>
  ),
  notificacoes: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  fechamento: (
    <>
      <path d="M9 11l3 3 8-8" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </>
  ),
  config: (
    <>
      <path d="M4 6h10M18 6h2" />
      <path d="M4 12h2M10 12h10" />
      <path d="M4 18h14M20 18h0" />
      <circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="18" cy="18" r="2" />
    </>
  ),
};

export const AppIcon = ({ name, size = 18, className = '' }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {icons[name] || icons.overview}
  </svg>
);
