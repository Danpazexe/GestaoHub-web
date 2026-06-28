// Clonagem profunda segura. Usa structuredClone nativo quando disponível;
// cai para JSON (suficiente para dados puros: config/matriz de permissões).
export const structuredCloneSafe = (obj) => {
  try {
    if (typeof structuredClone === 'function') return structuredClone(obj);
  } catch { /* fallback abaixo */ }
  return JSON.parse(JSON.stringify(obj));
};
