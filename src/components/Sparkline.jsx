// Mini-gráfico de linha (SVG puro, sem dependência de recharts) para tendência
// de uma série curta de números. Usa currentColor, então herda a cor do pai.
export const Sparkline = ({ data = [], width = 104, height = 30, strokeWidth = 1.6 }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const y = (v) => height - ((v - min) / range) * (height - 4) - 2;
  const points = data.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lastX = ((data.length - 1) * step).toFixed(1);
  const lastY = y(data[data.length - 1]).toFixed(1);
  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2" fill="currentColor" />
    </svg>
  );
};
