import { useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { SelectFilter } from '../../components/SelectFilter';
import { toast } from '../../lib/toast';
import { logEvent } from '../../lib/logger';
import { loadConfig, saveConfig } from '../../lib/config';
import {
  IMPORT_TYPES, getImportType, parseCsv, validateRows, downloadTemplate, persistConfigList,
} from '../../lib/csvImport';

// Importação em massa por planilha (briefing §34.19).
export const ImportacaoView = (props) => {
  const { profile } = props;
  const [typeKey, setTypeKey] = useState(IMPORT_TYPES[0].key);
  const [parsed, setParsed] = useState(null); // { validated: [], fileName }

  const type = useMemo(() => getImportType(typeKey), [typeKey]);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { rows } = parseCsv(text);
      if (!rows.length) { toast.error('Planilha vazia ou sem linhas de dados.'); return; }
      setParsed({ validated: validateRows(type, rows), fileName: file.name });
    } catch (error) {
      toast.error('Falha ao ler a planilha.');
      logEvent({ level: 'error', message: 'Falha ao importar planilha', context: error?.message });
    } finally {
      event.target.value = '';
    }
  };

  const validRows = parsed ? parsed.validated.filter((r) => !r.errors.length) : [];
  const errorRows = parsed ? parsed.validated.filter((r) => r.errors.length) : [];

  const confirmImport = () => {
    if (!validRows.length) { toast.error('Nenhuma linha válida para importar.'); return; }
    const who = profile?.name || profile?.email || 'Admin';

    if (type.configKey) {
      const added = persistConfigList(type.configKey, validRows, loadConfig, saveConfig);
      logEvent({ level: 'info', message: `Importação de ${type.label}`, context: `${who} importou ${validRows.length} linha(s), ${added} nova(s)` });
      toast.success(`${added} item(ns) novo(s) adicionado(s) em ${type.label}.`);
      setParsed(null);
    } else {
      logEvent({ level: 'info', message: `Importação validada de ${type.label}`, context: `${who} validou ${validRows.length} linha(s)` });
      toast.success(`${validRows.length} linha(s) válida(s). Gravação no banco requer endpoint backend (registrado nos logs).`);
    }
  };

  return (
    <PanelSection
      title="Importação em massa"
      subtitle="Importe dados por planilha CSV com validação por linha"
      kicker="Administração"
      actions={<button type="button" className="ghost-button" onClick={() => downloadTemplate(type)}>Baixar modelo CSV</button>}
    >
      <div className="filter-bar">
        <SelectFilter
          value={typeKey}
          onChange={(v) => { setTypeKey(v); setParsed(null); }}
          placeholder="Tipo de importação"
          options={IMPORT_TYPES.map((t) => ({ value: t.key, label: t.label }))}
        />
        <label className="upload-field">
          Selecionar planilha (.csv)
          <input type="file" accept=".csv,text/csv" onChange={handleFile} />
        </label>
      </div>

      <div className="import-cols-hint">
        Colunas esperadas: {type.columns.map((c) => `${c.key}${c.required ? '*' : ''}`).join(', ')}
        <span className="config-hint"> — {type.note}</span>
      </div>

      {parsed ? (
        <>
          <div className="import-summary">
            <span className="status-badge sev-tone-success">{validRows.length} válida(s)</span>
            <span className="status-badge sev-tone-danger">{errorRows.length} com erro</span>
            <span className="import-file">{parsed.fileName}</span>
            <button type="button" className="primary-button" onClick={confirmImport} disabled={!validRows.length}>
              {type.configKey ? 'Importar válidas' : 'Validar e registrar'}
            </button>
          </div>

          <DataTable
            rows={parsed.validated}
            pageSize={20}
            rowClassName={(r) => (r.errors.length ? 'sev-stripe-danger' : 'sev-stripe-success')}
            columns={[
              { key: 'index', label: 'Linha' },
              ...type.columns.map((c) => ({ key: c.key, label: c.label, render: (r) => r.data[c.key] || '—' })),
              {
                key: 'errors', label: 'Validação',
                render: (r) => (r.errors.length
                  ? <span className="status-badge sev-tone-danger">{r.errors.join('; ')}</span>
                  : <span className="status-badge sev-tone-success">OK</span>),
              },
            ]}
            emptyMessage="Nenhuma linha."
          />
        </>
      ) : (
        <div className="empty-state">Selecione uma planilha para validar e importar.</div>
      )}
    </PanelSection>
  );
};
