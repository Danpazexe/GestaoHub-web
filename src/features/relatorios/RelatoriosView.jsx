import { useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { SelectFilter } from '../../components/SelectFilter';
import { exportCsv } from '../../lib/csv';
import { exportXlsx, exportPdf } from '../../lib/exporters';
import { toast } from '../../lib/toast';
import { REPORTS, PERIODS, periodRange } from '../../lib/relatorios';
import { usePermissions } from '../../context/PermissionsContext';

// Tela de Relatórios por módulo (briefing §17). Deriva tudo dos dados já
// carregados; exporta CSV e imprime (Salvar como PDF no diálogo do navegador)
// respeitando os filtros aplicados.
export const RelatoriosView = (data) => {
  const { can } = usePermissions();
  const canExport = can('can_export_reports');
  const [reportKey, setReportKey] = useState(REPORTS[0].key);
  const [period, setPeriod] = useState('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const report = useMemo(() => REPORTS.find((r) => r.key === reportKey) || REPORTS[0], [reportKey]);

  const rows = useMemo(() => {
    const range = report.snapshot ? null : periodRange(period, { customStart, customEnd });
    return report.rows(data, range);
  }, [report, data, period, customStart, customEnd]);

  const reportOptions = REPORTS.map((r) => ({ value: r.key, label: `${r.category} · ${r.label}` }));

  const doExport = () => {
    if (!canExport) { toast.error('Sem permissão para exportar relatórios.'); return; }
    if (!rows.length) { toast.error('Sem dados para exportar.'); return; }
    exportCsv(rows, report.columns, report.key);
    toast.success('Relatório exportado.');
  };

  const doExportFormat = async (kind) => {
    if (!canExport) { toast.error('Sem permissão para exportar relatórios.'); return; }
    if (!rows.length) { toast.error('Sem dados para exportar.'); return; }
    const id = toast.loading(`Gerando ${kind.toUpperCase()}...`);
    try {
      const fn = kind === 'xlsx' ? exportXlsx : exportPdf;
      await fn(rows, report.columns, report.key, `${report.category} — ${report.label}`);
      toast.success(`${kind.toUpperCase()} gerado.`);
    } catch (error) {
      toast.error(error?.message || `Falha ao gerar ${kind.toUpperCase()}.`);
    } finally {
      toast.dismiss(id);
    }
  };

  return (
    <PanelSection
      title="Relatórios"
      subtitle="Relatórios operacionais por módulo — exporte em CSV, Excel ou PDF (respeita os filtros)"
      kicker="Inteligência"
      actions={(
        <div className="inline-actions no-print">
          <button type="button" className="ghost-button" onClick={doExport} disabled={!canExport} title={canExport ? 'Exportar CSV' : 'Sem permissão para exportar'}>CSV</button>
          <button type="button" className="ghost-button" onClick={() => doExportFormat('xlsx')} disabled={!canExport} title="Exportar Excel (XLSX)">Excel</button>
          <button type="button" className="ghost-button" onClick={() => doExportFormat('pdf')} disabled={!canExport} title="Exportar PDF">PDF</button>
          <button type="button" className="ghost-button" onClick={() => window.print()} title="Imprimir">Imprimir</button>
        </div>
      )}
    >
      <div className="filter-bar no-print">
        <SelectFilter value={reportKey} onChange={setReportKey} placeholder="Relatório" options={reportOptions} />
        {!report.snapshot ? (
          <SelectFilter value={period} onChange={setPeriod} placeholder="Período" options={PERIODS.map((p) => ({ value: p.key, label: p.label }))} />
        ) : <span className="report-snapshot-note">Estado atual (sem período)</span>}
        {!report.snapshot && period === 'custom' ? (
          <>
            <label className="date-filter"><span>De</span><input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></label>
            <label className="date-filter"><span>Até</span><input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></label>
          </>
        ) : null}
      </div>

      <div className="report-print-head">
        <h3>{report.category} — {report.label}</h3>
        <span>{rows.length} registro(s){report.snapshot ? '' : ` · ${PERIODS.find((p) => p.key === period)?.label || ''}`}</span>
      </div>

      <DataTable
        rows={rows}
        pageSize={25}
        sortable
        columns={report.columns.map((col) => ({
          key: col.key,
          label: col.label,
          render: col.format ? (row) => col.format(row) : undefined,
        }))}
        emptyMessage="Nenhum registro para os filtros selecionados."
      />
    </PanelSection>
  );
};
