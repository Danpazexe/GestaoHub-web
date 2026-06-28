import { useEffect, useState } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { SelectFilter } from '../../components/SelectFilter';
import { toast } from '../../lib/toast';
import { formatDateTime } from '../../lib/format';
import { getLogs } from '../../lib/logger';
import { adminApi } from '../../services/adminApi';

const LEVEL_TONE = { error: 'danger', warn: 'warning', info: 'info' };

// Logs técnicos e erros (briefing §34.17). Lê o histórico centralizado no
// Supabase (tabela logs_tecnicos); cai para o buffer da sessão se indisponível.
export const LogsView = () => {
  const [level, setLevel] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = () => {
    setLoading(true);
    adminApi.getLogsTecnicos(200)
      .then((rows) => setLogs(rows && rows.length ? rows : getLogs()))
      .catch(() => setLogs(getLogs()))
      .finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, []);

  const filtered = level ? logs.filter((l) => l.level === level) : logs;

  const handleClear = async () => {
    try { await adminApi.clearLogsTecnicos(); refresh(); toast.success('Logs limpos.'); }
    catch (error) { toast.error(error?.message || 'Não foi possível limpar os logs.'); }
  };
  const handleTest = async () => {
    await adminApi.insertLogTecnico({ level: 'info', message: 'Log de teste gerado pelo painel', context: 'LogsView' });
    refresh();
  };

  return (
    <PanelSection
      title="Logs técnicos e erros"
      subtitle="Erros relevantes capturados no navegador (carregamento, runtime, conexão)"
      kicker="Sistema"
      actions={(
        <div className="inline-actions">
          <button type="button" className="ghost-button" onClick={refresh} disabled={loading}>{loading ? 'Atualizando...' : 'Atualizar'}</button>
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
        Logs centralizados no Supabase (tabela <code>logs_tecnicos</code>), visíveis para qualquer admin. Integrações como Sentry/LogRocket podem ser avaliadas no futuro.
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
