// SLA e tempo limite por tarefa (briefing §4).
// Define o prazo operacional ideal de cada tipo de tarefa e calcula o status
// de SLA a partir do tempo decorrido. Status canônicos: dentro | proximo |
// atrasado | critico. Mantido sem dependência de relógio fixo para facilitar
// testes (recebe `now` opcional).

const MIN = 1;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// Limite ideal (em minutos) por tipo de tarefa. Fonte: tabela do briefing §4.
export const SLA_RULES = {
  conferencia_parada: { label: 'Conferência iniciada', limitMinutes: 30 * MIN },
  divergencia: { label: 'Nota com divergência', limitMinutes: 24 * HOUR },
  correcao_entrada: { label: 'Correção de entrada', limitMinutes: 24 * HOUR },
  avaria: { label: 'Avaria aberta', limitMinutes: 48 * HOUR },
  tratativa: { label: 'Tratativa aberta', limitMinutes: 48 * HOUR },
  validade_vencido: { label: 'Produto vencido', limitMinutes: 0 }, // resolver no mesmo dia
  validade_hoje: { label: 'Produto vencendo hoje', limitMinutes: 0 },
  sem_imagem: { label: 'Produto sem imagem', limitMinutes: 7 * DAY },
  cadastro_incompleto: { label: 'Cadastro incompleto', limitMinutes: 7 * DAY },
};

export const SLA_STATUS = {
  dentro: { key: 'dentro', label: 'Dentro do prazo', tone: 'success', severity: 'resolvido' },
  // Escalada visual de urgência: monitor (amarelo) < warning (laranja) < danger.
  proximo: { key: 'proximo', label: 'Próximo do limite', tone: 'monitor', severity: 'atencao' },
  atrasado: { key: 'atrasado', label: 'Atrasado', tone: 'warning', severity: 'atencao' },
  critico: { key: 'critico', label: 'Crítico', tone: 'danger', severity: 'critico' },
};

export const slaStatusMeta = (key) => SLA_STATUS[key] || SLA_STATUS.dentro;

// Formata uma duração em minutos para um texto curto pt-BR.
export const formatDuration = (totalMinutes) => {
  const minutes = Math.max(0, Math.round(Number(totalMinutes) || 0));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const restMin = minutes % 60;
  if (hours < 24) return restMin ? `${hours} h ${restMin} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} d ${restHours} h` : `${days} d`;
};

const minutesBetween = (since, now) => {
  if (!since) return 0;
  const start = new Date(since).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, (now - start) / 60000);
};

// Calcula o status de SLA de uma tarefa com base no tempo decorrido desde `since`.
// Para limites 0 (resolver no mesmo dia), qualquer tempo decorrido já é tratado
// como atrasado/crítico conforme o tempo acumulado.
export const computeSla = ({ type, since, now = Date.now() }) => {
  const rule = SLA_RULES[type] || { label: type || 'Tarefa', limitMinutes: 24 * HOUR };
  const elapsedMinutes = minutesBetween(since, now);
  const limitMinutes = rule.limitMinutes;

  let status;
  if (limitMinutes <= 0) {
    // "Resolver no mesmo dia": vira crítico após 8h decorridas, atrasado antes.
    status = elapsedMinutes >= 8 * HOUR ? 'critico' : 'atrasado';
  } else if (elapsedMinutes >= limitMinutes * 1.5) {
    status = 'critico';
  } else if (elapsedMinutes >= limitMinutes) {
    status = 'atrasado';
  } else if (elapsedMinutes >= limitMinutes * 0.75) {
    status = 'proximo';
  } else {
    status = 'dentro';
  }

  const remainingMinutes = limitMinutes > 0 ? limitMinutes - elapsedMinutes : 0;
  const meta = slaStatusMeta(status);

  return {
    type,
    ruleLabel: rule.label,
    status,
    statusLabel: meta.label,
    tone: meta.tone,
    severity: meta.severity,
    elapsedMinutes,
    limitMinutes,
    remainingMinutes,
    elapsedText: formatDuration(elapsedMinutes),
    // Texto pronto para exibição: "parada há 42 min" / "no limite há 1 d".
    text: status === 'dentro' && limitMinutes > 0
      ? `restam ${formatDuration(remainingMinutes)}`
      : `há ${formatDuration(elapsedMinutes)}`,
  };
};
