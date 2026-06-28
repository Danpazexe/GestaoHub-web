// Metas operacionais (briefing §14). Persistidas no Supabase
// (sistema_configuracoes/chave 'metas'), não mais em localStorage. Cache em
// memória + fetch async; o progresso é calculado dos dados em tempo real.

import { adminApi } from '../services/adminApi';

const SETTING_KEY = 'metas';

// Alvos padrão. `type`: 'zerar' (alvo = baixar até o alvo) ou 'percentual'.
export const DEFAULT_METAS = {
  validade_vencidos: { label: 'Zerar produtos vencidos', module: 'validade', type: 'zerar', target: 0 },
  validade_7dias: { label: 'Tratar produtos vencendo em 7 dias', module: 'validade', type: 'zerar', target: 0 },
  conferencia_finalizadas: { label: 'Finalizar 100% das conferências', module: 'conferencia', type: 'percentual', target: 100 },
  divergencias_resolvidas: { label: 'Resolver divergências de conferência', module: 'conferencia', type: 'zerar', target: 0 },
  avarias_tratadas: { label: 'Tratar avarias abertas', module: 'avarias', type: 'zerar', target: 0 },
  pedidos_pendentes: { label: 'Concluir pedidos em aberto', module: 'recebimento', type: 'zerar', target: 0 },
};

let _cache = { ...DEFAULT_METAS };

const mergeTargets = (saved = {}) => {
  const merged = { ...DEFAULT_METAS };
  for (const key of Object.keys(merged)) {
    if (saved[key] && typeof saved[key].target === 'number') {
      merged[key] = { ...merged[key], target: saved[key].target };
    }
  }
  return merged;
};

// Getter síncrono — cache em memória (defaults até hidratar via fetchMetas).
export const loadMetas = () => ({ ..._cache });

export const fetchMetas = async () => {
  const valor = await adminApi.getSetting(SETTING_KEY, null);
  if (valor) _cache = mergeTargets(valor);
  return { ..._cache };
};

export const saveMetas = async (metas) => {
  const minimal = {};
  for (const [key, value] of Object.entries(metas)) {
    minimal[key] = { target: value.target };
  }
  await adminApi.saveSetting(SETTING_KEY, minimal);
  _cache = mergeTargets(minimal);
  return true;
};
