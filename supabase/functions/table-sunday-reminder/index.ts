// Sunday 8pm CT reminder for The Table.
// Inserts a notification row for every active Owner who hasn't submitted
// their entry for the upcoming meeting. Idempotent per Owner per meeting.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function nowChicago() {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", weekday: "short", hour: "numeric", minute: "numeric", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const day = dayMap[parts.find(p => p.type === "weekday")!.value];
  const hour = parseInt(parts.find(p => p.type === "hour")!.value, 10);
  const minute = parseInt(parts.find(p => p.type === "minute")!.value, 10);
  return { day, hour, minute };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  const t = nowChicago();
  // Sunday between 7:30pm and 8:30pm CT
  if (!force && !(t.day === 0 && t.hour === 20 && t.minute < 60) && !(t.day === 0 && t.hour === 19 && t.minute >= 30)) {
    return new Response(JSON.stringify({ skipped: true, reason: "outside window", time: t }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Find next upcoming meeting
  const today = new Date().toISOString().slice(0, 10);
  const { data: meeting } = await supabase
    .from("table_meetings").select("*").gte("meeting_date", today).eq("status", "upcoming")
    .order("meeting_date").limit(1).maybeSingle();

  if (!meeting) {
    return new Response(JSON.stringify({ ok: true, message: "no upcoming meeting" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { data: owners } = await supabase.from("table_owners").select("*").eq("is_active", true);
  const { data: entries } = await supabase.from("table_owner_entries").select("owner_id, submitted_at").eq("meeting_id", meeting.id);
  const submittedSet = new Set((entries || []).filter(e => e.submitted_at).map(e => e.owner_id));

  let inserted = 0;
  for (const o of owners || []) {
    if (submittedSet.has(o.id)) continue;
    // Idempotency: skip if a reminder for this meeting+owner already exists
    const { data: existing } = await supabase.from("notifications")
      .select("id").eq("notification_type", "the_table_reminder")
      .eq("target_user", o.display_name)
      .contains("meta", { meeting_id: meeting.id }).limit(1);
    if (existing && existing.length > 0) continue;

    await supabase.from("notifications").insert({
      notification_type: "the_table_reminder",
      title: "The Table is tomorrow.",
      body: "Your lane update is still open.",
      target_user: o.display_name,
      meta: { meeting_id: meeting.id, link: "/the-table" },
    });
    inserted++;
  }

  return new Response(JSON.stringify({ ok: true, meeting_id: meeting.id, inserted }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
