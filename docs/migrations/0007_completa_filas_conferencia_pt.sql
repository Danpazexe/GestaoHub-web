-- Migração 0007 — Completa as views de fila de conferência em português
--
-- As views conferencia_fila_entrada / conferencia_fila_saida (0006) eram enxutas
-- e não traziam campos que a tela de Conferência usa (resultado da conferência,
-- quantidade conferida, contagem de divergência, pendência). Esta migração
-- recria as duas com esses campos. Idempotente (create or replace),
-- security_invoker. Rodar DEPOIS de 0006.
--
-- Como aplicar: Supabase Dashboard > SQL Editor.

create or replace view public.conferencia_fila_entrada with (security_invoker = true) as
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

create or replace view public.conferencia_fila_saida with (security_invoker = true) as
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

grant select on public.conferencia_fila_entrada, public.conferencia_fila_saida
  to authenticated, anon;
