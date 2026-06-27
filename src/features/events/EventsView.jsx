import { useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { Drawer } from '../../components/Drawer';
import { SelectFilter } from '../../components/SelectFilter';
import { SearchInput } from '../../components/SearchInput';
import { Timeline } from '../../components/Timeline';
import { useTableFilter } from '../../hooks/useTableFilter';
import { exportCsv } from '../../lib/csv';
import { formatDateTime } from '../../lib/format';
import { eventToTimelineItem } from '../../lib/timeline';

export const EventsView = ({ events, purchaseOrderActions }) => {
  const [moduleValue, setModuleValue] = useState('');
  const [eventTypeValue, setEventTypeValue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [drawerPayload, setDrawerPayload] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // table | timeline

  const filteredBase = useMemo(() => (events || []).filter((row) => {
    if (moduleValue && row.module !== moduleValue) return false;
    if (eventTypeValue && row.event_type !== eventTypeValue) return false;

    const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
    if (startDate && createdAt < new Date(`${startDate}T00:00:00`).getTime()) return false;
    if (endDate && createdAt > new Date(`${endDate}T23:59:59`).getTime()) return false;
    return true;
  }), [events, moduleValue, eventTypeValue, startDate, endDate]);

  const { filtered, allFilteredRows, search, setSearch } = useTableFilter(filteredBase, {
    searchKeys: ['actor_name', 'entity_id', 'entity_type', 'module', 'event_type'],
    pageSize: 25,
  });

  return (
    <>
      <Drawer
        open={Boolean(drawerPayload)}
        title="Payload do evento"
        onClose={() => setDrawerPayload(null)}
      >
        <pre className="payload-pre">{JSON.stringify(drawerPayload || {}, null, 2)}</pre>
      </Drawer>

      <PanelSection
        title="Auditoria operacional"
        subtitle="Registro de eventos operacionais. Sem dados indica que a instrumentação ainda não foi implementada no app."
        kicker="Auditoria"
        actions={(
          <div className="inline-actions">
            <div className="segmented" role="tablist" aria-label="Modo de visualização">
              <button type="button" className={viewMode === 'table' ? 'segmented-btn active' : 'segmented-btn'} onClick={() => setViewMode('table')}>Tabela</button>
              <button type="button" className={viewMode === 'timeline' ? 'segmented-btn active' : 'segmented-btn'} onClick={() => setViewMode('timeline')}>Linha do tempo</button>
            </div>
          <button
            type="button"
            className="ghost-button"
            onClick={() => exportCsv(allFilteredRows, [
              { key: 'module', label: 'Módulo' },
              { key: 'event_type', label: 'Evento' },
              { key: 'entity_type', label: 'Tipo' },
              { key: 'entity_id', label: 'Entidade' },
              { key: 'actor_name', label: 'Ator' },
              { key: 'created_at', label: 'Quando', format: (row) => formatDateTime(row.created_at) },
            ], 'auditoria-operacional')}
            title="Exportar eventos filtrados"
          >
            Exportar
          </button>
          </div>
        )}
      >
        <div className="filter-bar">
          <SelectFilter
            value={moduleValue}
            onChange={setModuleValue}
            placeholder="Todos os módulos"
            options={Array.from(new Set((events || []).map((row) => row.module).filter(Boolean))).map((value) => ({ value, label: value }))}
          />
          <SelectFilter
            value={eventTypeValue}
            onChange={setEventTypeValue}
            placeholder="Todos os eventos"
            options={Array.from(new Set((events || []).map((row) => row.event_type).filter(Boolean))).map((value) => ({ value, label: value }))}
          />
          <div className="search-expand">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar ator ou entidade" />
          </div>
          <label className="date-filter">
            <span>De</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="date-filter">
            <span>Até</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>

        {viewMode === 'timeline' ? (
          <Timeline
            items={allFilteredRows.map(eventToTimelineItem)}
            emptyMessage="Sem eventos de auditoria registrados."
          />
        ) : (
          <DataTable
            rows={filtered}
            pageSize={25}
            sortable
            columns={[
              { key: 'module', label: 'Módulo' },
              { key: 'event_type', label: 'Evento' },
              { key: 'entity_type', label: 'Tipo' },
              { key: 'entity_id', label: 'Entidade' },
              { key: 'actor_name', label: 'Ator', render: (row) => row.actor_name || '-' },
              { key: 'order_ref', label: 'Pedido/NF' },
              { key: 'batch_ref', label: 'Lote' },
              {
                key: 'payload',
                label: 'Payload',
                render: (row) => (
                  <button type="button" className="table-action-button" onClick={() => setDrawerPayload(row.payload || {})} title="Ver payload completo">
                    Ver payload
                  </button>
                ),
              },
              {
                key: 'created_at',
                label: 'Quando',
                render: (row) => formatDateTime(row.created_at),
              },
            ]}
            emptyMessage="Sem eventos de auditoria registrados."
          />
        )}
      </PanelSection>

      <PanelSection
        title="Trilha de pedidos (recebimento)"
        subtitle="Ações registradas nos pedidos: bônus, auditoria, reimpressão e devolução"
        kicker="Auditoria"
      >
        <DataTable
          rows={purchaseOrderActions || []}
          searchable
          sortable
          pageSize={12}
          columns={[
            { key: 'order_number', label: 'Pedido' },
            { key: 'invoice_number', label: 'NF' },
            { key: 'supplier_name', label: 'Fornecedor' },
            { key: 'action_label', label: 'Ação' },
            { key: 'created_by_name', label: 'Usuário' },
            { key: 'created_at', label: 'Data', render: (row) => formatDateTime(row.created_at) },
          ]}
          emptyMessage="Sem auditoria registrada para pedidos."
        />
      </PanelSection>
    </>
  );
};
