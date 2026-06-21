import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../services/adminApi';
import { isSupabaseReady, supabase } from '../lib/supabase';

// Traduz erros crus do supabase-js em mensagens acionáveis.
// O modo de falha mais comum hoje é o backend inacessível (URL/projeto inexistente),
// que o supabase-js lança como "Failed to fetch" — pouco diagnosticável para o usuário.
const describeAuthError = (error) => {
  const raw = String(error?.message || '');
  const isNetwork =
    error?.name === 'TypeError' ||
    /failed to fetch|fetch failed|network|resolve host|ENOTFOUND|ECONNREFUSED|NXDOMAIN/i.test(raw);

  if (isNetwork) {
    return 'Não foi possível conectar ao backend. Verifique VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env, e confirme que o projeto Supabase existe e está ativo.';
  }

  return raw || 'Falha ao validar sessão admin.';
};

export const useAdminSession = () => {
  const [state, setState] = useState({
    loading: true,
    user: null,
    profile: null,
    admin: null,
    error: '',
  });

  const resolveSession = useCallback(async () => {
    if (!isSupabaseReady) {
      setState({
        loading: false,
        user: null,
        profile: null,
        admin: null,
        error: 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para acessar o painel.',
      });
      return;
    }

    try {
      const session = await adminApi.getCurrentSession();
      if (!session?.user) {
        setState({
          loading: false,
          user: null,
          profile: null,
          admin: null,
          error: '',
        });
        return;
      }

      const [admin, profile] = await Promise.all([
        adminApi.assertAdmin(session.user.id),
        adminApi.getProfile(session.user.id),
      ]);

      if (!admin) {
        setState({
          loading: false,
          user: null,
          profile: null,
          admin: null,
          error: 'Seu usuário autenticado não está cadastrado em admin_users.',
        });
        return;
      }

      setState({
        loading: false,
        user: session.user,
        profile,
        admin,
        error: '',
      });
    } catch (error) {
      setState({
        loading: false,
        user: null,
        profile: null,
        admin: null,
        error: describeAuthError(error),
      });
    }
  }, []);

  useEffect(() => {
    resolveSession();

    if (!supabase) {
      return undefined;
    }

    const { data } = supabase.auth.onAuthStateChange(() => {
      resolveSession();
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, [resolveSession]);

  return {
    ...state,
    reload: resolveSession,
  };
};
