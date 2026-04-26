import { useCallback, useEffect, useState } from 'react';
import { adminApi } from '../services/adminApi';
import { isSupabaseReady, supabase } from '../lib/supabase';

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
        error: error?.message || 'Falha ao validar sessão admin.',
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
