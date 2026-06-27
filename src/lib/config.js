// Configurações operacionais do sistema (briefing §24). Listas configuráveis
// persistidas em localStorage para alimentar selects (motivos, funções, setores)
// e a importação em massa. As faixas de validade ficam em lib/validadeFaixas.

const STORAGE_KEY = 'gh-config-sistema-v1';

export const DEFAULT_CONFIG = {
  funcoes: ['Conferente', 'Recebimento', 'Validade', 'Avarias', 'Estoque'],
  setores: ['Alimentos', 'Limpeza', 'Bebidas', 'Higiene', 'Depósito', 'Recebimento', 'Frente de loja'],
  motivosCorrecao: ['Quantidade divergente', 'Produto faltando', 'Produto a mais', 'Erro de digitação', 'Avaria no recebimento'],
  motivosExclusao: ['Cadastro duplicado', 'Erro de cadastro', 'Produto inexistente'],
  motivosDivergencia: ['Falta', 'Sobra', 'Troca', 'Avaria'],
};

// Tipos de tratativa de validade — canônicos do banco (read-only na UI).
export const TIPOS_TRATATIVA = ['Vendido', 'Trocado', 'Devolvido', 'Vencido/Perda'];

export const loadConfig = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredCloneSafe(DEFAULT_CONFIG);
    const saved = JSON.parse(raw);
    const merged = structuredCloneSafe(DEFAULT_CONFIG);
    for (const key of Object.keys(merged)) {
      if (Array.isArray(saved[key])) merged[key] = saved[key];
    }
    return merged;
  } catch {
    return structuredCloneSafe(DEFAULT_CONFIG);
  }
};

export const saveConfig = (config) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
};

// Converte texto (um item por linha) em lista limpa, e vice-versa.
export const textToList = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
export const listToText = (list) => (Array.isArray(list) ? list.join('\n') : '');

function structuredCloneSafe(obj) {
  return JSON.parse(JSON.stringify(obj));
}
