// Daily renewal for the RingCentral webhook subscription.
// - If the singleton rc_subscription row has no id OR expiry is <2 days
//   away OR expiry is past OR RC says the subscription no longer exists,
//   we recreate it. Otherwise we renew.
// - Self-heals: a missing/expired subscription is recreated and
//   last_recreated_at is stamped.
// - Called by pg_cron daily and safe to call manually.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const RC_SERVER = 'https://platform.ringcentral.com'
const EVENT_FILTERS = [
  '/restapi/v1.0/account/~/extension/~/message-store',
]

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

async function getRcAccessToken(): Promise<string> {
  const clientId = Deno.env.get('RC_CLIENT_ID')!
  const clientSecret = Deno.env.get('RC_CLIENT_SECRET')!
  const jwt = Deno.env.get('RC_JWT')!
  const basic = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`RC token: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token
}

function webhookUrl(): string {
  const projectId = Deno.env.get('SUPABASE_URL')!.replace('https://', '').split('.')[0]
  return `https://${projectId}.functions.supabase.co/ringcentral-webhook`
}

async function createSubscription(token: string) {
  const res = await fetch(`${RC_SERVER}/restapi/v1.0/subscription`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      eventFilters: EVENT_FILTERS,
      deliveryMode: { transportType: 'WebHook', address: webhookUrl() },
      expiresIn: 604800, // 7 days (max)
    }),
  })
  if (!res.ok) throw new Error(`RC create sub: ${res.status} ${await res.text()}`)
  return await res.json()
}

async function renewSubscription(token: string, subId: string) {
  const res = await fetch(`${RC_SERVER}/restapi/v1.0/subscription/${subId}/renew`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (res.status === 404) return null // gone, need to recreate
  if (!res.ok) throw new Error(`RC renew: ${res.status} ${await res.text()}`)
  return await res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const token = await getRcAccessToken()
    const { data: row } = await supabase
      .from('rc_subscription')
      .select('*')
      .eq('id', 'primary')
      .maybeSingle()

    const now = new Date()
    const expiresAt = row?.expires_at ? new Date(row.expires_at) : null
    const hoursLeft = expiresAt ? (expiresAt.getTime() - now.getTime()) / 3_600_000 : -1
    const needsCreate = !row?.rc_subscription_id || hoursLeft <= 0
    const needsRenew = !needsCreate && hoursLeft < 48

    let result: any = null
    let action: 'none' | 'renewed' | 'created' | 'recreated' = 'none'

    if (needsCreate) {
      result = await createSubscription(token)
      action = row?.rc_subscription_id ? 'recreated' : 'created'
    } else if (needsRenew) {
      result = await renewSubscription(token, row!.rc_subscription_id!)
      if (!result) {
        result = await createSubscription(token)
        action = 'recreated'
      } else {
        action = 'renewed'
      }
    } else {
      return new Response(JSON.stringify({ ok: true, action: 'none', hoursLeft }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('rc_subscription').upsert({
      id: 'primary',
      rc_subscription_id: result.id,
      expires_at: result.expirationTime,
      last_renewed_at: action === 'renewed' ? now.toISOString() : row?.last_renewed_at || null,
      last_recreated_at: (action === 'created' || action === 'recreated') ? now.toISOString() : row?.last_recreated_at || null,
      status: 'active',
      last_error: null,
      updated_at: now.toISOString(),
    })

    return new Response(JSON.stringify({ ok: true, action, id: result.id, expires: result.expirationTime }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = (e as Error).message
    console.error('rc-renew error', msg)
    await supabase.from('rc_subscription').upsert({
      id: 'primary',
      status: 'error',
      last_error: msg,
      updated_at: new Date().toISOString(),
    })
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
