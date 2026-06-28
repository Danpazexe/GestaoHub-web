// Permissões granulares por ação (briefing §26). Define as ações controláveis,
// os papéis padrão e o mapa papel→permissões. A matriz REAL vive no Supabase
// (perfis_acesso/permissoes_acoes/perfis_permissoes, migrations/0010) e é
// resolvida no servidor (RLS + RPC). Este módulo guarda apenas o catálogo e a
// matriz padrão usada como fallback quando o banco ainda não foi migrado.

import { structuredCloneSafe } from './clone';

export const PERMISSIONS = [
  { key: 'can_view_dashboard', label: 'Ver dashboards' },
  { key: 'can_manage_users', label: 'Gerenciar usuários' },
  { key: 'can_reset_password', label: 'Resetar senha' },
  { key: 'can_assign_tasks', label: 'Atribuir tarefas' },
  { key: 'can_edit_validade', label: 'Editar validade' },
  { key: 'can_delete_validade', label: 'Excluir validade' },
  { key: 'can_correct_entrada', label: 'Corrigir entrada' },
  { key: 'can_export_reports', label: 'Exportar relatórios' },
  { key: 'can_view_audit', label: 'Ver auditoria' },
  { key: 'can_approve_workflows', label: 'Aprovar fluxos' },
  { key: 'can_manage_settings', label: 'Gerenciar configurações' },
];

export const ROLES = [
  { key: 'admin', label: 'Administrador' },
  { key: 'supervisor', label: 'Supervisor' },
  { key: 'operador', label: 'Operador' },
  { key: 'leitura', label: 'Somente leitura' },
];

const ALL = PERMISSIONS.map((p) => p.key);

// Matriz padrão papel → permissões.
export const DEFAULT_MATRIX = {
  admin: Object.fromEntries(ALL.map((k) => [k, true])),
  supervisor: Object.fromEntries(ALL.map((k) => [k, ![
    'can_manage_settings', 'can_delete_validade',
  ].includes(k)])),
  operador: Object.fromEntries(ALL.map((k) => [k, [
    'can_view_dashboard', 'can_assign_tasks', 'can_edit_validade', 'can_correct_entrada',
  ].includes(k)])),
  leitura: Object.fromEntries(ALL.map((k) => [k, [
    'can_view_dashboard', 'can_view_audit',
  ].includes(k)])),
};

// Fallback local (clone da matriz padrão) usado quando o banco ainda não tem as
// tabelas de permissão (0010). A fonte de verdade é adminApi.getPermissionsMatrix().
export const defaultMatrix = () => structuredCloneSafe(DEFAULT_MATRIX);
