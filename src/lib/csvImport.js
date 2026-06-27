// Importação em massa por planilha (briefing §34.19). Parser de CSV tolerante
// (delimitador ; ou ,, campos com aspas) + validação por linha por tipo de
// importação + geração de modelo. Persistência real para listas de
// configuração (setores/funções); demais tipos validam e geram preview.

import { textToList, listToText } from './config';

// ── Parser (RFC 4180-aware) ──────────────────────────────────────────────────
// Tokeniza o texto inteiro em registros respeitando aspas: delimitador e quebra
// de linha dentro de aspas ("...") NÃO separam — só fora de aspas.
const tokenize = (text, delimiter) => {
  const records = [];
  let row = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i += 1; }
        else inQuotes = false;
      } else { cur += ch; }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cur.trim()); cur = '';
    } else if (ch === '\n') {
      row.push(cur.trim()); records.push(row); row = []; cur = '';
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  row.push(cur.trim());
  records.push(row);
  // Descarta linhas totalmente vazias.
  return records.filter((r) => !(r.length === 1 && r[0] === ''));
};

export const parseCsv = (text) => {
  const clean = String(text || '').replace(/^﻿/, '');
  if (!clean.trim()) return { headers: [], rows: [] };
  // Detecta o delimitador pela contagem de colunas do header (fora de aspas).
  const semiRecs = tokenize(clean, ';');
  const commaRecs = tokenize(clean, ',');
  const recs = (semiRecs[0]?.length || 0) >= (commaRecs[0]?.length || 0) ? semiRecs : commaRecs;
  if (!recs.length) return { headers: [], rows: [] };
  const headers = recs[0].map((h) => h.toLowerCase());
  const rows = recs.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cells[idx] ?? ''; });
    return obj;
  });
  return { headers, rows };
};

// ── Validadores reutilizáveis ────────────────────────────────────────────────
const required = (v) => String(v || '').trim().length > 0;
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
const isNumber = (v) => v === '' || Number.isFinite(Number(v));
const isInt = (v) => v === '' || (Number.isFinite(Number(v)) && Number.isInteger(Number(v)));

// ── Tipos de importação ──────────────────────────────────────────────────────
// persist(rows) opcional: importação real para listas de configuração.
export const IMPORT_TYPES = [
  {
    key: 'setores', label: 'Setores / localizações', configKey: 'setores',
    columns: [{ key: 'nome', label: 'Nome', required: true }],
    note: 'Importação real — mescla na lista de setores das Configurações.',
  },
  {
    key: 'funcoes', label: 'Funções operacionais', configKey: 'funcoes',
    columns: [{ key: 'nome', label: 'Nome', required: true }],
    note: 'Importação real — mescla na lista de funções das Configurações.',
  },
  {
    key: 'produtos', label: 'Produtos / lista de validade',
    columns: [
      { key: 'codprod', label: 'Código', required: true },
      { key: 'descricao', label: 'Descrição', required: true },
      { key: 'ean', label: 'EAN' },
      { key: 'lote', label: 'Lote' },
      { key: 'quantidade', label: 'Quantidade', validate: (v) => (isInt(v) ? null : 'quantidade inválida') },
      { key: 'validade', label: 'Validade (AAAA-MM-DD)' },
    ],
    note: 'Validação e pré-visualização. A gravação no banco requer endpoint de inserção no Supabase.',
  },
  {
    key: 'colaboradores', label: 'Colaboradores',
    columns: [
      { key: 'nome', label: 'Nome', required: true },
      { key: 'email', label: 'E-mail', required: true, validate: (v) => (isEmail(v) ? null : 'e-mail inválido') },
      { key: 'funcao', label: 'Função' },
    ],
    note: 'Validação e pré-visualização. A criação de usuários requer função segura no Supabase.',
  },
  {
    key: 'fornecedores', label: 'Fornecedores',
    columns: [
      { key: 'nome', label: 'Nome', required: true },
      { key: 'cnpj', label: 'CNPJ' },
    ],
    note: 'Validação e pré-visualização. A gravação requer endpoint de inserção.',
  },
];

export const getImportType = (key) => IMPORT_TYPES.find((t) => t.key === key) || IMPORT_TYPES[0];

// Valida as linhas contra o tipo; devolve [{ index, data, errors: [] }].
export const validateRows = (type, rows) => rows.map((data, index) => {
  const errors = [];
  for (const col of type.columns) {
    const value = data[col.key];
    if (col.required && !required(value)) errors.push(`${col.label} obrigatório`);
    else if (col.validate && required(value)) {
      const msg = col.validate(value);
      if (msg) errors.push(msg);
    }
  }
  return { index: index + 1, data, errors };
});

// Gera o conteúdo de um modelo de planilha (header + 1 exemplo).
export const buildTemplate = (type) => {
  const header = type.columns.map((c) => c.key).join(';');
  const example = type.columns.map((c) => `exemplo_${c.key}`).join(';');
  return `﻿${header}\n${example}`;
};

export const downloadTemplate = (type) => {
  const blob = new Blob([buildTemplate(type)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `modelo-${type.key}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Persistência real para listas de config (setores/funções): mescla sem duplicar.
export const persistConfigList = (configKey, validRows, loadConfig, saveConfig) => {
  const config = loadConfig();
  const current = Array.isArray(config[configKey]) ? config[configKey] : [];
  const incoming = validRows.map((r) => String(r.data.nome || '').trim()).filter(Boolean);
  const merged = Array.from(new Set([...current, ...incoming]));
  saveConfig({ ...config, [configKey]: merged });
  return merged.length - current.length; // quantidade de novos
};

export { textToList, listToText };
