import { useMemo } from 'react';
import { PanelSection } from './PanelSection';
import { DataTable } from './DataTable';
import { SelectFilter } from './SelectFilter';
import { SearchInput } from './SearchInput';
import { useTableFilter } from '../hooks/useTableFilter';
import { exportCsv } from '../lib/csv';

/**
 * Padrão reutilizável: PanelSection + barra de filtros (selects + busca) +
 * (opcional) botão CSV + DataTable. Tira a duplicação de quase toda view.
 *
 * Props principais:
 *  - filters: [{ key, value, onChange, placeholder, options }]  (selects; filtra por row[key] === value)
 *  - searchKeys: campos para a busca textual
 *  - exportCsv: { columns, filename }  → renderiza botão "Exportar CSV" (exporta o que está filtrado)
 *  - headerActions: JSX extra no cabeçalho
 *  - children: conteúdo extra antes da tabela (ex.: montador)
 */
export const ResourceTable = ({
  title,
  subtitle,
  kicker,
  rows = [],
  columns,
  searchKeys = [],
  searchPlaceholder = 'Buscar...',
  filters = [],
  pageSize = 20,
  sortable = true,
  rowClassName,
  emptyMessage = 'Nenhum registro encontrado.',
  exportCsv: exportConfig,
  headerActions,
  children,
}) => {
  const prefiltered = useMemo(
    () => (rows || []).filter((row) => filters.every((f) => !f.value || row[f.key] === f.value)),
    [rows, filters],
  );

  const { filtered, search, setSearch } = useTableFilter(prefiltered, { searchKeys, pageSize });

  const actions = (exportConfig && filtered.length > 0) || headerActions ? (
    <>
      {headerActions}
      {exportConfig && filtered.length > 0 ? (
        <button
          type="button"
          className="ghost-button"
          onClick={() => exportCsv(filtered, exportConfig.columns, exportConfig.filename || 'export')}
          title="Exportar CSV do que está filtrado"
        >
          Exportar CSV
        </button>
      ) : null}
    </>
  ) : null;

  const hasFilterBar = filters.length > 0 || searchKeys.length > 0;

  return (
    <PanelSection title={title} subtitle={subtitle} kicker={kicker} actions={actions}>
      {children}
      {hasFilterBar ? (
        <div className="filter-bar">
          {filters.map((f) => (
            <SelectFilter
              key={f.key}
              value={f.value}
              onChange={f.onChange}
              placeholder={f.placeholder}
              options={f.options}
            />
          ))}
          {searchKeys.length > 0 ? (
            <div className="search-expand">
              <SearchInput value={search} onChange={setSearch} placeholder={searchPlaceholder} />
            </div>
          ) : null}
        </div>
      ) : null}

      <DataTable
        rows={filtered}
        pageSize={pageSize}
        sortable={sortable}
        rowClassName={rowClassName}
        columns={columns}
        emptyMessage={emptyMessage}
      />
    </PanelSection>
  );
};
