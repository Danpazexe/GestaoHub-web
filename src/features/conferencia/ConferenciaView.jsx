import { useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { useConfirm } from '../../hooks/useConfirm';
import { adminApi } from '../../services/adminApi';
import { toast } from '../../lib/toast';
import { exportCsv } from '../../lib/csv';
import { formatDateTime } from '../../lib/format';

const createPackagingDraft = () => ({
  id: crypto.randomUUID(),
  label: '',
  factor: '1',
  ean: '',
  dun: '',
});

const createItemDraft = () => ({
  id: crypto.randomUUID(),
  code: '',
  description: '',
  expected_qty: '1',
  unit: 'UN',
  ean: '',
  dun: '',
  packaging_options: [],
});

const sanitizeFactor = (value) => {
  const parsed = Number(value || 1);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return parsed;
};

const sanitizeQty = (value) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

export const ConferenciaView = ({
  conferenciaBonusQueue,
  conferenciaSaidas,
  onCreateManualBonus,
  assignableUsers,
  onRefresh,
}) => {
  const { confirm, ConfirmModalNode } = useConfirm();
  const [manualBuilderCollapsed, setManualBuilderCollapsed] = useState(false);
  const [manualHeader, setManualHeader] = useState({
    invoice_number: '',
    supplier_name: '',
    supplier_code: '',
    supplier_document: '',
  });
  const [manualItems, setManualItems] = useState([createItemDraft()]);
  const [manualState, setManualState] = useState({
    loading: false,
    error: '',
    success: '',
  });
  const [assignmentMap, setAssignmentMap] = useState({});

  const usersOptions = useMemo(
    () => (assignableUsers || []).map((user) => ({
      value: user.user_id,
      label: `${user.name || user.email || user.user_id}${user.role ? ` · ${user.role}` : ''}`,
    })),
    [assignableUsers],
  );

  const updateHeader = (key, value) => {
    setManualHeader((current) => ({ ...current, [key]: value }));
  };

  const updateItem = (itemId, key, value) => {
    setManualItems((current) => current.map((item) => (
      item.id === itemId ? { ...item, [key]: value } : item
    )));
  };

  const addItem = () => setManualItems((current) => [...current, createItemDraft()]);

  const removeItem = (itemId) => {
    setManualItems((current) => current.length > 1 ? current.filter((item) => item.id !== itemId) : current);
  };

  const addPackaging = (itemId) => {
    setManualItems((current) => current.map((item) => (
      item.id === itemId
        ? { ...item, packaging_options: [...item.packaging_options, createPackagingDraft()] }
        : item
    )));
  };

  const updatePackaging = (itemId, packagingId, key, value) => {
    setManualItems((current) => current.map((item) => (
      item.id === itemId
        ? {
            ...item,
            packaging_options: item.packaging_options.map((packaging) => (
              packaging.id === packagingId ? { ...packaging, [key]: value } : packaging
            )),
          }
        : item
    )));
  };

  const removePackaging = (itemId, packagingId) => {
    setManualItems((current) => current.map((item) => (
      item.id === itemId
        ? { ...item, packaging_options: item.packaging_options.filter((packaging) => packaging.id !== packagingId) }
        : item
    )));
  };

  const handleCreateManualBonus = async () => {
    setManualState({ loading: true, error: '', success: '' });

    try {
      const invoiceNumber = String(manualHeader.invoice_number || '').trim();
      const supplierName = String(manualHeader.supplier_name || '').trim();

      if (!invoiceNumber) throw new Error('Informe a NF do bônus.');
      if (!supplierName) throw new Error('Informe o fornecedor do bônus.');

      const payloadItems = manualItems.map((item, index) => {
        const baseLabel = String(item.unit || 'UN').trim() || 'UN';
        const basePackaging = {
          id: 'base',
          label: baseLabel,
          factor: 1,
          ean: String(item.ean || '').trim(),
          dun: String(item.dun || '').trim(),
        };

        const extraPackagings = (item.packaging_options || [])
          .map((packaging, packagingIndex) => ({
            id: packaging.id || `pkg-${packagingIndex + 1}`,
            label: String(packaging.label || '').trim(),
            factor: sanitizeFactor(packaging.factor),
            ean: String(packaging.ean || '').trim(),
            dun: String(packaging.dun || '').trim(),
          }))
          .filter((packaging) => packaging.label);

        return {
          line_number: index + 1,
          code: String(item.code || '').trim() || null,
          description: String(item.description || '').trim(),
          expected_qty: sanitizeQty(item.expected_qty),
          unit: baseLabel,
          ean: basePackaging.ean || null,
          dun: basePackaging.dun || null,
          packaging_options: [basePackaging, ...extraPackagings],
        };
      }).filter((item) => item.description);

      if (!payloadItems.length) {
        throw new Error('Adicione pelo menos um produto com descrição.');
      }

      await onCreateManualBonus(
        {
          invoice_number: invoiceNumber,
          supplier_name: supplierName,
          supplier_code: String(manualHeader.supplier_code || '').trim() || null,
          supplier_document: String(manualHeader.supplier_document || '').trim() || null,
        },
        payloadItems,
      );

      setManualHeader({
        invoice_number: '',
        supplier_name: '',
        supplier_code: '',
        supplier_document: '',
      });
      setManualItems([createItemDraft()]);
      setManualState({
        loading: false,
        error: '',
        success: `Bônus manual da NF ${invoiceNumber} enviado para o celular.`,
      });
      await onRefresh?.();
    } catch (error) {
      setManualState({
        loading: false,
        error: error?.message || 'Falha ao criar bônus manual.',
        success: '',
      });
    }
  };

  const assignResponsible = async (row) => {
    const userId = assignmentMap[row.id];
    if (!userId) {
      toast.error('Selecione um responsável antes de atribuir.');
      return;
    }

    const selectedUser = (assignableUsers || []).find((user) => user.user_id === userId);
    const assignedUserName = selectedUser?.name || selectedUser?.email || null;

    const loadingId = toast.loading('Atribuindo responsável...');
    try {
      await adminApi.assignConferenciaBonus(row.id, userId, assignedUserName);
      await onRefresh?.();
      toast.success('Responsável atribuído.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao atribuir responsável.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const removeQueue = async (row) => {
    const approved = await confirm({
      title: 'Remover bônus da fila?',
      description: `A NF ${row.invoice_number || '-'} será removida da fila de conferência.`,
      confirmLabel: 'Remover',
      danger: true,
    });

    if (!approved) return;

    const loadingId = toast.loading('Removendo bônus...');
    try {
      await adminApi.removeConferenciaBonus(row.id);
      await onRefresh?.();
      toast.success('Bônus removido da fila.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao remover o bônus.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  return (
    <>
      {ConfirmModalNode}
      <div className="content-grid">
        <PanelSection
          title="Criar bônus"
          subtitle="Monte o bônus com produtos e embalagens para enviar pronto ao app mobile"
          kicker="Conferência"
          actions={(
            <button
              className="table-action-button"
              type="button"
              onClick={() => setManualBuilderCollapsed((current) => !current)}
              title={manualBuilderCollapsed ? 'Expandir montador de bônus' : 'Recolher montador de bônus'}
            >
              {manualBuilderCollapsed ? 'Expandir' : 'Recolher'}
            </button>
          )}
        >
          {manualBuilderCollapsed ? (
            <div className="builder-collapsed-note" role="status">
              Montador de bônus recolhido.
            </div>
          ) : (
            <>
              <div className="bonus-builder-grid">
                <label className="builder-field">
                  <span>NF</span>
                  <input value={manualHeader.invoice_number} onChange={(event) => updateHeader('invoice_number', event.target.value)} placeholder="Número da NF" />
                </label>
                <label className="builder-field">
                  <span>Fornecedor</span>
                  <input value={manualHeader.supplier_name} onChange={(event) => updateHeader('supplier_name', event.target.value)} placeholder="Nome do fornecedor" />
                </label>
                <label className="builder-field">
                  <span>Código do fornecedor</span>
                  <input value={manualHeader.supplier_code} onChange={(event) => updateHeader('supplier_code', event.target.value)} placeholder="Opcional" />
                </label>
                <label className="builder-field">
                  <span>Documento</span>
                  <input value={manualHeader.supplier_document} onChange={(event) => updateHeader('supplier_document', event.target.value)} placeholder="CNPJ ou CPF" />
                </label>
              </div>

              <div className="builder-toolbar">
                <strong>Produtos do bônus</strong>
                <button className="table-action-button" type="button" onClick={addItem} title="Adicionar produto">
                  Adicionar produto
                </button>
              </div>

              <div className="bonus-items-list">
                {manualItems.map((item, index) => (
                  <div className="bonus-item-card" key={item.id}>
                    <div className="bonus-item-header">
                      <strong>Produto {index + 1}</strong>
                      {manualItems.length > 1 ? (
                        <button className="table-action-button is-danger" type="button" onClick={() => removeItem(item.id)} title="Remover produto">
                          Remover
                        </button>
                      ) : null}
                    </div>

                    <div className="bonus-builder-grid">
                      <label className="builder-field">
                        <span>Código</span>
                        <input value={item.code} onChange={(event) => updateItem(item.id, 'code', event.target.value)} placeholder="Código interno" />
                      </label>
                      <label className="builder-field builder-field-wide">
                        <span>Descrição</span>
                        <input value={item.description} onChange={(event) => updateItem(item.id, 'description', event.target.value)} placeholder="Descrição do produto" />
                      </label>
                      <label className="builder-field">
                        <span>Quantidade</span>
                        <input value={item.expected_qty} onChange={(event) => updateItem(item.id, 'expected_qty', event.target.value)} placeholder="0" inputMode="decimal" />
                      </label>
                      <label className="builder-field">
                        <span>Unidade base</span>
                        <input value={item.unit} onChange={(event) => updateItem(item.id, 'unit', event.target.value)} placeholder="UN" />
                      </label>
                      <label className="builder-field">
                        <span>EAN base</span>
                        <input value={item.ean} onChange={(event) => updateItem(item.id, 'ean', event.target.value)} placeholder="EAN" />
                      </label>
                      <label className="builder-field">
                        <span>DUN base</span>
                        <input value={item.dun} onChange={(event) => updateItem(item.id, 'dun', event.target.value)} placeholder="DUN" />
                      </label>
                    </div>

                    <div className="builder-toolbar">
                      <strong>Embalagens</strong>
                      <button className="table-action-button" type="button" onClick={() => addPackaging(item.id)} title="Adicionar embalagem">
                        Adicionar embalagem
                      </button>
                    </div>

                    <div className="packaging-list">
                      {item.packaging_options.length ? item.packaging_options.map((packaging) => (
                        <div className="packaging-card" key={packaging.id}>
                          <div className="bonus-builder-grid">
                            <label className="builder-field">
                              <span>Rótulo</span>
                              <input value={packaging.label} onChange={(event) => updatePackaging(item.id, packaging.id, 'label', event.target.value)} placeholder="CX, FD, PCT" />
                            </label>
                            <label className="builder-field">
                              <span>Fator</span>
                              <input value={packaging.factor} onChange={(event) => updatePackaging(item.id, packaging.id, 'factor', event.target.value)} placeholder="1" inputMode="decimal" />
                            </label>
                            <label className="builder-field">
                              <span>EAN</span>
                              <input value={packaging.ean} onChange={(event) => updatePackaging(item.id, packaging.id, 'ean', event.target.value)} placeholder="EAN" />
                            </label>
                            <label className="builder-field">
                              <span>DUN</span>
                              <input value={packaging.dun} onChange={(event) => updatePackaging(item.id, packaging.id, 'dun', event.target.value)} placeholder="DUN" />
                            </label>
                          </div>
                          <button className="table-action-button is-danger" type="button" onClick={() => removePackaging(item.id, packaging.id)} title="Remover embalagem">
                            Remover embalagem
                          </button>
                        </div>
                      )) : (
                        <div className="empty-state compact-empty">Sem embalagem adicional neste produto.</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {manualState.error ? <div className="feedback error" role="alert">{manualState.error}</div> : null}
              {manualState.success ? <div className="feedback success" role="status">{manualState.success}</div> : null}

              <div className="builder-footer">
                <button className="primary-button builder-submit" type="button" onClick={handleCreateManualBonus} disabled={manualState.loading} title="Criar bônus para o celular">
                  {manualState.loading ? 'Criando bônus...' : 'Criar bônus para o celular'}
                </button>
              </div>
            </>
          )}
        </PanelSection>

        <div className="content-grid two-columns">
          <PanelSection title="Fila de bônus" subtitle="NFs prontas para conferência no celular" kicker="Recebimento">
            <DataTable
              rows={conferenciaBonusQueue}
              searchable
              sortable
              pageSize={15}
              columns={[
                { key: 'invoice_number', label: 'NF' },
                { key: 'supplier_name', label: 'Fornecedor' },
                { key: 'item_count', label: 'Itens' },
                { key: 'total_quantity', label: 'Qtd total' },
                {
                  key: 'status',
                  label: 'Status',
                  render: (row) => <StatusBadge value={row.status} />,
                },
                {
                  key: 'assigned_user_name',
                  label: 'Responsável',
                  render: (row) => (
                    <div className="assignment-cell">
                      <select
                        value={assignmentMap[row.id] || row.assigned_user_id || ''}
                        onChange={(event) => setAssignmentMap((current) => ({ ...current, [row.id]: event.target.value }))}
                      >
                        <option value="">Selecionar</option>
                        {usersOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <button type="button" className="table-action-button" onClick={() => assignResponsible(row)} title="Atribuir responsável">
                        Atribuir
                      </button>
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Fila',
                  render: (row) => (
                    <button type="button" className="table-action-button is-danger" onClick={() => removeQueue(row)} title="Remover da fila">
                      Remover
                    </button>
                  ),
                },
              ]}
              emptyMessage="Nenhum bônus na fila."
            />
          </PanelSection>

          <PanelSection
            title="Conferências de saída"
            subtitle="Registros finalizados para análise e exportação"
            kicker="Saída"
            actions={(
              <button
                type="button"
                className="ghost-button"
                onClick={() => exportCsv(conferenciaSaidas, [
                  { key: 'order_code', label: 'Pedido' },
                  { key: 'separador', label: 'Separador' },
                  { key: 'embalador', label: 'Embalador' },
                  { key: 'items_count', label: 'Itens' },
                  { key: 'divergences_count', label: 'Divergências' },
                  { key: 'updated_at', label: 'Atualização', format: (row) => formatDateTime(row.updated_at) },
                ], 'conferencia-saida')}
                title="Exportar conferências de saída"
              >
                Exportar CSV
              </button>
            )}
          >
            <DataTable
              rows={conferenciaSaidas}
              searchable
              sortable
              pageSize={15}
              columns={[
                { key: 'order_code', label: 'Pedido' },
                { key: 'separador', label: 'Separador' },
                { key: 'embalador', label: 'Embalador' },
                { key: 'items_count', label: 'Itens' },
                {
                  key: 'divergences_count',
                  label: 'Divergências',
                  render: (row) => Number(row.divergences_count) > 0 ? <StatusBadge value="damaged" label={`${row.divergences_count} divergências`} /> : row.divergences_count,
                },
                { key: 'sync_status', label: 'Sync', render: (row) => <StatusBadge value={row.sync_status} /> },
                { key: 'updated_at', label: 'Atualização', render: (row) => formatDateTime(row.updated_at) },
              ]}
              emptyMessage="Sem conferências de saída no backend."
            />
          </PanelSection>
        </div>
      </div>
    </>
  );
};
