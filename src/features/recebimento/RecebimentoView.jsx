import { useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { formatDateTime } from '../../lib/format';

const createManualOrderItem = () => ({
  id: crypto.randomUUID(),
  code: '',
  description: '',
  expected_qty: '1',
  unit: 'UN',
  ean: '',
  dun: '',
});

export const RecebimentoView = ({
  purchaseOrders,
  conferenciaRecebimentos,
  xmlImportState,
  purchaseOrderState,
  recebimentoBonusState,
  onImportXml,
  onImportPurchaseOrderXml,
  onCreateManualPurchaseOrder,
  onRunPurchaseOrderAction,
  onGenerateBonusFromRecebimento,
}) => {
  const [manualHeader, setManualHeader] = useState({
    invoice_number: '',
    supplier_name: '',
    supplier_code: '',
    supplier_document: '',
  });
  const [manualItems, setManualItems] = useState([createManualOrderItem()]);

  // Pedidos concluídos (encerrado/cancelado) saem da lista de ativos — ficam só
  // no histórico/auditoria. Encerramos um pedido ao "dar entrada" no bônus dele.
  const activePurchaseOrders = useMemo(
    () => (purchaseOrders || []).filter(
      (row) => row.status !== 'encerrado' && row.status !== 'cancelado',
    ),
    [purchaseOrders],
  );

  const receivingSummary = useMemo(() => ({
    pedidos: activePurchaseOrders.length,
    entradas: activePurchaseOrders.filter((row) => row.entry_status === 'realizada').length,
    bonus: activePurchaseOrders.filter((row) => row.bonus_status === 'gerado').length,
  }), [activePurchaseOrders]);

  const updateHeader = (key, value) => {
    setManualHeader((current) => ({ ...current, [key]: value }));
  };

  const updateItem = (itemId, key, value) => {
    setManualItems((current) => current.map((item) => (
      item.id === itemId ? { ...item, [key]: value } : item
    )));
  };

  const addItem = () => {
    setManualItems((current) => [...current, createManualOrderItem()]);
  };

  const removeItem = (itemId) => {
    setManualItems((current) => (
      current.length > 1 ? current.filter((item) => item.id !== itemId) : current
    ));
  };

  const handleCreateManualOrder = async () => {
    try {
      const invoiceNumber = String(manualHeader.invoice_number || '').trim();
      const supplierName = String(manualHeader.supplier_name || '').trim();
      const normalizedItems = manualItems
        .map((item, index) => ({
          line_number: index + 1,
          code: String(item.code || '').trim() || null,
          description: String(item.description || '').trim(),
          expected_qty: Number(item.expected_qty || 0),
          unit: String(item.unit || 'UN').trim() || 'UN',
          ean: String(item.ean || '').trim() || null,
          dun: String(item.dun || '').trim() || null,
          packaging_options: [],
        }))
        .filter((item) => item.description);

      if (!invoiceNumber) {
        throw new Error('Informe a NF do pedido manual.');
      }

      if (!supplierName) {
        throw new Error('Informe o fornecedor do pedido manual.');
      }

      if (!normalizedItems.length) {
        throw new Error('Adicione ao menos um item ao pedido manual.');
      }

      await onCreateManualPurchaseOrder(
        {
          invoice_number: invoiceNumber,
          supplier_name: supplierName,
          supplier_code: String(manualHeader.supplier_code || '').trim() || null,
          supplier_document: String(manualHeader.supplier_document || '').trim() || null,
        },
        normalizedItems,
      );

      setManualHeader({
        invoice_number: '',
        supplier_name: '',
        supplier_code: '',
        supplier_document: '',
      });
      setManualItems([createManualOrderItem()]);
    } catch {
      // O estado de feedback vem do container pai.
    }
  };

  return (
    <div className="content-grid">
      <PanelSection
        title="Recebimento de notas"
        subtitle="Fluxo operacional completo para pedido, entrada, bônus, devolução, reimpressão e auditoria"
        kicker="Operação"
      >
        <div className="inline-summary-grid">
          <div className="inline-summary-card">
            <span>Pedidos</span>
            <strong>{receivingSummary.pedidos}</strong>
          </div>
          <div className="inline-summary-card">
            <span>Entradas</span>
            <strong>{receivingSummary.entradas}</strong>
          </div>
          <div className="inline-summary-card">
            <span>Bônus gerados</span>
            <strong>{receivingSummary.bonus}</strong>
          </div>
        </div>

        <div className="content-grid two-columns">
          <div className="xml-import-card">
            <div className="builder-toolbar">
              <strong>Gerar pedido por XML</strong>
            </div>
            <div className="inline-actions">
              <label className="upload-field">
                <input
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={onImportPurchaseOrderXml}
                  disabled={purchaseOrderState.loading}
                />
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>{purchaseOrderState.loading ? 'Criando pedido...' : 'Criar pedido por XML'}</span>
              </label>
              <label className="upload-field">
                <input
                  type="file"
                  accept=".xml,text/xml,application/xml"
                  onChange={onImportXml}
                  disabled={xmlImportState.loading}
                />
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>{xmlImportState.loading ? 'Importando...' : 'Enviar XML direto para bônus'}</span>
              </label>
            </div>

            {purchaseOrderState.error ? <div className="feedback error" role="alert">{purchaseOrderState.error}</div> : null}
            {purchaseOrderState.success ? <div className="feedback success" role="status">{purchaseOrderState.success}</div> : null}
            {xmlImportState.error ? <div className="feedback error" role="alert">{xmlImportState.error}</div> : null}
            {xmlImportState.success ? <div className="feedback success" role="status">{xmlImportState.success}</div> : null}

            {purchaseOrderState.preview ? (
              <div className="xml-preview">
                <strong>Prévia do pedido criado</strong>
                <span>NF: {purchaseOrderState.preview.invoice_number}</span>
                <span>Fornecedor: {purchaseOrderState.preview.supplier_name}</span>
                <span>Itens: {purchaseOrderState.preview.item_count}</span>
                <span>Quantidade total: {purchaseOrderState.preview.total_quantity}</span>
              </div>
            ) : null}
          </div>

          <div className="xml-import-card">
            <div className="builder-toolbar">
              <strong>Criar pedido manual</strong>
              <button className="table-action-button" type="button" onClick={addItem}>
                Adicionar item
              </button>
            </div>

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

            <div className="bonus-items-list">
              {manualItems.map((item, index) => (
                <div className="bonus-item-card" key={item.id}>
                  <div className="bonus-item-header">
                    <strong>Item {index + 1}</strong>
                    {manualItems.length > 1 ? (
                      <button className="table-action-button is-danger" type="button" onClick={() => removeItem(item.id)}>
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
                      <input value={item.description} onChange={(event) => updateItem(item.id, 'description', event.target.value)} placeholder="Descrição do item" />
                    </label>
                    <label className="builder-field">
                      <span>Quantidade</span>
                      <input value={item.expected_qty} onChange={(event) => updateItem(item.id, 'expected_qty', event.target.value)} placeholder="0" inputMode="decimal" />
                    </label>
                    <label className="builder-field">
                      <span>Unidade</span>
                      <input value={item.unit} onChange={(event) => updateItem(item.id, 'unit', event.target.value)} placeholder="UN" />
                    </label>
                    <label className="builder-field">
                      <span>EAN</span>
                      <input value={item.ean} onChange={(event) => updateItem(item.id, 'ean', event.target.value)} placeholder="EAN" />
                    </label>
                    <label className="builder-field">
                      <span>DUN</span>
                      <input value={item.dun} onChange={(event) => updateItem(item.id, 'dun', event.target.value)} placeholder="DUN" />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="builder-footer">
              <button className="primary-button builder-submit" type="button" onClick={handleCreateManualOrder} disabled={purchaseOrderState.loading}>
                {purchaseOrderState.loading ? 'Criando pedido...' : 'Criar pedido manual'}
              </button>
            </div>
          </div>
        </div>
      </PanelSection>

      <PanelSection
        title="Pedidos de compra"
        subtitle="Fluxo de pedidos para entrada, bônus, devolução e auditoria"
        kicker="Recebimento"
      >
          <DataTable
            rows={activePurchaseOrders}
            searchable
            sortable
            pageSize={12}
            columns={[
              { key: 'order_number', label: 'Pedido' },
              { key: 'invoice_number', label: 'NF' },
              { key: 'supplier_name', label: 'Fornecedor' },
              { key: 'item_count', label: 'Itens' },
              { key: 'total_quantity', label: 'Qtd total' },
              { key: 'entry_status', label: 'Entrada', render: (row) => <StatusBadge value={row.entry_status} /> },
              { key: 'bonus_status', label: 'Bônus', render: (row) => <StatusBadge value={row.bonus_status} /> },
              { key: 'return_status', label: 'Devolução', render: (row) => <StatusBadge value={row.return_status} /> },
              { key: 'audit_status', label: 'Auditoria', render: (row) => <StatusBadge value={row.audit_status} /> },
              {
                key: 'workflow',
                label: 'Ações',
                render: (row) => (
                  <div className="table-actions-row">
                    <button className="table-action-button" type="button" onClick={() => onRunPurchaseOrderAction(row.id, 'entry')} disabled={purchaseOrderState.loadingId === row.id}>
                      Entrada
                    </button>
                    <button className="table-action-button" type="button" onClick={() => onRunPurchaseOrderAction(row.id, 'bonus')} disabled={purchaseOrderState.loadingId === row.id}>
                      Bônus
                    </button>
                    <button className="table-action-button" type="button" onClick={() => onRunPurchaseOrderAction(row.id, 'return')} disabled={purchaseOrderState.loadingId === row.id}>
                      Devolução
                    </button>
                    <button className="table-action-button" type="button" onClick={() => onRunPurchaseOrderAction(row.id, 'reprint')} disabled={purchaseOrderState.loadingId === row.id}>
                      Reimprimir
                    </button>
                    <button className="table-action-button" type="button" onClick={() => onRunPurchaseOrderAction(row.id, 'audit')} disabled={purchaseOrderState.loadingId === row.id}>
                      Auditar
                    </button>
                  </div>
                ),
              },
            ]}
            emptyMessage="Nenhum pedido de compra criado ainda."
          />
        </PanelSection>

      <PanelSection
        title="Recebimentos do app"
        subtitle="NFs já registradas pelo app, com ação adicional para gerar bônus se necessário"
        kicker="Histórico"
      >
        {recebimentoBonusState.error ? <div className="feedback error" role="alert">{recebimentoBonusState.error}</div> : null}
        {recebimentoBonusState.success ? <div className="feedback success" role="status">{recebimentoBonusState.success}</div> : null}

        <DataTable
          rows={conferenciaRecebimentos}
          columns={[
            { key: 'supplier', label: 'Fornecedor' },
            { key: 'invoice', label: 'NF' },
            { key: 'conferente', label: 'Conferente' },
            { key: 'items_count', label: 'Itens' },
            { key: 'divergences_count', label: 'Divergências' },
            { key: 'sync_status', label: 'Sync', render: (row) => <StatusBadge value={row.sync_status} /> },
            { key: 'updated_at', label: 'Atualização', render: (row) => formatDateTime(row.updated_at) },
            {
              key: 'actions',
              label: 'Bônus',
              render: (row) => (
                <button
                  className="table-action-button"
                  type="button"
                  onClick={() => onGenerateBonusFromRecebimento(row)}
                  disabled={recebimentoBonusState.loadingId === row.id}
                >
                  {recebimentoBonusState.loadingId === row.id ? 'Gerando...' : 'Gerar bônus'}
                </button>
              ),
            },
          ]}
          emptyMessage="Sem conferências de recebimento no backend."
        />
      </PanelSection>
    </div>
  );
};
