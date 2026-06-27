export const navGroups = [
  {
    key: 'general',
    label: 'Geral',
    items: [
      { key: 'inicio', label: 'Início', shortLabel: 'IN', icon: 'overview' },
      { key: 'users', label: 'Usuários online', shortLabel: 'UO', icon: 'users' },
      { key: 'events', label: 'Auditoria', shortLabel: 'AU', icon: 'events' },
    ],
  },
  {
    key: 'operation',
    label: 'Operação',
    items: [
      { key: 'pendencias', label: 'Pendências', shortLabel: 'PE', icon: 'pendencias' },
      { key: 'recebimento', label: 'Recebimento', shortLabel: 'RC', icon: 'recebimento' },
      { key: 'conferencia', label: 'Conferências', shortLabel: 'CF', icon: 'conferencia' },
      { key: 'tratativas', label: 'Tratativas', shortLabel: 'TR', icon: 'tratativas' },
      { key: 'avarias', label: 'Avarias', shortLabel: 'AV', icon: 'avarias' },
      { key: 'validade', label: 'Validade', shortLabel: 'VA', icon: 'validade' },
    ],
  },
];

export const navItems = navGroups.flatMap((group) => group.items);
