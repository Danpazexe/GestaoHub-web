import { useCallback, useEffect, useState } from 'react';
import { useRealtimeRefresh } from './useRealtimeRefresh';
import { adminApi } from '../services/adminApi';
import { formatDateTime } from '../lib/format';
import { logError } from '../lib/logger';

// Plano FREE do Supabase: o painel recarrega ~14 chamadas por ciclo, então
// espaçamos para 3 min. O botão "Atualizar" continua disponível sob demanda.
const REFRESH_INTERVAL_MS = 180000;

export const initialDataState = {
  loading: true,
  error: '',
  summary: null,
  activeUsers: [],
  assignableUsers: [],
  purchaseOrders: [],
  purchaseOrderActions: [],
  tratativas: [],
  validade: [],
  avarias: [],
  conferenciaRecebimentos: [],
  conferenciaSaidas: [],
  conferenciaBonusQueue: [],
  conferenciaSaidaBonusQueue: [],
  conferenciaDivergencias: [],
  events: [],
  lastRefresh: '',
};

// Tabelas operacionais observadas em tempo real (precisam estar na publication
// supabase_realtime no banco). Sem isso, o polling segue valendo.
const REALTIME_TABLES = [
  'user_presence',
  'conferencia_bonus_queue',
  'conferencia_saida_bonus_queue',
  'conferencia_divergencias',
  'recebimento_treatment_cases',
  'avaria_items',
  'validade_products',
  'operational_events',
  'purchase_orders',
];

// Encapsula o carregamento do painel: estado consolidado, polling, realtime e
// tratamento de erro. Retorna { dataState, loadDashboard }.
export const useDashboardData = (user, admin) => {
  const [dataState, setDataState] = useState(initialDataState);

  const loadDashboard = useCallback(async () => {
    if (!user || !admin) return;

    setDataState((current) => ({ ...current, loading: true, error: '' }));

    try {
      const [
        summary, activeUsers, assignableUsers, purchaseOrders, purchaseOrderActions,
        tratativas, validade, avarias, conferenciaRecebimentos, conferenciaSaidas,
        conferenciaBonusQueue, conferenciaSaidaBonusQueue, conferenciaDivergencias, events,
      ] = await Promise.all([
        adminApi.getDashboardSummary(),
        adminApi.getActiveUsers(),
        adminApi.getAssignableUsers(),
        adminApi.getPurchaseOrders(),
        adminApi.getPurchaseOrderActions(),
        adminApi.getTratativas(),
        adminApi.getValidade(),
        adminApi.getAvarias(),
        adminApi.getConferenciaRecebimentos(),
        adminApi.getConferenciaSaidas(),
        adminApi.getConferenciaBonusQueue(),
        adminApi.getConferenciaSaidaBonusQueue(),
        adminApi.getConferenciaDivergencias(),
        adminApi.getEvents(),
      ]);

      setDataState({
        loading: false,
        error: '',
        summary, activeUsers, assignableUsers, purchaseOrders, purchaseOrderActions,
        tratativas, validade, avarias, conferenciaRecebimentos, conferenciaSaidas,
        conferenciaBonusQueue, conferenciaSaidaBonusQueue, conferenciaDivergencias, events,
        lastRefresh: formatDateTime(new Date().toISOString()),
      });
    } catch (loadError) {
      logError('Falha ao carregar o painel', loadError?.message || String(loadError));
      setDataState((current) => ({
        ...current,
        loading: false,
        error: loadError?.message || 'Falha ao carregar o painel.',
      }));
    }
  }, [user, admin]);

  useEffect(() => {
    if (!user || !admin) {
      setDataState(initialDataState);
      return undefined;
    }
    loadDashboard();
    const timer = window.setInterval(loadDashboard, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [user, admin, loadDashboard]);

  // Realtime: mudanças nas tabelas operacionais disparam um refresh (debounced).
  useRealtimeRefresh(loadDashboard, { tables: REALTIME_TABLES, enabled: Boolean(user && admin) });

  return { dataState, loadDashboard };
};
