// Mostra os filtros ativos como chips removíveis + "limpar tudo".
// chips: [{ key, label, onRemove }]. Renderiza nada se não há filtro ativo.
export const FilterChips = ({ chips = [], onClear }) => {
  const active = chips.filter(Boolean);
  if (!active.length) return null;
  return (
    <div className="filter-chips">
      <span className="filter-chips-label">Filtros:</span>
      {active.map((chip) => (
        <button type="button" key={chip.key} className="filter-chip" onClick={chip.onRemove} title="Remover filtro">
          {chip.label}
          <span className="filter-chip-x" aria-hidden="true">×</span>
        </button>
      ))}
      {active.length > 1 && onClear ? (
        <button type="button" className="filter-chip-clear" onClick={onClear}>Limpar tudo</button>
      ) : null}
    </div>
  );
};
