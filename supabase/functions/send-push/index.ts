// Edge Function: send-push
// Envoie des notifications Web Push (hors-app) aux appareils abonnés d'une liste
// d'utilisateurs. Appelée par le client après la création d'une notification.
//
// Secrets requis :
//   - VAPID_PRIVATE_KEY (obligatoire) : clé privée VAPID (à configurer)
//   - VAPID_SUBJECT (optionnel)       : mailto:... par défaut
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Clé publique VAPID (publique par nature — doit correspondre à celle du frontend)
const VAPID_PUBLIC_KEY = 'BBiEVv3khfSEScXjOi86SIEwrjzuRMfTh3jmNZ5wC7McFkrt7n4o-WLoSdSyW3KtMwlNwnLCNw02ahWM6bD_j0Y'
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@dkproduction.space'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!VAPID_PRIVATE_KEY) {
      return json({ error: 'VAPID_PRIVATE_KEY non configuré (secret manquant)' }, 500)
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // L'appelant doit être authentifié
    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await caller.auth.getUser()
    if (userErr || !user) return json({ error: 'unauthorized' }, 401)

    const { userIds, title, body, url } = await req.json()
    if (!Array.isArray(userIds) || userIds.length === 0) return json({ sent: 0 })

    // Lecture des abonnements avec le service_role (contourne la RLS)
    const admin = createClient(supabaseUrl, serviceKey)
    const { data: subs, error } = await admin
      .from('PushSubscription')
      .select('endpoint, p256dh, auth')
      .in('userId', userIds)
    if (error) throw error

    const payload = JSON.stringify({
      title: title || 'DK Manager',
      body: body || '',
      url: url || '/',
    })

    let sent = 0
    await Promise.all((subs ?? []).map(async (sub) => {
      const subscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }
      try {
        await webpush.sendNotification(subscription, payload)
        sent++
      } catch (err) {
        const status = (err as { statusCode?: number })?.statusCode
        // Abonnement expiré/invalide → on le retire
        if (status === 404 || status === 410) {
          await admin.from('PushSubscription').delete().eq('endpoint', sub.endpoint)
        }
      }
    }))

    return json({ sent })
  } catch (err) {
    return json({ error: String((err as Error)?.message ?? err) }, 500)
  }
})
