-- =====================================================================
-- 0014_anexos.sql — Anexos/comprovantes (briefing §23)
-- ---------------------------------------------------------------------
-- Cria o bucket privado 'document-attachments' (via SQL, sem passo manual),
-- a tabela document_attachments (metadados) e as RLS de admin. Permite anexar
-- comprovantes a entidades (avaria, tratativa, divergência, nota...).
--
-- Idempotente. Aplique no SQL Editor. Requer is_admin_user().
-- =====================================================================

-- Bucket privado (criado via SQL).
insert into storage.buckets (id, name, public)
values ('document-attachments', 'document-attachments', false)
on conflict (id) do nothing;

-- Metadados dos anexos (o arquivo em si fica no Storage).
create table if not exists public.document_attachments (
  id            uuid primary key default gen_random_uuid(),
  document_type text not null,          -- ex.: avaria_item, validade, divergencia, nota
  document_id   text not null,          -- id da entidade
  file_path     text not null,          -- caminho no bucket
  file_name     text,
  content_type  text,
  size_bytes    integer,
  uploaded_by   uuid references auth.users(id) on delete set null,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_doc_attach_entity on public.document_attachments (document_type, document_id);

alter table public.document_attachments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'document_attachments' and policyname = 'doc_attach_admin_read') then
    create policy doc_attach_admin_read on public.document_attachments
      for select using (public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'document_attachments' and policyname = 'doc_attach_admin_insert') then
    create policy doc_attach_admin_insert on public.document_attachments
      for insert with check (public.is_admin_user() and auth.uid() = uploaded_by);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'document_attachments' and policyname = 'doc_attach_admin_delete') then
    create policy doc_attach_admin_delete on public.document_attachments
      for delete using (public.is_admin_user());
  end if;
end $$;

-- RLS do Storage (objetos do bucket) — admins gerenciam.
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'doc_attach_storage_read') then
    create policy doc_attach_storage_read on storage.objects
      for select using (bucket_id = 'document-attachments' and public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'doc_attach_storage_insert') then
    create policy doc_attach_storage_insert on storage.objects
      for insert with check (bucket_id = 'document-attachments' and public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'doc_attach_storage_delete') then
    create policy doc_attach_storage_delete on storage.objects
      for delete using (bucket_id = 'document-attachments' and public.is_admin_user());
  end if;
end $$;
