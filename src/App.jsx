import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminSession } from './hooks/useAdminSession';
import { navItems } from './config/navigation';
import { useRealtimeRefresh } from './hooks/useRealtimeRefresh';
import { LoginForm } from './components/LoginForm';
import { AdminShell } from './components/AdminShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { adminApi } from './services/adminApi';
import { formatDateTime } from './lib/format';
import { parseNfeXml } from './lib/nfeXml';
import { logError } from './lib/logger';
// Views carregadas sob demanda (code splitting) — cada módulo vira um chunk próprio,
// reduzindo o bundle inicial (charts/recharts só carregam ao abrir o dashboard).
// Tela inicial unificada (Monitoramento + Dashboard + Visão geral) com controle
// segmentado "Tempo real / Análise". MonitorView/DashboardView viram sub-componentes
// internos do InicioView (recharts continua em lazy no segmento Análise).
const InicioView = lazy(() => import('./features/inicio/InicioView').then((m) => ({ default: m.InicioView })));
const PendenciasView = lazy(() => import('./features/pendencias/PendenciasView').then((m) => ({ default: m.PendenciasView })));
const FornecedoresView = lazy(() => import('./features/fornecedores/FornecedoresView').then((m) => ({ default: m.FornecedoresView })));
const QualidadeView = lazy(() => import('./features/qualidade/QualidadeView').then((m) => ({ default: m.QualidadeView })));
const RankingView = lazy(() => import('./features/ranking/RankingView').then((m) => ({ default: m.RankingView })));
const IndicadoresView = lazy(() => import('./features/indicadores/IndicadoresView').then((m) => ({ default: m.IndicadoresView })));
const TvView = lazy(() => import('./features/tv/TvView').then((m) => ({ default: m.TvView })));
const AdminCenterView = lazy(() => import('./features/admin/AdminCenterView').then((m) => ({ default: m.AdminCenterView })));
const ConfiguracoesView = lazy(() => import('./features/configuracoes/ConfiguracoesView').then((m) => ({ default: m.ConfiguracoesView })));
const FechamentoView = lazy(() => import('./features/fechamento/FechamentoView').then((m) => ({ default: m.FechamentoView })));
const LogsView = lazy(() => import('./features/logs/LogsView').then((m) => ({ default: m.LogsView })));
const ImportacaoView = lazy(() => import('./features/importacao/ImportacaoView').then((m) => ({ default: m.ImportacaoView })));
const AprovacoesView = lazy(() => import('./features/aprovacoes/AprovacoesView').then((m) => ({ default: m.AprovacoesView })));
const MapaView = lazy(() => import('./features/mapa/MapaView').then((m) => ({ default: m.MapaView })));
const RelatoriosView = lazy(() => import('./features/relatorios/RelatoriosView').then((m) => ({ default: m.RelatoriosView })));
const UsersView = lazy(() => import('./features/users/UsersView').then((m) => ({ default: m.UsersView })));
const TratativasView = lazy(() => import('./features/tratativas/TratativasView').then((m) => ({ default: m.TratativasView })));
const RecebimentoView = lazy(() => import('./features/recebimento/RecebimentoView').then((m) => ({ default: m.RecebimentoView })));
const ConferenciaView = lazy(() => import('./features/conferencia/ConferenciaView').then((m) => ({ default: m.ConferenciaView })));
const AvariasView = lazy(() => import('./features/avarias/AvariasView').then((m) => ({ default: m.AvariasView })));
const ValidadeView = lazy(() => import('./features/validade/ValidadeView').then((m) => ({ default: m.ValidadeView })));
const EventsView = lazy(() => import('./features/events/EventsView').then((m) => ({ default: m.EventsView })));

// Plano FREE do Supabase: o painel recarrega ~12 chamadas por ciclo, então
// espaçamos para 3 min (antes 45s) para economizar requisições. O botão
// "Atualizar" continua disponível para refresh sob demanda.
const REFRESH_INTERVAL_MS = 180000;

// View padrão (landing) e redirecionamento das rotas legadas para a tela unificada.
const DEFAULT_VIEW = 'inicio';
const LEGACY_REDIRECTS = { monitor: 'inicio', dashboard: 'inicio', overview: 'inicio' };

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
  conferenciaSaidaBonusQueue: [],
  conferenciaDivergencias: [],
  events: [],
  lastRefresh: '',
};

// Tabelas operacionais observadas em tempo real (precisam estar na publication
// supabase_realtime no banco — ver schema.sql). Sem isso, o polling segue valendo.
const REALTIME_TABLES = [
  'user_presence',
  'conferencia_bonus_queue',
  'conferencia_saida_bonus_queue',
  'conferencia_divergencias',
  'recebimento_treatment_cases',
  'avaria_items',
  'validade_products',
  'operational_events',
  'purchase_orders',
];

function App() {
  const { loading, user, profile, admin, error, reload } = useAdminSession();
  // Navegação por URL (deep-link, voltar/avançar e refresh preservam a view).
  const navigate = useNavigate();
  const location = useLocation();
  const routeKey = location.pathname.replace(/^\/+/, '').split('/')[0];
  const selectedView = navItems.some((item) => item.key === routeKey) ? routeKey : DEFAULT_VIEW;
  const setSelectedView = useCallback((key) => navigate(`/${key}`), [navigate]);

  // Rotas legadas (/monitor /dashboard /overview) → tela unificada /inicio.
  useEffect(() => {
    const target = LEGACY_REDIRECTS[routeKey];
    if (target) navigate(`/${target}`, { replace: true });
  }, [routeKey, navigate]);
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
        conferenciaSaidaBonusQueue,
        conferenciaDivergencias,
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
        adminApi.getConferenciaSaidaBonusQueue(),
        adminApi.getConferenciaDivergencias(),
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
        conferenciaSaidaBonusQueue,
        conferenciaDivergencias,
        events,
        lastRefresh: formatDateTime(new Date().toISOString()),
      });
    } catch (loadError) {
      logError('Falha ao carregar o painel', loadError?.message || String(loadError));
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

  // Realtime: qualquer mudança nas tabelas operacionais dispara um refresh (debounced),
  // deixando o painel ao vivo sem esperar o intervalo de polling.
  useRealtimeRefresh(loadDashboard, { tables: REALTIME_TABLES, enabled: Boolean(user && admin) });

  const signOut = async () => {
    await adminApi.signOut();
  };

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

  const createManualSaidaBonus = useCallback(async (queueInput, items) => {
    if (!user) {
      throw new Error('Sessão admin inválida.');
    }

    await adminApi.createManualConferenciaSaidaBonus(queueInput, items, user.id);
    await loadDashboard();
  }, [user, loadDashboard]);

  const viewMap = {
    inicio: (
      <InicioView
        summary={dataState.summary}
        activeUsers={dataState.activeUsers}
        tratativas={dataState.tratativas}
        avarias={dataState.avarias}
        validade={dataState.validade}
        events={dataState.events}
        conferenciaBonusQueue={dataState.conferenciaBonusQueue}
        conferenciaSaidaBonusQueue={dataState.conferenciaSaidaBonusQueue}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        conferenciaRecebimentos={dataState.conferenciaRecebimentos}
        lastRefresh={dataState.lastRefresh}
        onSelectView={setSelectedView}
      />
    ),
    pendencias: (
      <PendenciasView
        validade={dataState.validade}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        avarias={dataState.avarias}
        tratativas={dataState.tratativas}
        conferenciaBonusQueue={dataState.conferenciaBonusQueue}
        conferenciaSaidaBonusQueue={dataState.conferenciaSaidaBonusQueue}
        purchaseOrders={dataState.purchaseOrders}
        onSelectView={setSelectedView}
      />
    ),
    indicadores: (
      <IndicadoresView
        validade={dataState.validade}
        conferenciaBonusQueue={dataState.conferenciaBonusQueue}
        conferenciaSaidaBonusQueue={dataState.conferenciaSaidaBonusQueue}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        purchaseOrders={dataState.purchaseOrders}
        avarias={dataState.avarias}
        activeUsers={dataState.activeUsers}
        events={dataState.events}
      />
    ),
    users: <UsersView activeUsers={dataState.activeUsers} onRefresh={loadDashboard} />,
    tratativas: <TratativasView tratativas={dataState.tratativas} onRefresh={loadDashboard} />,
    recebimento: (
      <RecebimentoView
        purchaseOrders={dataState.purchaseOrders}
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
        conferenciaSaidaBonusQueue={dataState.conferenciaSaidaBonusQueue}
        conferenciaSaidas={dataState.conferenciaSaidas}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        onCreateManualBonus={createManualBonus}
        onCreateManualSaidaBonus={createManualSaidaBonus}
        assignableUsers={dataState.assignableUsers}
        onRefresh={loadDashboard}
      />
    ),
    avarias: <AvariasView avarias={dataState.avarias} onRefresh={loadDashboard} />,
    validade: <ValidadeView validade={dataState.validade} onRefresh={loadDashboard} />,
    fechamento: (
      <FechamentoView
        profile={profile}
        validade={dataState.validade}
        conferenciaBonusQueue={dataState.conferenciaBonusQueue}
        conferenciaSaidaBonusQueue={dataState.conferenciaSaidaBonusQueue}
        purchaseOrders={dataState.purchaseOrders}
        avarias={dataState.avarias}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
      />
    ),
    events: <EventsView events={dataState.events} purchaseOrderActions={dataState.purchaseOrderActions} />,
    fornecedores: (
      <FornecedoresView
        purchaseOrders={dataState.purchaseOrders}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        avarias={dataState.avarias}
      />
    ),
    qualidade: <QualidadeView validade={dataState.validade} />,
    configuracoes: <ConfiguracoesView />,
    logs: <LogsView />,
    importacao: <ImportacaoView profile={profile} />,
    aprovacoes: <AprovacoesView profile={profile} />,
    relatorios: (
      <RelatoriosView
        validade={dataState.validade}
        purchaseOrders={dataState.purchaseOrders}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        conferenciaBonusQueue={dataState.conferenciaBonusQueue}
        conferenciaSaidaBonusQueue={dataState.conferenciaSaidaBonusQueue}
        events={dataState.events}
      />
    ),
    admin: (
      <AdminCenterView
        validade={dataState.validade}
        purchaseOrders={dataState.purchaseOrders}
        conferenciaBonusQueue={dataState.conferenciaBonusQueue}
        conferenciaSaidaBonusQueue={dataState.conferenciaSaidaBonusQueue}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        avarias={dataState.avarias}
        tratativas={dataState.tratativas}
        activeUsers={dataState.activeUsers}
        events={dataState.events}
      />
    ),
    ranking: (
      <RankingView
        validade={dataState.validade}
        avarias={dataState.avarias}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        tratativas={dataState.tratativas}
      />
    ),
    mapa: (
      <MapaView
        validade={dataState.validade}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        avarias={dataState.avarias}
        tratativas={dataState.tratativas}
        conferenciaBonusQueue={dataState.conferenciaBonusQueue}
        conferenciaSaidaBonusQueue={dataState.conferenciaSaidaBonusQueue}
        purchaseOrders={dataState.purchaseOrders}
      />
    ),
  };

  if (loading) {
    return <div className="fullscreen-state">Validando sessão admin...</div>;
  }

  if (!user || !admin) {
    return <LoginForm onSuccess={reload} globalError={error} disabled={loading} />;
  }

  // Modo TV (briefing §16): tela cheia standalone, fora do AdminShell.
  if (routeKey === 'tv') {
    return (
      <Suspense fallback={<div className="fullscreen-state">Carregando painel...</div>}>
        <TvView data={dataState} lastRefresh={dataState.lastRefresh || '-'} onExit={() => navigate('/inicio')} />
      </Suspense>
    );
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
        searchData={dataState}
      >
        {dataState.error ? <div className="feedback error">{dataState.error}</div> : null}
        {dataState.loading ? <div className="inline-loading">Atualizando dados...</div> : null}
        <ErrorBoundary key={selectedView}>
          <Suspense fallback={<div className="inline-loading">Carregando módulo...</div>}>
            {viewMap[selectedView] || viewMap[DEFAULT_VIEW]}
          </Suspense>
        </ErrorBoundary>
      </AdminShell>
    </>
  );
}

export default App;
