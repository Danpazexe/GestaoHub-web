import { useMemo } from 'react';
import { PanelSection } from '../../components/PanelSection';
import { DataTable } from '../../components/DataTable';
import { exportCsv } from '../../lib/csv';
import { truncate } from '../../lib/format';
import { buildCadastroQuality } from '../../lib/analytics';

// Qualidade de cadastro (briefing §21). Identifica produtos de validade com
// dados incompletos. Checagens de campos ausentes no schema (imagem/EAN/setor)
// aparecem como "não rastreável" em vez de falso negativo.
export const QualidadeView = ({ validade = [] }) => {
  const quality = useMemo(() => buildCadastroQuality(validade), [validade]);

  return (
    <>
      <PanelSection
        title="Qualidade de cadastro"
        subtitle="Produtos com dados incompletos que prejudicam a operação"
        kicker="Inteligência"
      >
        <div className="pendencia-cards">
          <article className="pendencia-card sev-stripe-success">
            <span className="pendencia-card-value">{quality.completePct}%</span>
            <span className="pendencia-card-label">Cadastro completo</span>
          </article>
          <article className="pendencia-card sev-stripe-warning">
            <span className="pendencia-card-value">{quality.incompleteCount}</span>
            <span className="pendencia-card-label">Produtos incompletos</span>
          </article>
          <article className="pendencia-card sev-stripe-info">
            <span className="pendencia-card-value">{quality.total}</span>
            <span className="pendencia-card-label">Produtos avaliados</span>
          </article>
          <article className="pendencia-card sev-stripe-monitor">
            <span className="pendencia-card-value">{quality.checks.filter((c) => !c.trackable).length}</span>
            <span className="pendencia-card-label">Campos não rastreáveis</span>
          </article>
        </div>

        <div className="quality-checks">
          {quality.checks.map((check) => (
            <div key={check.key} className={`quality-check${check.trackable ? '' : ' is-untracked'}`}>
              <span className="quality-check-label">{check.label}</span>
              {check.trackable ? (
                <span className="quality-check-count">{check.missing}</span>
              ) : (
                <span className="quality-check-na" title="Campo ainda não publicado pelo app — não é possível avaliar">não rastreável</span>
              )}
            </div>
          ))}
        </div>
      </PanelSection>

      <PanelSection
        title={`Produtos incompletos (${quality.incompleteCount})`}
        subtitle="Ordenados pelos que têm mais campos faltando"
        kicker="Correção"
        actions={quality.incompleteRows.length > 0 ? (
          <button
            type="button"
            className="ghost-button"
            onClick={() => exportCsv(quality.incompleteRows, [
              { key: 'codprod', label: 'Código' },
              { key: 'descricao', label: 'Descrição' },
              { key: 'lote', label: 'Lote' },
              { key: 'quantidade', label: 'Qtd' },
              { key: 'missing', label: 'Faltando', format: (r) => r._missing.join(', ') },
            ], 'cadastro-incompleto')}
            title="Exportar produtos incompletos"
          >
            Exportar CSV
          </button>
        ) : null}
      >
        <DataTable
          rows={quality.incompleteRows}
          searchable
          pageSize={20}
          columns={[
            { key: 'codprod', label: 'Código', render: (r) => r.codprod || '—' },
            { key: 'descricao', label: 'Descrição', render: (r) => truncate(r.descricao, 48) },
            { key: 'lote', label: 'Lote', render: (r) => r.lote || '—' },
            { key: 'quantidade', label: 'Qtd', render: (r) => r.quantidade ?? '—' },
            {
              key: 'missing',
              label: 'Campos faltando',
              searchValue: (r) => r._missing.join(' '),
              render: (r) => (
                <div className="quality-missing-tags">
                  {r._missing.map((m) => <span key={m} className="status-badge sev-tone-warning">{m}</span>)}
                </div>
              ),
            },
          ]}
          emptyMessage="Todos os produtos avaliados estão completos. ✅"
        />
      </PanelSection>
    </>
  );
};
