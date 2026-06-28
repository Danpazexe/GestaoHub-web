import { describe, it, expect } from 'vitest';
import { PERMISSIONS, ROLES, DEFAULT_MATRIX, defaultMatrix } from '../src/lib/permissions';

describe('catálogo de permissões (§26)', () => {
  it('tem as 11 ações controláveis do briefing', () => {
    expect(PERMISSIONS).toHaveLength(11);
    const keys = PERMISSIONS.map((p) => p.key);
    expect(keys).toContain('can_view_dashboard');
    expect(keys).toContain('can_manage_settings');
    expect(keys).toContain('can_export_reports');
  });

  it('tem os 4 papéis padrão', () => {
    expect(ROLES.map((r) => r.key)).toEqual(['admin', 'supervisor', 'operador', 'leitura']);
  });

  it('admin tem todas as permissões; leitura quase nenhuma', () => {
    const all = PERMISSIONS.map((p) => p.key);
    expect(all.every((k) => DEFAULT_MATRIX.admin[k] === true)).toBe(true);
    expect(DEFAULT_MATRIX.leitura.can_view_dashboard).toBe(true);
    expect(DEFAULT_MATRIX.leitura.can_delete_validade).toBe(false);
  });

  it('supervisor não gerencia configurações nem exclui validade', () => {
    expect(DEFAULT_MATRIX.supervisor.can_manage_settings).toBe(false);
    expect(DEFAULT_MATRIX.supervisor.can_delete_validade).toBe(false);
    expect(DEFAULT_MATRIX.supervisor.can_view_dashboard).toBe(true);
  });

  it('defaultMatrix() devolve um clone (não muta o original)', () => {
    const m = defaultMatrix();
    m.admin.can_view_dashboard = false;
    expect(DEFAULT_MATRIX.admin.can_view_dashboard).toBe(true);
  });
});
