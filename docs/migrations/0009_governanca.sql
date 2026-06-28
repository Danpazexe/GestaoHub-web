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
