import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/** Membership sale results */
const SALE_RESULTS = ['Premier + OTbeat', 'Premier + OTBeat', 'Premier w/o OTBeat', 'Premier', 'Elite + OTbeat', 'Elite + OTBeat', 'Elite w/o OTBeat', 'Elite', 'Basic + OTbeat', 'Basic + OTBeat', 'Basic w/o OTBeat', 'Basic'];
const isSale = (r: string) => SALE_RESULTS.some(s => r.toLowerCase() === s.toLowerCase());

/** Clean membership type for display */
function membershipLabel(result: string): string {
  const r = result.trim();
  if (/premier/i.test(r)) return r.includes('OT') ? 'Premier + OTbeat' : 'Premier';
  if (/elite/i.test(r)) return r.includes('OT') ? 'Elite + OTbeat' : 'Elite';
  if (/basic/i.test(r)) return r.includes('OT') ? 'Basic + OTbeat' : 'Basic';
  return r;
}

/** Format sale list: "Name: Type, Name: Type" with max 3 + overflow */
function formatSalesList(sales: Array<{ name: string; type: string }>): string {
  if (sales.length === 0) return '';
  const shown = sales.slice(0, 3).map(s => `${s.name}: ${s.type}`).join(', ');
  if (sales.length > 3) return ` — ${shown} + ${sales.length - 3} more`;
  return ` — ${shown}`;
}

/** Get Central time offset: CST = -6, CDT = -5 */
function getCentralOffset(date: Date): number {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const stdOff = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  // In Deno server, we use Intl to check
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false });
  const centralHour = parseInt(fmt.format(date));
  const utcHour = date.getUTCHours();
  let diff = centralHour - utcHour;
  if (diff > 12) diff -= 24;
  if (diff < -12) diff += 24;
  return diff; // -6 for CST, -5 for CDT
}

/** Get shift window boundaries in UTC for a given date string and shift type */
function getShiftWindow(dateStr: string, shiftType: 'AM' | 'PM'): { start: string; end: string } {
  // Create a date at noon Central to determine DST
  const probe = new Date(`${dateStr}T12:00:00Z`);
  const offset = getCentralOffset(probe); // -6 or -5
  const absOff = Math.abs(offset);
  const pad = (n: number) => String(n).padStart(2, '0');

  if (shiftType === 'AM') {
    // Midnight Central to 12:59:59 PM Central
    // Midnight Central = (00:00 + absOff) UTC
    const startHourUTC = absOff; // 6 or 5
    const endHourUTC = 12 + absOff; // 18 or 17
    // Handle day boundary
    const start = `${dateStr}T${pad(startHourUTC)}:00:00Z`;
    const end = `${dateStr}T${pad(endHourUTC)}:59:59Z`;
    return { start, end };
  } else {
    // 1:00 PM Central to 11:59:59 PM Central
    const startHourUTC = 13 + absOff; // 19 or 18
    const endHourUTC = 23 + absOff; // 29 or 28 → next day 5 or 4
    const start = `${dateStr}T${pad(startHourUTC)}:00:00Z`;
    // End crosses midnight UTC
    const nextDate = new Date(`${dateStr}T00:00:00Z`);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const nextDateStr = nextDate.toISOString().split('T')[0];
    const endHour = endHourUTC - 24;
    const end = `${nextDateStr}T${pad(endHour)}:59:59Z`;
    return { start, end };
  }
}

/** Build the recap message from database data */
async function buildRecapMessage(
  supabaseAdmin: ReturnType<typeof createClient>,
  dateStr: string,
  shiftType: 'AM' | 'PM',
  staffName?: string, // undefined = studio-wide (auto)
): Promise<{ text: string; hasActivity: boolean }> {
  const window = getShiftWindow(dateStr, shiftType);

  // Helper to add SA filter for manual recaps
  const saFilter = staffName ? staffName : null;

  // 1. Intros Booked (created_at in shift window)
  let bookedQuery = supabaseAdmin
    .from('intros_booked')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', window.start)
    .lte('created_at', window.end)
    .is('deleted_at', null)
    .eq('booking_type_canon', 'STANDARD');
  if (saFilter) {
    bookedQuery = bookedQuery.or(`sa_working_shift.eq.${saFilter},booked_by.eq.${saFilter}`);
  }
  const { count: bookedCount } = await bookedQuery;

  // 2. Intros Ran (run_date = date) — date-only field, no shift window time filter
  let ranQuery = supabaseAdmin
    .from('intros_run')
    .select('member_name, result, result_canon, intro_owner, sa_name, linked_intro_booked_id, buy_date, run_date')
    .eq('run_date', dateStr);
  if (saFilter) {
    ranQuery = ranQuery.or(`sa_name.eq.${saFilter},intro_owner.eq.${saFilter}`);
  }
  const { data: ranData } = await ranQuery;
  const allRuns = ranData || [];

  // No-shows are booked-but-not-ran — exclude from "ran" count
  const noShows = allRuns.filter(r => r.result_canon === 'NO_SHOW' || r.result === 'No-show');
  const runs = allRuns.filter(r => r.result_canon !== 'NO_SHOW' && r.result !== 'No-show');

  // Separate same-day sales from follow-up purchases
  const sameDaySales = runs.filter(r => isSale(r.result) && (r.buy_date === r.run_date || !r.buy_date));
  const followUpNeeded = allRuns.filter(r => ['FOLLOW_UP_NEEDED', 'UNRESOLVED'].includes(r.result_canon || '') && r.result !== 'No-show');

  // 3. Follow-up Purchases (buy_date = date, run_date != date)
  let fuPurchQuery = supabaseAdmin
    .from('intros_run')
    .select('member_name, result, intro_owner, sa_name, linked_intro_booked_id')
    .eq('buy_date', dateStr)
    .neq('run_date', dateStr);
  if (saFilter) {
    fuPurchQuery = fuPurchQuery.or(`sa_name.eq.${saFilter},intro_owner.eq.${saFilter}`);
  }
  const { data: fuPurchData } = await fuPurchQuery;
  const fuPurchases = fuPurchData || [];

  // For sales attribution, get intro_owner from linked booking if missing on run
  const getSaleOwner = (run: any) => run.intro_owner || run.sa_name || 'Unknown';

  // Format sales lists
  const soldList = sameDaySales.map(r => ({ name: r.member_name, type: membershipLabel(r.result) }));
  const fuPurchList = fuPurchases.map(r => ({ name: r.member_name, type: membershipLabel(r.result) }));

  // 3b. Planning to Book 2nd Intro (from intros_booked, outcome logged within shift window)
  let planning2ndQuery = supabaseAdmin
    .from('intros_booked')
    .select('id', { count: 'exact', head: true })
    .eq('booking_status_canon', 'PLANNING_2ND_INTRO')
    .gte('closed_at', window.start)
    .lte('closed_at', window.end)
    .is('deleted_at', null);
  if (saFilter) {
    planning2ndQuery = planning2ndQuery.or(`sa_working_shift.eq.${saFilter},intro_owner.eq.${saFilter}`);
  }
  const { count: planning2ndCount } = await planning2ndQuery;

  // 4. Prep & Q metrics (timestamp-based, use shift window)
  const qSentQuery = supabaseAdmin
    .from('intros_booked')
    .select('id', { count: 'exact', head: true })
    .gte('questionnaire_sent_at', window.start)
    .lte('questionnaire_sent_at', window.end);
  if (saFilter) {
    // Can't easily filter Q sent by SA since it's on the booking, just count all
  }
  const { count: qSentCount } = await qSentQuery;

  const qCompQuery = supabaseAdmin
    .from('intro_questionnaires')
    .select('id', { count: 'exact', head: true })
    .gte('submitted_at', window.start)
    .lte('submitted_at', window.end);
  const { count: qCompCount } = await qCompQuery;

  let preppedQuery = supabaseAdmin
    .from('intros_booked')
    .select('id', { count: 'exact', head: true })
    .eq('prepped', true)
    .gte('prepped_at', window.start)
    .lte('prepped_at', window.end);
  const { count: preppedCount } = await preppedQuery;

  let scriptsQuery = supabaseAdmin
    .from('script_actions')
    .select('id', { count: 'exact', head: true })
    .eq('action_type', 'script_sent')
    .gte('completed_at', window.start)
    .lte('completed_at', window.end);
  if (saFilter) {
    scriptsQuery = scriptsQuery.eq('completed_by', saFilter);
  }
  const { count: scriptsCount } = await scriptsQuery;

  // 5. Contacts from shift_recaps (manually entered by SA)
  let contactsQuery = supabaseAdmin
    .from('shift_recaps')
    .select('calls_made, texts_sent, dms_sent')
    .eq('shift_date', dateStr);
  if (saFilter) {
    contactsQuery = contactsQuery.eq('staff_name', saFilter);
  }
  const { data: contactRows } = await contactsQuery;
  const contacts = (contactRows || []).reduce(
    (acc, r) => ({
      calls: acc.calls + (r.calls_made || 0),
      texts: acc.texts + (r.texts_sent || 0),
      dms: acc.dms + (r.dms_sent || 0),
    }),
    { calls: 0, texts: 0, dms: 0 }
  );

  // 6. Follow-up Touches
  let fuTouchQuery = supabaseAdmin
    .from('followup_touches')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', window.start)
    .lte('created_at', window.end);
  if (saFilter) {
    fuTouchQuery = fuTouchQuery.eq('created_by', saFilter);
  }
  const { count: fuTouchCount } = await fuTouchQuery;

  // Check if there's any activity at all
  const totalActivity = (bookedCount || 0) + allRuns.length + fuPurchases.length +
    (qSentCount || 0) + (qCompCount || 0) + (preppedCount || 0) + (scriptsCount || 0) +
    contacts.calls + contacts.texts + contacts.dms + (fuTouchCount || 0);

  if (totalActivity === 0) {
    return { text: '', hasActivity: false };
  }

  // Build message
  const dateLabel = new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago',
  });
  const shiftLabel = shiftType === 'AM' ? 'AM' : 'PM';

  const header = staffName
    ? `🏷️ ${staffName} — ${shiftLabel} Shift Recap (${dateLabel})`
    : `🏷️ Auto Recap — ${shiftLabel} (${dateLabel})`;

  const lines: string[] = [
    header,
    '',
    '📅 INTROS',
    `• Booked: ${bookedCount || 0}`,
    `• Ran: ${runs.length}`,
    `• Sold: ${sameDaySales.length}${formatSalesList(soldList)}`,
    `• No-Show: ${noShows.length}`,
    `• Follow-Up Needed: ${followUpNeeded.length}`,
    ...((planning2ndCount || 0) > 0 ? [`• Planning 2nd Intro: ${planning2ndCount}`] : []),
    '',
    '💳 FOLLOW-UP PURCHASES',
    `• ${fuPurchases.length} purchase(s)${formatSalesList(fuPurchList)}`,
    '',
    '📋 PREP & Q',
    `• Q Sent: ${qSentCount || 0}`,
    `• Q Completed: ${qCompCount || 0}`,
    `• Prepped: ${preppedCount || 0}`,
    `• Scripts Sent: ${scriptsCount || 0}`,
    '',
    '📞 CONTACTS & FOLLOW-UPS',
    `• Calls: ${contacts.calls}`,
    `• Texts: ${contacts.texts}`,
    `• IG DMs: ${contacts.dms}`,
    `• FU Touches: ${fuTouchCount || 0}`,
  ];

  return { text: lines.join('\n'), hasActivity: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GROUPME_BOT_ID = Deno.env.get('GROUPME_BOT_ID');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!GROUPME_BOT_ID) {
      return new Response(
        JSON.stringify({ success: false, error: 'GroupMe bot not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const body = await req.json();
    const { action, text, staffName, date, shiftType, recapId } = body;

    // ── TEST CONNECTION ──
    if (action === 'test') {
      const testMsg = `✅ GroupMe connected successfully${staffName ? ` (by ${staffName})` : ''}`;
      const res = await fetch('https://api.groupme.com/v3/bots/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: GROUPME_BOT_ID, text: testMsg }),
      });
      if (res.ok || res.status === 202) {
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const errText = await res.text();
      return new Response(JSON.stringify({ success: false, error: `GroupMe API error: ${res.status} ${errText}` }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── RESEND FAILED RECAP ──
    if (action === 'resend' && recapId) {
      const { data: recap } = await supabaseAdmin.from('daily_recaps').select('id, recap_text').eq('id', recapId).single();
      if (!recap) return new Response(JSON.stringify({ success: false, error: 'Recap not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const res = await fetch('https://api.groupme.com/v3/bots/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: GROUPME_BOT_ID, text: recap.recap_text }),
      });
      const ok = res.ok || res.status === 202;
      await supabaseAdmin.from('daily_recaps').update({
        status: ok ? 'sent' : 'failed',
        error_message: ok ? null : `GroupMe ${res.status}`,
      }).eq('id', recapId);
      return new Response(JSON.stringify({ success: ok }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── POST (manual submit) ──
    if (action === 'post') {
      const shift = shiftType === 'PM Shift' || shiftType === 'PM' ? 'PM' : 'AM';
      const recapDate = date || new Date().toISOString().split('T')[0];

      // Gate: check if SA logged any shift tasks before allowing GroupMe post
      if (staffName) {
        const { count: taskActivity } = await supabaseAdmin
          .from('shift_task_completions')
          .select('id', { count: 'exact', head: true })
          .eq('sa_name', staffName)
          .eq('shift_date', recapDate)
          .or('completed.eq.true,count_logged.gt.0');
        if (!taskActivity || taskActivity === 0) {
          return new Response(JSON.stringify({ success: true, skipped: true, message: 'No shift tasks completed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      const { text: msgText, hasActivity } = await buildRecapMessage(supabaseAdmin, recapDate, shift, staffName);
      
      if (!hasActivity) {
        return new Response(JSON.stringify({ success: true, skipped: true, message: 'No activity to report' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const res = await fetch('https://api.groupme.com/v3/bots/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: GROUPME_BOT_ID, text: msgText }),
      });
      const ok = res.ok || res.status === 202;

      // Store in daily_recaps
      await supabaseAdmin.from('daily_recaps').insert({
        shift_date: recapDate,
        staff_name: staffName || 'Auto Recap',
        recap_text: msgText,
        status: ok ? 'sent' : 'failed',
        error_message: ok ? null : `GroupMe ${res.status}`,
      });

      return new Response(JSON.stringify({ success: ok, text: msgText }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── AUTO (scheduled fire) ──
    if (action === 'auto') {
      // Determine current Central time
      const now = new Date();
      const centralHour = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', hour12: false }).format(now));
      const centralDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(now); // YYYY-MM-DD

      // Determine which shift based on current hour
      let shift: 'AM' | 'PM';
      if (centralHour >= 12 && centralHour <= 14) {
        shift = 'AM'; // Firing around 1 PM for AM shift
      } else if (centralHour >= 19 && centralHour <= 21) {
        shift = 'PM'; // Firing around 8 PM for PM shift
      } else {
        console.log(`Auto recap skipped: Central hour ${centralHour} not in expected range`);
        return new Response(JSON.stringify({ success: true, skipped: true, message: `Hour ${centralHour} not in range` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check if manual recap already sent for this date + shift
      const shiftLabel = shift === 'AM' ? 'AM' : 'PM';
      const { data: existing } = await supabaseAdmin
        .from('daily_recaps')
        .select('id')
        .eq('shift_date', centralDateStr)
        .eq('status', 'sent')
        .ilike('recap_text', `%${shiftLabel} Shift Recap%`)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`Auto recap suppressed: manual recap already sent for ${centralDateStr} ${shiftLabel}`);
        return new Response(JSON.stringify({ success: true, skipped: true, message: 'Manual recap already sent' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Gate: check if ANY SA logged shift tasks today
      const { count: anyTaskActivity } = await supabaseAdmin
        .from('shift_task_completions')
        .select('id', { count: 'exact', head: true })
        .eq('shift_date', centralDateStr)
        .or('completed.eq.true,count_logged.gt.0');
      if (!anyTaskActivity || anyTaskActivity === 0) {
        console.log(`Auto recap suppressed: no shift tasks completed for ${centralDateStr}`);
        return new Response(JSON.stringify({ success: true, skipped: true, message: 'No shift tasks completed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Build studio-wide message (no staffName filter)
      const { text: msgText, hasActivity } = await buildRecapMessage(supabaseAdmin, centralDateStr, shift);

      if (!hasActivity) {
        console.log(`Auto recap suppressed: zero activity for ${centralDateStr} ${shiftLabel}`);
        return new Response(JSON.stringify({ success: true, skipped: true, message: 'No activity' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const res = await fetch('https://api.groupme.com/v3/bots/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: GROUPME_BOT_ID, text: msgText }),
      });
      const ok = res.ok || res.status === 202;

      await supabaseAdmin.from('daily_recaps').insert({
        shift_date: centralDateStr,
        staff_name: 'Auto Recap',
        recap_text: msgText,
        status: ok ? 'sent' : 'failed',
        error_message: ok ? null : `GroupMe ${res.status}`,
      });

      console.log(`Auto recap ${ok ? 'sent' : 'failed'} for ${centralDateStr} ${shiftLabel}`);
      return new Response(JSON.stringify({ success: ok }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── LEGACY: raw text post (backward compat for resend from ShiftRecapsEditor) ──
    if (text) {
      const res = await fetch('https://api.groupme.com/v3/bots/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: GROUPME_BOT_ID, text }),
      });
      const ok = res.ok || res.status === 202;
      return new Response(JSON.stringify({ success: ok }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in post-groupme:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
