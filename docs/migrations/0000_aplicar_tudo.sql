-- ============================================================================
-- GestãoHub — APLICAR TUDO (consolidado: 0001-0004, 0006-0011)
-- ============================================================================
-- Arquivo único, idempotente (pode reaplicar). Cole no Supabase > SQL Editor.
-- Não precisa configurar "Exposed schemas" (views pt ficam no public).
-- Ordem: localização → aprovação → imagens → views pt (admin) → views pt
-- (public, com filas completas e payload de recebimento) → 0007/0008 →
-- governança (0009: config/fechamento/logs/auditoria) → permissões reais (0010).
-- ============================================================================


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO 0001_setor_filial_localizacao
-- ╚════════════════════════════════════════════════════════════════════╝
-- Migração 0001 — Controle por filial, loja, setor e localização (briefing §2/§3)
--
-- Adiciona campos de localização operacional às tabelas de domínio. É
-- idempotente (ADD COLUMN IF NOT EXISTS) e segura para rodar em produção: não
-- altera dados existentes e os campos nascem nulos.
--
-- Depois de aplicar, o app deve passar a publicar esses campos e as views
-- administrativas (admin_*_view) devem expô-los. A Webapp já lê os campos de
-- forma tolerante (lib/pendencias.readSector/readBranch); assim que vierem
-- preenchidos, o Mapa operacional e os filtros por setor passam a funcionar
-- automaticamente, sem mudança de código no frontend.
--
-- Como aplicar: Supabase Dashboard > SQL Editor > cole e rode. Ou via CLI:
--   supabase db execute --file docs/migrations/0001_setor_filial_localizacao.sql

-- Tabela auxiliar de localizações (opcional, para padronizar/escolher por lista)
create table if not exists public.operational_locations (
  id uuid primary key default gen_random_uuid(),
  branch       text,        -- filial
  store        text,        -- loja
  sector       text,        -- setor (Alimentos, Limpeza, ...)
  aisle        text,        -- corredor
  area         text,        -- área (venda, recebimento, depósito, câmara)
  created_at   timestamptz not null default now()
);

-- Campos de localização nas tabelas de domínio.
-- Repetimos o bloco por tabela para manter a migração explícita e auditável.

-- Produtos de validade
alter table if exists public.validade_products add column if not exists branch  text;
alter table if exists public.validade_products add column if not exists store   text;
alter table if exists public.validade_products add column if not exists sector  text;
alter table if exists public.validade_products add column if not exists aisle   text;
alter table if exists public.validade_products add column if not exists area    text;

-- Itens de avaria
alter table if exists public.avaria_items add column if not exists branch  text;
alter table if exists public.avaria_items add column if not exists store   text;
alter table if exists public.avaria_items add column if not exists sector  text;
alter table if exists public.avaria_items add column if not exists aisle   text;
alter table if exists public.avaria_items add column if not exists area    text;

-- Pedidos de compra / recebimento
alter table if exists public.purchase_orders add column if not exists branch  text;
alter table if exists public.purchase_orders add column if not exists store   text;
alter table if exists public.purchase_orders add column if not exists sector  text;
alter table if exists public.purchase_orders add column if not exists area    text;

-- Filas de conferência (entrada)
alter table if exists public.conferencia_bonus_queue add column if not exists branch text;
alter table if exists public.conferencia_bonus_queue add column if not exists store  text;
alter table if exists public.conferencia_bonus_queue add column if not exists sector text;
alter table if exists public.conferencia_bonus_queue add column if not exists area   text;

-- Filas de conferência (saída)
alter table if exists public.conferencia_saida_bonus_queue add column if not exists branch text;
alter table if exists public.conferencia_saida_bonus_queue add column if not exists store  text;
alter table if exists public.conferencia_saida_bonus_queue add column if not exists sector text;
alter table if exists public.conferencia_saida_bonus_queue add column if not exists area   text;

-- Tratativas de recebimento
alter table if exists public.recebimento_treatment_cases add column if not exists branch text;
alter table if exists public.recebimento_treatment_cases add column if not exists store  text;
alter table if exists public.recebimento_treatment_cases add column if not exists sector text;
alter table if exists public.recebimento_treatment_cases add column if not exists area   text;

-- Índices para filtros por setor/filial (consultas do Mapa e dos filtros).
create index if not exists idx_validade_sector on public.validade_products (sector);
create index if not exists idx_avaria_sector   on public.avaria_items (sector);
create index if not exists idx_po_sector        on public.purchase_orders (sector);

-- LEMBRETE: atualizar as views administrativas (admin_validade_products_view,
-- admin_avaria_items_view, admin_purchase_orders_view, etc.) para incluir os
-- novos campos (branch, store, sector, aisle, area) no SELECT, para que cheguem
-- ao frontend.


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO 0002_workflow_aprovacao
-- ╚════════════════════════════════════════════════════════════════════╝
-- Migração 0002 — Workflow de aprovação (briefing §34.6)
--
-- Cria a fila de solicitações de aprovação de ações críticas, com auditoria
-- completa (quem solicitou/decidiu, quando, motivo, antes/depois). Idempotente.
--
-- A Webapp já tem a tela de Aprovações (Operação → Aprovações) funcionando com
-- fila local; ao integrar esta tabela e o app mobile (que cria as solicitações
-- ao executar ações críticas), as solicitações reais passam a aparecer no painel.
--
-- Como aplicar: Supabase Dashboard > SQL Editor.

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  action_type     text not null,                 -- "Excluir produto", "Marcar como perda", ...
  description      text,
  module          text,                          -- validade | recebimento | conferencia | usuarios
  entity_type     text,
  entity_id       text,
  before_payload  jsonb default '{}'::jsonb,
  after_payload   jsonb default '{}'::jsonb,
  request_reason  text,
  status          text not null default 'pendente'
                    check (status in ('pendente', 'aprovada', 'rejeitada')),
  requested_by    uuid references auth.users (id),
  requested_at    timestamptz not null default now(),
  decided_by      uuid references auth.users (id),
  decided_at      timestamptz,
  decision_reason text
);

create index if not exists idx_approval_status on public.approval_requests (status);
create index if not exists idx_approval_requested_at on public.approval_requests (requested_at desc);

alter table public.approval_requests enable row level security;

-- Leitura/decisão restritas a admins (is_admin_user() já usada no projeto).
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'approval_admin_read') then
    create policy approval_admin_read on public.approval_requests
      for select using (public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where policyname = 'approval_admin_update') then
    create policy approval_admin_update on public.approval_requests
      for update using (public.is_admin_user());
  end if;
  -- Inserção: o usuário autenticado pode solicitar (o app cria as solicitações).
  if not exists (select 1 from pg_policies where policyname = 'approval_user_insert') then
    create policy approval_user_insert on public.approval_requests
      for insert with check (auth.uid() = requested_by);
  end if;
end $$;

-- View administrativa com nomes resolvidos (consumida pela Webapp).
create or replace view public.admin_approval_requests_view as
  select
    ar.*,
    rp.name as requested_by_name,
    dp.name as decided_by_name
  from public.approval_requests ar
  left join public.profiles rp on rp.user_id = ar.requested_by
  left join public.profiles dp on dp.user_id = ar.decided_by;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO 0003_imagens_validade_admin
-- ╚════════════════════════════════════════════════════════════════════╝
-- Migração 0003 — Imagens de produto no painel admin (Controle de Validade)
--
-- Problema: a Webapp não exibe a imagem do produto porque:
--   1) a view admin_validade_products_view NÃO expõe a coluna image_path; e
--   2) o bucket product-images é privado e a política de leitura é só do dono
--      (auth.uid() = primeira pasta do path), então o supervisor/admin não
--      consegue ler a imagem de outro colaborador nem gerar URL assinada.
--
-- Esta migração resolve os dois pontos. Idempotente e não destrutiva.
-- Como aplicar: Supabase Dashboard > SQL Editor > cole e rode.

-- 1) Expor image_path na view administrativa.
--    Mantém a ordem das colunas existentes e APENDA image_path no fim (exigência
--    do create-or-replace view). Atualize os campos abaixo se a view divergir.
create or replace view public.admin_validade_products_view as
select
  vp.user_id,
  p.name  as user_name,
  p.email as user_email,
  vp.id,
  vp.codprod,
  vp.codauxiliar,
  vp.descricao,
  vp.lote,
  vp.validade,
  vp.quantidade,
  vp.diasrestantes,
  vp.location,
  vp.status,
  vp.treatment_type,
  vp.treatment_quantity,
  vp.treatment_date,
  vp.created_at,
  vp.updated_at,
  vp.treatment_note,
  vp.image_path          -- << coluna apendada (consumida pela Webapp)
from public.validade_products vp
left join public.profiles p on p.user_id = vp.user_id
order by vp.updated_at desc;

-- 2) Permitir que administradores LEIAM as imagens do bucket product-images.
--    A política do dono continua valendo para os colaboradores; esta adiciona o
--    acesso de leitura para quem passa em is_admin_user() (mesma função já usada
--    nas demais políticas admin). Necessária para createSignedUrls funcionar no
--    painel.
drop policy if exists storage_read_admin_product_images on storage.objects;

create policy storage_read_admin_product_images
on storage.objects for select
using (
  bucket_id = 'product-images'
  and public.is_admin_user()
);

-- Pronto. Após aplicar, a Webapp (Controle de Validade) passa a gerar URLs
-- assinadas a partir de image_path e exibir as imagens dos produtos.


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO 0004_views_portugues_admin
-- ╚════════════════════════════════════════════════════════════════════╝
-- Migração 0004 — Camada de views administrativas em português (briefing §7/§11)
--
-- Estratégia SEGURA e NÃO-DESTRUTIVA (briefing §7.3): cria um schema `admin` com
-- views em português que apenas SELECIONAM das views públicas existentes
-- (admin_*_view). Nada é renomeado nem movido; as views antigas continuam
-- funcionando e o app/webapp não quebram. A Webapp pode migrar tela por tela
-- depois, trocando o nome lido no adminApi.
--
-- Pós-aplicação: em Supabase Dashboard > Settings > API > "Exposed schemas",
-- adicione `admin` para que o PostgREST exponha essas views. No frontend:
--   supabase.schema('admin').from('visao_produtos_validade')
--
-- security_invoker = true: a view roda com as permissões de QUEM consulta, então
-- a RLS / is_admin_user() das tabelas-base continua valendo (mesmo comportamento
-- das views atuais). Requer Postgres 15+ (Supabase já usa).
--
-- Como aplicar: Supabase Dashboard > SQL Editor.

create schema if not exists admin;
grant usage on schema admin to authenticated, anon, service_role;

-- ── Dashboard / usuários ─────────────────────────────────────────────────────
create or replace view admin.visao_resumo_dashboard
  with (security_invoker = true) as
  select * from public.admin_dashboard_summary_view;

create or replace view admin.visao_usuarios_ativos
  with (security_invoker = true) as
  select * from public.admin_active_users_view;

-- ── Validade ─────────────────────────────────────────────────────────────────
create or replace view admin.visao_produtos_validade
  with (security_invoker = true) as
  select * from public.admin_validade_products_view;

-- ── Recebimento / notas ──────────────────────────────────────────────────────
create or replace view admin.visao_notas_entrada
  with (security_invoker = true) as
  select * from public.admin_purchase_orders_view;

create or replace view admin.visao_acoes_pedidos
  with (security_invoker = true) as
  select * from public.admin_purchase_order_actions_view;

create or replace view admin.visao_conferencias_recebimento
  with (security_invoker = true) as
  select * from public.admin_conferencia_recebimentos_view;

create or replace view admin.visao_tratativas
  with (security_invoker = true) as
  select * from public.admin_tratativas_view;

-- ── Conferência ──────────────────────────────────────────────────────────────
create or replace view admin.visao_bonus_entrada
  with (security_invoker = true) as
  select * from public.admin_conferencia_bonus_queue_view;

create or replace view admin.visao_bonus_saida
  with (security_invoker = true) as
  select * from public.admin_conferencia_saida_bonus_queue_view;

create or replace view admin.visao_conferencias_saida
  with (security_invoker = true) as
  select * from public.admin_conferencia_saidas_view;

create or replace view admin.visao_divergencias_conferencia
  with (security_invoker = true) as
  select * from public.admin_conferencia_divergencias_view;

-- ── Avarias ──────────────────────────────────────────────────────────────────
create or replace view admin.visao_avarias
  with (security_invoker = true) as
  select * from public.admin_avaria_items_view;

-- ── Auditoria ────────────────────────────────────────────────────────────────
create or replace view admin.visao_eventos_operacionais
  with (security_invoker = true) as
  select * from public.operational_events;

-- ── Permissões de leitura para as views novas ────────────────────────────────
grant select on all tables in schema admin to authenticated, anon;
alter default privileges in schema admin grant select on tables to authenticated, anon;

-- Pronto. Nada antigo foi alterado. As views admin.visao_* sao um ALIAS em
-- portugues das views existentes. Migracao da Webapp: trocar, tela por tela, o
-- nome lido em src/services/adminApi.js (ex.: admin_validade_products_view ->
-- schema('admin').visao_produtos_validade), validando cada uma.


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO 0006_views_portugues_public
-- ╚════════════════════════════════════════════════════════════════════╝
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


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO 0007_completa_filas_conferencia_pt
-- ╚════════════════════════════════════════════════════════════════════╝
-- Migração 0007 — Completa as views de fila de conferência em português
--
-- As views conferencia_fila_entrada / conferencia_fila_saida (0006) eram enxutas
-- e não traziam campos que a tela de Conferência usa (resultado da conferência,
-- quantidade conferida, contagem de divergência, pendência).
--
-- Usa DROP + CREATE (não CREATE OR REPLACE) porque estamos mudando a ORDEM das
-- colunas — o create-or-replace só permite APENDAR colunas no fim, e daria
-- "cannot change name of view column". Nada depende dessas views, então o drop
-- é seguro. Idempotente (drop if exists), security_invoker. Rodar DEPOIS de 0006.
--
-- Como aplicar: Supabase Dashboard > SQL Editor.

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

grant select on public.conferencia_fila_entrada, public.conferencia_fila_saida
  to authenticated, anon;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO 0008_recebimento_conferencias_payload
-- ╚════════════════════════════════════════════════════════════════════╝
-- Migração 0008 — Expõe o payload (jsonb) em recebimento_conferencias (pt)
--
-- A tela de Recebimento gera bônus a partir do payload do recebimento
-- (recebimentoRow.payload.items, .invoice, …). A view recebimento_conferencias
-- (0006) não trazia esse jsonb, então faltava para migrar getConferenciaRecebimentos
-- ao português. Esta migração apenda a coluna `dados` (= payload).
--
-- Append no fim → CREATE OR REPLACE basta (não muda ordem das colunas existentes).
-- Idempotente, security_invoker. Rodar DEPOIS de 0006.
-- Como aplicar: Supabase Dashboard > SQL Editor.

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
  payload           as dados   -- << jsonb completo, usado para gerar bônus
from public.admin_conferencia_recebimentos_view;



-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO 0009_governanca
-- ╚════════════════════════════════════════════════════════════════════╝
-- =====================================================================
-- 0009_governanca.sql — Governança no Supabase (substitui localStorage)
-- ---------------------------------------------------------------------
-- Tira a governança operacional do localStorage do navegador e coloca no
-- banco, com RLS. Cria:
--   • sistema_configuracoes  — chave/valor JSONB (faixas de validade, metas,
--                              config do sistema, checklist de publicação)
--   • usuario_preferencias   — preferências por usuário (ex.: notificações lidas)
--   • fechamentos_diarios     — registro auditável dos fechamentos (§21)
--   • logs_tecnicos           — logs/erros do frontend centralizados (§34.17)
--   • registrar_evento(...)   — RPC para gravar auditoria em operational_events
--
-- NÃO mexe em tabelas físicas existentes (só adiciona). Idempotente: pode ser
-- reaplicado. Aplique no SQL Editor do Supabase. O painel admin degrada com
-- defaults se as tabelas ainda não existirem.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Configurações globais do sistema (chave/valor)
-- ---------------------------------------------------------------------
create table if not exists public.sistema_configuracoes (
  chave          text primary key,
  valor          jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);

alter table public.sistema_configuracoes enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'sistema_configuracoes' and policyname = 'sistema_config_admin_read') then
    create policy sistema_config_admin_read on public.sistema_configuracoes
      for select using (public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'sistema_configuracoes' and policyname = 'sistema_config_admin_write') then
    create policy sistema_config_admin_write on public.sistema_configuracoes
      for all using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) Preferências por usuário (ex.: notificações lidas)
-- ---------------------------------------------------------------------
create table if not exists public.usuario_preferencias (
  user_id       uuid not null references auth.users(id) on delete cascade,
  chave         text not null,
  valor         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, chave)
);

alter table public.usuario_preferencias enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'usuario_preferencias' and policyname = 'usuario_pref_self') then
    create policy usuario_pref_self on public.usuario_preferencias
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 3) Fechamentos diários (auditáveis) — §21
-- ---------------------------------------------------------------------
create table if not exists public.fechamentos_diarios (
  id                   uuid primary key default gen_random_uuid(),
  fechado_por          uuid references auth.users(id) on delete set null,
  fechado_por_nome     text,
  fechado_em           timestamptz not null default now(),
  pendencias_restantes integer not null default 0,
  observacoes          text,
  itens                jsonb not null default '[]'::jsonb
);

create index if not exists idx_fechamentos_diarios_data on public.fechamentos_diarios (fechado_em desc);

alter table public.fechamentos_diarios enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fechamentos_diarios' and policyname = 'fechamentos_admin_read') then
    create policy fechamentos_admin_read on public.fechamentos_diarios
      for select using (public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fechamentos_diarios' and policyname = 'fechamentos_insert') then
    create policy fechamentos_insert on public.fechamentos_diarios
      for insert with check (auth.uid() = fechado_por);
  end if;
  -- Admin pode corrigir/reabrir um fechamento (caso necessário no futuro).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'fechamentos_diarios' and policyname = 'fechamentos_admin_update') then
    create policy fechamentos_admin_update on public.fechamentos_diarios
      for update using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 4) Logs técnicos do frontend (centralizados) — §34.17
-- ---------------------------------------------------------------------
create table if not exists public.logs_tecnicos (
  id         uuid primary key default gen_random_uuid(),
  nivel      text not null default 'error' check (nivel in ('error', 'warn', 'info')),
  mensagem   text not null,
  contexto   text,
  criado_por uuid references auth.users(id) on delete set null,
  criado_em  timestamptz not null default now()
);

create index if not exists idx_logs_tecnicos_data on public.logs_tecnicos (criado_em desc);

alter table public.logs_tecnicos enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'logs_tecnicos' and policyname = 'logs_admin_read') then
    create policy logs_admin_read on public.logs_tecnicos
      for select using (public.is_admin_user());
  end if;
  -- Qualquer usuário autenticado pode registrar seu próprio log (best-effort).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'logs_tecnicos' and policyname = 'logs_insert_self') then
    create policy logs_insert_self on public.logs_tecnicos
      for insert with check (auth.uid() = criado_por or criado_por is null);
  end if;
  -- Admin pode limpar logs.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'logs_tecnicos' and policyname = 'logs_admin_delete') then
    create policy logs_admin_delete on public.logs_tecnicos
      for delete using (public.is_admin_user());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5) Aprovações (§34.6) — completa a tabela approval_requests (0002) com os
--    nomes legíveis usados pelo painel. (Sem 0002 aplicada, ignore esta seção.)
-- ---------------------------------------------------------------------
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'approval_requests') then
    alter table public.approval_requests add column if not exists requested_by_name text;
    alter table public.approval_requests add column if not exists decided_by_name text;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 6) RPC de auditoria: grava um evento em operational_events
--    (SECURITY DEFINER — funciona mesmo com RLS restritiva na tabela;
--     carimba user_id e actor_name do usuário autenticado no servidor).
-- ---------------------------------------------------------------------
create or replace function public.registrar_evento(
  p_module       text,
  p_event_type   text,
  p_entity_type  text default null,
  p_entity_id    text default null,
  p_payload      jsonb default '{}'::jsonb,
  p_order_ref    text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_nome text;
begin
  if auth.uid() is null then
    raise exception 'Sem usuário autenticado';
  end if;
  select coalesce(name, email) into v_nome from public.profiles where user_id = auth.uid();
  insert into public.operational_events (user_id, module, event_type, entity_type, entity_id, actor_name, payload, order_ref, created_at)
  values (auth.uid(), p_module, p_event_type, p_entity_type, p_entity_id, v_nome, coalesce(p_payload, '{}'::jsonb), p_order_ref, now())
  returning id into v_id;
  return v_id;
exception
  when undefined_table or undefined_column then
    -- operational_events ausente/diferente neste projeto: não quebra a ação.
    return null;
end;
$$;

grant execute on function public.registrar_evento(text, text, text, text, jsonb, text) to authenticated;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO 0010_permissoes_reais
-- ╚════════════════════════════════════════════════════════════════════╝
-- =====================================================================
-- 0010_permissoes_reais.sql — Permissões reais (banco + RPC + auditoria)
-- ---------------------------------------------------------------------
-- Hoje a matriz de permissões era só localStorage (decorativa). Esta migração
-- move a governança de acesso para o banco, com auditoria de alterações e
-- funções para resolver/aplicar permissões no servidor. Cria:
--   • perfis_acesso              — papéis (admin/supervisor/operador/leitura)
--   • permissoes_acoes           — catálogo das ações controláveis (can_*)
--   • perfis_permissoes          — matriz papel→permissão
--   • usuario_perfil             — qual perfil cada usuário tem
--   • auditoria_alteracoes_permissao — trilha de quem mudou o quê, quando e por quê
-- E as funções:
--   • resolver_permissoes_usuario(uuid)  — mapa efetivo de permissões do usuário
--   • tem_permissao(text, uuid)          — helper booleano (use em RLS futura)
--   • definir_permissao_perfil(...)      — altera a matriz (admin) + auditoria
--   • atribuir_perfil_usuario(...)       — vincula usuário a um perfil (admin)
--
-- Idempotente. Aplique no SQL Editor do Supabase. Requer is_admin_user() (base).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.perfis_acesso (
  id        uuid primary key default gen_random_uuid(),
  chave     text not null unique,
  nome      text not null,
  descricao text,
  sistema   boolean not null default false,   -- true = papel base (não excluir)
  criado_em timestamptz not null default now()
);

create table if not exists public.permissoes_acoes (
  id        uuid primary key default gen_random_uuid(),
  chave     text not null unique,
  nome      text not null,
  descricao text,
  criado_em timestamptz not null default now()
);

create table if not exists public.perfis_permissoes (
  perfil_id    uuid not null references public.perfis_acesso(id) on delete cascade,
  permissao_id uuid not null references public.permissoes_acoes(id) on delete cascade,
  permitido    boolean not null default true,
  primary key (perfil_id, permissao_id)
);

create table if not exists public.usuario_perfil (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  perfil_id    uuid references public.perfis_acesso(id) on delete set null,
  atribuido_por uuid references auth.users(id) on delete set null,
  atribuido_em timestamptz not null default now()
);

create table if not exists public.auditoria_alteracoes_permissao (
  id               uuid primary key default gen_random_uuid(),
  alterado_por     uuid references auth.users(id) on delete set null,
  alterado_por_nome text,
  perfil_chave     text not null,
  permissao_chave  text not null,
  valor_anterior   boolean,
  valor_novo       boolean,
  motivo           text,
  criado_em        timestamptz not null default now()
);

create index if not exists idx_auditoria_perm_data on public.auditoria_alteracoes_permissao (criado_em desc);

-- ---------------------------------------------------------------------
-- Seeds — papéis e catálogo de permissões (do briefing §26)
-- ---------------------------------------------------------------------
insert into public.perfis_acesso (chave, nome, descricao, sistema) values
  ('admin',      'Administrador',   'Acesso total ao painel', true),
  ('supervisor', 'Supervisor',      'Operação e auditoria, sem configurações críticas', true),
  ('operador',   'Operador',        'Execução operacional do dia a dia', true),
  ('leitura',    'Somente leitura', 'Visualização de dashboards e auditoria', true)
on conflict (chave) do nothing;

insert into public.permissoes_acoes (chave, nome) values
  ('can_view_dashboard',   'Ver dashboards'),
  ('can_manage_users',     'Gerenciar usuários'),
  ('can_reset_password',   'Resetar senha'),
  ('can_assign_tasks',     'Atribuir tarefas'),
  ('can_edit_validade',    'Editar validade'),
  ('can_delete_validade',  'Excluir validade'),
  ('can_correct_entrada',  'Corrigir entrada'),
  ('can_export_reports',   'Exportar relatórios'),
  ('can_view_audit',       'Ver auditoria'),
  ('can_approve_workflows','Aprovar fluxos'),
  ('can_manage_settings',  'Gerenciar configurações')
on conflict (chave) do nothing;

-- Matriz padrão (idempotente: não sobrescreve ajustes já feitos).
insert into public.perfis_permissoes (perfil_id, permissao_id, permitido)
select p.id, a.id,
  case p.chave
    when 'admin'      then true
    when 'supervisor' then a.chave not in ('can_manage_settings', 'can_delete_validade')
    when 'operador'   then a.chave in ('can_view_dashboard', 'can_assign_tasks', 'can_edit_validade', 'can_correct_entrada')
    when 'leitura'    then a.chave in ('can_view_dashboard', 'can_view_audit')
    else false
  end
from public.perfis_acesso p
cross join public.permissoes_acoes a
on conflict (perfil_id, permissao_id) do nothing;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.perfis_acesso enable row level security;
alter table public.permissoes_acoes enable row level security;
alter table public.perfis_permissoes enable row level security;
alter table public.usuario_perfil enable row level security;
alter table public.auditoria_alteracoes_permissao enable row level security;

do $$ begin
  -- Catálogos e matriz: admins leem/escrevem.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'perfis_acesso' and policyname = 'perfis_admin_all') then
    create policy perfis_admin_all on public.perfis_acesso for all using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'permissoes_acoes' and policyname = 'permissoes_admin_all') then
    create policy permissoes_admin_all on public.permissoes_acoes for all using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'perfis_permissoes' and policyname = 'perfis_perm_admin_all') then
    create policy perfis_perm_admin_all on public.perfis_permissoes for all using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
  -- usuario_perfil: admin gerencia; usuário lê o próprio.
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'usuario_perfil' and policyname = 'usuario_perfil_admin_all') then
    create policy usuario_perfil_admin_all on public.usuario_perfil for all using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'usuario_perfil' and policyname = 'usuario_perfil_self_read') then
    create policy usuario_perfil_self_read on public.usuario_perfil for select using (auth.uid() = user_id);
  end if;
  -- Auditoria de permissões: admin lê (escrita só via RPC SECURITY DEFINER).
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'auditoria_alteracoes_permissao' and policyname = 'auditoria_perm_admin_read') then
    create policy auditoria_perm_admin_read on public.auditoria_alteracoes_permissao for select using (public.is_admin_user());
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Funções
-- ---------------------------------------------------------------------

-- Resolve o mapa efetivo de permissões de um usuário (default: o autenticado).
-- Admins (admin_users) ou perfil 'admin' recebem tudo true.
create or replace function public.resolver_permissoes_usuario(p_user uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_perfil_chave text;
  v_is_admin     boolean;
  v_perms        jsonb;
begin
  if p_user is null then
    return jsonb_build_object('perfil', null, 'is_admin', false, 'permissoes', '{}'::jsonb);
  end if;

  select exists (select 1 from public.admin_users au where au.user_id = p_user) into v_is_admin;

  select pa.chave into v_perfil_chave
  from public.usuario_perfil up
  join public.perfis_acesso pa on pa.id = up.perfil_id
  where up.user_id = p_user;

  if v_is_admin or v_perfil_chave = 'admin' then
    select jsonb_object_agg(a.chave, true) into v_perms from public.permissoes_acoes a;
    return jsonb_build_object('perfil', coalesce(v_perfil_chave, 'admin'), 'is_admin', true, 'permissoes', coalesce(v_perms, '{}'::jsonb));
  end if;

  if v_perfil_chave is null then
    select jsonb_object_agg(a.chave, false) into v_perms from public.permissoes_acoes a;
    return jsonb_build_object('perfil', null, 'is_admin', false, 'permissoes', coalesce(v_perms, '{}'::jsonb));
  end if;

  select jsonb_object_agg(a.chave, coalesce(pp.permitido, false)) into v_perms
  from public.permissoes_acoes a
  left join public.perfis_permissoes pp
    on pp.permissao_id = a.id
   and pp.perfil_id = (select id from public.perfis_acesso where chave = v_perfil_chave);

  return jsonb_build_object('perfil', v_perfil_chave, 'is_admin', false, 'permissoes', coalesce(v_perms, '{}'::jsonb));
end;
$$;

-- Helper booleano — use em policies RLS futuras: using (public.tem_permissao('can_x'))
create or replace function public.tem_permissao(p_chave text, p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((public.resolver_permissoes_usuario(p_user) -> 'permissoes' ->> p_chave)::boolean, false);
$$;

-- Altera a matriz papel→permissão (apenas admin) e grava auditoria com motivo.
create or replace function public.definir_permissao_perfil(
  p_perfil_chave    text,
  p_permissao_chave text,
  p_permitido       boolean,
  p_motivo          text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil_id uuid;
  v_perm_id   uuid;
  v_anterior  boolean;
  v_nome      text;
begin
  if not public.is_admin_user() then
    raise exception 'Apenas administradores podem alterar permissões';
  end if;

  select id into v_perfil_id from public.perfis_acesso where chave = p_perfil_chave;
  select id into v_perm_id   from public.permissoes_acoes where chave = p_permissao_chave;
  if v_perfil_id is null or v_perm_id is null then
    raise exception 'Perfil (%) ou permissão (%) inexistente', p_perfil_chave, p_permissao_chave;
  end if;

  select permitido into v_anterior from public.perfis_permissoes where perfil_id = v_perfil_id and permissao_id = v_perm_id;

  insert into public.perfis_permissoes (perfil_id, permissao_id, permitido)
  values (v_perfil_id, v_perm_id, p_permitido)
  on conflict (perfil_id, permissao_id) do update set permitido = excluded.permitido;

  select coalesce(name, email) into v_nome from public.profiles where user_id = auth.uid();

  insert into public.auditoria_alteracoes_permissao
    (alterado_por, alterado_por_nome, perfil_chave, permissao_chave, valor_anterior, valor_novo, motivo)
  values
    (auth.uid(), v_nome, p_perfil_chave, p_permissao_chave, v_anterior, p_permitido, p_motivo);
end;
$$;

-- Vincula um usuário a um perfil (apenas admin).
create or replace function public.atribuir_perfil_usuario(p_user uuid, p_perfil_chave text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil_id uuid;
begin
  if not public.is_admin_user() then
    raise exception 'Apenas administradores podem atribuir perfis';
  end if;
  select id into v_perfil_id from public.perfis_acesso where chave = p_perfil_chave;
  if v_perfil_id is null then
    raise exception 'Perfil (%) inexistente', p_perfil_chave;
  end if;
  insert into public.usuario_perfil (user_id, perfil_id, atribuido_por)
  values (p_user, v_perfil_id, auth.uid())
  on conflict (user_id) do update set perfil_id = excluded.perfil_id, atribuido_por = auth.uid(), atribuido_em = now();
end;
$$;

grant execute on function public.resolver_permissoes_usuario(uuid) to authenticated;
grant execute on function public.tem_permissao(text, uuid) to authenticated;
grant execute on function public.definir_permissao_perfil(text, text, boolean, text) to authenticated;
grant execute on function public.atribuir_perfil_usuario(uuid, text) to authenticated;


-- ╔════════════════════════════════════════════════════════════════════╗
-- ║ BLOCO 0011_seguranca
-- ╚════════════════════════════════════════════════════════════════════╝
-- =====================================================================
-- 0011_seguranca.sql — Correções de segurança rápidas (auditoria da revisão)
-- ---------------------------------------------------------------------
-- 1) Auditoria imutável: operational_events vira append-only (sem UPDATE/DELETE),
--    de forma EXPLÍCITA. Hoje deletes/updates já caem no default-deny do RLS
--    (não há policy de update/delete), mas policies RESTRICTIVE garantem o
--    append-only mesmo que alguém adicione uma policy permissiva no futuro.
-- 2) Proteção do perfil admin: definir_permissao_perfil() passa a recusar
--    alterações no perfil 'admin' (que tem acesso total) — evita o cenário de
--    remover todas as permissões e travar o sistema sem admin.
--
-- Idempotente. Aplique no SQL Editor do Supabase. Requer 0009/0010 aplicadas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) operational_events append-only (não-repúdio da trilha de auditoria)
-- ---------------------------------------------------------------------
do $$ begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'operational_events'
  ) then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'operational_events'
        and policyname = 'operational_events_no_update'
    ) then
      create policy operational_events_no_update on public.operational_events
        as restrictive for update using (false);
    end if;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'operational_events'
        and policyname = 'operational_events_no_delete'
    ) then
      create policy operational_events_no_delete on public.operational_events
        as restrictive for delete using (false);
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2) definir_permissao_perfil: protege o perfil admin contra lockout
--    (recria a função 0010 acrescentando a guarda; restante inalterado).
-- ---------------------------------------------------------------------
create or replace function public.definir_permissao_perfil(
  p_perfil_chave    text,
  p_permissao_chave text,
  p_permitido       boolean,
  p_motivo          text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil_id uuid;
  v_perm_id   uuid;
  v_anterior  boolean;
  v_nome      text;
begin
  if not public.is_admin_user() then
    raise exception 'Apenas administradores podem alterar permissões';
  end if;

  -- O perfil admin tem acesso total e é imutável (evita travar o sistema sem admin).
  if p_perfil_chave = 'admin' then
    raise exception 'O perfil admin tem acesso total e não pode ser alterado';
  end if;

  select id into v_perfil_id from public.perfis_acesso where chave = p_perfil_chave;
  select id into v_perm_id   from public.permissoes_acoes where chave = p_permissao_chave;
  if v_perfil_id is null or v_perm_id is null then
    raise exception 'Perfil (%) ou permissão (%) inexistente', p_perfil_chave, p_permissao_chave;
  end if;

  select permitido into v_anterior from public.perfis_permissoes where perfil_id = v_perfil_id and permissao_id = v_perm_id;

  insert into public.perfis_permissoes (perfil_id, permissao_id, permitido)
  values (v_perfil_id, v_perm_id, p_permitido)
  on conflict (perfil_id, permissao_id) do update set permitido = excluded.permitido;

  select coalesce(name, email) into v_nome from public.profiles where user_id = auth.uid();

  insert into public.auditoria_alteracoes_permissao
    (alterado_por, alterado_por_nome, perfil_chave, permissao_chave, valor_anterior, valor_novo, motivo)
  values
    (auth.uid(), v_nome, p_perfil_chave, p_permissao_chave, v_anterior, p_permitido, p_motivo);
end;
$$;

grant execute on function public.definir_permissao_perfil(text, text, boolean, text) to authenticated;
