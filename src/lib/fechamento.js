// Fechamento diário da operação (briefing §21). Computa o resumo de pendências
// do dia a partir dos dados e persiste os fechamentos no Supabase
// (tabela fechamentos_diarios), não mais em localStorage.

import { isOpenValidade, loadFaixasConfig } from './validadeFaixas';
import { adminApi } from '../services/adminApi';

// Indicadores de pendência usados no checklist de fechamento.
export const computeResumoDia = (data = {}) => {
  const { criticoDias } = loadFaixasConfig();
  const open = (data.validade || []).filter(isOpenValidade);
  const validadeCritica = open.filter((r) => {
    const d = Number(r.diasrestantes);
    return Number.isFinite(d) && d <= criticoDias;
  }).length;
  const confPendentes = [...(data.conferenciaBonusQueue || []), ...(data.conferenciaSaidaBonusQueue || [])]
    .filter((r) => ['nao_iniciado', 'em_conferencia'].includes(r.status)).length;
  const notasPendentes = (data.purchaseOrders || [])
    .filter((r) => !['encerrado', 'auditado', 'cancelado'].includes(String(r.status || ''))).length;
  const avariasAbertas = (data.avarias || []).filter((r) => r.item_status === 'damaged').length;
  const divergenciasPendentes = (data.conferenciaDivergencias || [])
    .filter((r) => String(r.status || 'pendente') !== 'resolvida').length;

  const itens = [
    { key: 'conferencias', label: 'Conferências finalizadas', pendente: confPendentes, texto: confPendentes ? `${confPendentes} em aberto` : 'todas finalizadas' },
    { key: 'validade', label: 'Validades críticas tratadas', pendente: validadeCritica, texto: validadeCritica ? `${validadeCritica} críticas em aberto` : 'sem validade crítica' },
    { key: 'notas', label: 'Notas pendentes revisadas', pendente: notasPendentes, texto: notasPendentes ? `${notasPendentes} pendentes` : 'sem notas pendentes' },
    { key: 'avarias', label: 'Avarias conferidas', pendente: avariasAbertas, texto: avariasAbertas ? `${avariasAbertas} abertas` : 'sem avarias abertas' },
    { key: 'divergencias', label: 'Divergências justificadas', pendente: divergenciasPendentes, texto: divergenciasPendentes ? `${divergenciasPendentes} pendentes` : 'sem divergências' },
  ];

  const totalPendencias = confPendentes + validadeCritica + notasPendentes + avariasAbertas + divergenciasPendentes;
  return { itens, totalPendencias };
};

// Histórico de fechamentos (Supabase). Retorna [] se a tabela ainda não existe.
export const loadFechamentos = () => adminApi.getFechamentos(60);

// Registra um fechamento no Supabase. `registro`: { by, pendenciasRestantes, observacoes, itens }
export const saveFechamento = (registro) => adminApi.createFechamento({
  by: registro.by,
  pendenciasRestantes: registro.pendenciasRestantes,
  observacoes: registro.observacoes,
  itens: registro.itens,
});
