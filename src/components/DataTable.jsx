import { useMemo, useState } from 'react';
import { SearchInput } from './SearchInput';

const normalizeValue = (value) => String(value ?? '').toLowerCase().trim();

export const DataTable = ({
  columns,
  rows,
  emptyMessage = 'Sem dados.',
  searchable = false,
  sortable = false,
  pageSize,
  defaultSort,
  rowClassName,
}) => {
  const [search, setSearch] = useState('');
  const [sortState, setSortState] = useState(defaultSort || null);
  const [page, setPage] = useState(1);

  const processedRows = useMemo(() => {
    let nextRows = [...(rows || [])];

    if (searchable && search.trim()) {
      const normalizedSearch = normalizeValue(search);
      nextRows = nextRows.filter((row) => columns.some((column) => {
        const rawValue = column.searchValue ? column.searchValue(row) : row?.[column.key];
        return normalizeValue(rawValue).includes(normalizedSearch);
      }));
    }

    if (sortable && sortState?.key) {
      const sortColumn = columns.find((column) => column.key === sortState.key);
      if (sortColumn) {
        nextRows.sort((left, right) => {
          const leftValue = normalizeValue(sortColumn.sortValue ? sortColumn.sortValue(left) : left?.[sortColumn.key]);
          const rightValue = normalizeValue(sortColumn.sortValue ? sortColumn.sortValue(right) : right?.[sortColumn.key]);
          const comparison = leftValue.localeCompare(rightValue, 'pt-BR', { numeric: true });
          return sortState.direction === 'asc' ? comparison : comparison * -1;
        });
      }
    }

    return nextRows;
  }, [rows, columns, searchable, search, sortable, sortState]);

  const pagedRows = useMemo(() => {
    if (!pageSize) return processedRows;
    const safePage = Math.min(Math.max(1, page), Math.max(1, Math.ceil(processedRows.length / pageSize)));
    const startIndex = (safePage - 1) * pageSize;
    return processedRows.slice(startIndex, startIndex + pageSize);
  }, [processedRows, page, pageSize]);

  const pageCount = pageSize ? Math.max(1, Math.ceil(processedRows.length / pageSize)) : 1;

  const toggleSort = (key) => {
    if (!sortable) return;
    setPage(1);
    setSortState((current) => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const handleSearchChange = (value) => {
    setSearch(value);
    setPage(1);
  };

  if (!rows?.length) {
    return <div className="empty-state" role="status">{emptyMessage}</div>;
  }

  return (
    <div className="data-table-stack">
      {searchable ? (
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Buscar na tabela"
          />
        </div>
      ) : null}

      <div className="table-shell">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={sortable ? 'is-sortable' : ''}
                  onClick={() => toggleSort(col.key)}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row, idx) => (
              <tr key={row.id || row.session_id || `row-${idx}`} className={rowClassName ? rowClassName(row) : ''}>
                {columns.map((col) => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : (row[col.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageSize && pageCount > 1 ? (
        <div className="table-pagination">
          <button type="button" className="ghost-button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
            Anterior
          </button>
          <span>Página {page} de {pageCount}</span>
          <button type="button" className="ghost-button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount}>
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  );
};
