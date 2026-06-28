# GestãoHub Webapp — Faltas e Pendências (pente fino)

> Auditoria do painel administrativo (`GestaoHub-web`) confrontado com o **briefing único (§1–§33)** e o **briefing adicional (§34)**.
> Levantamento feito por leitura direta do código (8 frentes paralelas). Status por item: **feito** ✅ · **parcial** 🟡 · **faltando** 🔴.
>
> Última atualização: 2026-06-27.

---

## 1. Resumo executivo

Foram avaliados **119 itens**. Distribuição:

| Status | Qtde | Leitura |
| --- | --- | --- |
| ✅ Feito | ~32 | Telas, derivações de dados e UX entregues. |
| 🟡 Parcial | ~44 | Existe na UI, mas com lacuna estrutural (geralmente: só localStorage, sem backend de escrita, ou versão simplificada do que o briefing pede). |
| 🔴 Faltando | ~43 | Não implementado — quase sempre porque depende de backend (RPC/Edge Function/tabela/RLS) que não foi entregue. |

**O painel está forte como camada de leitura e análise.** As lacunas concentram-se em **escrita governada no servidor**: tudo que precisa de `service_role`, RLS granular, tabela de governança ou trilha de auditoria persistida está ausente ou simulado em `localStorage`.

### Temas-raiz (as 43 faltas viram ~10 causas)

1. **Sem backend de escrita para ações sensíveis.** Criar usuário, resetar senha, alterar função/permissão, bloquear/desbloquear, corrigir nota, ajustar quantidade, cancelar pedido — nenhum existe. Exigem `service_role`/Edge Function. Único write real de governança hoje: `forceSignOut` (RPC `admin_force_sign_out`).
2. **Governança vive em `localStorage`.** Metas, permissões, fechamentos, aprovações, configurações, faixas de validade, leitura de notificações e logs — todos por navegador/dispositivo. Não compartilhado, não auditável, não server-side.
3. **Permissões são decorativas.** O catálogo das 11 `can_*` e a matriz existem, mas **nenhuma view consome `hasPermission()`**, não há gate de UI e não há RLS granular. Qualquer admin logado faz tudo.
4. **Auditoria não escreve.** `SENSITIVE_ACTIONS` só **filtra** a leitura; nenhuma ação do painel **emite** `operational_event` (nem o `forceSignOut`). `before/after/motivo` só existem em `localStorage`.
5. **Tratativa de validade sem quantidade.** Sem campo de quantidade, sem trava de teto (não exceder estoque) e sem tratativa **parcial com saldo**. O app mobile já faz isso; o web não portou.
6. **Setor/filial/localização não trafega.** A migração `0001` é só DDL; as views PT (`0006`) e os `select` do `adminApi` não expõem `sector/branch/area`. Resultado: Mapa operacional e Qualidade de cadastro rodam sempre em modo degradado.
7. **Notas de recebimento sem abas/correção/cancelamento.** Sem as abas do §15, sem corrigir entrada/item/quantidade, sem cancelar; pedidos encerrados/cancelados somem da tela.
8. **Travas numéricas e motivo obrigatório não cabladas.** `validations.js` existe mas quase não é usado; motivo obrigatório só em 2 fluxos (decisão de aprovação e baixa de validade "vencido").
9. **Sem comentários (§22) e sem anexos/comprovantes (§23).** Inexistentes — dependem de tabela + Storage + RLS.
10. **Export e robustez.** Sem Excel/XLSX e sem PDF real (só CSV + `window.print`); sem backup geral; sem testes e sem lint no CI.

---

## 2. Prioridização sugerida

### 🔥 P0 — Segurança, integridade e "produção de verdade"
Sem isto o painel não pode ser tratado como fonte de governança confiável.

- **RLS/permissões realmente aplicadas** (§26/§30) — políticas por `can_*` no Supabase + helper `hasPermission()` consumido nas views (gate de UI). Hoje permissão é puramente visual. 🔴
- **Trilha de auditoria que escreve** (§18) — toda ação sensível deve gerar `operational_event` com `{actor, target, module, action, entity, before, after, reason}`. Inclusive o `forceSignOut`, que hoje não registra. 🔴
- **Backend de gestão de usuários** (§11/§12/§26) — Edge Functions com `service_role` para criar usuário, resetar senha, alterar função/permissão, bloquear/desbloquear. 🔴
- **Travas de quantidade** (§25/§34.24) — usar `clampNonNegative`/`isPositiveQuantity`/`notExceeds` (já existem, nunca importados) nos inputs de quantidade. 🔴
- **Motivo obrigatório nas ações críticas** (§25/§34.25) — excluir, corrigir nota, resetar senha, remover responsável, resolver divergência, alterar permissão. Hoje só aprovação e baixa "vencido". 🔴
- **Trava: finalizar conferência com divergência aberta** (§25) — hoje há o oposto ("Finalizar com pendência" sem motivo nem bloqueio) e não existe fluxo de "resolver divergência". 🔴

### ⚙️ P1 — Funcionalidades-núcleo do briefing
Recursos que o briefing descreve e que estão faltando/incompletos no fluxo principal.

- **Tratativa de validade com quantidade + parcial com saldo** (§14) — campo de quantidade, validação de teto e tratativa parcial mantendo o item aberto com saldo. Portar a lógica que o app mobile já tem. 🔴
- **Notas de recebimento — abas e edição** (§15) — abas (todas/pendentes/com divergência/corrigidas/auditadas/canceladas), **correção de entrada/item/quantidade com antes-depois+motivo**, **cancelar pedido**, e parar de esconder encerrados/cancelados. 🔴
- **Governança no Supabase** — tabelas + RLS + wiring no `adminApi` para: metas (§14), permissões (§26), configurações (§24), faixas de validade (§13.5/§24), fechamento diário (§21), aprovações (§7/§34.6 — tabela `0002` já existe, falta ligar), leitura de notificações (§20). Hoje tudo em `localStorage`. 🟡
- **Setor/filial trafegando ponta a ponta** (§34.1/§34.2) — atualizar views PT (`0006`) e `select` do `adminApi` para expor `sector/branch/area`; com isso o Mapa operacional e a Qualidade de cadastro deixam de rodar degradados. 🔴
- **Comentários internos** (§22) e **anexos/comprovantes via Storage** (§23) — inexistentes. 🔴
- **Desatribuir responsável de conferência** (§16) e **tempo parado/ocioso por item** (§16). 🔴
- **Importação em massa gravando no banco** (§34.19) — hoje só "setores/funções" gravam (em localStorage); produtos/colaboradores/fornecedores só fazem preview. 🟡

### ✨ P2 — Melhorias e robustez
- **Export Excel/XLSX** real e **PDF programático** (hoje só CSV + impressão do navegador) + **backup/exportação geral** (§17/§19). 🔴
- **Comparativo por período configurável** (§34.23) — hoje fixo em 7d vs 7d anteriores. 🟡
- **Dashboard por colaborador** com KPIs de produtividade (§34.11) e **timeline por entidade** (produto/NF/conferência/avaria) (§19). 🟡
- **Filtros de setor e responsável na Validade** (§13). 🔴
- **Logs centralizados** (Sentry/LogRocket/Supabase Logs) — hoje buffer local de 100 entradas (§34.17). 🟡
- **Testes automatizados** (vitest na lógica pura: `sla`, `validadeFaixas`, `pendencias`, `fechamento`) e **ESLint** + steps no CI (§30). 🔴
- **Tipos de tratativa "desconto" e "retirar da área"** (§14) — exigem ajustar o CHECK `ck_validade_treatment_type` no banco. 🔴

---

## 3. Detalhamento por módulo

### §12 — Supervisão de colaboradores
| Item | Status | Observação |
| --- | --- | --- |
| Online/offline + status, último heartbeat, módulo/tela/pedido, plataforma/versão | ✅ | Leitura completa (`UsersView` + `getActiveUsers` via view PT). Depende do app publicar os campos. |
| Encerrar sessão no app (force sign-out) | ✅ | Única ação de governança com backend real (RPC). |
| Drawer do colaborador | 🟡 | Tem dados/atividade/timeline, mas **falta** bloco de permissões, tarefas atribuídas e ações (só "encerrar sessão"). |
| Atribuir/desatribuir tarefa ao colaborador | 🟡 | Só existe atribuição por item de fila na Conferência; não há visão orientada ao colaborador nem desatribuir. |
| Alterar permissão de sistema do colaborador | 🟡 | Só matriz global em localStorage, não por colaborador, sem enforcement. |
| Dashboard por colaborador (§34.11) | 🟡 | Só métricas agregadas no drawer + relatório "atividade por colaborador". Sem KPIs de produtividade. |
| Alterar função operacional | 🔴 | Sem API/UI (só exibe). |
| Resetar senha | 🔴 | Sem RPC e sem botão; existe só como chave de permissão/label. |
| Bloquear/desbloquear acesso | 🔴 | Sem API/UI. |
| Auditoria das ações de supervisão | 🔴 | Os event types existem só como filtro; nenhuma ação emite evento. |

### §13/§14 — Validade + Tratativa
| Item | Status | Observação |
| --- | --- | --- |
| Cards de resumo, ordenação, cards com imagem, preview, faixas (7/15/30), observação, histórico | ✅ | Bem implementado e consistente. |
| Drawer de tratativa / tipos (vender/trocar/devolver/perda) | 🟡 | Funciona, mas sem quantidade; "perda" mapeada para "vencido". |
| Filtro "sem imagem" | 🟡 | Some se `image_path` nunca vier preenchido na view. |
| **Quantidade tratada não pode exceder o disponível** | 🔴 | Sem campo de quantidade no web (app mobile já tem). |
| **Tratativa parcial com saldo restante** | 🔴 | Toda tratativa é tudo-ou-nada; coluna `quantidade_tratada` é lida mas nunca escrita. |
| Filtro por setor / por responsável | 🔴 | Não existem (setor nem chega; responsável não é filtrável/buscável). |
| Tipo "desconto" / "retirar da área" | 🔴 | Ausentes; exigem migração no CHECK do banco. |
| Produto sem imagem virar pendência na Central | 🔴 | A Central de Pendências não considera ausência de imagem. |

### §15/§16 — Recebimento/Notas + Conferência
| Item | Status | Observação |
| --- | --- | --- |
| Gerar bônus, reimpressão (contagem), filas (entrada/saída), atribuir responsável, divergências | ✅ | Backend real; filas bem estruturadas. |
| Devolução / Auditar | 🟡 | Só togglam status; sem itens/quantidades/motivo nem passo de conclusão. |
| Progresso da conferência | 🟡 | Barra ao vivo só na fila de saída; entrada não tem. |
| Histórico / Export | 🟡 | Sem timeline por bônus; export só em parte das telas. |
| **Abas das notas** (todas/pendentes/divergência/corrigidas/auditadas/canceladas) | 🔴 | Não existem; tela mostra uma só tabela. |
| **Correção de entrada / corrigir item / ajustar quantidade** (com antes-depois+motivo) | 🔴 | Inexistentes; ações são toggles de 1 clique sem motivo. |
| **Cancelar pedido** | 🔴 | Não há ação; encerrados/cancelados somem da tela. |
| Desatribuir responsável | 🔴 | Só dá para trocar, não limpar. |
| Tempo parado/ocioso | 🔴 | `started_at` existe mas não é usado. |

### §17/§18/§19 — Relatórios, Auditoria e Histórico
| Item | Status | Observação |
| --- | --- | --- |
| Relatórios operacionais (14), export CSV, impressão, timeline por colaborador | ✅ | Cobertura ampla derivada dos dados. |
| Visualização de eventos / payload estruturado / antes-depois | 🟡 | Só leitura; campos `target/before/after/reason` não têm schema garantido. |
| Histórico por produto / por NF | 🟡 | Tabelas agregadas, não timeline por entidade individual. |
| **Registro (escrita) de ações sensíveis** | 🔴 | A webapp nunca escreve em `operational_events`. |
| **Export Excel/XLSX** | 🔴 | Sem lib; só CSV. |
| Export PDF real | 🟡 | Só `window.print()`. |
| Histórico por conferência/avaria/tratativa/divergência | 🔴 | Sem timeline por essas entidades. |
| Backup / exportação geral | 🔴 | Sem feature dedicada. |
| Gate `can_export_reports` na exportação | 🔴 | Export não checa permissão. |

### §20–§24 — Notificações, Fechamento, Comentários, Anexos, Config
| Item | Status | Observação |
| --- | --- | --- |
| Sino + badge + lida/não-lida + link por módulo | 🟡 | Funciona, mas derivado em runtime; "lido" só em localStorage; prioridade não exibida. |
| Fechamento diário (resumo+checklist+responsável/hora) | 🟡 | Completo na UI, mas só localStorage; sem bloqueio pós-fechamento, sem por loja/turno. |
| Config (faixas, funções, setores, motivos) | 🟡 | CRUD funciona, mas só localStorage; não compartilhado/auditável. |
| **Comentários internos** (§22) | 🔴 | Inexistente. |
| **Anexos/comprovantes via Storage** (§23) | 🔴 | Só leitura de imagens de produto; sem upload pela web. |

### §25/§26/§34 — Permissões, Travas, Aprovação, Motivo obrigatório
| Item | Status | Observação |
| --- | --- | --- |
| Catálogo das 11 `can_*` + matriz + UI | ✅ | Catálogo/UI completos. |
| Excluir com confirmação | ✅ | `useConfirm` nos deletes. |
| Motivo obrigatório na decisão de aprovação | ✅ | `hasReason` aplicado. |
| Workflow de aprovação ligado ao app (§34.6) | 🟡 | UI + tabela `0002` prontas, mas lib usa só localStorage; app não gera solicitações. |
| **Enforcement real das permissões** | 🔴 | Matriz não é consumida por nenhuma view; sem RLS granular. |
| **Travas: qtd negativa / exceder estoque** | 🔴 | Helpers existem, nunca usados. |
| **Motivo obrigatório**: excluir, corrigir nota, resetar senha, remover responsável, resolver divergência, alterar permissão | 🔴 | Não cablados. |
| Trava: alterar permissão sem auditoria | 🔴 | `persistMatrix` não gera log. |

### §34 (avançado) — Mapa, Fornecedores, Ranking, Qualidade, Comparativo, Importação, Logs
| Item | Status | Observação |
| --- | --- | --- |
| Fornecedores (histórico) / Ranking de produtos problemáticos | ✅ | Boas visões analíticas derivadas. |
| Mapa operacional | 🟡 | UI completa, mas roda sempre em fallback por módulo (setor não chega). |
| Qualidade de cadastro | 🟡 | Lógica boa, mas EAN/setor caem em "não rastreável" (não vêm no select). |
| Comparativo por período | 🟡 | Fixo em 7d vs 7d; sem seletor de período. |
| Importação em massa | 🟡 | Só "setores/funções" gravam (localStorage); produtos/colaboradores/fornecedores só preview. |
| Logs técnicos | 🟡 | Só buffer local; sem Sentry/centralização. |
| **Setor/filial/localização nos registros** | 🔴 | DDL aplicado, mas views PT e selects não expõem os campos. |

### Persistência, Deploy, CI, Qualidade (§27/§30)
| Item | Status | Observação |
| --- | --- | --- |
| Deploy Vercel (SPA, build, headers) / sem segredo no front / resiliência sem Supabase / tema | ✅ | Configuração de produção sólida. |
| Migrações `0001–0008` + `0000` (consolidada) | 🟡 | Idempotentes, mas aplicação manual; nenhuma cria tabela de metas/permissões/config/fechamento/etc. |
| CI (GitHub Actions) | 🟡 | Só faz build; sem lint, sem testes, sem deploy automático. |
| **RLS granular aplicada** | 🔴 | Só `approval_requests` e storage admin; resto é `is_admin_user()` tudo-ou-nada. |
| **Backend de usuários** (criar/reset/role) | 🔴 | Exige Edge Function com `service_role`. |
| **Testes automatizados** / **ESLint** | 🔴 | Nenhum no projeto. |

---

## 4. O que depende de quê (caminho recomendado)

A maioria das faltas P0/P1 destrava ao construir **a camada de backend governado** que o projeto vinha adiando (o "BFF/Edge Functions sobre Supabase"):

1. **Tabelas de governança no Supabase** (metas, permissões, config, faixas, fechamento, notif-read, aprovações) → resolve ~13 itens 🟡 "só localStorage" de uma vez.
2. **RLS por `can_*` + helper `hasPermission()` no front** → torna permissões reais (P0) e habilita gates de UI.
3. **Edge Functions com `service_role`** (criar/reset/role/bloquear usuário; corrigir/cancelar nota; tratativa com quantidade) → destrava §11/§12/§15/§14.
4. **Trilha `operational_events` de escrita** em toda mutação → §18 e as travas de "alterar sem auditoria".
5. **Views PT + selects expondo `sector/branch/area`** → Mapa e Qualidade saem do modo degradado.
6. **Comentários (§22) e anexos (§23)**: tabelas + bucket + RLS.

> Observação de arquitetura: enquanto não houver backend de escrita, os itens 🟡 "localStorage" continuam **úteis como protótipo de UX**, mas **não devem ser tratados como fonte de verdade** (não auditáveis, não compartilhados entre supervisores).
