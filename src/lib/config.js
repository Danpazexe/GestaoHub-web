// Configurações operacionais do sistema (briefing §24). Listas configuráveis
// (motivos, funções, setores) persistidas no Supabase
// (sistema_configuracoes/chave 'config_sistema'), não mais em localStorage.
// Cache em memória + fetch async. As faixas de validade ficam em validadeFaixas.

import { adminApi } from '../services/adminApi';
import { structuredCloneSafe } from './clone';

const SETTING_KEY = 'config_sistema';

export const DEFAULT_CONFIG = {
  funcoes: ['Conferente', 'Recebimento', 'Validade', 'Avarias', 'Estoque'],
  setores: ['Alimentos', 'Limpeza', 'Bebidas', 'Higiene', 'Depósito', 'Recebimento', 'Frente de loja'],
  motivosCorrecao: ['Quantidade divergente', 'Produto faltando', 'Produto a mais', 'Erro de digitação', 'Avaria no recebimento'],
  motivosExclusao: ['Cadastro duplicado', 'Erro de cadastro', 'Produto inexistente'],
  motivosDivergencia: ['Falta', 'Sobra', 'Troca', 'Avaria'],
};

// Tipos de tratativa de validade — canônicos do banco (read-only na UI).
export const TIPOS_TRATATIVA = ['Vendido', 'Trocado', 'Devolvido', 'Vencido/Perda'];

let _cache = structuredCloneSafe(DEFAULT_CONFIG);

const merge = (saved = {}) => {
  const merged = structuredCloneSafe(DEFAULT_CONFIG);
  for (const key of Object.keys(merged)) {
    if (Array.isArray(saved[key])) merged[key] = saved[key];
  }
  return merged;
};

// Getter síncrono — cache em memória (defaults até hidratar via fetchConfig).
export const loadConfig = () => structuredCloneSafe(_cache);

export const fetchConfig = async () => {
  const valor = await adminApi.getSetting(SETTING_KEY, null);
  if (valor) _cache = merge(valor);
  return structuredCloneSafe(_cache);
};

export const saveConfig = async (config) => {
  const next = merge(config);
  await adminApi.saveSetting(SETTING_KEY, next);
  _cache = next;
  return true;
};

// Converte texto (um item por linha) em lista limpa, e vice-versa.
export const textToList = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
export const listToText = (list) => (Array.isArray(list) ? list.join('\n') : '');
