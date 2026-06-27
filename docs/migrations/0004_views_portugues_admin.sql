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
