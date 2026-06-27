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
