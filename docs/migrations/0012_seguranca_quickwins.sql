-- =====================================================================
-- 0012_seguranca_quickwins.sql — Quick wins de segurança + fundações p/ RLS
-- ---------------------------------------------------------------------
-- A1) resolver_permissoes_usuario: barra leitura de permissões de terceiros.
-- C5) registrar_evento: valida/limita entrada (anti-poluição da auditoria).
-- pode()/tem_perfil(): helpers usados pela RLS por permissão (0013).
--
-- Idempotente. Aplique no SQL Editor do Supabase. Requer 0009/0010.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A1) resolver_permissoes_usuario com guarda de autorização
-- ---------------------------------------------------------------------
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

  -- Só o próprio usuário ou um admin pode resolver permissões de alguém.
  if p_user <> auth.uid() and not public.is_admin_user() then
    raise exception 'Sem permissão para consultar permissões de outro usuário';
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

grant execute on function public.resolver_permissoes_usuario(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- C5) registrar_evento com validação/limites de entrada
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
  if p_event_type is null or length(trim(p_event_type)) = 0 then
    raise exception 'event_type é obrigatório';
  end if;

  -- Limites para evitar poluição/abuso da trilha de auditoria.
  p_module      := left(coalesce(nullif(trim(p_module), ''), 'outros'), 50);
  p_event_type  := left(trim(p_event_type), 100);
  p_entity_type := left(p_entity_type, 50);
  p_entity_id   := left(p_entity_id, 120);
  p_order_ref   := left(p_order_ref, 120);

  select coalesce(name, email) into v_nome from public.profiles where user_id = auth.uid();

  insert into public.operational_events (user_id, module, event_type, entity_type, entity_id, actor_name, payload, order_ref, created_at)
  values (auth.uid(), p_module, p_event_type, p_entity_type, p_entity_id, v_nome, coalesce(p_payload, '{}'::jsonb), p_order_ref, now())
  returning id into v_id;
  return v_id;
exception
  when undefined_table or undefined_column then
    return null;
end;
$$;

grant execute on function public.registrar_evento(text, text, text, text, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------
-- Helpers para RLS por permissão (consumidos em 0013)
-- ---------------------------------------------------------------------
-- pode(): admin (admin_users) OU possui a permissão via perfil.
create or replace function public.pode(p_chave text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin_user() or public.tem_permissao(p_chave);
$$;

-- tem_perfil(): o usuário tem um perfil de acesso atribuído?
-- Usado para que a RLS por permissão só restrinja quem TEM perfil (usuários do
-- app mobile, sem perfil, continuam governados pelas policies de dono).
create or replace function public.tem_perfil(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.usuario_perfil up where up.user_id = p_user);
$$;

grant execute on function public.pode(text) to authenticated;
grant execute on function public.tem_perfil(uuid) to authenticated;
