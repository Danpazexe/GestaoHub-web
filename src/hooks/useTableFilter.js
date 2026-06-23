import { useMemo, useState } from 'react';

const normalizeText = (value) => String(value || '').toLowerCase().trim();

export const useTableFilter = (rows, options = {}) => {
  const {
    searchKeys = [],
    filterKey = '',
    initialFilterValue = '',
  } = options;

  const [search, setSearch] = useState('');
  const [filterValue, setFilterValue] = useState(initialFilterValue);

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return (rows || []).filter((row) => {
      const passesFilter = !filterKey || !filterValue || String(row?.[filterKey] || '') === filterValue;
      if (!passesFilter) return false;

      if (!normalizedSearch) return true;

      return searchKeys.some((key) => normalizeText(row?.[key]).includes(normalizedSearch));
    });
  }, [rows, search, filterKey, filterValue, searchKeys]);

  // A paginação é responsabilidade do DataTable, que recebe a lista filtrada
  // COMPLETA. Antes este hook já fatiava em uma página e o DataTable paginava de
  // novo por cima -> só a 1ª página aparecia e as demais linhas ficavam inacessíveis.
  return {
    filtered: filteredRows,
    total: filteredRows.length,
    search,
    setSearch,
    filterValue,
    setFilterValue,
    allFilteredRows: filteredRows,
  };
};
