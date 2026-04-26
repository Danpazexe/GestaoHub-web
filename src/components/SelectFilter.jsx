export const SelectFilter = ({
  value,
  onChange,
  options,
  placeholder = 'Todos',
}) => (
  <label className="select-filter">
    <select value={value} onChange={(event) => onChange?.(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <span className="select-chevron" aria-hidden="true">▾</span>
  </label>
);
