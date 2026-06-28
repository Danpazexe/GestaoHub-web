import { useMemo, useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { Drawer } from '../../components/Drawer';
import { ResourceTable } from '../../components/ResourceTable';
import { useConfirm } from '../../hooks/useConfirm';
import { Attachments } from '../../components/Attachments';
import { adminApi } from '../../services/adminApi';
import { toast } from '../../lib/toast';
import { formatDateTime, truncate } from '../../lib/format';

const STATUS_OPTIONS = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'resolved', label: 'Resolved' },
];

export const AvariasView = ({ avarias, onRefresh }) => {
  const { confirm, ConfirmModalNode } = useConfirm();
  const [statusValue, setStatusValue] = useState('');
  const [damageValue, setDamageValue] = useState('');
  const [resolutionState, setResolutionState] = useState({
    row: null,
    resolution_type: 'devolução',
    observacao: '',
    loading: false,
  });

  const summary = useMemo(() => ({
    total: avarias?.length || 0,
    pending: (avarias || []).filter((item) => item.item_status === 'damaged').length,
    resolved: (avarias || []).filter((item) => item.item_status === 'resolved').length,
  }), [avarias]);

  const damageOptions = useMemo(
    () => Array.from(new Set((avarias || []).map((row) => row.damage_type).filter(Boolean))).map((value) => ({ value, label: value })),
    [avarias],
  );

  const resolveItem = async () => {
    if (!resolutionState.row) return;
    const loadingId = toast.loading('Resolvendo item...');
    setResolutionState((current) => ({ ...current, loading: true }));
    try {
      await adminApi.resolveAvariaItem(resolutionState.row.item_id, {
        item_status: 'resolved',
        resolution_type: resolutionState.resolution_type,
        observacao: resolutionState.observacao,
      });
      await onRefresh?.();
      toast.success('Item resolvido com sucesso.');
      setResolutionState({ row: null, resolution_type: 'devolução', observacao: '', loading: false });
    } catch (error) {
      toast.error(error?.message || 'Falha ao resolver a avaria.');
      setResolutionState((current) => ({ ...current, loading: false }));
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const deleteItem = async (row) => {
    // Motivo obrigatório (§25) — confirm devolve a string do motivo.
    const reason = await confirm({
      title: 'Excluir item de avaria?',
      description: `O item ${row.codprod || '-'} será removido do lote.`,
      confirmLabel: 'Excluir',
      danger: true,
      requireReason: true,
      reasonLabel: 'Motivo da exclusão (obrigatório)',
    });

    if (!reason) return;

    const loadingId = toast.loading('Removendo item...');
    try {
      await adminApi.deleteAvariaItem(row.item_id);
      // Auditoria de escrita (§18) — best-effort, não bloqueia a ação.
      adminApi.logOperationalEvent({
        module: 'avarias',
        eventType: 'item_excluido',
        entityType: 'avaria_item',
        entityId: String(row.item_id),
        payload: { codprod: row.codprod || null, motivo: reason },
      });
      await onRefresh?.();
      toast.success('Item removido.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao remover o item.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  return (
    <>
      {ConfirmModalNode}
      <Drawer
        open={Boolean(resolutionState.row)}
        title={`Resolver item ${resolutionState.row?.codprod || ''}`}
        onClose={() => setResolutionState({ row: null, resolution_type: 'devolução', observacao: '', loading: false })}
      >
        <div className="form-stack">
          <label className="builder-field">
            <span>Resolução</span>
            <select value={resolutionState.resolution_type} onChange={(event) => setResolutionState((current) => ({ ...current, resolution_type: event.target.value }))}>
              <option value="devolução">devolução</option>
              <option value="descarte">descarte</option>
              <option value="reclassificação">reclassificação</option>
              <option value="reposição">reposição</option>
            </select>
          </label>
          <label className="builder-field">
            <span>Observação</span>
            <textarea value={resolutionState.observacao} onChange={(event) => setResolutionState((current) => ({ ...current, observacao: event.target.value.slice(0, 300) }))} rows={4} placeholder="Observação opcional" />
          </label>
          <button type="button" className="primary-button button-inline" onClick={resolveItem} disabled={resolutionState.loading} title="Confirmar resolução">
            {resolutionState.loading ? 'Salvando...' : 'Confirmar resolução'}
          </button>
          <Attachments documentType="avaria_item" documentId={resolutionState.row?.item_id} title="Comprovantes" />
        </div>
      </Drawer>

      <ResourceTable
        title="Avarias"
        subtitle="Itens por lote com resolução operacional e rastreabilidade"
        kicker="Controle"
        rows={avarias || []}
        searchKeys={['descricao', 'codprod', 'damage_type', 'supplier']}
        searchPlaceholder="Buscar produto"
        filters={[
          { key: 'item_status', value: statusValue, onChange: setStatusValue, placeholder: 'Status do item', options: STATUS_OPTIONS },
          { key: 'damage_type', value: damageValue, onChange: setDamageValue, placeholder: 'Tipo de avaria', options: damageOptions },
        ]}
        rowClassName={(row) => {
          if (row.item_status === 'damaged') return 'row-danger-soft';
          if (row.item_status === 'resolved') return 'row-dimmed';
          return '';
        }}
        emptyMessage="Nenhum item de avaria sincronizado."
        columns={[
          { key: 'batch_id', label: 'Lote' },
          { key: 'supplier', label: 'Fornecedor', render: (row) => row.supplier || '-' },
          { key: 'user_name', label: 'Operador', render: (row) => row.user_name || row.user_email || '-' },
          { key: 'item_status', label: 'Status item', render: (row) => <StatusBadge value={row.item_status} /> },
          { key: 'codprod', label: 'Código' },
          { key: 'descricao', label: 'Descrição', render: (row) => truncate(row.descricao, 48) },
          { key: 'quantidade', label: 'Qtd' },
          { key: 'damage_type', label: 'Avaria' },
          { key: 'resolution_type', label: 'Resolução' },
          { key: 'item_updated_at', label: 'Atualização', render: (row) => formatDateTime(row.item_updated_at) },
          {
            key: 'actions',
            label: 'Ações',
            render: (row) => (
              <div className="table-actions-row">
                <button type="button" className="table-action-button" onClick={() => setResolutionState({ row, resolution_type: row.resolution_type || 'devolução', observacao: '', loading: false })} title="Resolver item">
                  Resolver
                </button>
                <button type="button" className="table-action-button is-danger" onClick={() => deleteItem(row)} title="Excluir item">
                  Excluir
                </button>
              </div>
            ),
          },
        ]}
      >
        <div className="inline-summary-grid">
          <div className="inline-summary-card"><span>Total</span><strong>{summary.total}</strong></div>
          <div className="inline-summary-card"><span>Pendentes</span><strong>{summary.pending}</strong></div>
          <div className="inline-summary-card"><span>Resolvidos</span><strong>{summary.resolved}</strong></div>
        </div>
      </ResourceTable>
    </>
  );
};
