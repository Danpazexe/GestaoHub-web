# GestãoHub Webapp — Segurança e Melhorias

> Auditoria multi-agente (105 agentes, 99 achados → **94 confirmados** após verificação adversarial) do `GestaoHub-web` + base Supabase. Foco: segurança (RLS/RPC, segredos, auth, deps) e o que dá para acrescentar.
>
> Status: **corrigido** ✅ · **aberto** 🔴/🟡 · Última atualização: 2026-06-28.

---

## 1. Veredito de segurança

A base **não tem falhas triviais** (sem segredo de servidor no front, sem SQL injection, RLS por dono+admin, `.env` fora do git). O risco real está concentrado em **um tema**: a **governança/autorização granular ainda não é aplicada no servidor** — a matriz de permissões protege a UI, mas o banco autoriza só por "dono OU admin". Some-se a isso a **revogação de sessão incompleta** e a **auditoria que quase não escreve**.

| Severidade (ajustada) | Qtde | Já corrigido nesta rodada |
| --- | --- | --- |
| 🔴 Crítico | 6 | 2 (perfil admin imutável, auditoria append-only parcial) |
| 🟠 Alto | ~10 | 1 parcial (gates de UI em 2 telas) |
| 🟡 Médio/baixo | resto | `ws` (dep), forceSignOut emite evento |

### Já aplicado (commits recentes)
- ✅ **`ws` (high, DoS) em produção** → `npm audit fix` → 0 vulnerabilidades de produção.
- ✅ **Perfil `admin` imutável** (`definir_permissao_perfil` recusa alterar admin) — migração `0011`.
- ✅ **Auditoria append-only** (`operational_events` com policies `RESTRICTIVE` contra UPDATE/DELETE) — `0011`.
- ✅ **`forceSignOut` passa a emitir `operational_event`** (PR anterior).
- ✅ **Gates `can_export_reports`** em Relatórios e Admin (PR anterior).

---

## 2. Segurança — achados abertos

### 🔴 Críticos

| # | Achado | Onde | Esforço |
| --- | --- | --- | --- |
| C1 | **Permissões não valem no servidor.** `tem_permissao()` existe mas **nenhuma RLS a usa**; tabelas operacionais autorizam só por `auth.uid()=user_id` OU `is_admin_user()`. Um `operador` deleta/edita via API mesmo com `can_*=false`. | `0010` + `schema.sql` (policies) | alto → **ver §4 (plano)** |
| C2 | **`forceSignOut` não invalida o JWT.** Marca `user_presence='signed_out'`, mas o token do app continua válido (~1h) e acessa dados via API. | `adminApi.forceSignOut` + RPC `admin_force_sign_out` | alto |
| C3 | **Auditoria quase não escreve.** Só 1 de ~27 mutações emite evento. As demais (tratar/excluir/corrigir/atribuir/auditar nota…) não geram trilha — falsa sensação de auditoria (§18). | `adminApi.js` (mutações) | médio |
| C4 | **Motivo obrigatório só em 3 de 6 fluxos.** Falta em excluir, corrigir nota, remover responsável, resolver divergência (§25). | `validations.js` + modais | médio |
| C5 | **`registrar_evento` sem whitelist de `module`/`event_type`** → auditoria pode ser poluída (spam/DoS de logs); `actor_name` pode gravar NULL. | `0009_governanca.sql` | baixo |
| C6 | (parcial) **Auditoria apagável** — corrigido o DELETE/UPDATE via `0011`; resta validar `module`/`event_type` (= C5). | `0011` ✅ + C5 | — |

### 🟠 Altos

| # | Achado | Onde | Esforço |
| --- | --- | --- | --- |
| A1 | **`resolver_permissoes_usuario(uuid)` vaza permissões de terceiros** — aceita UUID arbitrário sem checar `auth.uid()=p_user OR is_admin`. Qualquer autenticado lê o perfil/permissões de qualquer um. | `0010:146-187` | baixo |
| A2 | **Gates de UI ausentes** em ~18 das 20 telas (botões de ação aparecem para quem não pode; dependem só do RLS). | views (`ValidadeView`, `UsersView`, …) | médio |
| A3 | **Upload de CSV sem limite de tamanho** → DoS de memória no navegador (arquivo gigante). | `ImportacaoView:27`, `useRecebimentoActions` | baixo |
| A4 | **Sem rate limiting no login** (brute force). Confiar na proteção nativa do Supabase + throttle no front + CAPTCHA após N tentativas. | `LoginForm` + `adminApi.signIn` + Supabase Dashboard | médio |
| A5 | **`approval_requests.entity_id` sem FK/validação** — solicitações fantasma; `before/after` sem schema. | `0002` | médio |
| A6 | **Sessão expirada sem re-auth/retry guiado** — token expira no meio da operação → erro genérico. | `useAdminSession` / `adminApi` | médio |

### 🟡 Médios/baixos
- **Anon key no bundle** — é *by design* (chave publicável); RLS forte mitiga. Reforçar: policies `DELETE using(false)` explícitas em tabelas sensíveis, rotação periódica, restrição de Referrer/rate-limit no Supabase.
- **Sem CSP** no `vercel.json` (tem os demais headers). Adicionar CSP exige listar origens (Supabase, fonts) e `style-src 'unsafe-inline'` por causa de estilos inline.
- **SRI no Google Fonts** ausente (irrelevante na prática — é CSS de origem confiável).
- **RLS multi-filial** ausente (preventivo; hoje é single-tenant, sem risco atual).

### Robustez/confiabilidade (categorizadas como segurança pelos agentes)
`readMany/readPt` sem **timeout/AbortController** nem **retry**; `Promise.all` em `ConfiguracoesView` engole falha parcial (usar `allSettled` + toast); **cache sem TTL/invalidação** (supervisor B não vê config alterada por A até F5). Todos **esforço baixo**, alto valor de UX.

### ✅ O que está correto
Sem `service_role` no front (só anon); **queries 100% parametrizadas** (sem SQLi); `.env` gitignored; headers de segurança no Vercel; RLS base por dono+admin; funções `SECURITY DEFINER` com `search_path` setado; `is_admin_user()` correta.

---

## 3. O que acrescentar (melhorias)

### P1 — alto valor
| Item | Detalhe | Esforço |
| --- | --- | --- |
| **Anexos/comprovantes (§23)** | Bucket `document-attachments` + tabela `document_attachments` + RLS + componente `<FileUpload>` em conferência/validade/divergência. | médio |
| **Export XLSX e PDF real** | Hoje só CSV + `window.print()`. Adicionar `xlsx` + `jsPDF/autotable`; `lib/exporters.js`. | médio |
| **Acessibilidade (WCAG AA)** | Skip links, focus-trap em modais (Drawer/Confirm), contraste do `--muted-2` (~2.8:1 falha), `aria-sort`/teclado nas tabelas. `@axe-core` no dev. | médio |
| **Observabilidade** | Sentry (erros) + `web-vitals` (LCP/CLS) — hoje só logs locais/Supabase. | baixo |

### P2 — qualidade/robustez
- **Bundle**: `DashboardView`/recharts = 387 kB → code-split do gráfico; `loading="lazy"` nas imagens.
- **CI/qualidade**: `husky` + `lint-staged` (pre-commit) e **branch protection** (lint/test bloqueando merge); `semantic-release`/tags+changelog.
- **Bug real**: `Number(val) || DEFAULT` em `validadeFaixas.normalize` **descarta `0`** (0 é falsy) → criar `lib/validators.toNumber()` central e reusar.
- **DRY**: `structuredCloneSafe` duplicado (`config.js`/`permissions.js`) → `lib/clone.js`; `isNumber` morto em `csvImport`; `readMany`/`readPt` com leve duplicação.
- **Observabilidade de logs**: padronizar `console.warn` (degradação esperada) vs `logError` (inesperado) — criar `logWarn`.
- **PWA**: `stale-while-revalidate` para dados (opcional — painel é tempo-real, dado fresco é desejável).

---

## 4. Plano: permissões reais no servidor (RLS) — resolve C1 e A1/A2

Hoje a infra existe (`perfis_acesso`, `permissoes_acoes`, `perfis_permissoes`, `usuario_perfil`, `tem_permissao()`, `resolver_permissoes_usuario()`), o `PermissionsContext.can()` já roda no front, mas **as policies das tabelas ainda usam só `is_admin_user()`**. O plano torna a matriz efetiva, **sem quebrar** o que funciona.

### Princípio
RLS **aditiva**: `is_admin_user() OR tem_permissao('can_x')`. Admins (na tabela `admin_users`) seguem com acesso total; perfis não-admin passam a ser governados pela matriz. Nada trava enquanto não houver perfis atribuídos.

### Pré-requisitos (rápidos, antes de ligar RLS)
1. **Corrigir A1** — `resolver_permissoes_usuario`: barrar leitura de terceiros.
   ```sql
   -- no início da função, após resolver v_is_admin:
   if p_user <> auth.uid() and not public.is_admin_user() then
     raise exception 'Sem permissão para consultar permissões de outro usuário';
   end if;
   ```
2. **Atribuir perfis** (`usuario_perfil`) a todos os usuários não-admin via `atribuir_perfil_usuario(uuid, 'operador'|'supervisor'|'leitura')`. Sem perfil → `tem_permissao` é `false` → o usuário perderia acesso ao ligar a RLS. Definir um **perfil padrão** (ex.: `leitura`) para quem não tem.
3. **Helper de conveniência** no banco:
   ```sql
   create or replace function public.pode(p_chave text)
   returns boolean language sql stable security definer set search_path = public
   as $$ select public.is_admin_user() or public.tem_permissao(p_chave); $$;
   ```

### Mapa tabela × comando × permissão
| Tabela | SELECT | UPDATE/escrita | DELETE |
| --- | --- | --- | --- |
| `validade_products` | `can_view_dashboard` | `can_edit_validade` | `can_delete_validade` |
| `purchase_orders` / entrada | `can_view_dashboard` | `can_correct_entrada` | — |
| `conferencia_*` (atribuir) | `can_view_dashboard` | `can_assign_tasks` | — |
| `approval_requests` (decidir) | `can_view_audit` | `can_approve_workflows` | — |
| `operational_events` / views auditoria | `can_view_audit` | (append-only) | bloqueado ✅ |
| `sistema_configuracoes` | `can_view_dashboard` | `can_manage_settings` | `can_manage_settings` |

### Migração (padrão por tabela/comando) — exemplo `validade_products`
```sql
-- mantém owner + admin e ADICIONA a camada de permissão (aditiva).
drop policy if exists validade_products_admin_update on public.validade_products;
create policy validade_products_perm_update on public.validade_products
  for update using (auth.uid() = user_id or public.pode('can_edit_validade'))
            with check (auth.uid() = user_id or public.pode('can_edit_validade'));

create policy validade_products_perm_delete on public.validade_products
  for delete using (public.pode('can_delete_validade'));
```
Repetir o padrão para cada tabela conforme o mapa. Idempotente (`drop policy if exists` + `create`).

### Backend de mutações que exigem `service_role` (C2/§11)
Criar **Edge Functions** (com `service_role`, nunca no front) para: criar usuário, **resetar senha**, alterar função, **bloquear/desbloquear** e **revogar sessão de verdade** (`auth.admin.signOut`/`deleteUser`) — cada uma checando `pode('can_*')` e gravando `operational_event`. Resolve C2 (revogação real) e o "backend de usuários".

### Auditoria de escrita (C3/C4) — junto
Encapsular as mutações do `adminApi` num helper que, após sucesso, chama `logOperationalEvent(...)`, e exigir **motivo** (`hasReason`) nas ações críticas (excluir/corrigir/remover/resolver) antes de chamar a API.

### Rollout seguro
1. Aplicar pré-requisitos (1–3) e atribuir perfis.
2. Ligar RLS por tabela **em staging**; testar com 1 usuário de cada perfil (operador não deleta validade; supervisor não mexe em settings; leitura só lê).
3. Promover para produção tabela a tabela. `is_admin_user()` permanece como rede de segurança o tempo todo.

### Riscos & mitigações
- **Lockout** → camada aditiva + perfil admin imutável (`0011`) + perfil padrão `leitura`.
- **Performance** → `tem_permissao` é `STABLE`/`SECURITY DEFINER` (cacheável por statement); se necessário, simplificar `resolver_*` ou materializar o mapa por usuário.
- **Vazamento via resolver** → corrigido no pré-requisito 1.

---

## 5. Sequência recomendada
1. **Quick wins de segurança** (esforço baixo): A1 (guard do resolver), A3 (limite de upload), C5 (whitelist `registrar_evento`), `Promise.allSettled`, timeout/retry. 1 migração `0012` + ajustes no `adminApi`.
2. **Auditoria de escrita + motivo** (C3/C4) — wrapper no `adminApi`.
3. **RLS por permissão** (C1) — §4, faseado.
4. **Edge Functions** (C2 + backend de usuários).
5. **P1** (anexos, XLSX/PDF, a11y, observabilidade).
