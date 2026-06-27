-- Migração 0003 — Imagens de produto no painel admin (Controle de Validade)
--
-- Problema: a Webapp não exibe a imagem do produto porque:
--   1) a view admin_validade_products_view NÃO expõe a coluna image_path; e
--   2) o bucket product-images é privado e a política de leitura é só do dono
--      (auth.uid() = primeira pasta do path), então o supervisor/admin não
--      consegue ler a imagem de outro colaborador nem gerar URL assinada.
--
-- Esta migração resolve os dois pontos. Idempotente e não destrutiva.
-- Como aplicar: Supabase Dashboard > SQL Editor > cole e rode.

-- 1) Expor image_path na view administrativa.
--    Mantém a ordem das colunas existentes e APENDA image_path no fim (exigência
--    do create-or-replace view). Atualize os campos abaixo se a view divergir.
create or replace view public.admin_validade_products_view as
select
  vp.user_id,
  p.name  as user_name,
  p.email as user_email,
  vp.id,
  vp.codprod,
  vp.codauxiliar,
  vp.descricao,
  vp.lote,
  vp.validade,
  vp.quantidade,
  vp.diasrestantes,
  vp.location,
  vp.status,
  vp.treatment_type,
  vp.treatment_quantity,
  vp.treatment_date,
  vp.created_at,
  vp.updated_at,
  vp.treatment_note,
  vp.image_path          -- << coluna apendada (consumida pela Webapp)
from public.validade_products vp
left join public.profiles p on p.user_id = vp.user_id
order by vp.updated_at desc;

-- 2) Permitir que administradores LEIAM as imagens do bucket product-images.
--    A política do dono continua valendo para os colaboradores; esta adiciona o
--    acesso de leitura para quem passa em is_admin_user() (mesma função já usada
--    nas demais políticas admin). Necessária para createSignedUrls funcionar no
--    painel.
drop policy if exists storage_read_admin_product_images on storage.objects;

create policy storage_read_admin_product_images
on storage.objects for select
using (
  bucket_id = 'product-images'
  and public.is_admin_user()
);

-- Pronto. Após aplicar, a Webapp (Controle de Validade) passa a gerar URLs
-- assinadas a partir de image_path e exibir as imagens dos produtos.
