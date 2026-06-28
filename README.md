# GestãoHub — Webapp (Painel de Supervisão)

[![🚦 CI](https://github.com/Danpazexe/GestaoHub-web/actions/workflows/ci.yml/badge.svg)](https://github.com/Danpazexe/GestaoHub-web/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-20-339933?logo=node.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-RLS-3ECF8E?logo=supabase&logoColor=white)

Central web de **supervisão, operação, auditoria e BI** sobre o Supabase do
GestãoHub. Permite acompanhar a operação em tempo real, gerenciar colaboradores,
controlar validade, conferir recebimentos, resolver pendências, analisar
indicadores, exportar relatórios e auditar ações.

## Stack

- **Vite** + **React 18** + **React Router 7**
- **Supabase JS** (auth + leitura de views administrativas)
- **Recharts** (gráficos) · **React Hot Toast** (feedback)
- JavaScript (sem TypeScript), CSS único com design tokens

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com os dados do seu projeto Supabase
npm run dev            # http://localhost:4173
npm run build          # build de produção em dist/
npm run preview        # serve o build
```

### Variáveis de ambiente (`.env`)

```txt
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=chave-anon-ou-publishable
```

> ⚠️ **Nunca** coloque a `SUPABASE_SERVICE_ROLE_KEY` no frontend. Apenas a chave
> pública (anon/publishable) deve ir para o navegador.

## Estrutura

```txt
src/
  features/        # uma pasta por módulo (validade, pendencias, relatorios, tv, ...)
  components/      # UI reutilizável (DataTable, Drawer, SeverityBadge, Timeline, ...)
  lib/             # regras puras: pendencias, sla, severity, analytics, dashboards,
                   # validadeFaixas, relatorios, notificacoes, fechamento, config, ...
  services/        # adminApi (acesso ao Supabase)
  config/          # navegação
  styles.css       # tokens + estilos (claro/escuro)
docs/migrations/   # migrações SQL (ex.: setor/filial/localização)
public/            # PWA: manifest, ícones, service worker
```

## Módulos

| Grupo | Telas |
|---|---|
| Geral | Início (monitoramento + dashboard), Indicadores, Colaboradores, Auditoria |
| Operação | Pendências, Recebimento, Conferências, Tratativas, Avarias, Validade, Fechamento diário |
| Inteligência | Relatórios, Fornecedores, Qualidade de cadastro, Ranking, Mapa operacional |
| Sistema | Configurações, Administração |
| Standalone | Modo TV (`/tv`) |

Destaques: prioridade automática + SLA na Central de Pendências, busca global,
timeline operacional, modo TV, PWA instalável, metas configuráveis, gravidade
padronizada por cor, travas contra erro humano e antes/depois visual.

## Deploy na Vercel

- **Framework Preset:** Vite · **Build:** `npm run build` · **Output:** `dist`
- **Install:** `npm install`
- Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `vercel.json` já faz o rewrite de SPA (todas as rotas → `index.html`) e
  desabilita cache do `sw.js`.

## CI

`.github/workflows/ci.yml` roda `npm ci` + `npm run build` em cada push na `main`
e em pull requests.

## Banco de dados

A Webapp **lê views administrativas** (`admin_*_view`) e usa RPCs seguras (ex.:
`admin_force_sign_out`). Para habilitar controle por setor/filial, aplique
[`docs/migrations/0001_setor_filial_localizacao.sql`](docs/migrations/0001_setor_filial_localizacao.sql)
no Supabase — a UI passa a agrupar por setor automaticamente.

## Checklist de publicação

Antes de subir para produção (também disponível em **Sistema → Administração**):

- [ ] Build funcionando (`npm run build`)
- [ ] Login funcionando
- [ ] Supabase conectado
- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] Rotas funcionando (rewrite SPA)
- [ ] GitHub Actions passando
- [ ] Sem chave sensível no frontend (apenas anon/publishable)
- [ ] Permissões revisadas
- [ ] Usuário admin criado (`admin_users`)
- [ ] Regras de auditoria testadas
- [ ] Exportações testadas
- [ ] Dashboard carregando corretamente
