# Supabase em Português — Plano de Migração (briefing §7–§15)

> Reorganização do banco para nomes em português, separados por módulo, **sem
> quebrar App/Webapp**. Estratégia gradual e não-destrutiva. Documento gerado a
> partir do schema real (`GestaoHub-app/supabase/*.sql`).

> ⚠️ As migrações precisam ser **aplicadas por você** no Supabase (SQL Editor) —
> eu não tenho acesso de escrita ao banco. Cada passo é aditivo e reversível.

---

## 1. Inventário atual (real)

**Tabelas (19):** `admin_users`, `profiles`, `user_presence`, `user_settings`,
`validade_products`, `avaria_batches`, `avaria_items`, `purchase_orders`,
`purchase_order_items`, `purchase_order_actions`, `recebimento_treatment_cases`,
`conferencia_recebimentos`, `conferencia_saidas`, `conferencia_divergencias`,
`conferencia_bonus_queue`, `conferencia_bonus_queue_items`,
`conferencia_saida_bonus_queue`, `conferencia_saida_bonus_queue_items`,
`operational_events`.

**Views admin (12):** `admin_dashboard_summary_view`, `admin_active_users_view`,
`admin_validade_products_view`, `admin_tratativas_view`, `admin_avaria_items_view`,
`admin_conferencia_recebimentos_view`, `admin_conferencia_saidas_view`,
`admin_conferencia_divergencias_view`, `admin_conferencia_bonus_queue_view`,
`admin_conferencia_saida_bonus_queue_view`, `admin_purchase_orders_view`,
`admin_purchase_order_actions_view`.

**Funções/RPC (4):** `is_admin_user()`, `admin_force_sign_out()`,
`handle_new_user_profile()`, `set_updated_at()`.

**Storage:** bucket privado `product-images` (imagens de validade, coluna
`validade_products.image_path`).

---

## 2. Por que não renomear as tabelas agora

Renomear tabelas/colunas reais quebraria **simultaneamente**: App mobile,
Webapp, as 12 views admin, as RPCs, as políticas RLS, o Realtime (publication
`supabase_realtime`) e os índices. O briefing (§7.1) é explícito: migração
**gradual** com **camada de compatibilidade**, removendo nomes antigos só no fim.

**Decisão:** começar pela camada de **views em português** (alias), migrar a
Webapp tela por tela, e só muito depois (opcional) renomear tabelas físicas.

---

## 3. Dicionário inglês → português

### Tabelas → schema/nome em português (alvo futuro)

| Atual | Módulo | Português (alvo) |
|---|---|---|
| `profiles` | usuarios | `usuarios.colaboradores` |
| `admin_users` | usuarios | `usuarios.perfis_acesso` |
| `user_presence` | usuarios | `usuarios.sessoes_dispositivos` |
| `user_settings` | usuarios | `usuarios.preferencias` |
| `validade_products` | validade | `validade.produtos` |
| `avaria_batches` | avarias | `avarias.lotes` |
| `avaria_items` | avarias | `avarias.itens` |
| `purchase_orders` | recebimento | `recebimento.notas_entrada` |
| `purchase_order_items` | recebimento | `recebimento.itens_nota_entrada` |
| `purchase_order_actions` | recebimento | `recebimento.acoes_pedido` |
| `recebimento_treatment_cases` | recebimento | `recebimento.tratativas` |
| `conferencia_recebimentos` | conferencia | `conferencia.recebimentos` |
| `conferencia_saidas` | conferencia | `conferencia.saidas` |
| `conferencia_divergencias` | conferencia | `conferencia.divergencias` |
| `conferencia_bonus_queue` | conferencia | `conferencia.fila_entrada` |
| `conferencia_bonus_queue_items` | conferencia | `conferencia.itens_fila_entrada` |
| `conferencia_saida_bonus_queue` | conferencia | `conferencia.fila_saida` |
| `conferencia_saida_bonus_queue_items` | conferencia | `conferencia.itens_fila_saida` |
| `operational_events` | auditoria | `auditoria.eventos` |

### Views admin → `admin.visao_*` (entregue na migração 0004)

| Atual (`public.`) | Português (`admin.`) |
|---|---|
| `admin_dashboard_summary_view` | `visao_resumo_dashboard` |
| `admin_active_users_view` | `visao_usuarios_ativos` |
| `admin_validade_products_view` | `visao_produtos_validade` |
| `admin_tratativas_view` | `visao_tratativas` |
| `admin_avaria_items_view` | `visao_avarias` |
| `admin_conferencia_recebimentos_view` | `visao_conferencias_recebimento` |
| `admin_conferencia_saidas_view` | `visao_conferencias_saida` |
| `admin_conferencia_divergencias_view` | `visao_divergencias_conferencia` |
| `admin_conferencia_bonus_queue_view` | `visao_bonus_entrada` |
| `admin_conferencia_saida_bonus_queue_view` | `visao_bonus_saida` |
| `admin_purchase_orders_view` | `visao_notas_entrada` |
| `admin_purchase_order_actions_view` | `visao_acoes_pedidos` |
| `operational_events` | `visao_eventos_operacionais` |

### Colunas (padrão alvo para tabelas novas em português)

`id`, `codigo_produto`, `codigo_ean`, `descricao`, `quantidade`, `lote`,
`data_validade`, `dias_restantes`, `status`, `tipo_tratativa`,
`quantidade_tratada`, `responsavel_id`, `motivo`, `observacao`, `criado_em`,
`atualizado_em`, `criado_por`, `atualizado_por`. Auditoria: `ator_usuario_id`,
`usuario_alvo_id`, `modulo`, `tipo_acao`, `tipo_entidade`, `entidade_id`,
`antes`, `depois`.

---

## 4. Estratégia gradual (fases)

| Fase | Ação | Risco | Status |
|---|---|---|---|
| **1** | Camada de views `admin.visao_*` (alias) | baixo | ✅ SQL pronto: `migrations/0004` |
| **2** | Expor o schema `admin` na API + migrar a Webapp tela por tela | baixo | a fazer |
| **3** | Schemas de domínio (`usuarios`, `validade`, …) com **views** sobre as tabelas atuais | baixo | a planejar |
| **4** | Migrar o App mobile para os nomes novos (gradual) | médio | a planejar |
| **5** | Mover tabelas físicas para os schemas (com views de compat. no `public`) | alto | só no fim |
| **6** | Remover nomes antigos | alto | só quando tudo estável |

### Camada de compatibilidade
A migração 0004 faz o **inverso seguro** do exemplo do briefing: as views em
português **leem das views antigas** (que permanecem intactas). Assim nada
quebra. Quando a Webapp/App estiverem 100% nos nomes novos, inverte-se a fonte
e as views antigas viram aliases — aí sim removíveis.

---

## 5. O que já está pronto

- **`migrations/0004_views_portugues_admin.sql`** — schema `admin` + 13 views
  `visao_*` (alias não-destrutivo, `security_invoker`).
- Para usar na Webapp depois de aplicar: em **Settings > API > Exposed schemas**
  adicione `admin`, e no `adminApi` troque, por tela:
  `supabase.from('admin_validade_products_view')` →
  `supabase.schema('admin').from('visao_produtos_validade')`.

## 6. Riscos & rollback

- **Exposição do schema:** sem adicionar `admin` aos *Exposed schemas*, o
  PostgREST não enxerga as views (erro 404). É só configuração, reversível.
- **security_invoker:** mantém a RLS de quem consulta; se uma view antiga já
  dependia do owner, valide o acesso admin após aplicar.
- **Rollback da 0004:** `drop schema admin cascade;` remove tudo que foi criado,
  sem tocar em nada do `public`.
- **Não** rode renomeação de tabela (Fase 5) sem antes migrar App **e** Webapp e
  validar Realtime/RLS/RPC num ambiente de teste.

---

## 7. Próximos passos sugeridos

1. Aplicar `migrations/0003` (imagens) e `migrations/0004` (views pt-BR).
2. Expor o schema `admin` na API do Supabase.
3. Migrar a Webapp tela por tela para `admin.visao_*` (posso fazer isso com você,
   uma tela por commit, validando cada uma).
4. Depois, planejar as Fases 3–4 (schemas de domínio + App mobile).
