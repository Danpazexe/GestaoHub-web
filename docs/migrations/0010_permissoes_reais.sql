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
