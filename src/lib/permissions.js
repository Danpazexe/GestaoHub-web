// Permissões granulares por ação (briefing §26). Define as ações controláveis,
// os papéis padrão e o mapa papel→permissões. Persistido em localStorage; serve
// como base de governança até existir enforcement no backend (RLS/políticas).

const STORAGE_KEY = 'gh-permissions-v1';

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

export const loadMatrix = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredCloneSafe(DEFAULT_MATRIX);
    const saved = JSON.parse(raw);
    const merged = structuredCloneSafe(DEFAULT_MATRIX);
    for (const role of Object.keys(merged)) {
      if (saved[role]) {
        for (const perm of ALL) {
          if (typeof saved[role][perm] === 'boolean') merged[role][perm] = saved[role][perm];
        }
      }
    }
    return merged;
  } catch {
    return structuredCloneSafe(DEFAULT_MATRIX);
  }
};

export const saveMatrix = (matrix) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matrix));
    return true;
  } catch {
    return false;
  }
};

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}
