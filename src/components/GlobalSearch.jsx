import { useEffect, useMemo, useRef, useState } from 'react';
import { searchGlobal, countResults } from '../lib/globalSearch';

// Busca global do topbar (briefing §10). Filtra os dados em memória e abre um
// painel com os resultados agrupados por categoria; clicar navega para o módulo.
export const GlobalSearch = ({ data, onNavigate }) => {
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const groups = useMemo(() => searchGlobal(data || {}, term), [data, term]);
  const total = countResults(groups);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  // Atalho "/" foca a busca (quando não está digitando em outro campo).
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleNavigate = (viewKey) => {
    onNavigate?.(viewKey);
    setOpen(false);
    setTerm('');
  };

  const showPanel = open && term.trim().length >= 2;

  return (
    <div className="global-search" ref={containerRef}>
      <span className="global-search-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <input
        ref={inputRef}
        className="global-search-input"
        value={term}
        onChange={(event) => { setTerm(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar produto, EAN, NF, fornecedor, colaborador…"
        aria-label="Busca global"
      />
      {term ? (
        <button type="button" className="global-search-clear" onClick={() => { setTerm(''); inputRef.current?.focus(); }} title="Limpar">×</button>
      ) : (
        <kbd className="global-search-kbd" aria-hidden="true">/</kbd>
      )}

      {showPanel ? (
        <div className="global-search-panel" role="listbox">
          {total === 0 ? (
            <div className="global-search-empty">Nada encontrado para “{term}”.</div>
          ) : (
            groups.map((group) => (
              <div className="global-search-group" key={group.category}>
                <div className="global-search-group-head">{group.category}</div>
                {group.items.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className="global-search-item"
                    onClick={() => handleNavigate(item.viewKey)}
                  >
                    <span className="global-search-item-label">{item.label}</span>
                    <span className="global-search-item-sub">{item.sublabel}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};
