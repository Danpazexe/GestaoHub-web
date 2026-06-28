// Coerção numérica segura: só cai no fallback se NÃO for número finito.
// Preserva o 0 (que `Number(x) || default` descartaria, por 0 ser falsy).
export const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
