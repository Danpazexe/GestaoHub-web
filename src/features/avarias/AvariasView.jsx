import { useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Drawer } from '../../components/Drawer';
import { SelectFilter } from '../../components/SelectFilter';
import { SearchInput } from '../../components/SearchInput';
import { useConfirm } from '../../hooks/useConfirm';
import { useTableFilter } from '../../hooks/useTableFilter';
import { adminApi } from '../../services/adminApi';
import { toast } from '../../lib/toast';
import { formatDateTime, truncate } from '../../lib/format';

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
  const {
    filtered,
    search,
    setSearch,
  } = useTableFilter(
    (avarias || []).filter((row) => {
      if (statusValue && row.item_status !== statusValue) return false;
      if (damageValue && row.damage_type !== damageValue) return false;
      return true;
    }),
    {
      searchKeys: ['descricao', 'codprod', 'damage_type', 'supplier'],
      pageSize: 20,
    },
  );

  const summary = useMemo(() => ({
    total: avarias?.length || 0,
    pending: (avarias || []).filter((item) => item.item_status === 'damaged').length,
    resolved: (avarias || []).filter((item) => item.item_status === 'resolved').length,
  }), [avarias]);

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
      setResolutionState({
        row: null,
        resolution_type: 'devolução',
        observacao: '',
        loading: false,
      });
    } catch (error) {
      toast.error(error?.message || 'Falha ao resolver a avaria.');
      setResolutionState((current) => ({ ...current, loading: false }));
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const deleteItem = async (row) => {
    const approved = await confirm({
      title: 'Excluir item de avaria?',
      description: `O item ${row.codprod || '-'} será removido do lote.`,
      confirmLabel: 'Excluir',
      danger: true,
    });

    if (!approved) return;

    const loadingId = toast.loading('Removendo item...');
    try {
      await adminApi.deleteAvariaItem(row.item_id);
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
        onClose={() => setResolutionState({
          row: null,
          resolution_type: 'devolução',
          observacao: '',
          loading: false,
        })}
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
        </div>
      </Drawer>

      <PanelSection
        title="Avarias"
        subtitle="Itens por lote com resolução operacional e rastreabilidade"
        kicker="Controle"
      >
        <div className="inline-summary-grid">
          <div className="inline-summary-card"><span>Total</span><strong>{summary.total}</strong></div>
          <div className="inline-summary-card"><span>Pendentes</span><strong>{summary.pending}</strong></div>
          <div className="inline-summary-card"><span>Resolvidos</span><strong>{summary.resolved}</strong></div>
        </div>

        <div className="filter-bar">
          <SelectFilter
            value={statusValue}
            onChange={setStatusValue}
            placeholder="Status do item"
            options={[
              { value: 'damaged', label: 'Damaged' },
              { value: 'resolved', label: 'Resolved' },
            ]}
          />
          <SelectFilter
            value={damageValue}
            onChange={setDamageValue}
            placeholder="Tipo de avaria"
            options={Array.from(new Set((avarias || []).map((row) => row.damage_type).filter(Boolean))).map((value) => ({ value, label: value }))}
          />
          <div className="search-expand">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar produto" />
          </div>
        </div>

        <DataTable
          rows={filtered}
          pageSize={20}
          sortable
          rowClassName={(row) => {
            if (row.item_status === 'damaged') return 'row-danger-soft';
            if (row.item_status === 'resolved') return 'row-dimmed';
            return '';
          }}
          columns={[
            { key: 'batch_id', label: 'Lote' },
            { key: 'supplier', label: 'Fornecedor', render: (row) => row.supplier || '-' },
            {
              key: 'user_name',
              label: 'Operador',
              render: (row) => row.user_name || row.user_email || '-',
            },
            {
              key: 'item_status',
              label: 'Status item',
              render: (row) => <StatusBadge value={row.item_status} />,
            },
            { key: 'codprod', label: 'Código' },
            {
              key: 'descricao',
              label: 'Descrição',
              render: (row) => truncate(row.descricao, 48),
            },
            { key: 'quantidade', label: 'Qtd' },
            { key: 'damage_type', label: 'Avaria' },
            { key: 'resolution_type', label: 'Resolução' },
            {
              key: 'item_updated_at',
              label: 'Atualização',
              render: (row) => formatDateTime(row.item_updated_at),
            },
            {
              key: 'actions',
              label: 'Ações',
                  render: (row) => (
                <div className="table-actions-row">
                  <button type="button" className="table-action-button" onClick={() => setResolutionState({
                    row,
                    resolution_type: row.resolution_type || 'devolução',
                    observacao: '',
                    loading: false,
                  })} title="Resolver item">
                    Resolver
                  </button>
                  <button type="button" className="table-action-button is-danger" onClick={() => deleteItem(row)} title="Excluir item">
                    Excluir
                  </button>
                </div>
              ),
            },
          ]}
          emptyMessage="Nenhum item de avaria sincronizado."
        />
      </PanelSection>
    </>
  );
};
