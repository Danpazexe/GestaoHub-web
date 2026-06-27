import { lazy } from 'react';

// Registro central das views carregadas sob demanda (code splitting). Cada uma
// vira um chunk próprio — o import() mantém caminho literal para o Vite analisar.
const load = (factory, name) => lazy(() => factory().then((m) => ({ default: m[name] })));

export const InicioView = load(() => import('../features/inicio/InicioView'), 'InicioView');
export const PendenciasView = load(() => import('../features/pendencias/PendenciasView'), 'PendenciasView');
export const FornecedoresView = load(() => import('../features/fornecedores/FornecedoresView'), 'FornecedoresView');
export const QualidadeView = load(() => import('../features/qualidade/QualidadeView'), 'QualidadeView');
export const RankingView = load(() => import('../features/ranking/RankingView'), 'RankingView');
export const IndicadoresView = load(() => import('../features/indicadores/IndicadoresView'), 'IndicadoresView');
export const TvView = load(() => import('../features/tv/TvView'), 'TvView');
export const AdminCenterView = load(() => import('../features/admin/AdminCenterView'), 'AdminCenterView');
export const ConfiguracoesView = load(() => import('../features/configuracoes/ConfiguracoesView'), 'ConfiguracoesView');
export const FechamentoView = load(() => import('../features/fechamento/FechamentoView'), 'FechamentoView');
export const LogsView = load(() => import('../features/logs/LogsView'), 'LogsView');
export const ImportacaoView = load(() => import('../features/importacao/ImportacaoView'), 'ImportacaoView');
export const AprovacoesView = load(() => import('../features/aprovacoes/AprovacoesView'), 'AprovacoesView');
export const MapaView = load(() => import('../features/mapa/MapaView'), 'MapaView');
export const RelatoriosView = load(() => import('../features/relatorios/RelatoriosView'), 'RelatoriosView');
export const UsersView = load(() => import('../features/users/UsersView'), 'UsersView');
export const TratativasView = load(() => import('../features/tratativas/TratativasView'), 'TratativasView');
export const RecebimentoView = load(() => import('../features/recebimento/RecebimentoView'), 'RecebimentoView');
export const ConferenciaView = load(() => import('../features/conferencia/ConferenciaView'), 'ConferenciaView');
export const AvariasView = load(() => import('../features/avarias/AvariasView'), 'AvariasView');
export const ValidadeView = load(() => import('../features/validade/ValidadeView'), 'ValidadeView');
export const EventsView = load(() => import('../features/events/EventsView'), 'EventsView');
