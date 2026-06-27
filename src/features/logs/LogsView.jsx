import { useMemo, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { SelectFilter } from '../../components/SelectFilter';
import { toast } from '../../lib/toast';
import { formatDateTime } from '../../lib/format';
import { getLogs, clearLogs, logEvent } from '../../lib/logger';

const LEVEL_TONE = { error: 'danger', warn: 'warning', info: 'info' };

// Logs técnicos e erros (briefing §34.17). Lê o buffer local de erros do
// frontend (falha ao carregar dados, erro de runtime, promise rejeitada, etc.).
export const LogsView = () => {
  const [version, setVersion] = useState(0);
  const [level, setLevel] = useState('');
  const logs = useMemo(() => getLogs(), [version]);

  const filtered = level ? logs.filter((l) => l.level === level) : logs;

  const refresh = () => setVersion((v) => v + 1);
  const handleClear = () => { clearLogs(); refresh(); toast.success('Logs limpos.'); };
  const handleTest = () => { logEvent({ level: 'info', message: 'Log de teste gerado pelo painel', context: 'LogsView' }); refresh(); };

  return (
    <PanelSection
      title="Logs técnicos e erros"
      subtitle="Erros relevantes capturados no navegador (carregamento, runtime, conexão)"
      kicker="Sistema"
      actions={(
        <div className="inline-actions">
          <button type="button" className="ghost-button" onClick={refresh}>Atualizar</button>
          <button type="button" className="ghost-button" onClick={handleTest}>Gerar log de teste</button>
          <button type="button" className="danger-button" onClick={handleClear} disabled={!logs.length}>Limpar</button>
        </div>
      )}
    >
      <div className="filter-bar">
        <SelectFilter
          value={level}
          onChange={setLevel}
          placeholder="Todos os níveis"
          options={[{ value: 'error', label: 'Erro' }, { value: 'warn', label: 'Aviso' }, { value: 'info', label: 'Info' }]}
        />
      </div>
      <p className="config-hint" style={{ marginTop: 0, marginBottom: 12 }}>
        Integrações como Sentry, LogRocket ou Supabase Logs podem ser avaliadas no futuro; por ora os logs ficam no próprio navegador.
      </p>
      <DataTable
        rows={filtered}
        pageSize={25}
        columns={[
          { key: 'level', label: 'Nível', render: (r) => <span className={`status-badge sev-tone-${LEVEL_TONE[r.level] || 'info'}`}>{r.level}</span> },
          { key: 'message', label: 'Mensagem' },
          { key: 'context', label: 'Contexto', render: (r) => r.context || '—' },
          { key: 'at', label: 'Quando', render: (r) => formatDateTime(r.at) },
        ]}
        emptyMessage="Nenhum log registrado. 🎉"
      />
    </PanelSection>
  );
};
