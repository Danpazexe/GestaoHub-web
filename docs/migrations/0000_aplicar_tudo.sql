-- ============================================================================
-- GestãoHub — APLICAR TUDO (consolidado: 0001-0004, 0006, 0007, 0008)
-- ============================================================================
-- Arquivo único, idempotente (pode reaplicar). Cole no Supabase > SQL Editor.
-- Não precisa configurar "Exposed schemas" (views pt ficam no public).
-- Ordem: localização → aprovação → imagens → views pt (admin) → views pt
-- (public, com filas completas e payload de recebimento) → 0007/0008 (idempot.).
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

