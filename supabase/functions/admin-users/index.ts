// Edge Function: admin-users
// Handles privileged user-management actions (create / delete) that require
// the service_role key, which must never be exposed to the client.
// Only callers whose `User.role = 'admin'` may perform these actions.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Authorization manquante')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user: caller },
      error: callerErr,
    } = await callerClient.auth.getUser()
    if (callerErr || !caller) throw new Error('Non authentifié')

    const { data: callerProfile, error: profileErr } = await callerClient
      .from('User')
      .select('role')
      .eq('id', caller.id)
      .single()
    if (profileErr || callerProfile?.role !== 'admin') throw new Error('Réservé aux administrateurs')

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const body = await req.json()

    if (body.action === 'create') {
      const { name, email, password, role } = body
      if (!name || !email || !password) throw new Error('Nom, email et mot de passe requis')

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      })
      if (createErr) throw createErr

      const { error: updateErr } = await adminClient
        .from('User')
        .update({ name, role: role || 'operator' })
        .eq('id', created.user.id)
      if (updateErr) throw updateErr

      return json({ id: created.user.id })
    }

    if (body.action === 'delete') {
      const { userId } = body
      if (!userId) throw new Error('userId requis')
      if (userId === caller.id) throw new Error('Vous ne pouvez pas supprimer votre propre compte')

      const { error: deleteErr } = await adminClient.auth.admin.deleteUser(userId)
      if (deleteErr) throw deleteErr

      return json({ success: true })
    }

    throw new Error('Action inconnue')
  } catch (err) {
    return json({ error: err.message }, 400)
  }
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
