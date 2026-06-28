import { defineConfig } from 'vitest/config';

// Testes de lógica pura (sem DOM). Cobre as regras de negócio mais sensíveis
// (faixas de validade, catálogo de permissões) que não dependem de Supabase.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,jsx}'],
  },
});
