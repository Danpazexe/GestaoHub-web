import { useMemo, useState } from 'react';

const normalizeText = (value) => String(value || '').toLowerCase().trim();

export const useTableFilter = (rows, options = {}) => {
  const {
    searchKeys = [],
    filterKey = '',
    pageSize = 20,
    initialFilterValue = '',
  } = options;

  const [search, setSearch] = useState('');
  const [filterValue, setFilterValue] = useState(initialFilterValue);
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return (rows || []).filter((row) => {
      const passesFilter = !filterKey || !filterValue || String(row?.[filterKey] || '') === filterValue;
      if (!passesFilter) return false;

      if (!normalizedSearch) return true;

      return searchKeys.some((key) => normalizeText(row?.[key]).includes(normalizedSearch));
    });
  }, [rows, search, filterKey, filterValue, searchKeys]);

  const safePageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, safePageCount);
  const startIndex = (currentPage - 1) * pageSize;

  const pagedRows = useMemo(
    () => filteredRows.slice(startIndex, startIndex + pageSize),
    [filteredRows, startIndex, pageSize],
  );

  const updateSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const updateFilterValue = (value) => {
    setFilterValue(value);
    setPage(1);
  };

  return {
    filtered: pagedRows,
    total: filteredRows.length,
    search,
    setSearch: updateSearch,
    filterValue,
    setFilterValue: updateFilterValue,
    page: currentPage,
    setPage,
    pageCount: safePageCount,
    allFilteredRows: filteredRows,
  };
};
