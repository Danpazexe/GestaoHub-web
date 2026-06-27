import { useCallback, useEffect, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminSession } from './hooks/useAdminSession';
import { useDashboardData } from './hooks/useDashboardData';
import { useRecebimentoActions } from './hooks/useRecebimentoActions';
import { navItems } from './config/navigation';
import { LoginForm } from './components/LoginForm';
import { AdminShell } from './components/AdminShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { adminApi } from './services/adminApi';
import * as Views from './config/lazyViews';

// View padrão (landing) e redirecionamento das rotas legadas para a tela unificada.
const DEFAULT_VIEW = 'inicio';
const LEGACY_REDIRECTS = { monitor: 'inicio', dashboard: 'inicio', overview: 'inicio' };

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

  const { dataState, loadDashboard } = useDashboardData(user, admin);
  const {
    xmlImportState, recebimentoBonusState, purchaseOrderState,
    importXml, generateBonusFromRecebimento, importPurchaseOrderXml,
    createManualPurchaseOrder, runPurchaseOrderAction, createManualBonus, createManualSaidaBonus,
  } = useRecebimentoActions(user, loadDashboard);

  const signOut = async () => { await adminApi.signOut(); };

  const viewMap = {
    inicio: (
      <Views.InicioView
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
      <Views.PendenciasView
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
      <Views.IndicadoresView
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
    users: <Views.UsersView activeUsers={dataState.activeUsers} onRefresh={loadDashboard} />,
    tratativas: <Views.TratativasView tratativas={dataState.tratativas} onRefresh={loadDashboard} />,
    recebimento: (
      <Views.RecebimentoView
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
      <Views.ConferenciaView
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
    aprovacoes: <Views.AprovacoesView profile={profile} />,
    avarias: <Views.AvariasView avarias={dataState.avarias} onRefresh={loadDashboard} />,
    validade: <Views.ValidadeView validade={dataState.validade} onRefresh={loadDashboard} />,
    fechamento: (
      <Views.FechamentoView
        profile={profile}
        validade={dataState.validade}
        conferenciaBonusQueue={dataState.conferenciaBonusQueue}
        conferenciaSaidaBonusQueue={dataState.conferenciaSaidaBonusQueue}
        purchaseOrders={dataState.purchaseOrders}
        avarias={dataState.avarias}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
      />
    ),
    events: <Views.EventsView events={dataState.events} purchaseOrderActions={dataState.purchaseOrderActions} />,
    relatorios: (
      <Views.RelatoriosView
        validade={dataState.validade}
        purchaseOrders={dataState.purchaseOrders}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        conferenciaBonusQueue={dataState.conferenciaBonusQueue}
        conferenciaSaidaBonusQueue={dataState.conferenciaSaidaBonusQueue}
        events={dataState.events}
      />
    ),
    fornecedores: (
      <Views.FornecedoresView
        purchaseOrders={dataState.purchaseOrders}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        avarias={dataState.avarias}
      />
    ),
    qualidade: <Views.QualidadeView validade={dataState.validade} />,
    ranking: (
      <Views.RankingView
        validade={dataState.validade}
        avarias={dataState.avarias}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        tratativas={dataState.tratativas}
      />
    ),
    mapa: (
      <Views.MapaView
        validade={dataState.validade}
        conferenciaDivergencias={dataState.conferenciaDivergencias}
        avarias={dataState.avarias}
        tratativas={dataState.tratativas}
        conferenciaBonusQueue={dataState.conferenciaBonusQueue}
        conferenciaSaidaBonusQueue={dataState.conferenciaSaidaBonusQueue}
        purchaseOrders={dataState.purchaseOrders}
      />
    ),
    configuracoes: <Views.ConfiguracoesView />,
    admin: (
      <Views.AdminCenterView
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
    importacao: <Views.ImportacaoView profile={profile} />,
    logs: <Views.LogsView />,
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
        <Views.TvView data={dataState} lastRefresh={dataState.lastRefresh || '-'} onExit={() => navigate('/inicio')} />
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
