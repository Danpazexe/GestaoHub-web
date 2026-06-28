-- =====================================================================
-- 0013_rls_por_permissao.sql — Permissões efetivas no servidor (C1)
-- ---------------------------------------------------------------------
-- Torna a matriz de permissões EFETIVA via RLS, sem quebrar nada:
--   • Policies RESTRICTIVE (AND-combinadas) que só "mordem" quem TEM perfil
--     atribuído: condição = (not tem_perfil() OR pode('can_x')).
--   • Usuários do app mobile (donos, SEM perfil) → not tem_perfil() = true →
--     passam (continuam governados pelas policies de dono existentes).
--   • Admins → pode() = true → passam.
--   • Usuário de painel com perfil (operador/supervisor/leitura) → precisa da
--     permissão correspondente para UPDATE/DELETE.
--
-- Seguro aplicar já: enquanto ninguém tem perfil (usuario_perfil vazio), nada
-- muda; o enforcement ativa conforme você atribui perfis (atribuir_perfil_usuario).
-- Idempotente. Requer 0012 (pode/tem_perfil). Aplique no SQL Editor.
-- =====================================================================

-- Helper interno deste arquivo: cria uma policy restritiva por permissão se a
-- tabela existir e a policy ainda não existir.
do $$
declare
  r record;
  -- tabela, comando (update/delete/insert), chave de permissão, nome da policy
  alvos text[][] := array[
    ['validade_products', 'update', 'can_edit_validade',     'validade_products_perm_update'],
    ['validade_products', 'delete', 'can_delete_validade',   'validade_products_perm_delete'],
    ['purchase_orders',   'update', 'can_correct_entrada',   'purchase_orders_perm_update'],
    ['conferencia_bonus_queue',       'update', 'can_assign_tasks', 'conf_bonus_queue_perm_update'],
    ['conferencia_saida_bonus_queue', 'update', 'can_assign_tasks', 'conf_saida_queue_perm_update'],
    ['approval_requests', 'update', 'can_approve_workflows', 'approval_requests_perm_update'],
    ['sistema_configuracoes', 'update', 'can_manage_settings', 'sistema_config_perm_update'],
    ['sistema_configuracoes', 'delete', 'can_manage_settings', 'sistema_config_perm_delete'],
    ['sistema_configuracoes', 'insert', 'can_manage_settings', 'sistema_config_perm_insert']
  ];
  v_tbl text; v_cmd text; v_perm text; v_pol text; v_cond text; v_sql text;
begin
  foreach r slice 1 in array alvos loop
    v_tbl := r[1]; v_cmd := r[2]; v_perm := r[3]; v_pol := r[4];
    -- tabela precisa existir
    if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = v_tbl) then
      continue;
    end if;
    -- policy já existe? pula (idempotente)
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = v_tbl and policyname = v_pol) then
      continue;
    end if;
    v_cond := format('(not public.tem_perfil() or public.pode(%L))', v_perm);
    if v_cmd = 'insert' then
      v_sql := format('create policy %I on public.%I as restrictive for insert with check %s', v_pol, v_tbl, v_cond);
    elsif v_cmd = 'update' then
      v_sql := format('create policy %I on public.%I as restrictive for update using %s with check %s', v_pol, v_tbl, v_cond, v_cond);
    else -- delete
      v_sql := format('create policy %I on public.%I as restrictive for %s using %s', v_pol, v_tbl, v_cmd, v_cond);
    end if;
    execute v_sql;
  end loop;
end $$;

-- NOTA: para o enforcement valer p/ um usuário de painel não-admin, atribua um
-- perfil a ele: select public.atribuir_perfil_usuario('<uuid>', 'operador');
-- Recomendado definir um perfil padrão (ex.: 'leitura') para novos usuários.
