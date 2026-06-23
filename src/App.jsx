import { useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { useAdminSession } from './hooks/useAdminSession';
import { LoginForm } from './components/LoginForm';
import { AdminShell } from './components/AdminShell';
import { adminApi } from './services/adminApi';
import { formatDateTime } from './lib/format';
import { parseNfeXml } from './lib/nfeXml';
import { DashboardView } from './features/dashboard/DashboardView';
import { OverviewView } from './features/overview/OverviewView';
import { UsersView } from './features/users/UsersView';
import { TratativasView } from './features/tratativas/TratativasView';
import { RecebimentoView } from './features/recebimento/RecebimentoView';
import { ConferenciaView } from './features/conferencia/ConferenciaView';
import { AvariasView } from './features/avarias/AvariasView';
import { ValidadeView } from './features/validade/ValidadeView';
import { EventsView } from './features/events/EventsView';

// Plano FREE do Supabase: o painel recarrega ~12 chamadas por ciclo, então
// espaçamos para 3 min (antes 45s) para economizar requisições. O botão
// "Atualizar" continua disponível para refresh sob demanda.
const REFRESH_INTERVAL_MS = 180000;

const initialDataState = {
  loading: true,
  error: '',
  summary: null,
  activeUsers: [],
  assignableUsers: [],
  purchaseOrders: [],
  purchaseOrderActions: [],
  tratativas: [],
  validade: [],
  avarias: [],
  conferenciaRecebimentos: [],
  conferenciaSaidas: [],
  conferenciaBonusQueue: [],
  events: [],
  lastRefresh: '',
};

function App() {
  const { loading, user, profile, admin, error, reload } = useAdminSession();
  const [selectedView, setSelectedView] = useState('dashboard');
  const [dataState, setDataState] = useState(initialDataState);
  const [xmlImportState, setXmlImportState] = useState({
    loading: false,
    error: '',
    success: '',
    preview: null,
  });
  const [recebimentoBonusState, setRecebimentoBonusState] = useState({
    loadingId: '',
    error: '',
    success: '',
  });
  const [purchaseOrderState, setPurchaseOrderState] = useState({
    loading: false,
    loadingId: '',
    error: '',
    success: '',
    preview: null,
  });

  const loadDashboard = useCallback(async () => {
    if (!user || !admin) {
      return;
    }

    setDataState((current) => ({
      ...current,
      loading: true,
      error: '',
    }));

    try {
      const [
        summary,
        activeUsers,
        assignableUsers,
        purchaseOrders,
        purchaseOrderActions,
        tratativas,
        validade,
        avarias,
        conferenciaRecebimentos,
        conferenciaSaidas,
        conferenciaBonusQueue,
        events,
      ] = await Promise.all([
        adminApi.getDashboardSummary(),
        adminApi.getActiveUsers(),
        adminApi.getAssignableUsers(),
        adminApi.getPurchaseOrders(),
        adminApi.getPurchaseOrderActions(),
        adminApi.getTratativas(),
        adminApi.getValidade(),
        adminApi.getAvarias(),
        adminApi.getConferenciaRecebimentos(),
        adminApi.getConferenciaSaidas(),
        adminApi.getConferenciaBonusQueue(),
        adminApi.getEvents(),
      ]);

      setDataState({
        loading: false,
        error: '',
        summary,
        activeUsers,
        assignableUsers,
        purchaseOrders,
        purchaseOrderActions,
        tratativas,
        validade,
        avarias,
        conferenciaRecebimentos,
        conferenciaSaidas,
        conferenciaBonusQueue,
        events,
        lastRefresh: formatDateTime(new Date().toISOString()),
      });
    } catch (loadError) {
      setDataState((current) => ({
        ...current,
        loading: false,
        error: loadError?.message || 'Falha ao carregar o painel.',
      }));
    }
  }, [user, admin]);

  useEffect(() => {
    if (!user || !admin) {
      setDataState(initialDataState);
      return;
    }

    loadDashboard();
    const timer = window.setInterval(loadDashboard, REFRESH_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [user, admin, loadDashboard]);

  const signOut = async () => {
    await adminApi.signOut();
  };

  const summaryCards = useMemo(() => {
    const summary = dataState.summary || {};
    return [
      {
        label: 'Usuários ativos',
        value: summary.active_users,
        accent: 'linear-gradient(135deg, #ff7a18 0%, #ffb800 100%)',
        note: 'Baseado em `user_presence`.',
      },
      {
        label: 'Tratativas abertas',
        value: summary.open_tratativas,
        accent: 'linear-gradient(135deg, #e74c3c 0%, #ff8f70 100%)',
        note: 'ABERTA, EM ANDAMENTO e AGUARDANDO.',
      },
      {
        label: 'Avarias abertas',
        value: summary.open_avaria_items,
        accent: 'linear-gradient(135deg, #00796b 0%, #32b39a 100%)',
        note: 'Itens com status `damaged`.',
      },
      {
        label: 'Divergências pendentes',
        value: summary.pending_divergencias,
        accent: 'linear-gradient(135deg, #3957ff 0%, #7da2ff 100%)',
        note: 'Lidas da tabela de divergências.',
      },
      {
        label: 'Bônus na fila',
        value: summary.open_bonus_queue,
        accent: 'linear-gradient(135deg, #1c7c54 0%, #88d498 100%)',
        note: 'Notas importadas para recebimento.',
      },
    ];
  }, [dataState.summary]);

  const importXml = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      return;
    }

    setXmlImportState({
      loading: true,
      error: '',
      success: '',
      preview: null,
    });

    try {
      const xmlText = await file.text();
      const parsed = parseNfeXml(xmlText);

      await adminApi.importConferenciaBonusFromXml(parsed, parsed.items, user.id);
      await loadDashboard();

      setXmlImportState({
        loading: false,
        error: '',
        success: `NF ${parsed.invoice_number} importada para a fila de conferência.`,
        preview: parsed,
      });
    } catch (importError) {
      setXmlImportState({
        loading: false,
        error: importError?.message || 'Falha ao importar XML.',
        success: '',
        preview: null,
      });
    } finally {
      event.target.value = '';
    }
  }, [user, loadDashboard]);

  const generateBonusFromRecebimento = useCallback(async (recebimentoRow) => {
    if (!user || !recebimentoRow) {
      return;
    }

    setRecebimentoBonusState({
      loadingId: String(recebimentoRow.id || ''),
      error: '',
      success: '',
    });

    try {
      await adminApi.importConferenciaBonusFromRecebimento(recebimentoRow, user.id);
      await loadDashboard();

      setRecebimentoBonusState({
        loadingId: '',
        error: '',
        success: `Bônus gerado a partir da NF ${recebimentoRow.invoice || '-'}.`,
      });
    } catch (bonusError) {
      setRecebimentoBonusState({
        loadingId: '',
        error: bonusError?.message || 'Falha ao gerar bônus pelo recebimento.',
        success: '',
      });
    }
  }, [user, loadDashboard]);

  const importPurchaseOrderXml = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      return;
    }

    setPurchaseOrderState({
      loading: true,
      loadingId: '',
      error: '',
      success: '',
      preview: null,
    });

    try {
      const xmlText = await file.text();
      const parsed = parseNfeXml(xmlText);

      await adminApi.createPurchaseOrderFromXml(parsed, user.id);
      await loadDashboard();

      setPurchaseOrderState({
        loading: false,
        loadingId: '',
        error: '',
        success: `Pedido criado a partir da NF ${parsed.invoice_number}.`,
        preview: parsed,
      });
    } catch (importError) {
      setPurchaseOrderState({
        loading: false,
        loadingId: '',
        error: importError?.message || 'Falha ao criar pedido pelo XML.',
        success: '',
        preview: null,
      });
    } finally {
      event.target.value = '';
    }
  }, [user, loadDashboard]);

  const createManualPurchaseOrder = useCallback(async (orderInput, items) => {
    if (!user) {
      throw new Error('Sessão admin inválida.');
    }

    setPurchaseOrderState((current) => ({
      ...current,
      loading: true,
      error: '',
      success: '',
    }));

    try {
      await adminApi.createManualPurchaseOrder(orderInput, items, user.id);
      await loadDashboard();
      setPurchaseOrderState({
        loading: false,
        loadingId: '',
        error: '',
        success: 'Pedido manual criado com sucesso.',
        preview: null,
      });
    } catch (error) {
      setPurchaseOrderState({
        loading: false,
        loadingId: '',
        error: error?.message || 'Falha ao criar pedido manual.',
        success: '',
        preview: null,
      });
      throw error;
    }
  }, [user, loadDashboard]);

  const runPurchaseOrderAction = useCallback(async (orderId, actionType) => {
    if (!user || !orderId) {
      return;
    }

    setPurchaseOrderState((current) => ({
      ...current,
      loadingId: orderId,
      error: '',
      success: '',
    }));

    try {
      if (actionType === 'entry') {
        await adminApi.markPurchaseOrderEntry(orderId, user.id);
      } else if (actionType === 'bonus') {
        await adminApi.generateConferenciaBonusFromPurchaseOrder(orderId, user.id);
      } else if (actionType === 'return') {
        await adminApi.requestPurchaseOrderReturn(orderId, user.id);
      } else if (actionType === 'reprint') {
        await adminApi.registerPurchaseOrderReprint(orderId, user.id);
      } else if (actionType === 'audit') {
        await adminApi.auditPurchaseOrder(orderId, user.id);
      }

      await loadDashboard();

      const successMap = {
        entry: 'Entrada registrada no pedido.',
        bonus: 'Bônus gerado a partir do pedido.',
        return: 'Devolução marcada no pedido.',
        reprint: 'Reimpressão registrada.',
        audit: 'Auditoria registrada.',
      };

      setPurchaseOrderState((current) => ({
        ...current,
        loadingId: '',
        error: '',
        success: successMap[actionType] || 'Ação executada com sucesso.',
      }));
    } catch (error) {
      setPurchaseOrderState((current) => ({
        ...current,
        loadingId: '',
        error: error?.message || 'Falha ao executar a ação do pedido.',
        success: '',
      }));
    }
  }, [user, loadDashboard]);

  const createManualBonus = useCallback(async (queueInput, items) => {
    if (!user) {
      throw new Error('Sessão admin inválida.');
    }

    await adminApi.createManualConferenciaBonus(queueInput, items, user.id);
    await loadDashboard();
  }, [user, loadDashboard]);

  const viewMap = {
    dashboard: (
      <DashboardView
        summaryCards={summaryCards}
        tratativas={dataState.tratativas}
        avarias={dataState.avarias}
        activeUsers={dataState.activeUsers}
        events={dataState.events}
        validade={dataState.validade}
        onSelectView={setSelectedView}
      />
    ),
    overview: (
      <OverviewView
        summaryCards={summaryCards}
        activeUsers={dataState.activeUsers}
        tratativas={dataState.tratativas}
        avarias={dataState.avarias}
        validade={dataState.validade}
        conferenciaRecebimentos={dataState.conferenciaRecebimentos}
        onSelectView={setSelectedView}
      />
    ),
    users: <UsersView activeUsers={dataState.activeUsers} onRefresh={loadDashboard} />,
    tratativas: <TratativasView tratativas={dataState.tratativas} onRefresh={loadDashboard} />,
    recebimento: (
      <RecebimentoView
        purchaseOrders={dataState.purchaseOrders}
        purchaseOrderActions={dataState.purchaseOrderActions}
        conferenciaRecebimentos={dataState.conferenciaRecebimentos}
        xmlImportState={xmlImportState}
        purchaseOrderState={purchaseOrderState}
        recebimentoBonusState={recebimentoBonusState}
        onImportXml={importXml}
        onImportPurchaseOrderXml={importPurchaseOrderXml}
        onCreateManualPurchaseOrder={createManualPurchaseOrder}
        onRunPurchaseOrderAction={runPurchaseOrderAction}
        onGenerateBonusFromRecebimento={generateBonusFromRecebimento}
      />
    ),
    conferencia: (
      <ConferenciaView
        conferenciaBonusQueue={dataState.conferenciaBonusQueue}
        conferenciaSaidas={dataState.conferenciaSaidas}
        onCreateManualBonus={createManualBonus}
        assignableUsers={dataState.assignableUsers}
        onRefresh={loadDashboard}
      />
    ),
    avarias: <AvariasView avarias={dataState.avarias} onRefresh={loadDashboard} />,
    validade: <ValidadeView validade={dataState.validade} onRefresh={loadDashboard} />,
    events: <EventsView events={dataState.events} />,
  };

  if (loading) {
    return <div className="fullscreen-state">Validando sessão admin...</div>;
  }

  if (!user || !admin) {
    return <LoginForm onSuccess={reload} globalError={error} disabled={loading} />;
  }

  return (
    <>
      <Toaster position="top-right" />
      <AdminShell
        profile={profile}
        admin={admin}
        selectedView={selectedView}
        onSelectView={setSelectedView}
        onRefresh={loadDashboard}
        onSignOut={signOut}
        lastRefresh={dataState.lastRefresh || '-'}
      >
        {dataState.error ? <div className="feedback error">{dataState.error}</div> : null}
        {dataState.loading ? <div className="inline-loading">Atualizando dados...</div> : null}
        {viewMap[selectedView] || viewMap.dashboard}
      </AdminShell>
    </>
  );
}

export default App;
