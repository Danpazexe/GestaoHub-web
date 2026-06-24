import { useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Drawer } from '../../components/Drawer';
import { useConfirm } from '../../hooks/useConfirm';
import { adminApi } from '../../services/adminApi';
import { toast } from '../../lib/toast';
import { exportCsv } from '../../lib/csv';
import { formatDateTime } from '../../lib/format';

const toNumber = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Lê o snapshot de conferência (esperado x conferido por item) gravado pelo app
// ao finalizar e deriva a porcentagem de conferência + divergências.
const computeConference = (row) => {
  const items = Array.isArray(row?.conference_result) ? row.conference_result : [];
  if (!items.length) {
    return {
      hasData: false,
      percent: null,
      expected: toNumber(row?.total_quantity),
      conferred: toNumber(row?.checked_quantity),
      divergences: toNumber(row?.divergence_count),
      items: [],
    };
  }

  const expected = items.reduce((sum, item) => sum + toNumber(item.expectedQty), 0);
  // Completude = quanto do esperado foi conferido (excesso não passa de 100%).
  const conferredCapped = items.reduce(
    (sum, item) => sum + Math.min(toNumber(item.checkedQty), toNumber(item.expectedQty)),
    0,
  );
  const conferred = items.reduce((sum, item) => sum + toNumber(item.checkedQty), 0);
  const divergences = items.filter((item) => toNumber(item.diff) !== 0).length;
  const percent = expected > 0 ? Math.round((conferredCapped / expected) * 100) : 100;

  return { hasData: true, percent, expected, conferred, divergences, items };
};

const percentTone = (percent) => {
  if (percent === null) return 'neutral';
  if (percent >= 100) return 'ok';
  if (percent >= 70) return 'warn';
  return 'danger';
};

// Progresso ao vivo de um bônus em aberto (quanto do esperado já foi conferido).
const openProgressPercent = (row) => {
  const total = toNumber(row?.total_quantity);
  const checked = toNumber(row?.checked_quantity);
  if (total <= 0) return checked > 0 ? 100 : 0;
  return Math.min(100, Math.round((checked / total) * 100));
};

const ConferenceProgress = ({ row }) => {
  if (row.status === 'nao_iniciado' && toNumber(row.checked_quantity) === 0) {
    return <span className="conf-progress-empty">Aguardando</span>;
  }
  const pct = openProgressPercent(row);
  return (
    <div className="conf-progress" title={`${toNumber(row.checked_quantity)} de ${toNumber(row.total_quantity)} conferidos`}>
      <div className="conf-progress-track">
        <div className={`conf-progress-fill${pct >= 100 ? ' is-ok' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="conf-progress-label">{pct}%</span>
    </div>
  );
};

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
  conferenciaSaidaBonusQueue,
  conferenciaSaidas,
  conferenciaDivergencias = [],
  onCreateManualBonus,
  onCreateManualSaidaBonus,
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
  const [detailRow, setDetailRow] = useState(null);

  // Montador de bônus de SAÍDA (pedido + itens) — fila separada da de entrada.
  const [saidaBuilderCollapsed, setSaidaBuilderCollapsed] = useState(false);
  const [saidaHeader, setSaidaHeader] = useState({ order_code: '', customer_name: '', route_code: '' });
  const [saidaItems, setSaidaItems] = useState([createItemDraft()]);
  const [saidaState, setSaidaState] = useState({ loading: false, error: '', success: '' });

  const detail = useMemo(
    () => (detailRow ? { row: detailRow, ...computeConference(detailRow) } : null),
    [detailRow],
  );

  const usersOptions = useMemo(
    () => (assignableUsers || []).map((user) => ({
      value: user.user_id,
      label: `${user.name || user.email || user.user_id}${user.role ? ` · ${user.role}` : ''}`,
    })),
    [assignableUsers],
  );

  // Separa a fila: "em aberto" (ainda conferíveis no celular) x "finalizados"
  // (já conferidos) — antes ficavam misturados na mesma "Fila de bônus".
  const openBonusQueue = useMemo(
    () => (conferenciaBonusQueue || []).filter(
      (row) => row.status === 'nao_iniciado' || row.status === 'em_conferencia',
    ),
    [conferenciaBonusQueue],
  );
  const finishedBonusQueue = useMemo(
    () => (conferenciaBonusQueue || []).filter((row) => row.status === 'finalizada'),
    [conferenciaBonusQueue],
  );

  const openSaidaQueue = useMemo(
    () => (conferenciaSaidaBonusQueue || []).filter(
      (row) => row.status === 'nao_iniciado' || row.status === 'em_conferencia',
    ),
    [conferenciaSaidaBonusQueue],
  );
  const finishedSaidaQueue = useMemo(
    () => (conferenciaSaidaBonusQueue || []).filter((row) => row.status === 'finalizada'),
    [conferenciaSaidaBonusQueue],
  );

  const updateSaidaHeader = (key, value) => setSaidaHeader((current) => ({ ...current, [key]: value }));
  const updateSaidaItem = (itemId, key, value) => setSaidaItems((current) => current.map((item) => (
    item.id === itemId ? { ...item, [key]: value } : item
  )));
  const addSaidaItem = () => setSaidaItems((current) => [...current, createItemDraft()]);
  const removeSaidaItem = (itemId) => setSaidaItems((current) => current.length > 1 ? current.filter((item) => item.id !== itemId) : current);

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

  const reopenBonus = async (row) => {
    const approved = await confirm({
      title: 'Reabrir bônus?',
      description: `A NF ${row.invoice_number || '-'} voltará para a fila e reaparecerá para o conferente conferir novamente no app.`,
      confirmLabel: 'Reabrir',
    });

    if (!approved) return;

    const loadingId = toast.loading('Reabrindo bônus...');
    try {
      await adminApi.reopenConferenciaBonus(row.id);
      await onRefresh?.();
      toast.success('Bônus reaberto e enviado de volta para a fila.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao reabrir o bônus.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const giveEntry = async (row) => {
    const approved = await confirm({
      title: 'Dar entrada no bônus?',
      description: `A NF ${row.invoice_number || '-'} será encerrada (entrada realizada) e sairá da lista de finalizados.`,
      confirmLabel: 'Dar entrada',
    });

    if (!approved) return;

    const loadingId = toast.loading('Dando entrada...');
    try {
      await adminApi.markConferenciaBonusEntry(row.id);
      await onRefresh?.();
      toast.success('Entrada registrada. Bônus encerrado.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao dar entrada no bônus.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const finishWithPendency = async (row) => {
    const approved = await confirm({
      title: 'Finalizar com pendência?',
      description: `A NF ${row.invoice_number || '-'} será marcada como finalizada mesmo sem conferência completa. As divergências/pendências ficam registradas para análise.`,
      confirmLabel: 'Finalizar com pendência',
      danger: true,
    });

    if (!approved) return;

    const loadingId = toast.loading('Finalizando bônus...');
    try {
      await adminApi.finishConferenciaBonusWithPendency(row.id);
      await onRefresh?.();
      toast.success('Bônus finalizado com pendência.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao finalizar o bônus.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  // ── Handlers do bônus de SAÍDA ──
  const handleCreateManualSaidaBonus = async () => {
    setSaidaState({ loading: true, error: '', success: '' });
    try {
      const orderCode = String(saidaHeader.order_code || '').trim();
      if (!orderCode) throw new Error('Informe o código do pedido de saída.');

      const payloadItems = saidaItems.map((item, index) => {
        const baseLabel = String(item.unit || 'UN').trim() || 'UN';
        const basePackaging = {
          id: 'base',
          label: baseLabel,
          factor: 1,
          ean: String(item.ean || '').trim(),
          dun: String(item.dun || '').trim(),
        };
        return {
          line_number: index + 1,
          code: String(item.code || '').trim() || null,
          description: String(item.description || '').trim(),
          expected_qty: sanitizeQty(item.expected_qty),
          unit: baseLabel,
          ean: basePackaging.ean || null,
          dun: basePackaging.dun || null,
          packaging_options: [basePackaging],
        };
      }).filter((item) => item.description);

      if (!payloadItems.length) throw new Error('Adicione pelo menos um produto com descrição.');

      await onCreateManualSaidaBonus(
        {
          order_code: orderCode,
          customer_name: String(saidaHeader.customer_name || '').trim() || null,
          route_code: String(saidaHeader.route_code || '').trim() || null,
        },
        payloadItems,
      );

      setSaidaHeader({ order_code: '', customer_name: '', route_code: '' });
      setSaidaItems([createItemDraft()]);
      setSaidaState({ loading: false, error: '', success: `Bônus de saída do pedido ${orderCode} enviado para o celular.` });
      await onRefresh?.();
    } catch (error) {
      setSaidaState({ loading: false, error: error?.message || 'Falha ao criar bônus de saída.', success: '' });
    }
  };

  const assignSaidaResponsible = async (row) => {
    const userId = assignmentMap[row.id];
    if (!userId) {
      toast.error('Selecione um responsável antes de atribuir.');
      return;
    }
    const selectedUser = (assignableUsers || []).find((user) => user.user_id === userId);
    const assignedUserName = selectedUser?.name || selectedUser?.email || null;
    const loadingId = toast.loading('Atribuindo responsável...');
    try {
      await adminApi.assignConferenciaSaidaBonus(row.id, userId, assignedUserName);
      await onRefresh?.();
      toast.success('Responsável atribuído.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao atribuir responsável.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const removeSaidaQueue = async (row) => {
    const approved = await confirm({
      title: 'Remover bônus de saída?',
      description: `O pedido ${row.order_code || '-'} será removido da fila de saída.`,
      confirmLabel: 'Remover',
      danger: true,
    });
    if (!approved) return;
    const loadingId = toast.loading('Removendo bônus...');
    try {
      await adminApi.removeConferenciaSaidaBonus(row.id);
      await onRefresh?.();
      toast.success('Bônus de saída removido da fila.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao remover o bônus.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const reopenSaidaBonus = async (row) => {
    const approved = await confirm({
      title: 'Reabrir bônus de saída?',
      description: `O pedido ${row.order_code || '-'} voltará para a fila e reaparecerá para o conferente.`,
      confirmLabel: 'Reabrir',
    });
    if (!approved) return;
    const loadingId = toast.loading('Reabrindo bônus...');
    try {
      await adminApi.reopenConferenciaSaidaBonus(row.id);
      await onRefresh?.();
      toast.success('Bônus de saída reaberto.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao reabrir o bônus.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const giveSaidaExit = async (row) => {
    const approved = await confirm({
      title: 'Dar saída no pedido?',
      description: `O pedido ${row.order_code || '-'} será encerrado (saída realizada) e sairá da lista de finalizados.`,
      confirmLabel: 'Dar saída',
    });
    if (!approved) return;
    const loadingId = toast.loading('Dando saída...');
    try {
      await adminApi.markConferenciaSaidaBonusExit(row.id);
      await onRefresh?.();
      toast.success('Saída registrada. Pedido encerrado.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao dar saída no pedido.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const finishSaidaWithPendency = async (row) => {
    const approved = await confirm({
      title: 'Finalizar com pendência?',
      description: `O pedido ${row.order_code || '-'} será finalizado mesmo sem conferência completa. As divergências ficam registradas.`,
      confirmLabel: 'Finalizar com pendência',
      danger: true,
    });
    if (!approved) return;
    const loadingId = toast.loading('Finalizando bônus...');
    try {
      await adminApi.finishConferenciaSaidaBonusWithPendency(row.id);
      await onRefresh?.();
      toast.success('Bônus de saída finalizado com pendência.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao finalizar o bônus.');
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

        <PanelSection
          title="Criar bônus de saída"
          subtitle="Monte o pedido de saída (código bipavel + produtos) para o conferente bipar e conferir no app"
          kicker="Saída"
          actions={(
            <button
              className="table-action-button"
              type="button"
              onClick={() => setSaidaBuilderCollapsed((current) => !current)}
              title={saidaBuilderCollapsed ? 'Expandir montador de saída' : 'Recolher montador de saída'}
            >
              {saidaBuilderCollapsed ? 'Expandir' : 'Recolher'}
            </button>
          )}
        >
          {saidaBuilderCollapsed ? (
            <div className="builder-collapsed-note" role="status">Montador de saída recolhido.</div>
          ) : (
            <>
              <div className="bonus-builder-grid">
                <label className="builder-field">
                  <span>Pedido (código bipavel)</span>
                  <input value={saidaHeader.order_code} onChange={(event) => updateSaidaHeader('order_code', event.target.value)} placeholder="Ex.: PED-123 / QR / código de barras" />
                </label>
                <label className="builder-field">
                  <span>Cliente / destino</span>
                  <input value={saidaHeader.customer_name} onChange={(event) => updateSaidaHeader('customer_name', event.target.value)} placeholder="Opcional" />
                </label>
                <label className="builder-field">
                  <span>Rota</span>
                  <input value={saidaHeader.route_code} onChange={(event) => updateSaidaHeader('route_code', event.target.value)} placeholder="Opcional" />
                </label>
              </div>

              <div className="builder-toolbar">
                <strong>Produtos do pedido</strong>
                <button className="table-action-button" type="button" onClick={addSaidaItem} title="Adicionar produto">Adicionar produto</button>
              </div>

              <div className="bonus-items-list">
                {saidaItems.map((item, index) => (
                  <div className="bonus-item-card" key={item.id}>
                    <div className="bonus-item-header">
                      <strong>Produto {index + 1}</strong>
                      {saidaItems.length > 1 ? (
                        <button className="table-action-button is-danger" type="button" onClick={() => removeSaidaItem(item.id)} title="Remover produto">Remover</button>
                      ) : null}
                    </div>
                    <div className="bonus-builder-grid">
                      <label className="builder-field">
                        <span>Código</span>
                        <input value={item.code} onChange={(event) => updateSaidaItem(item.id, 'code', event.target.value)} placeholder="Código interno" />
                      </label>
                      <label className="builder-field builder-field-wide">
                        <span>Descrição</span>
                        <input value={item.description} onChange={(event) => updateSaidaItem(item.id, 'description', event.target.value)} placeholder="Descrição do produto" />
                      </label>
                      <label className="builder-field">
                        <span>Quantidade</span>
                        <input value={item.expected_qty} onChange={(event) => updateSaidaItem(item.id, 'expected_qty', event.target.value)} placeholder="0" inputMode="decimal" />
                      </label>
                      <label className="builder-field">
                        <span>Unidade</span>
                        <input value={item.unit} onChange={(event) => updateSaidaItem(item.id, 'unit', event.target.value)} placeholder="UN" />
                      </label>
                      <label className="builder-field">
                        <span>EAN</span>
                        <input value={item.ean} onChange={(event) => updateSaidaItem(item.id, 'ean', event.target.value)} placeholder="EAN para bipagem" />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {saidaState.error ? <div className="feedback error" role="alert">{saidaState.error}</div> : null}
              {saidaState.success ? <div className="feedback success" role="status">{saidaState.success}</div> : null}

              <div className="builder-footer">
                <button className="primary-button builder-submit" type="button" onClick={handleCreateManualSaidaBonus} disabled={saidaState.loading} title="Criar bônus de saída para o celular">
                  {saidaState.loading ? 'Criando bônus...' : 'Criar bônus de saída'}
                </button>
              </div>
            </>
          )}
        </PanelSection>

        <div className="content-grid two-columns">
          <PanelSection title={`Bônus em aberto (${openBonusQueue.length})`} subtitle="NFs aguardando conferência no celular" kicker="Recebimento">
            <DataTable
              rows={openBonusQueue}
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
                    <div className="table-actions-row">
                      <button type="button" className="table-action-button" onClick={() => finishWithPendency(row)} title="Finalizar mesmo com pendência">
                        Finalizar c/ pendência
                      </button>
                      <button type="button" className="table-action-button is-danger" onClick={() => removeQueue(row)} title="Remover da fila">
                        Remover
                      </button>
                    </div>
                  ),
                },
              ]}
              emptyMessage="Nenhum bônus em aberto."
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

        <PanelSection
          title={`Bônus finalizados (${finishedBonusQueue.length})`}
          subtitle="NFs já conferidas no celular"
          kicker="Recebimento"
        >
          <DataTable
            rows={finishedBonusQueue}
            searchable
            sortable
            pageSize={10}
            columns={[
              { key: 'invoice_number', label: 'NF' },
              { key: 'supplier_name', label: 'Fornecedor' },
              { key: 'item_count', label: 'Itens' },
              {
                key: 'conference',
                label: 'Conferência',
                render: (row) => {
                  const summary = computeConference(row);
                  if (!summary.hasData) {
                    return <span className="conference-pill is-neutral" title="Sem detalhamento de conferência (finalizado pelo painel)">sem dados</span>;
                  }
                  return (
                    <span className={`conference-pill is-${percentTone(summary.percent)}`} title={`${summary.conferred} conferidos de ${summary.expected} esperados`}>
                      {summary.percent}%
                      {summary.divergences > 0 ? <em> · {summary.divergences} div.</em> : null}
                    </span>
                  );
                },
              },
              { key: 'assigned_user_name', label: 'Conferente', render: (row) => row.assigned_user_name || '—' },
              { key: 'finished_at', label: 'Finalizado em', render: (row) => formatDateTime(row.finished_at) },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              {
                key: 'actions',
                label: 'Fila',
                render: (row) => (
                  <div className="table-actions-row">
                    <button type="button" className="table-action-button" onClick={() => setDetailRow(row)} title="Ver itens e divergências da conferência">
                      Detalhes
                    </button>
                    <button type="button" className="table-action-button" onClick={() => giveEntry(row)} title="Dar entrada e encerrar o bônus">
                      Dar entrada
                    </button>
                    <button type="button" className="table-action-button" onClick={() => reopenBonus(row)} title="Reabrir e enviar de volta ao conferente">
                      Reabrir
                    </button>
                    <button type="button" className="table-action-button is-danger" onClick={() => removeQueue(row)} title="Remover da fila">
                      Remover
                    </button>
                  </div>
                ),
              },
            ]}
            emptyMessage="Nenhum bônus finalizado."
          />
        </PanelSection>

        <div className="content-grid two-columns">
          <PanelSection title={`Saída em aberto (${openSaidaQueue.length})`} subtitle="Pedidos aguardando conferência de saída no celular" kicker="Saída">
            <DataTable
              rows={openSaidaQueue}
              searchable
              sortable
              pageSize={15}
              columns={[
                { key: 'order_code', label: 'Pedido' },
                { key: 'customer_name', label: 'Cliente', render: (row) => row.customer_name || '—' },
                { key: 'item_count', label: 'Itens' },
                { key: 'progress', label: 'Progresso', render: (row) => <ConferenceProgress row={row} /> },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
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
                      <button type="button" className="table-action-button" onClick={() => assignSaidaResponsible(row)} title="Atribuir responsável">Atribuir</button>
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Fila',
                  render: (row) => (
                    <div className="table-actions-row">
                      <button type="button" className="table-action-button" onClick={() => finishSaidaWithPendency(row)} title="Finalizar mesmo com pendência">Finalizar c/ pendência</button>
                      <button type="button" className="table-action-button is-danger" onClick={() => removeSaidaQueue(row)} title="Remover da fila">Remover</button>
                    </div>
                  ),
                },
              ]}
              emptyMessage="Nenhum pedido de saída em aberto."
            />
          </PanelSection>

          <PanelSection title={`Saída finalizados (${finishedSaidaQueue.length})`} subtitle="Pedidos já conferidos no celular" kicker="Saída">
            <DataTable
              rows={finishedSaidaQueue}
              searchable
              sortable
              pageSize={15}
              columns={[
                { key: 'order_code', label: 'Pedido' },
                { key: 'customer_name', label: 'Cliente', render: (row) => row.customer_name || '—' },
                {
                  key: 'conference',
                  label: 'Conferência',
                  render: (row) => {
                    const summary = computeConference(row);
                    if (!summary.hasData) {
                      return <span className="conference-pill is-neutral" title="Sem detalhamento (finalizado pelo painel)">sem dados</span>;
                    }
                    return (
                      <span className={`conference-pill is-${percentTone(summary.percent)}`} title={`${summary.conferred} conferidos de ${summary.expected} esperados`}>
                        {summary.percent}%
                        {summary.divergences > 0 ? <em> · {summary.divergences} div.</em> : null}
                      </span>
                    );
                  },
                },
                { key: 'assigned_user_name', label: 'Conferente', render: (row) => row.assigned_user_name || '—' },
                { key: 'finished_at', label: 'Finalizado em', render: (row) => formatDateTime(row.finished_at) },
                {
                  key: 'actions',
                  label: 'Fila',
                  render: (row) => (
                    <div className="table-actions-row">
                      <button type="button" className="table-action-button" onClick={() => setDetailRow(row)} title="Ver itens e divergências">Detalhes</button>
                      <button type="button" className="table-action-button" onClick={() => giveSaidaExit(row)} title="Dar saída e encerrar o pedido">Dar saída</button>
                      <button type="button" className="table-action-button" onClick={() => reopenSaidaBonus(row)} title="Reabrir e enviar de volta ao conferente">Reabrir</button>
                      <button type="button" className="table-action-button is-danger" onClick={() => removeSaidaQueue(row)} title="Remover da fila">Remover</button>
                    </div>
                  ),
                },
              ]}
              emptyMessage="Nenhum pedido de saída finalizado."
            />
          </PanelSection>

          <PanelSection
            title={`Divergências (${(conferenciaDivergencias || []).length})`}
            subtitle="Itens conferidos com quantidade diferente da esperada (recebimento e saída)"
            kicker="Conferência"
            actions={(conferenciaDivergencias || []).length > 0 ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => exportCsv(conferenciaDivergencias, [
                  { key: 'source', label: 'Origem' },
                  { key: 'code', label: 'Código' },
                  { key: 'description', label: 'Descrição' },
                  { key: 'expected_qty', label: 'Esperado' },
                  { key: 'checked_qty', label: 'Conferido' },
                  { key: 'diff', label: 'Diferença' },
                  { key: 'status', label: 'Status' },
                  { key: 'user_name', label: 'Operador' },
                  { key: 'created_at', label: 'Data', format: (row) => formatDateTime(row.created_at) },
                ], 'divergencias')}
                title="Exportar divergências"
              >
                Exportar CSV
              </button>
            ) : null}
          >
            <DataTable
              rows={conferenciaDivergencias || []}
              searchable
              sortable
              pageSize={15}
              columns={[
                { key: 'source', label: 'Origem', render: (row) => (row.source === 'saida' ? 'Saída' : 'Recebimento') },
                { key: 'code', label: 'Código', render: (row) => row.code || '—' },
                { key: 'description', label: 'Descrição', render: (row) => (row.description || '').slice(0, 48) || '—' },
                { key: 'reference', label: 'Referência', render: (row) => row.order_code || row.invoice || row.supplier || '—' },
                { key: 'expected_qty', label: 'Esperado' },
                { key: 'checked_qty', label: 'Conferido' },
                {
                  key: 'diff',
                  label: 'Diferença',
                  render: (row) => (
                    <strong className={Number(row.diff) < 0 ? 'days-critical' : 'days-warning'}>
                      {Number(row.diff) > 0 ? '+' : ''}{row.diff}
                    </strong>
                  ),
                },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status || 'pendente'} /> },
                { key: 'user_name', label: 'Operador', render: (row) => row.user_name || row.user_email || '—' },
                { key: 'created_at', label: 'Registrada', render: (row) => formatDateTime(row.created_at) },
              ]}
              emptyMessage="Nenhuma divergência registrada."
            />
          </PanelSection>
        </div>
      </div>

      <Drawer
        open={!!detail}
        onClose={() => setDetailRow(null)}
        title={detail ? `Conferência · ${detail.row.order_code ? `Pedido ${detail.row.order_code}` : `NF ${detail.row.invoice_number || '-'}`}` : 'Conferência'}
        width={560}
      >
        {detail ? (
          <div className="conference-detail">
            <div className="conference-detail-head">
              <div>
                <strong>{detail.row.supplier_name || detail.row.customer_name || (detail.row.order_code ? 'Pedido de saída' : 'Fornecedor não informado')}</strong>
                <span className="conference-detail-sub">
                  Conferente: {detail.row.assigned_user_name || '—'}
                  {detail.row.finished_at ? ` · ${formatDateTime(detail.row.finished_at)}` : ''}
                </span>
              </div>
              {detail.hasData ? (
                <span className={`conference-pill is-${percentTone(detail.percent)} is-lg`}>{detail.percent}%</span>
              ) : null}
            </div>

            {detail.row.finalized_with_pendency ? (
              <div className="feedback error" role="status">Finalizado com pendência pelo painel.</div>
            ) : null}

            <div className="conference-metrics">
              <div className="conference-metric">
                <span className="conference-metric-value">{detail.expected}</span>
                <span className="conference-metric-label">Esperado</span>
              </div>
              <div className="conference-metric">
                <span className="conference-metric-value">{detail.conferred}</span>
                <span className="conference-metric-label">Conferido</span>
              </div>
              <div className="conference-metric">
                <span className={`conference-metric-value ${detail.divergences > 0 ? 'is-danger' : ''}`}>{detail.divergences}</span>
                <span className="conference-metric-label">Divergências</span>
              </div>
            </div>

            {detail.hasData ? (
              <table className="conference-items">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="num">Esp.</th>
                    <th className="num">Conf.</th>
                    <th className="num">Dif.</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item, index) => {
                    const diff = toNumber(item.diff);
                    const tone = diff === 0 ? 'ok' : diff > 0 ? 'warn' : 'danger';
                    return (
                      <tr key={`${item.code || 'item'}-${index}`} className={diff !== 0 ? 'is-divergent' : ''}>
                        <td>
                          <div className="conference-item-code">{item.code || '—'}{item.packagingLabel ? ` · ${item.packagingLabel}` : ''}</div>
                          <div className="conference-item-desc">{item.description || '—'}</div>
                        </td>
                        <td className="num">{toNumber(item.expectedQty)}</td>
                        <td className="num">{toNumber(item.checkedQty)}</td>
                        <td className={`num conference-diff is-${tone}`}>{diff > 0 ? `+${diff}` : diff}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="empty-state compact-empty">
                Este bônus não tem detalhamento item a item (finalizado pelo painel ou conferido em versão anterior do app).
              </div>
            )}
          </div>
        ) : null}
      </Drawer>
    </>
  );
};
