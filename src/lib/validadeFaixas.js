// Faixas de validade (briefing §13.5) — regra centralizada e configurável (§24).
// Persistidas no Supabase (sistema_configuracoes/chave 'faixas_validade'), não
// mais em localStorage. Mantemos um cache em memória (hidratado por
// fetchFaixasConfig no boot) para que classifyValidade continue síncrona.
// Defaults do briefing: crítico 7d, atenção 15d, monitorar 30d.

import { adminApi } from '../services/adminApi';
import { toNumber } from './numbers';

const SETTING_KEY = 'faixas_validade';

export const DEFAULT_FAIXAS = { criticoDias: 7, atencaoDias: 15, monitorarDias: 30 };

let _cache = { ...DEFAULT_FAIXAS };

const normalize = (saved = {}) => ({
  criticoDias: toNumber(saved.criticoDias, DEFAULT_FAIXAS.criticoDias),
  atencaoDias: toNumber(saved.atencaoDias, DEFAULT_FAIXAS.atencaoDias),
  monitorarDias: toNumber(saved.monitorarDias, DEFAULT_FAIXAS.monitorarDias),
});

// Getter síncrono — devolve o cache em memória (defaults até hidratar).
export const loadFaixasConfig = () => ({ ..._cache });

// Carrega do Supabase e atualiza o cache. Chamado no bootstrap e na tela de Config.
export const fetchFaixasConfig = async () => {
  const valor = await adminApi.getSetting(SETTING_KEY, null);
  if (valor) _cache = normalize(valor);
  return { ..._cache };
};

// Salva no Supabase e atualiza o cache.
export const saveFaixasConfig = async (config) => {
  const next = normalize(config);
  await adminApi.saveSetting(SETTING_KEY, next);
  _cache = next;
  return true;
};

// Classifica os dias restantes numa faixa de validade.
// Faixas: vencido | hoje | critico | atencao | monitorar | seguro
export const classifyValidade = (diasrestantes, config = _cache) => {
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
