import { useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { toast } from '../../lib/toast';
import { loadConfig, saveConfig, textToList, listToText, TIPOS_TRATATIVA } from '../../lib/config';
import { loadFaixasConfig, saveFaixasConfig } from '../../lib/validadeFaixas';

const LIST_FIELDS = [
  { key: 'funcoes', label: 'Funções operacionais', hint: 'Conferente, Recebimento, Validade…' },
  { key: 'setores', label: 'Setores / localizações', hint: 'Alimentos, Limpeza, Depósito…' },
  { key: 'motivosCorrecao', label: 'Motivos de correção', hint: 'Usados ao corrigir entrada/nota' },
  { key: 'motivosExclusao', label: 'Motivos de exclusão', hint: 'Usados ao excluir produto' },
  { key: 'motivosDivergencia', label: 'Motivos de divergência', hint: 'Falta, Sobra, Troca…' },
];

// Configurações do sistema (briefing §24). Centraliza regras operacionais que
// não devem ficar fixas no código: faixas de validade, funções, setores e
// motivos. Persistido em localStorage.
export const ConfiguracoesView = () => {
  const [faixas, setFaixas] = useState(() => loadFaixasConfig());
  const [config, setConfig] = useState(() => loadConfig());

  const setFaixa = (key, value) => setFaixas((cur) => ({ ...cur, [key]: Math.max(0, Number(value) || 0) }));
  const setList = (key, text) => setConfig((cur) => ({ ...cur, [key]: textToList(text) }));

  const persist = () => {
    const okFaixas = saveFaixasConfig(faixas);
    const okConfig = saveConfig(config);
    if (okFaixas && okConfig) toast.success('Configurações salvas.');
    else toast.error('Não foi possível salvar as configurações.');
  };

  const faixasInvalid = !(faixas.criticoDias < faixas.atencaoDias && faixas.atencaoDias < faixas.monitorarDias);

  return (
    <>
      <PanelSection
        title="Configurações do sistema"
        subtitle="Regras operacionais editáveis — evite valores fixos no código"
        kicker="Administração"
        actions={<button type="button" className="primary-button" onClick={persist} disabled={faixasInvalid} title="Salvar configurações">Salvar configurações</button>}
      >
        <h4 className="config-group-title">Faixas de validade (dias)</h4>
        <div className="config-faixas">
          <label className="builder-field">
            <span>Crítico até</span>
            <input type="number" min="0" value={faixas.criticoDias} onChange={(e) => setFaixa('criticoDias', e.target.value)} />
          </label>
          <label className="builder-field">
            <span>Atenção até</span>
            <input type="number" min="0" value={faixas.atencaoDias} onChange={(e) => setFaixa('atencaoDias', e.target.value)} />
          </label>
          <label className="builder-field">
            <span>Monitorar até</span>
            <input type="number" min="0" value={faixas.monitorarDias} onChange={(e) => setFaixa('monitorarDias', e.target.value)} />
          </label>
        </div>
        {faixasInvalid ? (
          <div className="feedback warning">Os limites devem ser crescentes: crítico &lt; atenção &lt; monitorar.</div>
        ) : (
          <p className="config-hint">Acima de {faixas.monitorarDias} dias o produto é considerado “Seguro”. Vencido (&lt;0) e vence hoje (0) são fixos.</p>
        )}
      </PanelSection>

      <PanelSection title="Listas operacionais" subtitle="Um item por linha" kicker="Administração">
        <div className="config-lists">
          {LIST_FIELDS.map((field) => (
            <label key={field.key} className="config-list-field">
              <span className="config-list-label">{field.label}</span>
              <span className="config-list-hint">{field.hint}</span>
              <textarea
                rows={6}
                value={listToText(config[field.key])}
                onChange={(e) => setList(field.key, e.target.value)}
              />
            </label>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Tipos de tratativa de validade" subtitle="Valores canônicos aceitos pelo banco (somente leitura)" kicker="Referência">
        <div className="config-readonly-tags">
          {TIPOS_TRATATIVA.map((t) => <span key={t} className="status-badge is-info">{t}</span>)}
        </div>
        <p className="config-hint">Estes tipos são validados por CHECK no Supabase; alterá-los exige migração no banco.</p>
      </PanelSection>
    </>
  );
};
