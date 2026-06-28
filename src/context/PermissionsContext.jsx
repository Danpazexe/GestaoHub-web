import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { adminApi } from '../services/adminApi';

// Permissões reais (briefing §26). Resolve no servidor o mapa de permissões do
// usuário autenticado (via perfil + RLS, migrations/0010) e expõe `can(key)`
// para as views aplicarem o enforcement na UI.
//
// Degradação segura: se as tabelas de permissão ainda não existem (0010 não
// aplicada) ou o usuário é admin, `can()` libera tudo — assim o painel nunca
// trava durante a transição; o gating real passa a valer para perfis não-admin
// assim que o SQL for aplicado e os usuários receberem um perfil.

const PermissionsContext = createContext({
  can: () => true,
  perfil: null,
  isAdmin: true,
  loaded: false,
  refresh: () => {},
});

export const PermissionsProvider = ({ enabled = true, children }) => {
  const [state, setState] = useState({ permissoes: null, perfil: null, isAdmin: true, loaded: false });

  const refresh = useCallback(async () => {
    const res = await adminApi.resolveMyPermissions();
    if (res && res.permissoes) {
      setState({
        permissoes: res.permissoes,
        perfil: res.perfil || null,
        isAdmin: Boolean(res.is_admin),
        loaded: true,
      });
    } else {
      // 0010 ausente: não bloqueia (painel admin mantém acesso total).
      setState({ permissoes: null, perfil: null, isAdmin: true, loaded: true });
    }
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  const can = useCallback((key) => {
    if (state.isAdmin || !state.permissoes) return true;
    return Boolean(state.permissoes[key]);
  }, [state]);

  return (
    <PermissionsContext.Provider value={{ can, perfil: state.perfil, isAdmin: state.isAdmin, loaded: state.loaded, refresh }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => useContext(PermissionsContext);
