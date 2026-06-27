// Padronização de gravidade em todo o sistema (briefing §15).
// Uma única fonte de verdade para cor + rótulo + peso de ordenação de cada
// nível de gravidade. Usado por pendências, SLA, fila inteligente, alertas e
// pelos painéis (Modo TV, dashboards). As cores reaproveitam os tokens CSS
// semânticos já existentes (--danger/--warning/--info/--success) + um token
// "monitor" (amarelo) adicionado no styles.css.

export const SEVERITY = {
  critico: {
    key: 'critico',
    label: 'Crítico',
    tone: 'danger', // vermelho
    weight: 5,
  },
  atencao: {
    key: 'atencao',
    label: 'Atenção',
    tone: 'warning', // laranja
    weight: 4,
  },
  monitorar: {
    key: 'monitorar',
    label: 'Monitorar',
    tone: 'monitor', // amarelo
    weight: 3,
  },
  informativo: {
    key: 'informativo',
    label: 'Informativo',
    tone: 'info', // azul/cinza
    weight: 2,
  },
  resolvido: {
    key: 'resolvido',
    label: 'Resolvido',
    tone: 'success', // verde
    weight: 1,
  },
};

export const SEVERITY_ORDER = ['critico', 'atencao', 'monitorar', 'informativo', 'resolvido'];

export const severityMeta = (key) => SEVERITY[key] || SEVERITY.informativo;

export const severityWeight = (key) => severityMeta(key).weight;

// Classe CSS aplicada em chips/linhas. Ex.: sev-tone-danger.
export const severityToneClass = (key) => `sev-tone-${severityMeta(key).tone}`;

// Mapeia prioridade operacional (alta/media/baixa) -> gravidade visual padrão,
// usada quando a fonte não define uma gravidade própria.
export const PRIORITY_TO_SEVERITY = {
  alta: 'critico',
  media: 'atencao',
  baixa: 'monitorar',
};

export const PRIORITY = {
  alta: { key: 'alta', label: 'Alta', weight: 3 },
  media: { key: 'media', label: 'Média', weight: 2 },
  baixa: { key: 'baixa', label: 'Baixa', weight: 1 },
};

export const priorityMeta = (key) => PRIORITY[key] || PRIORITY.baixa;

export const priorityWeight = (key) => priorityMeta(key).weight;
