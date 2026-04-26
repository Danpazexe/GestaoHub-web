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

export const ValidadeView = ({ validade, onRefresh }) => {
  const { confirm, ConfirmModalNode } = useConfirm();
  const [statusValue, setStatusValue] = useState('');
  const [maxDays, setMaxDays] = useState('');
  const [treatmentState, setTreatmentState] = useState({
    row: null,
    treatment_type: 'recolhimento',
    observacao: '',
    loading: false,
  });

  const filteredBase = useMemo(() => {
    const daysLimit = Number(maxDays);
    return [...(validade || [])]
      .filter((row) => {
        if (statusValue && row.status !== statusValue) return false;
        if (maxDays && Number.isFinite(daysLimit) && Number(row.diasrestantes) > daysLimit) return false;
        return true;
      })
      .sort((left, right) => Number(left.diasrestantes) - Number(right.diasrestantes));
  }, [validade, statusValue, maxDays]);

  const { filtered, search, setSearch } = useTableFilter(filteredBase, {
    searchKeys: ['codprod', 'descricao', 'lote'],
    pageSize: 20,
  });

  const applyTreatment = async () => {
    if (!treatmentState.row) return;
    const loadingId = toast.loading('Aplicando tratativa...');
    setTreatmentState((current) => ({ ...current, loading: true }));
    try {
      await adminApi.applyValidadeTreatment(treatmentState.row.id, {
        treatment_type: treatmentState.treatment_type,
        observacao: treatmentState.observacao,
        status: 'treated',
      });
      await onRefresh?.();
      toast.success('Tratativa aplicada com sucesso.');
      setTreatmentState({
        row: null,
        treatment_type: 'recolhimento',
        observacao: '',
        loading: false,
      });
    } catch (error) {
      toast.error(error?.message || 'Falha ao aplicar tratativa.');
      setTreatmentState((current) => ({ ...current, loading: false }));
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const resolveItem = async (row) => {
    const approved = await confirm({
      title: 'Marcar item como resolvido?',
      description: `O item ${row.codprod || '-'} será marcado como resolvido.`,
      confirmLabel: 'Marcar como resolvido',
    });

    if (!approved) return;

    const loadingId = toast.loading('Atualizando item...');
    try {
      await adminApi.resolveValidadeItem(row.id);
      await onRefresh?.();
      toast.success('Item marcado como resolvido.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao atualizar o item.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  return (
    <>
      {ConfirmModalNode}
      <Drawer
        open={Boolean(treatmentState.row)}
        title={`Aplicar tratativa em ${treatmentState.row?.codprod || ''}`}
        onClose={() => setTreatmentState({
          row: null,
          treatment_type: 'recolhimento',
          observacao: '',
          loading: false,
        })}
      >
        <div className="form-stack">
          <label className="builder-field">
            <span>Tratativa</span>
            <select value={treatmentState.treatment_type} onChange={(event) => setTreatmentState((current) => ({ ...current, treatment_type: event.target.value }))}>
              <option value="recolhimento">recolhimento</option>
              <option value="descarte">descarte</option>
              <option value="promoção">promoção</option>
              <option value="devolução">devolução</option>
            </select>
          </label>
          <label className="builder-field">
            <span>Observação</span>
            <textarea value={treatmentState.observacao} onChange={(event) => setTreatmentState((current) => ({ ...current, observacao: event.target.value.slice(0, 300) }))} rows={4} placeholder="Observação opcional" />
          </label>
          <button type="button" className="primary-button button-inline" onClick={applyTreatment} disabled={treatmentState.loading} title="Aplicar tratativa">
            {treatmentState.loading ? 'Salvando...' : 'Aplicar tratativa'}
          </button>
        </div>
      </Drawer>

      <PanelSection
        title="Validade"
        subtitle="Lista operacional consolidada do módulo de validade"
        kicker="Rastreabilidade"
      >
        <div className="filter-bar">
          <SelectFilter
            value={statusValue}
            onChange={setStatusValue}
            placeholder="Todos os status"
            options={Array.from(new Set((validade || []).map((row) => row.status).filter(Boolean))).map((value) => ({ value, label: value }))}
          />
          <label className="numeric-filter">
            <span>Dias restantes ≤</span>
            <input value={maxDays} onChange={(event) => setMaxDays(event.target.value)} inputMode="numeric" placeholder="30" />
          </label>
          <div className="search-expand">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar produto" />
          </div>
        </div>

        <DataTable
          rows={filtered}
          pageSize={20}
          sortable
          rowClassName={(row) => {
            const days = Number(row.diasrestantes);
            if (days <= 7) return 'row-danger-soft';
            if (days <= 30) return 'row-warning-soft';
            return '';
          }}
          columns={[
            {
              key: 'user_name',
              label: 'Operador',
              render: (row) => row.user_name || row.user_email || '-',
            },
            { key: 'codprod', label: 'Código' },
            {
              key: 'descricao',
              label: 'Descrição',
              render: (row) => truncate(row.descricao, 52),
            },
            { key: 'lote', label: 'Lote' },
            { key: 'quantidade', label: 'Qtd' },
            {
              key: 'diasrestantes',
              label: 'Dias rest.',
              render: (row) => <span className={Number(row.diasrestantes) <= 7 ? 'days-critical' : Number(row.diasrestantes) <= 30 ? 'days-warning' : ''}>{row.diasrestantes}</span>,
            },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <StatusBadge value={row.status} />,
            },
            {
              key: 'treatment_type',
              label: 'Tratativa',
              render: (row) => row.treatment_type || '-',
            },
            {
              key: 'updated_at',
              label: 'Atualização',
              render: (row) => formatDateTime(row.updated_at),
            },
            {
              key: 'actions',
              label: 'Ações',
                  render: (row) => (
                <div className="table-actions-row">
                  <button type="button" className="table-action-button" onClick={() => setTreatmentState({
                    row,
                    treatment_type: row.treatment_type || 'recolhimento',
                    observacao: '',
                    loading: false,
                  })} title="Aplicar tratativa">
                    Tratar
                  </button>
                  <button type="button" className="table-action-button" onClick={() => resolveItem(row)} title="Marcar como resolvido">
                    Resolver
                  </button>
                </div>
              ),
            },
          ]}
          emptyMessage="Nenhum produto de validade encontrado."
        />
      </PanelSection>
    </>
  );
};
