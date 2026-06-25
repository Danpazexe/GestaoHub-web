import { useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { Drawer } from '../../components/Drawer';
import { ResourceTable } from '../../components/ResourceTable';
import { useConfirm } from '../../hooks/useConfirm';
import { adminApi } from '../../services/adminApi';
import { toast } from '../../lib/toast';
import { formatDateTime } from '../../lib/format';

const STATUS_OPTIONS = [
  { value: 'ABERTA', label: 'Aberta' },
  { value: 'EM ANDAMENTO', label: 'Em andamento' },
  { value: 'AGUARDANDO', label: 'Aguardando' },
  { value: 'ENCERRADA', label: 'Encerrada' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

export const TratativasView = ({ tratativas, onRefresh }) => {
  const { confirm, ConfirmModalNode } = useConfirm();
  const [statusValue, setStatusValue] = useState('');
  const [detailRow, setDetailRow] = useState(null);

  const updateStatus = async (row, status, danger = false) => {
    const approved = await confirm({
      title: status === 'ENCERRADA' ? 'Encerrar tratativa?' : 'Cancelar tratativa?',
      description: `O status do documento ${row.doc_number || '-'} será alterado para ${status}.`,
      confirmLabel: status === 'ENCERRADA' ? 'Encerrar' : 'Cancelar',
      danger,
    });

    if (!approved) return;

    const loadingId = toast.loading('Atualizando tratativa...');
    try {
      await adminApi.updateTratativa(row.id, { status });
      await onRefresh?.();
      toast.success(status === 'ENCERRADA' ? 'Tratativa encerrada com sucesso.' : 'Tratativa cancelada.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao atualizar a tratativa.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  return (
    <>
      {ConfirmModalNode}
      <Drawer
        open={Boolean(detailRow)}
        title={`Detalhes da tratativa ${detailRow?.doc_number || ''}`}
        onClose={() => setDetailRow(null)}
      >
        {detailRow ? (
          <div className="detail-grid">
            {[
              ['Documento', detailRow.doc_number],
              ['Operador', detailRow.user_name || detailRow.user_email],
              ['Fornecedor', detailRow.supplier_code],
              ['NF origem', detailRow.origin_invoice_number],
              ['Status', detailRow.status],
              ['Ocorrência', detailRow.occurrence_type],
              ['Resolução', detailRow.resolution_type],
              ['Criado em', formatDateTime(detailRow.created_at)],
              ['Atualizado em', formatDateTime(detailRow.updated_at)],
            ].map(([label, value]) => (
              <div key={label} className="detail-card">
                <span>{label}</span>
                <strong>{value || '-'}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </Drawer>

      <ResourceTable
        title="Tratativas"
        subtitle="Rastreio de espelhos de recebimento e ocorrências"
        kicker="Operação"
        rows={tratativas || []}
        searchKeys={['doc_number', 'supplier_code', 'origin_invoice_number', 'user_name']}
        searchPlaceholder="Buscar por documento ou fornecedor"
        filters={[
          { key: 'status', value: statusValue, onChange: setStatusValue, placeholder: 'Todos os status', options: STATUS_OPTIONS },
        ]}
        rowClassName={(row) => {
          if (row.status === 'ABERTA') return 'row-warning-soft';
          if (row.status === 'EM ANDAMENTO') return 'row-info-soft';
          return '';
        }}
        emptyMessage="Nenhuma tratativa encontrada."
        columns={[
          { key: 'doc_number', label: 'Documento TR' },
          { key: 'user_name', label: 'Operador', render: (row) => row.user_name || row.user_email || '-' },
          { key: 'supplier_code', label: 'Fornecedor' },
          { key: 'origin_invoice_number', label: 'NF origem' },
          { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
          { key: 'occurrence_type', label: 'Ocorrência' },
          { key: 'updated_at', label: 'Atualização', render: (row) => formatDateTime(row.updated_at) },
          {
            key: 'actions',
            label: 'Ações',
            render: (row) => (
              <div className="table-actions-row">
                {(row.status === 'ABERTA' || row.status === 'EM ANDAMENTO') ? (
                  <button type="button" className="table-action-button" onClick={() => updateStatus(row, 'ENCERRADA')} title="Encerrar tratativa">
                    Encerrar
                  </button>
                ) : null}
                {(row.status !== 'ENCERRADA' && row.status !== 'CANCELADA') ? (
                  <button type="button" className="table-action-button is-danger" onClick={() => updateStatus(row, 'CANCELADA', true)} title="Cancelar tratativa">
                    Cancelar
                  </button>
                ) : null}
                <button type="button" className="table-action-button" onClick={() => setDetailRow(row)} title="Ver detalhes">
                  Detalhes
                </button>
              </div>
            ),
          },
        ]}
      />
    </>
  );
};
