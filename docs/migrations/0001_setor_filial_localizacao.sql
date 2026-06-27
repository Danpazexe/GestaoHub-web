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
