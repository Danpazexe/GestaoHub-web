import { useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { AppIcon } from '../../components/AppIcon';
import { StatCard } from '../../components/StatCard';
import { toast } from '../../lib/toast';
import { buildModuleDashboards, buildComparativo, computeMetaProgress } from '../../lib/dashboards';
import { loadMetas, saveMetas } from '../../lib/metas';

const DeltaPill = ({ item }) => {
  const improved = item.betterWhenLower ? item.deltaPct < 0 : item.deltaPct > 0;
  const worsened = item.betterWhenLower ? item.deltaPct > 0 : item.deltaPct < 0;
  const tone = item.deltaPct === 0 ? 'info' : improved ? 'success' : worsened ? 'danger' : 'info';
  const arrow = item.deltaPct === 0 ? '→' : item.deltaPct > 0 ? '▲' : '▼';
  return <span className={`status-badge sev-tone-${tone}`}>{arrow} {Math.abs(item.deltaPct)}%</span>;
};

// Indicadores: dashboards por módulo (§13), comparativo por período (§24) e
// metas operacionais (§14). Tudo derivado dos dados já carregados.
export const IndicadoresView = (props) => {
  const data = props;
  const [metas, setMetas] = useState(() => loadMetas());

  const modules = useMemo(() => buildModuleDashboards(data), [data]);
  const comparativo = useMemo(() => buildComparativo(data), [data]);
  const metaProgress = useMemo(() => computeMetaProgress(data, metas), [data, metas]);

  const handleTargetChange = (key, value) => {
    const target = Math.max(0, Number(value) || 0);
    setMetas((cur) => ({ ...cur, [key]: { ...cur[key], target } }));
  };

  const persist = () => {
    if (saveMetas(metas)) toast.success('Metas salvas.');
    else toast.error('Não foi possível salvar as metas.');
  };

  return (
    <>
      <PanelSection
        title="Metas operacionais"
        subtitle="Defina o alvo de cada meta; o progresso é calculado em tempo real"
        kicker="Indicadores"
        actions={<button type="button" className="primary-button" onClick={persist} title="Salvar metas">Salvar metas</button>}
      >
        <div className="metas-grid">
          {metaProgress.map((meta) => (
            <div key={meta.key} className="meta-card">
              <div className="meta-head">
                <span className="meta-label">{meta.label}</span>
                {meta.achieved ? <span className="status-badge sev-tone-success">Atingida</span> : null}
              </div>
              <div className="meta-bar">
                <span className={`meta-bar-fill sev-fill-${meta.tone}`} style={{ width: `${meta.pct}%` }} />
              </div>
              <div className="meta-foot">
                <span className="meta-pct">{meta.pct}% concluída</span>
                <span className="meta-current">{meta.type === 'percentual' ? `${meta.current} abertas` : `${meta.current} pendente(s)`}</span>
                <label className="meta-target">
                  <span>Alvo</span>
                  <input
                    type="number"
                    min="0"
                    value={meta.target}
                    onChange={(event) => handleTargetChange(meta.key, event.target.value)}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection
        title="Comparativo por período"
        subtitle="Esta semana vs. semana anterior"
        kicker="Tendência"
      >
        <div className="stat-grid">
          {comparativo.map((item) => (
            <StatCard
              key={item.label}
              hero
              icon={item.icon}
              tone={item.tone}
              label={item.label}
              value={item.current}
              trend={<DeltaPill item={item} />}
              series={item.series}
              hint={`semana anterior: ${item.previous}`}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection
        title="Dashboards por módulo"
        subtitle="KPIs de cada área operacional"
        kicker="Indicadores"
      >
        <div className="module-dashboards">
          {modules.map((module) => (
            <div key={module.key} className="module-dash">
              <div className="module-dash-head">
                <AppIcon name={module.icon} size={16} />
                <h4>{module.label}</h4>
              </div>
              <div className="module-kpis">
                {module.kpis.map((kpi) => (
                  <div key={kpi.label} className="kpi-mini">
                    <span className={`sev-dot sev-tone-${kpi.tone}`} />
                    <strong className="kpi-mini-value">{kpi.value}</strong>
                    <span className="kpi-mini-label">{kpi.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PanelSection>
    </>
  );
};
