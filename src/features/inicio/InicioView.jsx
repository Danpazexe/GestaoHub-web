import { lazy, Suspense, useState } from 'react';
import { AppIcon } from '../../components/AppIcon';
import { MonitorView } from '../monitor/MonitorView';

// "Análise" carrega o recharts sob demanda — só quando o segmento é aberto,
// preservando o code-split mesmo com a tela Início sendo a landing.
const DashboardView = lazy(() =>
  import('../dashboard/DashboardView').then((m) => ({ default: m.DashboardView })),
);

const SEGMENTS = [
  { key: 'realtime', label: 'Tempo real', icon: 'monitor' },
  { key: 'analise', label: 'Análise', icon: 'dashboard' },
];

// Tela inicial unificada: "Tempo real" (operação ao vivo) e "Análise" (tendências
// + histórico). Substitui as antigas telas Monitoramento / Dashboard / Visão geral.
export const InicioView = ({
  summary,
  activeUsers,
  tratativas,
  validade,
  events,
  conferenciaBonusQueue,
  conferenciaSaidaBonusQueue,
  conferenciaDivergencias,
  lastRefresh,
  onSelectView,
}) => {
  const [segment, setSegment] = useState('realtime');

  return (
    <>
      <div className="segmented" role="tablist" aria-label="Modo do painel">
        {SEGMENTS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={segment === item.key}
            className={segment === item.key ? 'segmented-btn active' : 'segmented-btn'}
            onClick={() => setSegment(item.key)}
          >
            <AppIcon name={item.icon} size={15} />
            {item.label}
          </button>
        ))}
      </div>

      {segment === 'realtime' ? (
        <MonitorView
          summary={summary}
          activeUsers={activeUsers}
          conferenciaBonusQueue={conferenciaBonusQueue}
          conferenciaSaidaBonusQueue={conferenciaSaidaBonusQueue}
          conferenciaDivergencias={conferenciaDivergencias}
          validade={validade}
          events={events}
          lastRefresh={lastRefresh}
          onSelectView={onSelectView}
        />
      ) : (
        <Suspense fallback={<div className="inline-loading">Carregando análise...</div>}>
          <DashboardView
            tratativas={tratativas}
            validade={validade}
            onSelectView={onSelectView}
          />
        </Suspense>
      )}
    </>
  );
};
