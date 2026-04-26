import { useEffect, useState } from 'react';

export const SearchInput = ({
  value,
  onChange,
  placeholder = 'Buscar',
  debounce = 200,
}) => {
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onChange?.(localValue);
    }, debounce);

    return () => window.clearTimeout(timer);
  }, [localValue, debounce, onChange]);

  return (
    <label className="search-input">
      <span className="search-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        placeholder={placeholder}
      />
      {localValue ? (
        <button
          type="button"
          className="search-clear"
          onClick={() => setLocalValue('')}
          title="Limpar busca"
        >
          ×
        </button>
      ) : null}
    </label>
  );
};
