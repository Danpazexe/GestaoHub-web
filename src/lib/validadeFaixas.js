// Faixas de validade (briefing §13.5) — regra centralizada e configurável (§24).
// Lê os limites de localStorage (editáveis na tela de Configurações) com os
// defaults do briefing: crítico 7d, atenção 15d, monitorar 30d.

const CONFIG_KEY = 'gh-config-validade-v1';

export const DEFAULT_FAIXAS = { criticoDias: 7, atencaoDias: 15, monitorarDias: 30 };

export const loadFaixasConfig = () => {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_FAIXAS };
    const saved = JSON.parse(raw);
    return {
      criticoDias: Number(saved.criticoDias) || DEFAULT_FAIXAS.criticoDias,
      atencaoDias: Number(saved.atencaoDias) || DEFAULT_FAIXAS.atencaoDias,
      monitorarDias: Number(saved.monitorarDias) || DEFAULT_FAIXAS.monitorarDias,
    };
  } catch {
    return { ...DEFAULT_FAIXAS };
  }
};

export const saveFaixasConfig = (config) => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      criticoDias: Number(config.criticoDias) || DEFAULT_FAIXAS.criticoDias,
      atencaoDias: Number(config.atencaoDias) || DEFAULT_FAIXAS.atencaoDias,
      monitorarDias: Number(config.monitorarDias) || DEFAULT_FAIXAS.monitorarDias,
    }));
    return true;
  } catch {
    return false;
  }
};

// Classifica os dias restantes numa faixa de validade.
// Faixas: vencido | hoje | critico | atencao | monitorar | seguro
export const classifyValidade = (diasrestantes, config = loadFaixasConfig()) => {
  const dias = Number(diasrestantes);
  if (!Number.isFinite(dias)) {
    return { key: 'desconhecido', label: 'Sem validade', tone: 'info', dias: null };
  }
  if (dias < 0) return { key: 'vencido', label: `Vencido (${Math.abs(dias)}d)`, tone: 'danger', dias };
  if (dias === 0) return { key: 'hoje', label: 'Vence hoje', tone: 'danger', dias };
  if (dias <= config.criticoDias) return { key: 'critico', label: `Crítico (${dias}d)`, tone: 'danger', dias };
  if (dias <= config.atencaoDias) return { key: 'atencao', label: `Atenção (${dias}d)`, tone: 'warning', dias };
  if (dias <= config.monitorarDias) return { key: 'monitorar', label: `Monitorar (${dias}d)`, tone: 'monitor', dias };
  return { key: 'seguro', label: `Seguro (${dias}d)`, tone: 'success', dias };
};

// Caminho/URL bruto da imagem do produto. O app guarda a imagem no bucket
// privado product-images (coluna image_path); a view admin precisa expor essa
// coluna (ver docs/migrations/0003). Pode também ser uma URL pública direta.
export const readImage = (row = {}) =>
  row.image_path || row.image_url || row.imagem || row.photo_url || row.foto_url || null;

// Detecta se os registros publicam imagem (para habilitar cards/filtros de imagem
// sem gerar falso positivo quando o campo nem existe no schema).
export const hasImageField = (rows = []) => rows.some((r) => readImage(r));

// True quando o valor já é uma URL pronta (não precisa de URL assinada).
export const isDirectImageUrl = (value) => /^(https?:|data:|blob:)/.test(String(value || ''));

// Status de tratativa para legibilidade.
export const isOpenValidade = (row = {}) => row.status !== 'treated' && row.status !== 'resolved';
