// Travas contra erro humano (briefing §25). Validações reutilizáveis para a
// camada de interface (e que podem ser espelhadas no backend depois).

export const clampNonNegative = (value) => Math.max(0, Number(value) || 0);

export const isPositiveQuantity = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
};

// Não permitir tratar mais do que o disponível.
export const notExceeds = (value, max) => {
  const n = Number(value);
  const m = Number(max);
  if (!Number.isFinite(m)) return true;
  return Number.isFinite(n) && n <= m;
};

// Motivo obrigatório (correções, perdas, ajustes, reset de senha, etc.).
export const hasReason = (text, min = 3) => String(text || '').trim().length >= min;

export const VALIDATION_MESSAGES = {
  negative: 'A quantidade não pode ser negativa.',
  notPositive: 'Informe uma quantidade maior que zero.',
  exceeds: 'O valor não pode ser maior que o disponível em estoque.',
  reason: 'Informe o motivo para registrar esta ação.',
};

// Valida um conjunto de regras e devolve a primeira mensagem de erro (ou null).
export const validate = (rules = []) => {
  for (const rule of rules) {
    if (!rule.ok) return rule.message;
  }
  return null;
};
