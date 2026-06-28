// Exportadores XLSX e PDF. As libs (xlsx, jspdf) são carregadas via import()
// dinâmico — só entram no bundle quando o usuário exporta (não pesam no
// carregamento inicial). columns: [{ key, label, format? }].

const cellValue = (row, col) => {
  const v = col.format ? col.format(row) : row[col.key];
  return v == null ? '' : v;
};

export const exportXlsx = async (rows, columns, filename = 'relatorio') => {
  const XLSX = await import('xlsx');
  const data = (rows || []).map((row) => {
    const obj = {};
    columns.forEach((col) => { obj[col.label] = cellValue(row, col); });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

export const exportPdf = async (rows, columns, filename = 'relatorio', title = 'Relatório') => {
  const { default: JsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new JsPDF({ orientation: columns.length > 6 ? 'landscape' : 'portrait' });
  doc.setFontSize(13);
  doc.text(String(title), 14, 16);
  autoTable(doc, {
    startY: 22,
    head: [columns.map((c) => c.label)],
    body: (rows || []).map((row) => columns.map((col) => String(cellValue(row, col)))),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [40, 48, 68] },
  });
  doc.save(`${filename}.pdf`);
};
