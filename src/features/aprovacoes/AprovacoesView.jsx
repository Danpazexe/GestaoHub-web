import { useEffect, useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Drawer';
import { BeforeAfter } from '../../components/BeforeAfter';
import { toast } from '../../lib/toast';
import { formatDateTime } from '../../lib/format';
import { hasReason, VALIDATION_MESSAGES } from '../../lib/validations';
import { logEvent } from '../../lib/logger';
import { APPROVAL_ACTIONS, loadAprovacoes, createAprovacao, decideAprovacao } from '../../lib/aprovacoes';

const STATUS_TONE = { pendente: 'warning', aprovada: 'success', rejeitada: 'danger' };

// Workflow de aprovação (briefing §34.6). Solicitações persistidas no Supabase
// (approval_requests); o app mobile pode criar solicitações reais na operação.
export const AprovacoesView = (props) => {
  const { profile } = props;
  const who = profile?.name || profile?.email || 'Admin';
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ type: APPROVAL_ACTIONS[0], description: '', before: '', after: '' });
  const [decision, setDecision] = useState(null); // { registro, status, reason }
  const [busy, setBusy] = useState(false);

  const refresh = () => { loadAprovacoes().then(setList).catch(() => {}); };
  useEffect(() => { refresh(); }, []);

  const pendentes = useMemo(() => list.filter((r) => r.status === 'pendente'), [list]);
  const decididas = useMemo(() => list.filter((r) => r.status !== 'pendente'), [list]);

  const submitRequest = async () => {
    if (!form.description.trim()) { toast.error('Descreva a solicitação.'); return; }
    setBusy(true);
    try {
      await createAprovacao({ ...form, requestedBy: who });
      refresh();
      setForm({ type: APPROVAL_ACTIONS[0], description: '', before: '', after: '' });
      toast.success('Solicitação de aprovação criada.');
    } catch (error) {
      toast.error(error?.message || 'Não foi possível criar a solicitação.');
    } finally {
      setBusy(false);
    }
  };

  const openDecision = (registro, status) => setDecision({ registro, status, reason: '' });
  const reasonOk = decision ? hasReason(decision.reason) : false;

  const confirmDecision = async () => {
    if (!reasonOk) { toast.error(VALIDATION_MESSAGES.reason); return; }
    setBusy(true);
    try {
      await decideAprovacao(decision.registro.id, { status: decision.status, decidedBy: who, decisionReason: decision.reason });
      refresh();
      logEvent({ level: 'info', message: `Aprovação ${decision.status}`, context: `${who} · ${decision.registro.type} · ${decision.registro.description}` });
      toast.success(`Solicitação ${decision.status}.`);
      setDecision(null);
    } catch (error) {
      toast.error(error?.message || 'Não foi possível registrar a decisão.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Drawer open={Boolean(decision)} title={decision ? `${decision.status === 'aprovada' ? 'Aprovar' : 'Rejeitar'} solicitação` : ''} onClose={() => setDecision(null)}>
        {decision ? (
          <div className="form-stack">
            <div className="detail-card">
              <strong>{decision.registro.type}</strong>
              <span>{decision.registro.description}</span>
              <span>Solicitado por {decision.registro.requestedBy} · {formatDateTime(decision.registro.requestedAt)}</span>
            </div>
            {decision.registro.before || decision.registro.after ? (
              <BeforeAfter
                before={[{ label: 'Antes', value: decision.registro.before || '—' }]}
                after={[{ label: 'Depois', value: decision.registro.after || '—' }]}
              />
            ) : null}
            <label className="builder-field">
              <span>Motivo da decisão (obrigatório)</span>
              <textarea value={decision.reason} onChange={(e) => setDecision((d) => ({ ...d, reason: e.target.value.slice(0, 300) }))} rows={3} placeholder="Justifique a aprovação/rejeição" />
            </label>
            {!reasonOk ? <div className="feedback warning">{VALIDATION_MESSAGES.reason}</div> : null}
            <button type="button" className={decision.status === 'aprovada' ? 'primary-button' : 'danger-button'} onClick={confirmDecision} disabled={!reasonOk || busy}>
              {busy ? 'Salvando...' : decision.status === 'aprovada' ? 'Confirmar aprovação' : 'Confirmar rejeição'}
            </button>
          </div>
        ) : null}
      </Drawer>

      <PanelSection title="Nova solicitação de aprovação" subtitle="Registre uma ação crítica que precisa de aprovação do supervisor" kicker="Controle">
        <div className="bonus-builder-grid">
          <label className="builder-field">
            <span>Ação</span>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {APPROVAL_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="builder-field builder-field-wide">
            <span>Descrição</span>
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Ex.: Marcar 8 un do Leite Integral lote L123 como perda" />
          </label>
          <label className="builder-field">
            <span>Antes (opcional)</span>
            <input value={form.before} onChange={(e) => setForm((f) => ({ ...f, before: e.target.value }))} placeholder="Qtd: 10 · Pendente" />
          </label>
          <label className="builder-field">
            <span>Depois (opcional)</span>
            <input value={form.after} onChange={(e) => setForm((f) => ({ ...f, after: e.target.value }))} placeholder="Qtd: 8 · Corrigido" />
          </label>
        </div>
        <button type="button" className="primary-button" style={{ marginTop: 12 }} onClick={submitRequest} disabled={busy}>{busy ? 'Enviando...' : 'Solicitar aprovação'}</button>
        <p className="config-hint">As solicitações são gravadas no Supabase (<code>approval_requests</code>). O app mobile também pode criar solicitações na operação, que aparecem aqui automaticamente.</p>
      </PanelSection>

      <PanelSection title={`Pendentes de aprovação (${pendentes.length})`} subtitle="Aprove ou rejeite — toda decisão exige motivo e gera auditoria" kicker="Controle">
        <DataTable
          rows={pendentes}
          pageSize={12}
          rowClassName={() => 'sev-stripe-warning'}
          columns={[
            { key: 'type', label: 'Ação' },
            { key: 'description', label: 'Descrição' },
            { key: 'requestedBy', label: 'Solicitante' },
            { key: 'requestedAt', label: 'Quando', render: (r) => formatDateTime(r.requestedAt) },
            {
              key: 'actions', label: 'Decisão',
              render: (r) => (
                <div className="table-actions-row">
                  <button type="button" className="table-action-button" onClick={() => openDecision(r, 'aprovada')}>Aprovar</button>
                  <button type="button" className="table-action-button is-danger" onClick={() => openDecision(r, 'rejeitada')}>Rejeitar</button>
                </div>
              ),
            },
          ]}
          emptyMessage="Nenhuma solicitação pendente."
        />
      </PanelSection>

      <PanelSection title={`Histórico de decisões (${decididas.length})`} subtitle="Auditoria: quem solicitou, quem decidiu, quando e por quê" kicker="Auditoria">
        <DataTable
          rows={decididas}
          pageSize={12}
          columns={[
            { key: 'status', label: 'Status', render: (r) => <span className={`status-badge sev-tone-${STATUS_TONE[r.status]}`}>{r.status}</span> },
            { key: 'type', label: 'Ação' },
            { key: 'description', label: 'Descrição' },
            { key: 'requestedBy', label: 'Solicitante' },
            { key: 'decidedBy', label: 'Decidido por' },
            { key: 'decisionReason', label: 'Motivo', render: (r) => r.decisionReason || '—' },
            { key: 'decidedAt', label: 'Quando', render: (r) => formatDateTime(r.decidedAt) },
          ]}
          emptyMessage="Nenhuma decisão registrada ainda."
        />
      </PanelSection>
    </>
  );
};
