import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Assina mudanças (INSERT/UPDATE/DELETE) nas tabelas operacionais e dispara um
 * refresh (com debounce, coalescendo rajadas). O painel fica "ao vivo" sem
 * esperar o polling.
 *
 * Degrada em silêncio: se uma tabela NÃO estiver na publication supabase_realtime,
 * simplesmente não chegam eventos dela — o polling continua valendo.
 */
export const useRealtimeRefresh = (onChange, { tables = [], enabled = true, debounceMs = 1500 } = {}) => {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const tablesKey = tables.join(',');

  useEffect(() => {
    if (!enabled || !supabase || tables.length === 0) return undefined;

    let timer = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { onChangeRef.current?.(); }, debounceMs);
    };

    const channel = supabase.channel('admin-monitor-realtime');
    tables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, trigger);
    });
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debounceMs, tablesKey]);
};
