# GestãoHub — Estado do Projeto

> Documento de referência do estado atual do **GestãoHub Webapp** (painel de
> supervisão). Gerado a partir do código real. Última atualização: 2026-06.

---

## 1. Ecossistema

O GestãoHub é composto por três partes sobre um mesmo **Supabase**:

```txt
GestaoHub-app   →  App mobile (React Native) usado pelos colaboradores na operação
GestaoHub-web   →  Painel admin/supervisão (Vite + React)  ← ESTE projeto
Supabase        →  Banco (Postgres), Auth, Realtime e views administrativas
```

- O **app mobile** registra a operação (validade, conferência, avarias, entrada,
  presença) e grava nas tabelas de domínio.
- O **webapp** lê **views administrativas** (`admin_*_view`) e dispara ações via
  `adminApi` (updates + RPCs seguras). Não acessa tabelas cruas diretamente para
  leitura agregada.
- Schemas do banco vivem em `GestaoHub-app/supabase/` (`schema.sql`,
  `schema_admin_panel_v1.sql`, etc.). As migrações específicas do webapp ficam em
  `GestaoHub-web/docs/migrations/`.

---

## 2. Stack do Webapp

| Camada | Tecnologia |
|---|---|
| Build | Vite 5 (`@vitejs/plugin-react`) |
| UI | React 18 |
| Rotas | React Router 7 (BrowserRouter, navegação por URL) |
| Dados | `@supabase/supabase-js` (auth + leitura de views + RPC) |
| Gráficos | Recharts (lazy, só no dashboard) |
| Feedback | React Hot Toast |
| Estilo | CSS com design tokens (claro/escuro), dividido por área |
| Linguagem | JavaScript (sem TypeScript) |

Dev server: `host 0.0.0.0`, `port 4173`. Scripts: `dev`, `build`, `preview`.

---

## 3. Estrutura de pastas

```txt
GestaoHub-web/
├── index.html                 # entrada + meta PWA + fontes
├── vite.config.js
├── vercel.json                # rewrite SPA + no-cache do sw.js
├── .env.example               # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
├── .github/workflows/ci.yml   # CI: npm ci + npm run build
├── public/                    # PWA: manifest, icones, service worker
│   ├── manifest.webmanifest
│   ├── icon.svg / icon-maskable.svg
│   └── sw.js
├── docs/
│   ├── ESTADO-DO-PROJETO.md   # este documento
│   ├── briefing-*.md          # briefings de escopo
│   └── migrations/            # 0001 localizacao, 0002 aprovacao
└── src/
    ├── main.jsx               # bootstrap + registro do SW + logger global
    ├── App.jsx                # composition root (sessao, nav, viewMap, render)
    ├── config/
    │   ├── navigation.js       # grupos e itens do menu
    │   └── lazyViews.js        # registro das 22 views lazy (code splitting)
    ├── services/
    │   └── adminApi.js         # toda a comunicacao com o Supabase
    ├── hooks/                  # logica de estado reutilizavel
    ├── lib/                    # regras puras (sem React)
    ├── components/             # UI reutilizavel
    ├── features/              # uma pasta por tela/modulo
    └── styles/                # CSS dividido por area
```

Tamanho aproximado: **features ~4.650 linhas**, **lib ~2.150**, **components
~1.280**, **styles ~1.790**.

---

## 4. Arquitetura em camadas

```txt
features/*View.jsx        (telas — recebem dados via props, disparam acoes)
        │  usa
        ▼
components/*              (UI burra reutilizavel: DataTable, Drawer, badges…)
lib/*                     (regras puras: pendencias, sla, analytics, faixas…)
hooks/*                   (estado: sessao, dados do painel, acoes, filtros)
        │  chama
        ▼
services/adminApi.js      (unico ponto de acesso ao Supabase)
        │
        ▼
Supabase (views admin_*_view, tabelas, RPC, Realtime)
```

Princípios:
- **Telas não chamam o Supabase diretamente** — recebem `dataState` por props do
  `App` (carregado uma vez) e chamam `adminApi`/hooks para ações.
- **lib/ é pura** (sem React, sem I/O) → testável e reutilizável entre telas.
- Tudo é **derivado dos dados já carregados** (sem chamadas extras por tela).

### 4.1 Fluxo de dados

1. `useAdminSession` valida login + se o usuário está em `admin_users`.
2. `useDashboardData(user, admin)` carrega ~14 views em paralelo (`Promise.all`),
   com **polling de 3 min** + **Realtime** (9 tabelas) para refresh imediato.
3. `App` monta o `viewMap` passando fatias do `dataState` para cada tela.
4. `useRecebimentoActions` concentra ações de XML/bônus/pedidos de compra.

---

## 5. Mapa de telas (navegação)

| Grupo | Tela | Rota | Origem dos dados |
|---|---|---|---|
| **Geral** | Início (monitor + dashboard) | `/inicio` | summary + várias |
| | Indicadores | `/indicadores` | KPIs/metas/comparativo derivados |
| | Colaboradores | `/users` | active users + eventos por usuário |
| | Auditoria | `/events` | operational_events + ações de pedido |
| **Operação** | Pendências | `/pendencias` | motor de pendências (todas as fontes) |
| | Recebimento | `/recebimento` | purchase_orders + recebimentos |
| | Conferências | `/conferencia` | filas entrada/saída + divergências |
| | Tratativas | `/tratativas` | treatment cases |
| | Aprovações | `/aprovacoes` | fila local + (futuro: approval_requests) |
| | Avarias | `/avarias` | avaria_items |
| | Validade | `/validade` | validade_products |
| | Fechamento diário | `/fechamento` | resumo derivado + registro local |
| **Inteligência** | Relatórios | `/relatorios` | 13 relatórios derivados |
| | Fornecedores | `/fornecedores` | derivado de pedidos/divergências/avarias |
| | Qualidade de cadastro | `/qualidade` | completude de validade |
| | Ranking de produtos | `/ranking` | ocorrências por produto |
| | Mapa operacional | `/mapa` | pendências por setor (proxy: módulo) |
| **Sistema** | Configurações | `/configuracoes` | localStorage |
| | Administração | `/admin` | export + checklist + permissões |
| | Importação em massa | `/importacao` | parse CSV + validação |
| | Logs técnicos | `/logs` | buffer local de erros |
| **Standalone** | Modo TV | `/tv` | tela cheia, fora do AdminShell |

---

## 6. Camada de dados (`services/adminApi.js`)

**Auth:** `signIn`, `signOut`, `getCurrentSession`, `getCurrentUser`,
`assertAdmin` (checa `admin_users`), `getProfile`.

**Views lidas:**
`admin_dashboard_summary_view`, `admin_active_users_view`,
`admin_tratativas_view`, `admin_validade_products_view`,
`admin_avaria_items_view`, `admin_conferencia_recebimentos_view`,
`admin_conferencia_saidas_view`, `admin_conferencia_divergencias_view`,
`admin_conferencia_bonus_queue_view`, `admin_conferencia_saida_bonus_queue_view`,
`admin_purchase_orders_view`, `admin_purchase_order_actions_view`.

**Ações (writes/RPC):** tratativa de validade, resolução/remoção de avaria,
fila de conferência (entrada/saída: atribuir, finalizar, reabrir, dar entrada/
saída), pedidos de compra (entrada, bônus, devolução, reimpressão, auditoria),
import de bônus por XML/recebimento/pedido, `admin_force_sign_out` (RPC segura),
`getUserEvents`.

**Resiliência:** `readMany(..., { optional: true })` degrada para `[]` quando uma
view ainda não foi migrada (não derruba o painel). **Realtime** em 9 tabelas
operacionais; **polling** a cada 3 min como fallback.

---

## 7. Biblioteca de regras (`lib/`)

| Arquivo | Responsabilidade |
|---|---|
| `supabase.js` | cliente Supabase (anon key) |
| `format.js` | datas, números, tempo relativo, truncate |
| `csv.js` | exportação CSV |
| `csvImport.js` | parser CSV RFC 4180-aware + validação por linha + modelo |
| `nfeXml.js` | parse de NF-e (XML) |
| `toast.js` / `chartTheme.js` | feedback e tema de gráficos |
| `severity.js` | gravidade (crítico→informativo) + prioridade + pesos |
| `sla.js` | prazos por tipo de tarefa + status de SLA |
| `pendencias.js` | **motor central**: agrega ocorrências, prioridade, fila |
| `validadeFaixas.js` | faixas de validade configuráveis + detecção de imagem |
| `analytics.js` | fornecedores, qualidade de cadastro, ranking |
| `dashboards.js` | KPIs por módulo, comparativo de período, progresso de metas |
| `metas.js` | metas operacionais (alvos editáveis) |
| `relatorios.js` | definições dos 13 relatórios + janelas de período |
| `globalSearch.js` | índice e busca global em memória |
| `timeline.js` | normaliza eventos em timeline + atividade por colaborador |
| `notificacoes.js` | deriva notificações (pendências + eventos) |
| `fechamento.js` | resumo do dia + persistência de fechamentos |
| `config.js` | listas operacionais (funções, setores, motivos) |
| `permissions.js` | permissões granulares por ação × papel |
| `validations.js` | travas contra erro humano |
| `logger.js` | logs técnicos (buffer + captura global) |
| `aprovacoes.js` | fila de workflow de aprovação |

---

## 8. Componentes (`components/`)

`AdminShell` (sidebar + topbar + busca + sino + tema), `AppIcon`, `DataTable`
(busca/sort/paginação), `Drawer`, `ConfirmModal`, `PanelSection`, `MetricCard`,
`StatusBadge`, `SeverityBadge` (gravidade/prioridade/SLA), `Timeline`,
`BeforeAfter` (antes/depois), `GlobalSearch`, `NotificationsBell`, `SearchInput`,
`SelectFilter`, `ResourceTable`, `LoginForm`, `ErrorBoundary`.

## 9. Hooks (`hooks/`)

`useAdminSession` (login + verificação admin), `useDashboardData` (carga +
polling + realtime), `useRecebimentoActions` (ações de XML/bônus/pedidos),
`useTableFilter` (busca/filtro), `useConfirm` (modal de confirmação),
`useRealtimeRefresh` (subscriptions Supabase).

---

## 10. Estilos (`styles/`) — briefing §28

CSS dividido por área, importado **na ordem da cascata** no `main.jsx`:

```txt
tokens.css → base.css → layout.css → features.css
           → components.css → responsive.css → modules.css
```

Tokens semânticos (cores de gravidade, superfícies, espaçamento, tipografia) com
**tema claro e escuro**. A divisão preserva a cascata byte a byte (validada por
`diff` contra o arquivo único original).

---

## 11. PWA — briefing §17

`manifest.webmanifest` (display standalone, tema ember, ícones `any` +
`maskable`), `sw.js` (service worker mínimo: network-first para navegação,
cache-first para assets hashados, **sem cache do Supabase**), registrado só em
produção no `main.jsx`. Instalável no desktop.

---

## 12. Persistência local (localStorage)

Configurações e estados de governança que ainda não têm backend dedicado:

| Chave | Conteúdo |
|---|---|
| `gh-theme` | tema claro/escuro |
| `gh-config-validade-v1` | faixas de validade (crítico/atenção/monitorar) |
| `gh-config-sistema-v1` | funções, setores, motivos |
| `gh-metas-v1` | alvos das metas operacionais |
| `gh-permissions-v1` | matriz de permissões por papel |
| `gh-checklist-v1` | checklist de publicação |
| `gh-notif-read-v1` | notificações lidas |
| `gh-fechamentos-v1` | histórico de fechamentos diários |
| `gh-aprovacoes-v1` | fila de aprovações |
| `gh-logs-v1` | logs técnicos |

> Esses dados são **locais ao navegador**. Para uso multiusuário/auditável,
> devem ser migrados para tabelas no Supabase (ver §14).

---

## 13. Deploy (briefing §26/§27)

- **Vercel:** preset Vite, build `npm run build`, output `dist`. `vercel.json`
  faz o rewrite SPA (todas as rotas → `index.html`).
- **Variáveis:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. **Nunca** usar
  `service_role` no frontend.
- **CI:** `.github/workflows/ci.yml` roda `npm ci` + `npm run build` em push na
  `main` e em PRs.

---

## 14. Limitações conhecidas / pendências de backend

Funcionalidades com **camada visual pronta** que dependem de migração/endpoint:

| Item | Estado | O que falta |
|---|---|---|
| Controle por setor/filial | UI lê de forma tolerante | aplicar `migrations/0001` e expor campos nas views |
| Workflow de aprovação | fila local funcional | aplicar `migrations/0002` + app gravar solicitações |
| Reset de senha seguro | botão de encerrar sessão existe | RPC `SECURITY DEFINER` (nunca `service_role` no front) |
| Importação de produtos/colaboradores | valida e pré-visualiza | endpoint de inserção no Supabase |
| Alterar função/permissão do colaborador | matriz de governança local | persistência + enforcement (RLS) no banco |
| Metas/checklist/fechamento | localStorage | tabelas para histórico multiusuário |
| Imagem/EAN de produto | detecção tolerante (degrada) | colunas no schema + publicação pelo app |

Migrações disponíveis:
- `docs/migrations/0001_setor_filial_localizacao.sql` — campos de localização.
- `docs/migrations/0002_workflow_aprovacao.sql` — tabela `approval_requests` + view + RLS.

---

## 15. Qualidade

- **Build** verde a cada incremento (`npm run build`).
- **Code splitting**: cada tela é um chunk lazy (Recharts isolado no dashboard).
- **Duas revisões adversariais** (multi-agente) sobre a lógica nova encontraram e
  corrigiram **19 bugs** de lógica/UX (gravidade, SLA, contagens, parser CSV,
  janelas de período, etc.).
- **Branch de trabalho:** `redesign/admin-saas`.

---

## 16. Como rodar

```bash
npm install
cp .env.example .env     # preencher com o projeto Supabase
npm run dev              # http://localhost:4173
npm run build            # produção em dist/
```
