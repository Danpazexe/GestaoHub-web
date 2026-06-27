import { useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { Drawer } from '../../components/Drawer';
import { SelectFilter } from '../../components/SelectFilter';
import { SearchInput } from '../../components/SearchInput';
import { Timeline } from '../../components/Timeline';
import { useConfirm } from '../../hooks/useConfirm';
import { useTableFilter } from '../../hooks/useTableFilter';
import { adminApi } from '../../services/adminApi';
import { toast } from '../../lib/toast';
import { formatDateTime, formatRelativeMinutes } from '../../lib/format';
import { eventToTimelineItem, summarizeUserActivity } from '../../lib/timeline';

const EMPTY_DRAWER = { open: false, user: null, events: [], loading: false };

export const UsersView = ({ activeUsers, onRefresh }) => {
  const { confirm, ConfirmModalNode } = useConfirm();
  const [drawerState, setDrawerState] = useState(EMPTY_DRAWER);
  const [statusValue, setStatusValue] = useState('');
  const {
    filtered,
    search,
    setSearch,
  } = useTableFilter(
    (activeUsers || []).filter((row) => !statusValue || row.status === statusValue),
    {
      searchKeys: ['name', 'email', 'current_module', 'current_order_ref'],
      pageSize: 20,
    },
  );

  const handleForceLogout = async (row) => {
    const approved = await confirm({
      title: 'Encerrar sessão do colaborador no app?',
      description: `O status atual de ${row.name || row.email || 'colaborador'} será alterado para signed_out.`,
      confirmLabel: 'Encerrar sessão',
      danger: true,
    });

    if (!approved) return;

    const loadingId = toast.loading('Encerrando sessão...');
    try {
      const affected = await adminApi.forceSignOut(row.user_id);
      await onRefresh?.();
      if (affected > 0) {
        toast.success('Sessão encerrada com sucesso.');
      } else {
        toast.error('Nenhuma sessão ativa encontrada para este colaborador.');
      }
    } catch (error) {
      toast.error(error?.message || 'Falha ao encerrar a sessão.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const openProfile = async (row) => {
    setDrawerState({ open: true, user: row, events: [], loading: true });
    try {
      const events = await adminApi.getUserEvents(row.user_id, 60);
      setDrawerState({ open: true, user: row, events, loading: false });
    } catch (error) {
      setDrawerState({ open: true, user: row, events: [], loading: false });
      toast.error(error?.message || 'Falha ao carregar o perfil do colaborador.');
    }
  };

  const rows = useMemo(() => filtered, [filtered]);

  const profileUser = drawerState.user;
  const activity = useMemo(
    () => summarizeUserActivity(drawerState.events),
    [drawerState.events],
  );
  const timelineItems = useMemo(
    () => drawerState.events.map(eventToTimelineItem),
    [drawerState.events],
  );

  // Dados principais do perfil (briefing §11). Campos ainda não publicados pelo
  // app aparecem como "—" em vez de serem inventados.
  const profileFields = profileUser ? [
    { label: 'E-mail', value: profileUser.email || '—' },
    { label: 'Função operacional', value: profileUser.role || '—' },
    { label: 'Status no app', value: profileUser.status || 'offline' },
    { label: 'Plataforma', value: profileUser.platform || '—' },
    { label: 'Versão do app', value: profileUser.app_version || '—' },
    { label: 'Módulo atual', value: profileUser.current_module || '—' },
    { label: 'Tela atual', value: profileUser.current_screen || '—' },
    { label: 'Pedido/NF em uso', value: profileUser.current_order_ref || '—' },
    { label: 'Último acesso', value: formatRelativeMinutes(profileUser.last_heartbeat_at) },
  ] : [];

  return (
    <>
      {ConfirmModalNode}
      <Drawer
        open={drawerState.open}
        width={560}
        title={`Perfil de ${profileUser?.name || profileUser?.email || 'colaborador'}`}
        onClose={() => setDrawerState(EMPTY_DRAWER)}
      >
        {profileUser ? (
          <div className="profile-drawer">
            <div className="profile-header">
              <div className="profile-avatar-lg" aria-hidden="true">
                {(profileUser.name || profileUser.email || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="profile-id">
                <strong>{profileUser.name || '—'}</strong>
                <span>{profileUser.email || '—'}</span>
                <StatusBadge value={profileUser.status} />
              </div>
            </div>

            <section className="profile-section">
              <h4 className="profile-section-title">Dados principais</h4>
              <div className="profile-grid">
                {profileFields.map((field) => (
                  <div className="profile-field" key={field.label}>
                    <span className="profile-field-label">{field.label}</span>
                    <span className="profile-field-value">{field.value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="profile-section">
              <h4 className="profile-section-title">Atividade (últimos eventos)</h4>
              <div className="profile-metrics">
                <div className="profile-metric">
                  <strong>{activity.total}</strong>
                  <span>Eventos registrados</span>
                </div>
                <div className="profile-metric">
                  <strong>{activity.last7days}</strong>
                  <span>Nos últimos 7 dias</span>
                </div>
                <div className="profile-metric">
                  <strong>{activity.modulesRanked.length}</strong>
                  <span>Módulos atuados</span>
                </div>
              </div>
              {activity.modulesRanked.length ? (
                <div className="profile-modules">
                  {activity.modulesRanked.map(([module, count]) => (
                    <div className="profile-module-row" key={module}>
                      <span className="profile-module-name">{module}</span>
                      <span className="profile-module-count">{count}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="profile-section">
              <h4 className="profile-section-title">Linha do tempo</h4>
              {drawerState.loading ? (
                <div className="inline-loading" role="status">Carregando atividade...</div>
              ) : (
                <Timeline items={timelineItems} emptyMessage="Sem eventos para esse colaborador." />
              )}
            </section>

            <div className="profile-actions">
              <button type="button" className="danger-button" onClick={() => handleForceLogout(profileUser)} title="Encerrar sessão no app">
                Encerrar sessão no app
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>

      <PanelSection
        title="Colaboradores"
        subtitle="Quem está logado, em qual módulo e com qual referência operacional."
        kicker="Supervisão de equipe"
      >
        <div className="filter-bar">
          <SelectFilter
            value={statusValue}
            onChange={setStatusValue}
            placeholder="Todos os status"
            options={[
              { value: 'online', label: 'Online' },
              { value: 'idle', label: 'Idle' },
              { value: 'offline', label: 'Offline' },
              { value: 'signed_out', label: 'Signed out' },
            ]}
          />
          <div className="search-expand">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar por colaborador, e-mail ou módulo" />
          </div>
        </div>

        <DataTable
          rows={rows}
          sortable
          pageSize={20}
          rowClassName={(row) => {
            const diffMs = Date.now() - new Date(row.last_heartbeat_at).getTime();
            if (row.status === 'offline' && diffMs > 60 * 60 * 1000) return 'row-dimmed';
            return '';
          }}
          columns={[
            {
              key: 'name',
              label: 'Colaborador',
              searchValue: (row) => `${row.name || ''} ${row.email || ''}`,
              render: (row) => (
                <button type="button" className="link-button" onClick={() => openProfile(row)} title="Abrir perfil completo">
                  <strong className="table-main-text">{row.name || '-'}</strong>
                  <div className="cell-subtext">{row.email || '-'}</div>
                </button>
              ),
            },
            { key: 'platform', label: 'Plataforma' },
            { key: 'app_version', label: 'Versão' },
            { key: 'current_module', label: 'Módulo' },
            { key: 'current_screen', label: 'Tela' },
            { key: 'current_order_ref', label: 'Pedido/NF' },
            {
              key: 'status',
              label: 'Status',
              render: (row) => <StatusBadge value={row.status} />,
            },
            {
              key: 'last_heartbeat_at',
              label: 'Último heartbeat',
              render: (row) => formatDateTime(row.last_heartbeat_at),
            },
            {
              key: 'actions',
              label: 'Ações',
              render: (row) => (
                <div className="table-actions-row">
                  <button type="button" className="table-action-button" onClick={() => openProfile(row)} title="Ver perfil completo">
                    Perfil
                  </button>
                  <button type="button" className="table-action-button is-danger" onClick={() => handleForceLogout(row)} title="Encerrar sessão no app">
                    Logout
                  </button>
                </div>
              ),
            },
          ]}
          emptyMessage="Ainda não há presença remota publicada pelo app."
        />
      </PanelSection>
    </>
  );
};
