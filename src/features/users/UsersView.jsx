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
import { formatDateTime } from '../../lib/format';

export const UsersView = ({ activeUsers, onRefresh }) => {
  const { confirm, ConfirmModalNode } = useConfirm();
  const [drawerState, setDrawerState] = useState({ open: false, user: null, events: [], loading: false });
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
      title: 'Forçar logout do usuário?',
      description: `O status atual de ${row.name || row.email || 'usuário'} será alterado para signed_out.`,
      confirmLabel: 'Forçar logout',
      danger: true,
    });

    if (!approved) return;

    const loadingId = toast.loading('Forçando logout...');
    try {
      await adminApi.forceSignOut(row.user_id);
      await onRefresh?.();
      toast.success('Logout forçado com sucesso.');
    } catch (error) {
      toast.error(error?.message || 'Falha ao forçar o logout.');
    } finally {
      toast.dismiss(loadingId);
    }
  };

  const openHistory = async (row) => {
    setDrawerState({ open: true, user: row, events: [], loading: true });

    try {
      const events = await adminApi.getUserEvents(row.user_id);
      setDrawerState({ open: true, user: row, events, loading: false });
    } catch (error) {
      setDrawerState({ open: true, user: row, events: [], loading: false });
      toast.error(error?.message || 'Falha ao carregar o histórico do usuário.');
    }
  };

  const rows = useMemo(() => filtered, [filtered]);

  return (
    <>
      {ConfirmModalNode}
      <Drawer
        open={drawerState.open}
        title={`Histórico de ${drawerState.user?.name || drawerState.user?.email || 'usuário'}`}
        onClose={() => setDrawerState({ open: false, user: null, events: [], loading: false })}
      >
        {drawerState.loading ? (
          <div className="inline-loading" role="status">Carregando eventos...</div>
        ) : (
          <div className="drawer-stack">
            {drawerState.events.map((event) => (
              <div key={event.id} className="detail-card">
                <strong>{event.module} · {event.event_type}</strong>
                <span>{formatDateTime(event.created_at)}</span>
                <span>{event.entity_type || '-'} · {event.entity_id || '-'}</span>
              </div>
            ))}
            {!drawerState.events.length ? <div className="empty-state">Sem eventos para esse usuário.</div> : null}
          </div>
        )}
      </Drawer>

      <PanelSection
        title="Usuários online"
        subtitle="Quem está logado, em qual módulo e com qual referência operacional."
        kicker="Presença remota"
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
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar por usuário, e-mail ou módulo" />
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
              label: 'Usuário',
              searchValue: (row) => `${row.name || ''} ${row.email || ''}`,
              render: (row) => (
                <div>
                  <strong className="table-main-text">{row.name || '-'}</strong>
                  <div className="cell-subtext">{row.email || '-'}</div>
                </div>
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
                  <button type="button" className="table-action-button is-danger" onClick={() => handleForceLogout(row)} title="Forçar logout">
                    Logout
                  </button>
                  <button type="button" className="table-action-button" onClick={() => openHistory(row)} title="Ver histórico">
                    Histórico
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
