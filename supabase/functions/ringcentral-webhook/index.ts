// RingCentral webhook — receives message-store notifications, fetches
// message details, matches to leads/bookings by normalized phone, and
// writes lead_activities (outbound='text', inbound='note') plus an
// rc_message_log row for dedupe and unmatched reporting.
//
// Read-only toward RingCentral: this function NEVER sends messages.
// Auth to RC: JWT grant flow (client_credentials with jwt assertion),
// using RC_CLIENT_ID / RC_CLIENT_SECRET / RC_JWT function secrets.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const RC_SERVER = 'https://platform.ringcentral.com'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Same 10-digit rule as src/lib/parsing/phone.ts stripCountryCode.
function toTenDigits(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('1')) {
    const ten = digits.slice(1)
    if (ten[0] === '0' || ten[0] === '1') return null
    return ten
  }
  if (digits.length === 10) {
    if (digits[0] === '0' || digits[0] === '1') return null
    return digits
  }
  return null
}

const toE164 = (ten: string) => `+1${ten}`

async function getRcAccessToken(): Promise<string> {
  const clientId = Deno.env.get('RC_CLIENT_ID')!
  const clientSecret = Deno.env.get('RC_CLIENT_SECRET')!
  const jwt = Deno.env.get('RC_JWT')!
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  })
  const basic = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(`${RC_SERVER}/restapi/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body,
  })
  if (!res.ok) throw new Error(`RC token fetch failed: ${res.status} ${await res.text()}`)
  const j = await res.json()
  return j.access_token as string
}

async function fetchMessage(uri: string, token: string) {
  // uri is a full path like /restapi/v1.0/account/~/extension/~/message-store/12345
  const url = uri.startsWith('http') ? uri : `${RC_SERVER}${uri}`
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`RC message fetch failed: ${res.status}`)
  return await res.json()
}

// Extract counterparty (the non-studio number) and direction.
// RC message has 'from' and 'to' (array). direction is 'Inbound' or 'Outbound'.
function extractCounterparty(msg: any, studioTenDigits: string): string | null {
  const direction = msg.direction as string
  if (direction === 'Outbound') {
    // counterparty = first 'to' number
    const to = Array.isArray(msg.to) ? msg.to[0] : null
    return toTenDigits(to?.phoneNumber || null)
  }
  // Inbound: counterparty = 'from'
  return toTenDigits(msg?.from?.phoneNumber || null)
}

async function matchByPhone(ten: string): Promise<{ leadId: string | null; bookingId: string | null }> {
  const last10 = ten
  const e164 = toE164(ten)

  // 1. leads: last-10 match on phone column, exclude soft-deleted (deleted_at not null on leads? check).
  //    leads table doesn't have deleted_at per schema; skip that filter.
  const { data: leadRows } = await supabase
    .from('leads')
    .select('id, phone, created_at')
    .not('phone', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)
    // Rough server-side prefilter using ilike on last 4 to keep result small,
    // then filter precisely in JS.
    .ilike('phone', `%${ten.slice(-4)}%`)

  const leadMatch = (leadRows || []).find(r => {
    const t = toTenDigits(r.phone)
    return t === last10
  })

  if (leadMatch) return { leadId: leadMatch.id, bookingId: null }

  // 2. intros_booked fallback — phone_e164 exact OR phone last-10.
  const { data: bookRows } = await supabase
    .from('intros_booked')
    .select('id, phone, phone_e164, class_date')
    .is('deleted_at', null)
    .or(`phone_e164.eq.${e164},phone.ilike.%${ten.slice(-4)}%`)
    .order('class_date', { ascending: false })
    .limit(50)

  const bookMatch = (bookRows || []).find(r => {
    if (r.phone_e164 === e164) return true
    return toTenDigits(r.phone) === last10
  })

  if (!bookMatch) return { leadId: null, bookingId: null }

  // Hop to a linked lead via leads.booked_intro_id
  const { data: linkedLead } = await supabase
    .from('leads')
    .select('id, created_at')
    .eq('booked_intro_id', bookMatch.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { leadId: linkedLead?.id || null, bookingId: bookMatch.id }
}

async function processMessage(msg: any, studioTenDigits: string) {
  const messageId = String(msg.id)

  // Dedup
  const { data: existing } = await supabase
    .from('rc_message_log')
    .select('message_id')
    .eq('message_id', messageId)
    .maybeSingle()
  if (existing) return { skipped: true }

  const direction = msg.direction === 'Outbound' ? 'Outbound' : 'Inbound'
  const counterTen = extractCounterparty(msg, studioTenDigits)
  const counterE164 = counterTen ? toE164(counterTen) : null
  const messageTs = msg.creationTime || null

  if (!counterTen) {
    await supabase.from('rc_message_log').insert({
      message_id: messageId,
      direction,
      counterparty_e164: null,
      matched: false,
      message_ts: messageTs,
    })
    return { logged: 'no_counterparty' }
  }

  const { leadId, bookingId } = await matchByPhone(counterTen)

  // Write lead_activity ONLY when we have a lead_id.
  // Outbound => 'text' (counts as contact). Inbound => 'note' (does not).
  if (leadId) {
    const activity_type = direction === 'Outbound' ? 'text' : 'note'
    const notes = direction === 'Outbound'
      ? 'Auto-logged outbound text'
      : 'Inbound text received'
    await supabase.from('lead_activities').insert({
      lead_id: leadId,
      activity_type,
      performed_by: 'RingCentral',
      notes,
      // created_at defaults to now(); prefer message timestamp for speed-to-lead accuracy
      created_at: messageTs || new Date().toISOString(),
    } as any)
  }

  await supabase.from('rc_message_log').insert({
    message_id: messageId,
    direction,
    counterparty_e164: counterE164,
    matched: !!leadId,
    lead_id: leadId,
    booking_id: bookingId,
    message_ts: messageTs,
  })

  return { matched: !!leadId, direction }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // RC subscription creation handshake: echo Validation-Token header
  const validationToken = req.headers.get('Validation-Token')
  if (validationToken) {
    return new Response(null, {
      status: 200,
      headers: { ...corsHeaders, 'Validation-Token': validationToken },
    })
  }

  try {
    const payload = await req.json().catch(() => ({}))
    // RC message-event body: { body: { changes: [{ newMessageIds: [...], type: 'SMS' }] }, ... }
    // OR simpler: { body: { messages: [...] } } depending on filter.
    // We fetch each message by id via account/~/extension/~/message-store/{id}.

    const messageIds: string[] = []
    const bodyChanges = payload?.body?.changes || []
    for (const c of bodyChanges) {
      if (Array.isArray(c.newMessageIds)) messageIds.push(...c.newMessageIds.map(String))
    }
    // Also support flat message shape
    if (Array.isArray(payload?.body?.messages)) {
      for (const m of payload.body.messages) if (m?.id) messageIds.push(String(m.id))
    }

    if (messageIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, note: 'no message ids' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const studioE164 = Deno.env.get('RC_STUDIO_NUMBER') || ''
    const studioTen = toTenDigits(studioE164) || ''

    const token = await getRcAccessToken()
    const results: any[] = []

    for (const id of messageIds) {
      try {
        const msg = await fetchMessage(
          `/restapi/v1.0/account/~/extension/~/message-store/${id}`,
          token,
        )
        // Only process SMS/text messages
        if (msg.type && msg.type !== 'SMS' && msg.type !== 'Text') {
          results.push({ id, skipped: 'non_sms' })
          continue
        }
        results.push({ id, ...(await processMessage(msg, studioTen)) })
      } catch (e) {
        results.push({ id, error: (e as Error).message })
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('rc-webhook error', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200, // Always 200 so RC doesn't retry-storm
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
