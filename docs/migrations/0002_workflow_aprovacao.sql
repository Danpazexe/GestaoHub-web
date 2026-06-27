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
