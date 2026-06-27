import { useMemo } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { buildPendencias } from '../../lib/pendencias';
import { severityMeta } from '../../lib/severity';

// Mapa operacional da loja (briefing §2/§3). Agrupa as pendências por
// setor/área. Como o schema ainda não tem setor/filial/localização, cai para
// agrupamento por MÓDULO (proxy) e avisa que a migração de localização
// (docs/migrations) habilita o mapa real por setor — sem mudar este código.
const buildMapa = (pendencias) => {
  const hasSector = pendencias.some((p) => p.sector);
  const groupOf = (p) => (hasSector ? (p.sector || 'Sem setor') : p.module);

  const groups = new Map();
  for (const p of pendencias) {
    const key = groupOf(p);
    if (!groups.has(key)) {
      groups.set(key, { name: key, total: 0, validade: 0, avarias: 0, divergencias: 0, notas: 0, conferencias: 0, tratativas: 0, outros: 0, maxSeverityWeight: 0 });
    }
    const g = groups.get(key);
    g.total += 1;
    if (p.source === 'validade') g.validade += 1;
    else if (p.source === 'avaria') g.avarias += 1;
    else if (p.type === 'divergencia') g.divergencias += 1;
    else if (p.source === 'purchase_order') g.notas += 1;
    else if (p.source === 'conferencia' || p.source === 'conferencia_saida') g.conferencias += 1;
    else if (p.source === 'tratativa') g.tratativas += 1;
    else g.outros += 1; // qualquer fonte futura não prevista cai aqui (nunca some do card)
    g.maxSeverityWeight = Math.max(g.maxSeverityWeight, severityMeta(p.severity).weight);
  }

  return {
    hasSector,
    groups: Array.from(groups.values()).sort((a, b) => b.total - a.total),
  };
};

const toneForTotal = (total) => (total >= 8 ? 'danger' : total >= 4 ? 'warning' : total >= 1 ? 'monitor' : 'success');

export const MapaView = (data) => {
  const pendencias = useMemo(() => buildPendencias(data), [data]);
  const mapa = useMemo(() => buildMapa(pendencias), [pendencias]);

  return (
    <PanelSection
      title="Mapa operacional"
      subtitle={mapa.hasSector
        ? 'Onde estão os problemas — por setor/área da operação'
        : 'Onde estão os problemas — agrupado por módulo (setor/filial habilitam ao migrar a localização)'}
      kicker="Visão da operação"
    >
      {!mapa.hasSector ? (
        <div className="feedback warning" style={{ marginBottom: 16 }}>
          Os registros ainda não possuem <strong>setor / filial / localização</strong>. Aplicando a migração
          <code> docs/migrations/0001_setor_filial_localizacao.sql</code> e publicando esses campos pelo app, o mapa passa a agrupar por setor automaticamente.
        </div>
      ) : null}

      {mapa.groups.length === 0 ? (
        <div className="empty-state">Sem pendências para mapear. Operação em dia! ✅</div>
      ) : (
        <div className="mapa-grid">
          {mapa.groups.map((group) => (
            <article key={group.name} className={`mapa-card sev-stripe-${toneForTotal(group.total)}`}>
              <header className="mapa-card-head">
                <h3>{group.name}</h3>
                <span className={`tv-count sev-tone-${toneForTotal(group.total)}`}>{group.total}</span>
              </header>
              <ul className="mapa-lines">
                {group.validade > 0 ? <li><span>Validades críticas</span><strong>{group.validade}</strong></li> : null}
                {group.divergencias > 0 ? <li><span>Divergências</span><strong>{group.divergencias}</strong></li> : null}
                {group.avarias > 0 ? <li><span>Avarias</span><strong>{group.avarias}</strong></li> : null}
                {group.conferencias > 0 ? <li><span>Conferências paradas</span><strong>{group.conferencias}</strong></li> : null}
                {group.notas > 0 ? <li><span>Notas pendentes</span><strong>{group.notas}</strong></li> : null}
                {group.tratativas > 0 ? <li><span>Tratativas abertas</span><strong>{group.tratativas}</strong></li> : null}
                {group.outros > 0 ? <li><span>Outras pendências</span><strong>{group.outros}</strong></li> : null}
                {group.total === 0 ? <li className="mapa-ok">Sem pendência</li> : null}
              </ul>
            </article>
          ))}
        </div>
      )}
    </PanelSection>
  );
};
