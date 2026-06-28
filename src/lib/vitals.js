import { adminApi } from '../services/adminApi';

// Observabilidade leve: reporta Web Vitals (LCP/CLS/INP/FCP/TTFB) para a tabela
// logs_tecnicos (nível info), sem serviço externo/DSN. import() dinâmico.
export const initWebVitals = async () => {
  try {
    const { onLCP, onCLS, onINP, onFCP, onTTFB } = await import('web-vitals');
    const report = (m) => adminApi.insertLogTecnico({
      level: 'info',
      message: `webvital:${m.name}`,
      context: `${Math.round(m.value)} (${m.rating})`,
    });
    onLCP(report);
    onCLS(report);
    onINP(report);
    onFCP(report);
    onTTFB(report);
  } catch {
    /* web-vitals indisponível — ignora */
  }
};
