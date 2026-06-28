import { useEffect, useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { exportCsv } from '../../lib/csv';
import { toast } from '../../lib/toast';
import { formatDateTime } from '../../lib/format';
import { buildPendencias } from '../../lib/pendencias';
import { severityMeta } from '../../lib/severity';
import { hasReason, VALIDATION_MESSAGES } from '../../lib/validations';
import { PERMISSIONS, ROLES, defaultMatrix } from '../../lib/permissions';
import { adminApi } from '../../services/adminApi';
import { usePermissions } from '../../context/PermissionsContext';

const SETTING_CHECKLIST = 'checklist_publicacao';

// Checklist de publicação (briefing §27).
const CHECKLIST_ITEMS = [
  'Build funcionando',
  'Login funcionando',
  'Supabase conectado',
  'Variáveis de ambiente configuradas',
  'Rotas funcionando na Vercel',
  'GitHub Actions passando',
  'Sem chave sensível no frontend',
  'Permissões revisadas',
  'Usuário admin criado',
  'Regras de auditoria testadas',
  'Exportações testadas',
  'Dashboard carregando corretamente',
];

export const AdminCenterView = (data) => {
  const { can } = usePermissions();
  const canManageSettings = can('can_manage_settings');
  const canExport = can('can_export_reports');

  const [checklist, setChecklist] = useState({});
  // Permissões reais (Supabase). roles/permissions vêm do banco; cai para o catálogo local.
  const [permData, setPermData] = useState({ roles: ROLES, permissions: PERMISSIONS, matrix: defaultMatrix() });
  const [baseline, setBaseline] = useState(() => JSON.stringify(defaultMatrix()));
  const [permReason, setPermReason] = useState('');
  const [savingPerm, setSavingPerm] = useState(false);

  const refreshMatrix = () => {
    adminApi.getPermissionsMatrix().then((res) => {
      if (res && res.matrix) {
        setPermData(res);
        setBaseline(JSON.stringify(res.matrix));
      }
    }).catch(() => {});
  };

  useEffect(() => {
    adminApi.getSetting(SETTING_CHECKLIST, {})
      .then((v) => setChecklist(v && typeof v === 'object' ? v : {}))
      .catch(() => {});
    refreshMatrix();
  }, []);

  // Bases exportáveis (briefing §19 backup/exportação geral).
  const exportables = useMemo(() => {
    const pendencias = buildPendencias(data);
    return [
      {
        key: 'validade', label: 'Produtos de validade', count: (data.validade || []).length, rows: data.validade || [],
        columns: [
          { key: 'codprod', label: 'Código' }, { key: 'descricao', label: 'Descrição' }, { key: 'lote', label: 'Lote' },
          { key: 'quantidade', label: 'Qtd' }, { key: 'diasrestantes', label: 'Dias rest.' }, { key: 'status', label: 'Status' },
          { key: 'treatment_type', label: 'Tratativa' }, { key: 'updated_at', label: 'Atualização', format: (r) => formatDateTime(r.updated_at) },
        ],
      },
      {
        key: 'pedidos', label: 'Notas / pedidos', count: (data.purchaseOrders || []).length, rows: data.purchaseOrders || [],
        columns: [
          { key: 'order_number', label: 'Pedido' }, { key: 'invoice_number', label: 'NF' }, { key: 'supplier_name', label: 'Fornecedor' },
          { key: 'item_count', label: 'Itens' }, { key: 'status', label: 'Status' }, { key: 'entry_status', label: 'Entrada' },
          { key: 'return_status', label: 'Devolução' }, { key: 'audit_status', label: 'Auditoria' },
        ],
      },
      {
        key: 'conferencias', label: 'Conferências (entrada)', count: (data.conferenciaBonusQueue || []).length, rows: data.conferenciaBonusQueue || [],
        columns: [
          { key: 'invoice_number', label: 'NF' }, { key: 'supplier_name', label: 'Fornecedor' }, { key: 'item_count', label: 'Itens' },
          { key: 'total_quantity', label: 'Qtd' }, { key: 'status', label: 'Status' }, { key: 'assigned_user_name', label: 'Responsável' },
        ],
      },
      {
        key: 'divergencias', label: 'Divergências', count: (data.conferenciaDivergencias || []).length, rows: data.conferenciaDivergencias || [],
        columns: [
          { key: 'code', label: 'Código' }, { key: 'description', label: 'Descrição' }, { key: 'source', label: 'Origem' },
          { key: 'expected_qty', label: 'Esperado' }, { key: 'checked_qty', label: 'Conferido' }, { key: 'diff', label: 'Dif.' },
          { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Data', format: (r) => formatDateTime(r.created_at) },
        ],
      },
      {
        key: 'avarias', label: 'Avarias', count: (data.avarias || []).length, rows: data.avarias || [],
        columns: [
          { key: 'codprod', label: 'Código' }, { key: 'descricao', label: 'Descrição' }, { key: 'quantidade', label: 'Qtd' },
          { key: 'supplier', label: 'Fornecedor' }, { key: 'damage_type', label: 'Avaria' }, { key: 'item_status', label: 'Status' },
          { key: 'item_updated_at', label: 'Atualização', format: (r) => formatDateTime(r.item_updated_at) },
        ],
      },
      {
        key: 'tratativas', label: 'Tratativas', count: (data.tratativas || []).length, rows: data.tratativas || [],
        columns: [
          { key: 'doc_number', label: 'Documento' }, { key: 'occurrence_type', label: 'Ocorrência' }, { key: 'origin_invoice_number', label: 'NF origem' },
          { key: 'status', label: 'Status' }, { key: 'created_at', label: 'Criada', format: (r) => formatDateTime(r.created_at) },
        ],
      },
      {
        key: 'usuarios', label: 'Colaboradores', count: (data.activeUsers || []).length, rows: data.activeUsers || [],
        columns: [
          { key: 'name', label: 'Nome' }, { key: 'email', label: 'E-mail' }, { key: 'platform', label: 'Plataforma' },
          { key: 'app_version', label: 'Versão' }, { key: 'current_module', label: 'Módulo' }, { key: 'status', label: 'Status' },
          { key: 'last_heartbeat_at', label: 'Último acesso', format: (r) => formatDateTime(r.last_heartbeat_at) },
        ],
      },
      {
        key: 'auditoria', label: 'Auditoria', count: (data.events || []).length, rows: data.events || [],
        columns: [
          { key: 'module', label: 'Módulo' }, { key: 'event_type', label: 'Evento' }, { key: 'entity_type', label: 'Tipo' },
          { key: 'entity_id', label: 'Entidade' }, { key: 'actor_name', label: 'Ator' }, { key: 'created_at', label: 'Quando', format: (r) => formatDateTime(r.created_at) },
        ],
      },
      {
        key: 'pendencias', label: 'Pendências', count: pendencias.length, rows: pendencias,
        columns: [
          { key: 'priority', label: 'Prioridade' }, { key: 'severity', label: 'Gravidade', format: (r) => severityMeta(r.severity).label },
          { key: 'module', label: 'Módulo' }, { key: 'title', label: 'Ocorrência' }, { key: 'responsible', label: 'Responsável' },
          { key: 'statusText', label: 'Status' },
        ],
      },
    ];
  }, [data]);

  const doExport = (item) => {
    if (!canExport) { toast.error('Sem permissão para exportar relatórios.'); return; }
    if (!item.rows.length) { toast.error(`Sem dados em "${item.label}".`); return; }
    exportCsv(item.rows, item.columns, item.key);
    toast.success(`${item.label} exportado.`);
  };

  const exportAll = () => {
    if (!canExport) { toast.error('Sem permissão para exportar relatórios.'); return; }
    const available = exportables.filter((e) => e.rows.length);
    if (!available.length) { toast.error('Nada para exportar.'); return; }
    available.forEach((item) => exportCsv(item.rows, item.columns, item.key));
    toast.success(`${available.length} bases exportadas.`);
  };

  const toggleCheck = (item) => {
    const next = { ...checklist, [item]: !checklist[item] };
    setChecklist(next);
    adminApi.saveSetting(SETTING_CHECKLIST, next).catch(() => toast.error('Falha ao salvar o checklist.'));
  };

  const checkedCount = CHECKLIST_ITEMS.filter((i) => checklist[i]).length;

  const togglePerm = (roleKey, permKey) => {
    setPermData((cur) => ({
      ...cur,
      matrix: { ...cur.matrix, [roleKey]: { ...cur.matrix[roleKey], [permKey]: !cur.matrix[roleKey]?.[permKey] } },
    }));
  };

  // Salva apenas as células alteradas (cada uma com motivo, via RPC com auditoria).
  const persistMatrix = async () => {
    const base = JSON.parse(baseline);
    const changes = [];
    for (const role of Object.keys(permData.matrix)) {
      for (const pk of Object.keys(permData.matrix[role])) {
        const now = Boolean(permData.matrix[role][pk]);
        const was = Boolean(base[role]?.[pk]);
        if (now !== was) changes.push({ role, pk, value: now });
      }
    }
    if (!changes.length) { toast.error('Nenhuma alteração para salvar.'); return; }
    if (!hasReason(permReason)) { toast.error(VALIDATION_MESSAGES.reason); return; }
    setSavingPerm(true);
    try {
      for (const c of changes) {
        await adminApi.setPermission(c.role, c.pk, c.value, permReason);
      }
      toast.success(`${changes.length} permissão(ões) atualizada(s).`);
      setPermReason('');
      refreshMatrix();
    } catch (error) {
      toast.error(error?.message || 'Não foi possível salvar as permissões.');
    } finally {
      setSavingPerm(false);
    }
  };

  return (
    <>
      <PanelSection
        title="Backup e exportação geral"
        subtitle="Exporte as bases operacionais para conferência externa e segurança"
        kicker="Administração"
        actions={<button type="button" className="primary-button" onClick={exportAll} disabled={!canExport} title="Exportar todas as bases">Exportar tudo</button>}
      >
        <div className="export-grid">
          {exportables.map((item) => (
            <button
              key={item.key}
              type="button"
              className="export-card"
              onClick={() => doExport(item)}
              disabled={!item.count || !canExport}
              title={`Exportar ${item.label}`}
            >
              <span className="export-card-label">{item.label}</span>
              <span className="export-card-count">{item.count}</span>
              <span className="export-card-cta">Exportar CSV</span>
            </button>
          ))}
        </div>
        {!canExport ? <p className="perm-note">Seu perfil não tem a permissão <code>can_export_reports</code>.</p> : null}
      </PanelSection>

      <PanelSection
        title={`Checklist de publicação (${checkedCount}/${CHECKLIST_ITEMS.length})`}
        subtitle="Verifique cada item técnico e operacional antes de subir para produção"
        kicker="Administração"
      >
        <div className="meta-bar" style={{ marginBottom: 14 }}>
          <span className={`meta-bar-fill ${checkedCount === CHECKLIST_ITEMS.length ? 'sev-fill-success' : 'sev-fill-warning'}`} style={{ width: `${Math.round((checkedCount / CHECKLIST_ITEMS.length) * 100)}%` }} />
        </div>
        <ul className="checklist">
          {CHECKLIST_ITEMS.map((item) => (
            <li key={item}>
              <label className="checklist-item">
                <input type="checkbox" checked={Boolean(checklist[item])} onChange={() => toggleCheck(item)} />
                <span className={checklist[item] ? 'is-done' : ''}>{item}</span>
              </label>
            </li>
          ))}
        </ul>
      </PanelSection>

      <PanelSection
        title="Permissões por ação"
        subtitle="Controle granular por papel — aplicado no banco (RLS) e auditado"
        kicker="Administração"
        actions={<button type="button" className="primary-button" onClick={persistMatrix} disabled={!canManageSettings || savingPerm} title="Salvar permissões">{savingPerm ? 'Salvando...' : 'Salvar permissões'}</button>}
      >
        <div className="table-shell">
          <table className="data-table perm-table">
            <thead>
              <tr>
                <th>Permissão</th>
                {permData.roles.map((role) => <th key={role.key} className="perm-role">{role.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {permData.permissions.map((perm) => (
                <tr key={perm.key}>
                  <td><strong>{perm.label}</strong><div className="cell-subtext">{perm.key}</div></td>
                  {permData.roles.map((role) => (
                    <td key={role.key} className="perm-cell">
                      <input
                        type="checkbox"
                        checked={Boolean(permData.matrix[role.key]?.[perm.key])}
                        disabled={role.key === 'admin' || !canManageSettings}
                        onChange={() => togglePerm(role.key, perm.key)}
                        aria-label={`${perm.label} para ${role.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="builder-field" style={{ marginTop: 14 }}>
          <span>Motivo da alteração (obrigatório para salvar)</span>
          <textarea
            value={permReason}
            onChange={(e) => setPermReason(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="Ex.: Supervisor passa a poder exportar relatórios a pedido da gerência"
            disabled={!canManageSettings}
          />
        </label>
        <p className="perm-note">
          O administrador mantém acesso total. As alterações são gravadas na matriz do banco
          (<code>perfis_permissoes</code>) via função com <code>SECURITY DEFINER</code> e registradas em
          <code> auditoria_alteracoes_permissao</code> (quem mudou, antes/depois, motivo).
          {canManageSettings ? null : ' Seu perfil não pode gerenciar configurações.'}
        </p>
      </PanelSection>
    </>
  );
};
