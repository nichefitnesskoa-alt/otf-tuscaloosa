import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseDaysFromTimingNote(note: string | null): number {
  if (!note) return 3;
  const lower = note.toLowerCase();
  if (lower.includes("same day")) return 0;
  if (lower.includes("24-48 hour")) return 2;
  if (lower.includes("3-5 day")) return 4;
  if (lower.includes("1-2 week")) return 10;
  if (lower.includes("7 day")) return 7;
  if (lower.includes("3 day")) return 3;
  const match = lower.match(/(\d+)\s*day/);
  if (match) return parseInt(match[1], 10);
  const weekMatch = lower.match(/(\d+)\s*week/);
  if (weekMatch) return parseInt(weekMatch[1], 10) * 7;
  return 3;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const groupmeBotId = Deno.env.get("GROUPME_BOT_ID");
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch send logs, templates, leads, bookings
    const [logsRes, templatesRes, leadsRes, bookingsRes] = await Promise.all([
      supabase.from("script_send_log").select("*").order("sent_at", { ascending: true }),
      supabase.from("script_templates").select("*").not("sequence_order", "is", null).eq("is_active", true),
      supabase.from("leads").select("id, first_name, last_name, stage"),
      supabase.from("intros_booked").select("id, member_name, booking_status").is("deleted_at", null),
    ]);

    const logs = logsRes.data || [];
    const templates = templatesRes.data || [];
    const leads = new Map((leadsRes.data || []).map((l: { id: string; first_name: string; last_name: string; stage: string }) => [l.id, l]));
    const bookings = new Map((bookingsRes.data || []).map((b: { id: string; member_name: string; booking_status: string | null }) => [b.id, b]));
    const templateMap = new Map(templates.map((t: { id: string }) => [t.id, t]));

    // Group by entity + category
    const grouped = new Map<string, typeof logs>();
    for (const log of logs) {
      const tpl = templateMap.get(log.template_id) as { category: string } | undefined;
      if (!tpl) continue;
      const key = log.lead_id ? `lead:${log.lead_id}:${tpl.category}` : log.booking_id ? `booking:${log.booking_id}:${tpl.category}` : null;
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(log);
    }

    // Find overdue items grouped by SA
    const overduesBySA = new Map<string, string[]>();
    const now = new Date();

    for (const [key, entityLogs] of grouped) {
      const [type, entityId, category] = key.split(":");
      const catTemplates = templates.filter((t: { category: string }) => t.category === category).sort((a: { sequence_order: number | null }, b: { sequence_order: number | null }) => (a.sequence_order || 0) - (b.sequence_order || 0));
      const sentSteps = new Set(entityLogs.map((l: { sequence_step_number: number | null }) => l.sequence_step_number).filter((s: number | null) => s !== null));
      const maxSent = Math.max(...(Array.from(sentSteps) as number[]));
      const nextTpl = catTemplates.find((t: { sequence_order: number | null }) => (t.sequence_order || 0) > maxSent) as { name: string; timing_note: string | null } | undefined;
      if (!nextTpl) continue;

      const lastLog = entityLogs.filter((l: { sequence_step_number: number | null }) => l.sequence_step_number !== null).sort((a: { sent_at: string }, b: { sent_at: string }) => b.sent_at.localeCompare(a.sent_at))[0];
      if (!lastLog) continue;

      const daysBetween = parseDaysFromTimingNote(nextTpl.timing_note);
      const sentTime = new Date(lastLog.sent_at).getTime();
      const hoursOverdue = (now.getTime() - sentTime) / (1000 * 60 * 60) - daysBetween * 24;
      if (hoursOverdue <= 0) continue;

      let personName = "Unknown";
      if (type === "lead") {
        const lead = leads.get(entityId);
        if (!lead || lead.stage === "lost" || lead.stage === "won") continue;
        personName = `${lead.first_name} ${lead.last_name}`;
      } else {
        const booking = bookings.get(entityId);
        if (!booking || booking.booking_status === "Cancelled") continue;
        personName = booking.member_name;
      }

      const sa = lastLog.sent_by || "Unknown";
      if (!overduesBySA.has(sa)) overduesBySA.set(sa, []);
      overduesBySA.get(sa)!.push(`${personName} - ${nextTpl.name}`);
    }

    if (overduesBySA.size === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No overdue follow-ups" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build message
    const lines: string[] = ["📋 Daily Follow-Up Digest\n"];
    for (const [sa, items] of overduesBySA) {
      lines.push(`@${sa}: ${items.length} follow-up${items.length > 1 ? "s" : ""} due`);
      for (const item of items) {
        lines.push(`  • ${item}`);
      }
      lines.push("");
    }
    const message = lines.join("\n");

    // Post to GroupMe
    if (groupmeBotId) {
      await fetch("https://api.groupme.com/v3/bots/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: groupmeBotId, text: message }),
      });
    }

    return new Response(JSON.stringify({ ok: true, message, overdueCount: Array.from(overduesBySA.values()).flat().length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("daily-followup-digest error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
