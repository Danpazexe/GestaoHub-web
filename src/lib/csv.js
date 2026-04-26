const escapeCsvValue = (value) => {
  const text = String(value ?? '');
  if (text.includes(';') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
};

export function exportCsv(rows, columns, filename) {
  const header = columns.map((column) => escapeCsvValue(column.label)).join(';');
  const body = (rows || [])
    .map((row) => columns.map((column) => {
      const rawValue = column.format ? column.format(row) : row?.[column.key];
      return escapeCsvValue(rawValue);
    }).join(';'))
    .join('\n');

  const csvContent = `\uFEFF${header}\n${body}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `${filename}-${Date.now()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
