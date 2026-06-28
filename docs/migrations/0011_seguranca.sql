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
