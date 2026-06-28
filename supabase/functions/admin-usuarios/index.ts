// Edge Function: admin-usuarios
// ---------------------------------------------------------------------------
// Operações de gestão de usuários que EXIGEM service_role (nunca no frontend):
//   • reset_password  — define uma senha temporária (ou a informada) e a retorna
//   • block / unblock — bane/desbane o usuário (impede refresh de token)
//   • revoke_session  — revoga TODOS os refresh tokens do usuário (logout real)
//
// Segurança: valida que QUEM chama é admin (JWT do chamador → admin_users) antes
// de agir, e grava um operational_event de auditoria com o ator e o motivo.
//
// Deploy:  supabase functions deploy admin-usuarios
// (Precisa das envs automáticas SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.)
// Chamada no front: supabase.functions.invoke('admin-usuarios', { body: {...} })
// ---------------------------------------------------------------------------
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const randomPassword = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(9)))
    .map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'[b % 54])
    .join('') + '!7';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') || '';
    if (!authHeader) return json({ error: 'Sem autenticação' }, 401);

    // Identidade do CHAMADOR (com o JWT dele) e validação de admin.
    const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: caller } = await callerClient.auth.getUser();
    const callerId = caller?.user?.id;
    if (!callerId) return json({ error: 'Sessão inválida' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isAdminRow } = await admin
      .from('admin_users').select('user_id').eq('user_id', callerId).maybeSingle();
    if (!isAdminRow) return json({ error: 'Apenas administradores' }, 403);

    const body = await req.json().catch(() => ({}));
    const action: string = body?.action;
    const target: string = body?.target_user_id;
    const motivo: string = (body?.motivo || '').toString().slice(0, 300);
    if (!action || !target) return json({ error: 'Parâmetros: action e target_user_id' }, 400);

    let result: Record<string, unknown> = {};

    if (action === 'reset_password') {
      const senha = (body?.new_password && String(body.new_password).length >= 6)
        ? String(body.new_password) : randomPassword();
      const { error } = await admin.auth.admin.updateUserById(target, { password: senha });
      if (error) throw error;
      result = { senha_temporaria: senha };
    } else if (action === 'block') {
      const { error } = await admin.auth.admin.updateUserById(target, { ban_duration: '876000h' });
      if (error) throw error;
    } else if (action === 'unblock') {
      const { error } = await admin.auth.admin.updateUserById(target, { ban_duration: 'none' });
      if (error) throw error;
    } else if (action === 'revoke_session') {
      // Revoga TODOS os refresh tokens do usuário (GoTrue admin logout).
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${target}/logout`, {
        method: 'POST',
        headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'global' }),
      });
      if (!resp.ok) throw new Error(`Falha ao revogar sessão (${resp.status})`);
    } else {
      return json({ error: `Ação desconhecida: ${action}` }, 400);
    }

    // Auditoria (best-effort).
    const { data: prof } = await admin.from('profiles').select('name, email').eq('user_id', callerId).maybeSingle();
    await admin.from('operational_events').insert({
      user_id: callerId,
      module: 'usuarios',
      event_type: `supervisor_${action}`,
      entity_type: 'user',
      entity_id: target,
      actor_name: prof?.name || prof?.email || null,
      payload: { motivo: motivo || null },
    });

    return json({ ok: true, action, ...result });
  } catch (err) {
    return json({ error: (err as Error)?.message || 'Erro interno' }, 400);
  }
});
