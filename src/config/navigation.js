export const navGroups = [
  {
    key: 'general',
    label: 'Geral',
    items: [
      { key: 'inicio', label: 'Início', shortLabel: 'IN', icon: 'overview' },
      { key: 'indicadores', label: 'Indicadores', shortLabel: 'ID', icon: 'dashboard' },
      { key: 'users', label: 'Colaboradores', shortLabel: 'CO', icon: 'users' },
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
      { key: 'fechamento', label: 'Fechamento diário', shortLabel: 'FD', icon: 'fechamento' },
    ],
  },
  {
    key: 'intelligence',
    label: 'Inteligência',
    items: [
      { key: 'relatorios', label: 'Relatórios', shortLabel: 'RL', icon: 'relatorios' },
      { key: 'fornecedores', label: 'Fornecedores', shortLabel: 'FO', icon: 'fornecedores' },
      { key: 'qualidade', label: 'Qualidade de cadastro', shortLabel: 'QC', icon: 'qualidade' },
      { key: 'ranking', label: 'Ranking de produtos', shortLabel: 'RK', icon: 'ranking' },
      { key: 'mapa', label: 'Mapa operacional', shortLabel: 'MP', icon: 'mapa' },
    ],
  },
  {
    key: 'system',
    label: 'Sistema',
    items: [
      { key: 'configuracoes', label: 'Configurações', shortLabel: 'CG', icon: 'config' },
      { key: 'admin', label: 'Administração', shortLabel: 'AD', icon: 'admin' },
      { key: 'logs', label: 'Logs técnicos', shortLabel: 'LG', icon: 'logs' },
    ],
  },
];

export const navItems = navGroups.flatMap((group) => group.items);
