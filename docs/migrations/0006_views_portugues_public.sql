-- Migração 0006 — Views em português NO SCHEMA PUBLIC (sem expor schema)
--
-- Por que existe: a 0005 cria as views em schemas de domínio (validade.*,
-- recebimento.*…), que exigem "Settings > API > Exposed schemas" no Supabase —
-- passo que nem sempre dá pra fazer. Esta migração cria EXATAMENTE as mesmas
-- views, com as mesmas COLUNAS em português, porém no schema `public` com nome
-- prefixado por domínio (validade_produtos, recebimento_notas_entrada, …). O
-- PostgREST já expõe o `public` automaticamente → nada a configurar no painel.
--
-- No frontend: supabase.from('validade_produtos').select(...)
--
-- É alternativa à 0005 (pode rodar só esta). Idempotente, não-destrutivo,
-- security_invoker. Rodar DEPOIS de 0003 (image_path -> caminho_imagem).
-- Como aplicar: Supabase Dashboard > SQL Editor.

-- ── Usuários ─────────────────────────────────────────────────────────────────
create or replace view public.usuarios_colaboradores_ativos with (security_invoker = true) as
select
  session_id        as sessao_id,
  user_id           as usuario_id,
  name              as nome,
  email             as email,
  device_label      as dispositivo,
  platform          as plataforma,
  app_version       as versao_app,
  current_module    as modulo_atual,
  current_screen    as tela_atual,
  current_order_ref as pedido_atual,
  status            as situacao,
  last_heartbeat_at as ultimo_heartbeat
from public.admin_active_users_view;

-- ── Validade ─────────────────────────────────────────────────────────────────
create or replace view public.validade_produtos with (security_invoker = true) as
select
  user_id            as usuario_id,
  user_name          as nome_usuario,
  user_email         as email_usuario,
  id                 as id,
  codprod            as codigo_produto,
  codauxiliar        as codigo_auxiliar,
  descricao          as descricao,
  lote               as lote,
  validade           as data_validade,
  quantidade         as quantidade,
  diasrestantes      as dias_restantes,
  location           as localizacao,
  status             as situacao,
  treatment_type     as tipo_tratativa,
  treatment_quantity as quantidade_tratada,
  treatment_date     as data_tratativa,
  treatment_note     as observacao_tratativa,
  image_path         as caminho_imagem,
  created_at         as criado_em,
  updated_at         as atualizado_em
from public.admin_validade_products_view;

-- ── Avarias ──────────────────────────────────────────────────────────────────
create or replace view public.avarias_itens with (security_invoker = true) as
select
  user_id         as usuario_id,
  user_name       as nome_usuario,
  user_email      as email_usuario,
  batch_id        as lote_id,
  batch_status    as situacao_lote,
  item_id         as item_id,
  codprod         as codigo_produto,
  descricao       as descricao,
  quantidade      as quantidade,
  lote            as lote,
  damage_type     as tipo_avaria,
  resolution_type as tipo_resolucao,
  item_status     as situacao_item,
  item_created_at as item_criado_em,
  item_updated_at as item_atualizado_em
from public.admin_avaria_items_view;

-- ── Recebimento ──────────────────────────────────────────────────────────────
create or replace view public.recebimento_tratativas with (security_invoker = true) as
select
  user_id                as usuario_id,
  user_name              as nome_usuario,
  user_email             as email_usuario,
  id                     as id,
  doc_number             as numero_documento,
  supplier_code          as codigo_fornecedor,
  origin_invoice_number  as nf_origem,
  return_invoice_number  as nf_devolucao,
  status                 as situacao,
  occurrence_type        as tipo_ocorrencia,
  resolution_type        as tipo_resolucao,
  affected_quantity      as quantidade_afetada,
  expected_quantity      as quantidade_esperada,
  received_quantity      as quantidade_recebida,
  opened_at              as aberta_em,
  closed_at              as fechada_em,
  status_updated_at      as situacao_atualizada_em,
  created_at             as criado_em,
  updated_at             as atualizado_em
from public.admin_tratativas_view;

create or replace view public.recebimento_notas_entrada with (security_invoker = true) as
select
  id                as id,
  order_number      as numero_pedido,
  source_type       as tipo_origem,
  supplier_name     as nome_fornecedor,
  supplier_code     as codigo_fornecedor,
  supplier_document as documento_fornecedor,
  invoice_number    as numero_nf,
  issued_at         as emitida_em,
  status            as situacao,
  entry_status      as situacao_entrada,
  bonus_status      as situacao_bonus,
  return_status     as situacao_devolucao,
  audit_status      as situacao_auditoria,
  item_count        as qtd_itens,
  total_quantity    as quantidade_total,
  reprint_count     as qtd_reimpressoes,
  entry_at          as entrada_em,
  audited_at        as auditada_em,
  closed_at         as fechada_em,
  created_by_name   as criado_por_nome,
  created_at        as criado_em,
  updated_at        as atualizado_em
from public.admin_purchase_orders_view;

create or replace view public.recebimento_acoes_pedido with (security_invoker = true) as
select
  id              as id,
  order_id        as pedido_id,
  created_by_name as criado_por_nome,
  order_number    as numero_pedido,
  invoice_number  as numero_nf,
  supplier_name   as nome_fornecedor,
  action_type     as tipo_acao,
  action_label    as rotulo_acao,
  notes           as observacao,
  created_at      as criado_em
from public.admin_purchase_order_actions_view;

create or replace view public.recebimento_conferencias with (security_invoker = true) as
select
  user_id           as usuario_id,
  user_name         as nome_usuario,
  user_email        as email_usuario,
  id                as id,
  supplier          as fornecedor,
  invoice           as nf,
  conferente        as conferente,
  sync_status       as situacao_sync,
  items_count       as qtd_itens,
  divergences_count as qtd_divergencias,
  created_at        as criado_em,
  updated_at        as atualizado_em,
  payload           as dados   -- jsonb completo (usado para gerar bônus)
from public.admin_conferencia_recebimentos_view;

-- ── Conferência ──────────────────────────────────────────────────────────────
-- (sufixo _pt onde o nome colidiria com uma tabela existente em public)
create or replace view public.conferencia_saidas_pt with (security_invoker = true) as
select
  user_id           as usuario_id,
  user_name         as nome_usuario,
  user_email        as email_usuario,
  id                as id,
  order_code        as codigo_pedido,
  separador         as separador,
  embalador         as embalador,
  sync_status       as situacao_sync,
  items_count       as qtd_itens,
  divergences_count as qtd_divergencias,
  created_at        as criado_em,
  updated_at        as atualizado_em
from public.admin_conferencia_saidas_view;

create or replace view public.conferencia_divergencias_pt with (security_invoker = true) as
select
  user_id      as usuario_id,
  user_name    as nome_usuario,
  user_email   as email_usuario,
  id           as id,
  source       as origem,
  status       as situacao,
  code         as codigo,
  description  as descricao,
  supplier     as fornecedor,
  invoice      as nf,
  order_code   as codigo_pedido,
  expected_qty as quantidade_esperada,
  checked_qty  as quantidade_conferida,
  diff         as diferenca,
  created_at   as criado_em,
  updated_at   as atualizado_em
from public.admin_conferencia_divergencias_view;

-- DROP + CREATE (não create-or-replace): estas trazem campos que a tela usa e
-- numa ordem própria; o create-or-replace só permite apendar no fim.
drop view if exists public.conferencia_fila_entrada;
create view public.conferencia_fila_entrada with (security_invoker = true) as
select
  id                      as id,
  invoice_number          as numero_nf,
  supplier_name           as nome_fornecedor,
  item_count              as qtd_itens,
  total_quantity          as quantidade_total,
  checked_quantity        as quantidade_conferida,
  status                  as situacao,
  assigned_user_id        as responsavel_id,
  assigned_user_name      as responsavel_nome,
  started_at              as iniciada_em,
  finished_at             as finalizada_em,
  conference_result       as resultado_conferencia,
  divergence_count        as qtd_divergencias,
  finalized_with_pendency as finalizada_com_pendencia,
  created_at              as criado_em
from public.admin_conferencia_bonus_queue_view;

drop view if exists public.conferencia_fila_saida;
create view public.conferencia_fila_saida with (security_invoker = true) as
select
  id                      as id,
  order_code              as codigo_pedido,
  customer_name           as nome_cliente,
  customer_code           as codigo_cliente,
  route_code              as codigo_rota,
  carga_code              as codigo_carga,
  item_count              as qtd_itens,
  total_quantity          as quantidade_total,
  checked_quantity        as quantidade_conferida,
  status                  as situacao,
  assigned_user_id        as responsavel_id,
  assigned_user_name      as responsavel_nome,
  started_at              as iniciada_em,
  finished_at             as finalizada_em,
  conference_result       as resultado_conferencia,
  divergence_count        as qtd_divergencias,
  finalized_with_pendency as finalizada_com_pendencia,
  created_at              as criado_em
from public.admin_conferencia_saida_bonus_queue_view;

-- ── Sistema (resumo) ─────────────────────────────────────────────────────────
create or replace view public.sistema_resumo_dashboard with (security_invoker = true) as
select
  active_users             as usuarios_ativos,
  open_tratativas          as tratativas_abertas,
  active_validade_products as produtos_validade_ativos,
  open_avaria_batches      as lotes_avaria_abertos,
  open_avaria_items        as itens_avaria_abertos,
  open_bonus_queue         as fila_bonus_aberta,
  pending_divergencias     as divergencias_pendentes
from public.admin_dashboard_summary_view;

-- ── Auditoria ────────────────────────────────────────────────────────────────
create or replace view public.auditoria_eventos with (security_invoker = true) as
select
  id          as id,
  user_id     as usuario_id,
  module      as modulo,
  event_type  as tipo_evento,
  entity_type as tipo_entidade,
  entity_id   as entidade_id,
  actor_name  as nome_ator,
  order_ref   as pedido_ref,
  batch_ref   as lote_ref,
  payload     as dados,
  created_at  as criado_em
from public.operational_events;

-- ── Permissões de leitura ────────────────────────────────────────────────────
grant select on
  public.usuarios_colaboradores_ativos,
  public.validade_produtos,
  public.avarias_itens,
  public.recebimento_tratativas,
  public.recebimento_notas_entrada,
  public.recebimento_acoes_pedido,
  public.recebimento_conferencias,
  public.conferencia_saidas_pt,
  public.conferencia_divergencias_pt,
  public.conferencia_fila_entrada,
  public.conferencia_fila_saida,
  public.sistema_resumo_dashboard,
  public.auditoria_eventos
to authenticated, anon;

-- Pronto. Views em português prontas para uso direto pela Webapp, sem configurar
-- "Exposed schemas". Rollback: drop view public.<nome>;  (nada do public muda).
