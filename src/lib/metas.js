// Metas operacionais (briefing §14). Persistidas em localStorage (sem schema):
// o supervisor define o alvo de cada meta e o progresso é calculado a partir
// dos dados em tempo real.

const STORAGE_KEY = 'gh-metas-v1';

// Alvos padrão. `type`: 'zerar' (alvo = baixar até o alvo) ou 'percentual'.
export const DEFAULT_METAS = {
  validade_vencidos: { label: 'Zerar produtos vencidos', module: 'validade', type: 'zerar', target: 0 },
  validade_7dias: { label: 'Tratar produtos vencendo em 7 dias', module: 'validade', type: 'zerar', target: 0 },
  conferencia_finalizadas: { label: 'Finalizar 100% das conferências', module: 'conferencia', type: 'percentual', target: 100 },
  divergencias_resolvidas: { label: 'Resolver divergências de conferência', module: 'conferencia', type: 'zerar', target: 0 },
  avarias_tratadas: { label: 'Tratar avarias abertas', module: 'avarias', type: 'zerar', target: 0 },
  pedidos_pendentes: { label: 'Concluir pedidos em aberto', module: 'recebimento', type: 'zerar', target: 0 },
};

export const loadMetas = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_METAS };
    const saved = JSON.parse(raw);
    // mescla com defaults (defaults preenchem metas novas)
    const merged = { ...DEFAULT_METAS };
    for (const key of Object.keys(merged)) {
      if (saved[key] && typeof saved[key].target === 'number') {
        merged[key] = { ...merged[key], target: saved[key].target };
      }
    }
    return merged;
  } catch {
    return { ...DEFAULT_METAS };
  }
};

export const saveMetas = (metas) => {
  try {
    const minimal = {};
    for (const [key, value] of Object.entries(metas)) {
      minimal[key] = { target: value.target };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(minimal));
    return true;
  } catch {
    return false;
  }
};
