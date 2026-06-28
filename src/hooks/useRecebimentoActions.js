import { useCallback, useState } from 'react';
import { adminApi } from '../services/adminApi';
import { parseNfeXml } from '../lib/nfeXml';

// Encapsula as ações de recebimento/conferência (importar XML, gerar bônus,
// criar/operar pedidos de compra) e seus estados de feedback. Depende do
// usuário admin e do loadDashboard para recarregar após cada ação.
export const useRecebimentoActions = (user, loadDashboard) => {
  const [xmlImportState, setXmlImportState] = useState({ loading: false, error: '', success: '', preview: null });
  const [recebimentoBonusState, setRecebimentoBonusState] = useState({ loadingId: '', error: '', success: '' });
  const [purchaseOrderState, setPurchaseOrderState] = useState({ loading: false, loadingId: '', error: '', success: '', preview: null });

  const importXml = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      setXmlImportState({ loading: false, error: 'Arquivo muito grande (máx. 5 MB).', success: '', preview: null });
      event.target.value = '';
      return;
    }
    setXmlImportState({ loading: true, error: '', success: '', preview: null });
    try {
      const parsed = parseNfeXml(await file.text());
      await adminApi.importConferenciaBonusFromXml(parsed, parsed.items, user.id);
      await loadDashboard();
      setXmlImportState({ loading: false, error: '', success: `NF ${parsed.invoice_number} importada para a fila de conferência.`, preview: parsed });
    } catch (importError) {
      setXmlImportState({ loading: false, error: importError?.message || 'Falha ao importar XML.', success: '', preview: null });
    } finally {
      event.target.value = '';
    }
  }, [user, loadDashboard]);

  const generateBonusFromRecebimento = useCallback(async (recebimentoRow) => {
    if (!user || !recebimentoRow) return;
    setRecebimentoBonusState({ loadingId: String(recebimentoRow.id || ''), error: '', success: '' });
    try {
      await adminApi.importConferenciaBonusFromRecebimento(recebimentoRow, user.id);
      await loadDashboard();
      setRecebimentoBonusState({ loadingId: '', error: '', success: `Bônus gerado a partir da NF ${recebimentoRow.invoice || '-'}.` });
    } catch (bonusError) {
      setRecebimentoBonusState({ loadingId: '', error: bonusError?.message || 'Falha ao gerar bônus pelo recebimento.', success: '' });
    }
  }, [user, loadDashboard]);

  const importPurchaseOrderXml = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      setPurchaseOrderState({ loading: false, loadingId: '', error: 'Arquivo muito grande (máx. 5 MB).', success: '', preview: null });
      event.target.value = '';
      return;
    }
    setPurchaseOrderState({ loading: true, loadingId: '', error: '', success: '', preview: null });
    try {
      const parsed = parseNfeXml(await file.text());
      await adminApi.createPurchaseOrderFromXml(parsed, user.id);
      await loadDashboard();
      setPurchaseOrderState({ loading: false, loadingId: '', error: '', success: `Pedido criado a partir da NF ${parsed.invoice_number}.`, preview: parsed });
    } catch (importError) {
      setPurchaseOrderState({ loading: false, loadingId: '', error: importError?.message || 'Falha ao criar pedido pelo XML.', success: '', preview: null });
    } finally {
      event.target.value = '';
    }
  }, [user, loadDashboard]);

  const createManualPurchaseOrder = useCallback(async (orderInput, items) => {
    if (!user) throw new Error('Sessão admin inválida.');
    setPurchaseOrderState((current) => ({ ...current, loading: true, error: '', success: '' }));
    try {
      await adminApi.createManualPurchaseOrder(orderInput, items, user.id);
      await loadDashboard();
      setPurchaseOrderState({ loading: false, loadingId: '', error: '', success: 'Pedido manual criado com sucesso.', preview: null });
    } catch (error) {
      setPurchaseOrderState({ loading: false, loadingId: '', error: error?.message || 'Falha ao criar pedido manual.', success: '', preview: null });
      throw error;
    }
  }, [user, loadDashboard]);

  const runPurchaseOrderAction = useCallback(async (orderId, actionType) => {
    if (!user || !orderId) return;
    setPurchaseOrderState((current) => ({ ...current, loadingId: orderId, error: '', success: '' }));
    try {
      if (actionType === 'entry') await adminApi.markPurchaseOrderEntry(orderId, user.id);
      else if (actionType === 'bonus') await adminApi.generateConferenciaBonusFromPurchaseOrder(orderId, user.id);
      else if (actionType === 'return') await adminApi.requestPurchaseOrderReturn(orderId, user.id);
      else if (actionType === 'reprint') await adminApi.registerPurchaseOrderReprint(orderId, user.id);
      else if (actionType === 'audit') await adminApi.auditPurchaseOrder(orderId, user.id);

      await loadDashboard();

      const successMap = {
        entry: 'Entrada registrada no pedido.',
        bonus: 'Bônus gerado a partir do pedido.',
        return: 'Devolução marcada no pedido.',
        reprint: 'Reimpressão registrada.',
        audit: 'Auditoria registrada.',
      };
      setPurchaseOrderState((current) => ({ ...current, loadingId: '', error: '', success: successMap[actionType] || 'Ação executada com sucesso.' }));
    } catch (error) {
      setPurchaseOrderState((current) => ({ ...current, loadingId: '', error: error?.message || 'Falha ao executar a ação do pedido.', success: '' }));
    }
  }, [user, loadDashboard]);

  const createManualBonus = useCallback(async (queueInput, items) => {
    if (!user) throw new Error('Sessão admin inválida.');
    await adminApi.createManualConferenciaBonus(queueInput, items, user.id);
    await loadDashboard();
  }, [user, loadDashboard]);

  const createManualSaidaBonus = useCallback(async (queueInput, items) => {
    if (!user) throw new Error('Sessão admin inválida.');
    await adminApi.createManualConferenciaSaidaBonus(queueInput, items, user.id);
    await loadDashboard();
  }, [user, loadDashboard]);

  return {
    xmlImportState,
    recebimentoBonusState,
    purchaseOrderState,
    importXml,
    generateBonusFromRecebimento,
    importPurchaseOrderXml,
    createManualPurchaseOrder,
    runPurchaseOrderAction,
    createManualBonus,
    createManualSaidaBonus,
  };
};
