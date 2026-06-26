import { useEffect, useState } from 'react';

// Recharts não resolve var(--*) em SVG de forma confiável, então lemos os tokens
// (CSS custom properties) com getComputedStyle e passamos cores resolvidas aos
// charts. Assim os gráficos seguem o tema (claro/escuro) sem cores hardcoded.
const FALLBACK = {
  accent: '#fc964e', info: '#0ea5e9', warning: '#f59e0b', danger: '#ef4444',
  success: '#10b981', muted: '#667085', line: 'rgba(51,65,85,0.12)',
  accent3: '#ffe6d1', surface: '#ffffff', ink: '#1e2433',
};

export const getChartTheme = () => {
  if (typeof window === 'undefined' || typeof getComputedStyle !== 'function') {
    return FALLBACK;
  }
  const s = getComputedStyle(document.documentElement);
  const v = (name, fallback) => (s.getPropertyValue(name).trim() || fallback);
  return {
    accent:  v('--accent-2', FALLBACK.accent),
    info:    v('--info',     FALLBACK.info),
    warning: v('--warning',  FALLBACK.warning),
    danger:  v('--danger',   FALLBACK.danger),
    success: v('--success',  FALLBACK.success),
    muted:   v('--muted',    FALLBACK.muted),
    line:    v('--line',     FALLBACK.line),
    accent3: v('--accent-3', FALLBACK.accent3),
    surface: v('--surface',  FALLBACK.surface),
    ink:     v('--ink',      FALLBACK.ink),
  };
};

// Recomputa a paleta quando o tema é alternado (data-theme no <html>).
export const useChartTheme = () => {
  const [theme, setTheme] = useState(getChartTheme);
  useEffect(() => {
    setTheme(getChartTheme());
    const observer = new MutationObserver(() => setTheme(getChartTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
};
