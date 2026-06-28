# Edge Functions (Supabase)

Funções que exigem `service_role` (operações privilegiadas que **nunca** podem ir para o frontend). Resolvem o gap C2 (revogar sessão de verdade) e o backend de gestão de usuários.

## `admin-usuarios`
Ações (body JSON): `reset_password`, `block`, `unblock`, `revoke_session`.
- Valida que o **chamador é admin** (JWT → `admin_users`) antes de agir.
- Grava `operational_event` de auditoria (ator + motivo).
- `reset_password` retorna uma **senha temporária** para repassar ao colaborador.
- `revoke_session` revoga **todos os refresh tokens** do usuário (logout real).

## Deploy
```bash
# na raiz com o projeto Supabase linkado (supabase link --project-ref <ref>)
supabase functions deploy admin-usuarios
```
As envs `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetadas automaticamente pelo runtime das Edge Functions — não precisa configurar nada.

## Uso no frontend
O webapp já chama via `adminApi` (`resetUserPassword`, `setUserBlocked`, `revokeUserSession`) usando `supabase.functions.invoke('admin-usuarios', …)`. Enquanto a função não estiver deployada, o painel mostra um aviso amigável (degrada com elegância).
