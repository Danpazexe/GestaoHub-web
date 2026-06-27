-- Migração 0005 — Schemas de domínio + views com COLUNAS em português
-- (briefing §8/§9/§10/§12). Camada de LEITURA/BI em português, sem tocar nas
-- tabelas físicas (o App mobile continua escrevendo nelas em inglês com upsert).
--
-- Estratégia segura: cada view em português SELECIONA da view admin_*_view
-- existente e ALIASA as colunas para português. Só usa colunas que a Webapp já
-- consome (logo, existem na sua base). Idempotente e não-destrutivo.
--
-- Rodar DEPOIS de 0003 (para validade ter image_path -> caminho_imagem).
--
-- Pós-aplicação: Supabase Dashboard > Settings > API > "Exposed schemas",
-- adicione: usuarios, validade, avarias, recebimento, conferencia, sistema,
-- auditoria. No frontend: supabase.schema('validade').from('produtos').
-- (Se preferir expor menos, troque os schemas abaixo por um único, ex.: `pt`.)
--
-- security_invoker = true: mantém a RLS / is_admin_user() de quem consulta.

create schema if not exists usuarios;
create schema if not exists validade;
create schema if not exists avarias;
create schema if not exists recebimento;
create schema if not exists conferencia;
create schema if not exists sistema;
create schema if not exists auditoria;
grant usage on schema usuarios, validade, avarias, recebimento, conferencia, sistema, auditoria
  to authenticated, anon, service_role;

-- ── Usuários ─────────────────────────────────────────────────────────────────
create or replace view usuarios.colaboradores_ativos with (security_invoker = true) as
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
create or replace view validade.produtos with (security_invoker = true) as
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
create or replace view avarias.itens with (security_invoker = true) as
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
create or replace view recebimento.tratativas with (security_invoker = true) as
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

create or replace view recebimento.notas_entrada with (security_invoker = true) as
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

create or replace view recebimento.acoes_pedido with (security_invoker = true) as
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

create or replace view recebimento.conferencias with (security_invoker = true) as
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
  updated_at        as atualizado_em
from public.admin_conferencia_recebimentos_view;

-- ── Conferência ──────────────────────────────────────────────────────────────
create or replace view conferencia.saidas with (security_invoker = true) as
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

create or replace view conferencia.divergencias with (security_invoker = true) as
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

create or replace view conferencia.fila_entrada with (security_invoker = true) as
select
  id                      as id,
  invoice_number          as numero_nf,
  supplier_name           as nome_fornecedor,
  item_count              as qtd_itens,
  total_quantity          as quantidade_total,
  status                  as situacao,
  assigned_user_id        as responsavel_id,
  assigned_user_name      as responsavel_nome,
  started_at              as iniciada_em,
  finished_at             as finalizada_em,
  created_at              as criado_em
from public.admin_conferencia_bonus_queue_view;

create or replace view conferencia.fila_saida with (security_invoker = true) as
select
  id                 as id,
  order_code         as codigo_pedido,
  customer_name      as nome_cliente,
  customer_code      as codigo_cliente,
  route_code         as codigo_rota,
  carga_code         as codigo_carga,
  item_count         as qtd_itens,
  total_quantity     as quantidade_total,
  status             as situacao,
  assigned_user_id   as responsavel_id,
  assigned_user_name as responsavel_nome,
  started_at         as iniciada_em,
  finished_at        as finalizada_em,
  created_at         as criado_em
from public.admin_conferencia_saida_bonus_queue_view;

-- ── Sistema (resumo) ─────────────────────────────────────────────────────────
create or replace view sistema.resumo_dashboard with (security_invoker = true) as
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
create or replace view auditoria.eventos with (security_invoker = true) as
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
grant select on all tables in schema usuarios, validade, avarias, recebimento, conferencia, sistema, auditoria
  to authenticated, anon;
alter default privileges in schema usuarios  grant select on tables to authenticated, anon;
alter default privileges in schema validade  grant select on tables to authenticated, anon;
alter default privileges in schema avarias   grant select on tables to authenticated, anon;
alter default privileges in schema recebimento grant select on tables to authenticated, anon;
alter default privileges in schema conferencia grant select on tables to authenticated, anon;
alter default privileges in schema sistema    grant select on tables to authenticated, anon;
alter default privileges in schema auditoria  grant select on tables to authenticated, anon;

-- Rollback: drop schema usuarios, validade, avarias, recebimento, conferencia,
--           sistema, auditoria cascade;  (não toca em nada do public)
