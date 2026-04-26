# CHANGES

## Arquivos criados

- `src/components/ConfirmModal.jsx`: modal reutilizável de confirmação com overlay e fechamento por Escape.
- `src/components/Drawer.jsx`: painel lateral reutilizável para detalhes, payloads e formulários.
- `src/components/SearchInput.jsx`: campo de busca com debounce, ícone e limpeza rápida.
- `src/components/SelectFilter.jsx`: select nativo estilizado para barras de filtro.
- `src/features/dashboard/DashboardView.jsx`: dashboard com KPIs, gráficos, usuários online e linha do tempo.
- `src/hooks/useConfirm.js`: hook imperativo para confirmação de ações.
- `src/hooks/useTableFilter.js`: hook de busca, filtro e paginação.
- `src/lib/csv.js`: exportação CSV com BOM e separador `;`.
- `src/lib/toast.js`: wrapper de notificações via `react-hot-toast`.

## Arquivos modificados

- `package.json`: adicionadas dependências `recharts` e `react-hot-toast`.
- `package-lock.json`: lockfile atualizado com as novas dependências.
- `src/App.jsx`: adicionado `Toaster`, `DashboardView`, novos props para views e dashboard como view inicial.
- `src/components/AppIcon.jsx`: adicionado ícone `dashboard`.
- `src/components/DataTable.jsx`: busca, ordenação, paginação e classes por linha.
- `src/components/StatusBadge.jsx`: suporte a rótulo customizado mantendo cor semântica.
- `src/config/navigation.js`: `dashboard` incluído como primeiro item do grupo geral.
- `src/features/overview/OverviewView.jsx`: overview expandido com alertas rápidos e navegação para módulos.
- `src/features/users/UsersView.jsx`: filtros, busca, força de logout e histórico em drawer.
- `src/features/tratativas/TratativasView.jsx`: filtros, ações de encerrar/cancelar e drawer de detalhes.
- `src/features/conferencia/ConferenciaView.jsx`: builder de bônus, atribuição, remoção de fila e exportação CSV.
- `src/features/avarias/AvariasView.jsx`: resumo, filtros, resolução e exclusão com confirmação.
- `src/features/validade/ValidadeView.jsx`: filtros, urgência visual, tratativa e resolução.
- `src/features/events/EventsView.jsx`: filtros avançados, exportação CSV e payload em drawer.
- `src/hooks/useConfirm.js`: ajuste para compatibilidade de build sem JSX em arquivo `.js`.
- `src/services/adminApi.js`: novos métodos CRUD operacionais para tratativas, avarias, validade, bônus e usuários.
- `src/styles.css`: estilos de modal, drawer, filtros, dashboard, tabelas e estados visuais novos.

## Validação

- `npm run build`: concluído com sucesso.
- Observação: o bundle principal ficou acima de `500 kB`, então existe aviso de chunk grande do Vite, mas sem impedir o build.
