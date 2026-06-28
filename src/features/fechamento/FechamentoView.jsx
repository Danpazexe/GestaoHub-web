import { useEffect, useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { toast } from '../../lib/toast';
import { formatDateTime } from '../../lib/format';
import { computeResumoDia, loadFechamentos, saveFechamento } from '../../lib/fechamento';

// Fechamento diário (briefing §21). Mostra o resumo de pendências do dia, um
// checklist de conferência e registra quem fechou, quando e o que restou
// (persistido no Supabase — tabela fechamentos_diarios).
export const FechamentoView = (props) => {
  const { profile, ...data } = props;
  const resumo = useMemo(() => computeResumoDia(data), [data]);
  const [checks, setChecks] = useState({});
  const [observacoes, setObservacoes] = useState('');
  const [historico, setHistorico] = useState([]);
  const [saving, setSaving] = useState(false);

  const refreshHistorico = () => { loadFechamentos().then(setHistorico).catch(() => {}); };
  useEffect(() => { refreshHistorico(); }, []);

  const toggle = (key) => setChecks((cur) => ({ ...cur, [key]: !cur[key] }));
  const allChecked = resumo.itens.every((i) => checks[i.key]);

  const registrar = async () => {
    setSaving(true);
    try {
      await saveFechamento({
        by: profile?.name || profile?.email || 'Admin',
        pendenciasRestantes: resumo.totalPendencias,
        observacoes: observacoes.trim(),
        itens: resumo.itens.map((i) => ({ label: i.label, ok: Boolean(checks[i.key]), pendente: i.pendente })),
      });
      refreshHistorico();
      setChecks({});
      setObservacoes('');
      toast.success('Fechamento registrado.');
    } catch (error) {
      toast.error(error?.message || 'Não foi possível registrar o fechamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PanelSection
        title="Fechamento diário"
        subtitle="Confira o estado da operação e registre o fechamento do dia"
        kicker="Operação"
      >
        <div className="pendencia-cards">
          <article className={`pendencia-card sev-stripe-${resumo.totalPendencias === 0 ? 'success' : 'warning'}`}>
            <span className="pendencia-card-value">{resumo.totalPendencias}</span>
            <span className="pendencia-card-label">Pendências restantes no fechamento</span>
          </article>
        </div>

        <ul className="fechamento-checklist">
          {resumo.itens.map((item) => (
            <li key={item.key} className="fechamento-item">
              <label className="fechamento-check">
                <input type="checkbox" checked={Boolean(checks[item.key])} onChange={() => toggle(item.key)} />
                <span className="fechamento-label">{item.label}</span>
              </label>
              <span className={`status-badge ${item.pendente ? 'sev-tone-warning' : 'sev-tone-success'}`}>{item.texto}</span>
            </li>
          ))}
        </ul>

        <label className="builder-field" style={{ marginTop: 16 }}>
          <span>Observações do fechamento</span>
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value.slice(0, 500))} rows={3} placeholder="Pendências que ficaram, ocorrências do dia, recados…" />
        </label>

        {resumo.totalPendencias > 0 && allChecked ? (
          <div className="feedback warning" style={{ marginTop: 12 }}>
            Há {resumo.totalPendencias} pendência(s) em aberto. O fechamento será registrado com essas pendências.
          </div>
        ) : null}

        <button type="button" className="primary-button" style={{ marginTop: 14 }} onClick={registrar} disabled={!allChecked || saving} title="Registrar fechamento">
          {saving ? 'Registrando...' : allChecked ? 'Registrar fechamento do dia' : 'Confirme todos os itens do checklist'}
        </button>
      </PanelSection>

      <PanelSection title={`Histórico de fechamentos (${historico.length})`} subtitle="Quem fechou, quando e com quantas pendências" kicker="Auditoria">
        <DataTable
          rows={historico}
          pageSize={12}
          columns={[
            { key: 'at', label: 'Data/hora', render: (r) => formatDateTime(r.at) },
            { key: 'by', label: 'Responsável' },
            { key: 'pendenciasRestantes', label: 'Pendências', render: (r) => <span className={r.pendenciasRestantes ? 'days-warning' : 'days-ok'}>{r.pendenciasRestantes}</span> },
            { key: 'observacoes', label: 'Observações', render: (r) => r.observacoes || '—' },
          ]}
          emptyMessage="Nenhum fechamento registrado ainda."
        />
      </PanelSection>
    </>
  );
};
