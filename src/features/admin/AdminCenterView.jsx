import { useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { exportCsv } from '../../lib/csv';
import { toast } from '../../lib/toast';
import { formatDateTime } from '../../lib/format';
import { buildPendencias } from '../../lib/pendencias';
import { severityMeta } from '../../lib/severity';
import { PERMISSIONS, ROLES, loadMatrix, saveMatrix } from '../../lib/permissions';

const CHECKLIST_KEY = 'gh-checklist-v1';

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

const loadChecklist = () => {
  try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || '{}'); } catch { return {}; }
};

export const AdminCenterView = (data) => {
  const [checklist, setChecklist] = useState(loadChecklist);
  const [matrix, setMatrix] = useState(() => loadMatrix());

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
    if (!item.rows.length) { toast.error(`Sem dados em "${item.label}".`); return; }
    exportCsv(item.rows, item.columns, item.key);
    toast.success(`${item.label} exportado.`);
  };

  const exportAll = () => {
    const available = exportables.filter((e) => e.rows.length);
    if (!available.length) { toast.error('Nada para exportar.'); return; }
    available.forEach((item) => exportCsv(item.rows, item.columns, item.key));
    toast.success(`${available.length} bases exportadas.`);
  };

  const toggleCheck = (item) => {
    setChecklist((cur) => {
      const next = { ...cur, [item]: !cur[item] };
      try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const checkedCount = CHECKLIST_ITEMS.filter((i) => checklist[i]).length;

  const togglePerm = (role, perm) => {
    setMatrix((cur) => ({ ...cur, [role]: { ...cur[role], [perm]: !cur[role][perm] } }));
  };

  const persistMatrix = () => {
    if (saveMatrix(matrix)) toast.success('Permissões salvas.');
    else toast.error('Não foi possível salvar as permissões.');
  };

  return (
    <>
      <PanelSection
        title="Backup e exportação geral"
        subtitle="Exporte as bases operacionais para conferência externa e segurança"
        kicker="Administração"
        actions={<button type="button" className="primary-button" onClick={exportAll} title="Exportar todas as bases">Exportar tudo</button>}
      >
        <div className="export-grid">
          {exportables.map((item) => (
            <button
              key={item.key}
              type="button"
              className="export-card"
              onClick={() => doExport(item)}
              disabled={!item.count}
              title={`Exportar ${item.label}`}
            >
              <span className="export-card-label">{item.label}</span>
              <span className="export-card-count">{item.count}</span>
              <span className="export-card-cta">Exportar CSV</span>
            </button>
          ))}
        </div>
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
        subtitle="Controle granular por papel — não dependa apenas do cargo (governança base)"
        kicker="Administração"
        actions={<button type="button" className="primary-button" onClick={persistMatrix} title="Salvar permissões">Salvar permissões</button>}
      >
        <div className="table-shell">
          <table className="data-table perm-table">
            <thead>
              <tr>
                <th>Permissão</th>
                {ROLES.map((role) => <th key={role.key} className="perm-role">{role.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((perm) => (
                <tr key={perm.key}>
                  <td><strong>{perm.label}</strong><div className="cell-subtext">{perm.key}</div></td>
                  {ROLES.map((role) => (
                    <td key={role.key} className="perm-cell">
                      <input
                        type="checkbox"
                        checked={Boolean(matrix[role.key]?.[perm.key])}
                        disabled={role.key === 'admin'}
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
        <p className="perm-note">O administrador mantém acesso total. Estas permissões formam a base de governança usada pela interface; o reforço definitivo deve ser aplicado também no backend (políticas/RLS do Supabase).</p>
      </PanelSection>
    </>
  );
};
