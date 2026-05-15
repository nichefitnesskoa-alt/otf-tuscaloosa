/**
 * Cadence reminder — runs Sunday 6pm America/Chicago.
 *
 * For every active coach with the current week's cadence obligation unmet,
 * inserts a notification row. Idempotent: if a notification for this coach +
 * week already exists, a second invocation is a no-op.
 *
 * Push delivery is handled downstream by the existing notifications consumer
 * (same path as fv_scorecard_notify, followup-auto-transfer, etc.).
 *
 * pg_cron schedules in UTC, so this function is invoked at multiple UTC times
 * around 6pm CT (covering CST = 00:00 UTC Mon and CDT = 23:00 UTC Sun) and
 * self-checks that "now" in America/Chicago is Sunday between 17:30 and 18:30.
 * `force=true` query param bypasses the time guard for manual testing.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function nowInChicago(): { day: number; hour: number; minute: number; iso: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find(p => p.type === t)?.value || "";
  const dayMap: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  return {
    day: dayMap[get("weekday")] ?? -1,
    hour: parseInt(get("hour")) || 0,
    minute: parseInt(get("minute")) || 0,
    iso: new Date().toISOString(),
  };
}

// ISO week number (Mon-start, Thu-anchored).
function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Monday 00:00 of the ISO week containing `d` in America/Chicago.
function chicagoWeekStart(d: Date): Date {
  // Convert to a Chicago Y-M-D-dow snapshot, then build a UTC Monday boundary.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value || "";
  const y = parseInt(get("year"));
  const m = parseInt(get("month")) - 1;
  const day = parseInt(get("day"));
  const dayMap: Record<string, number> = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  const dow = dayMap[get("weekday")];
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  // Approximate: build a Date for Monday 00:00 local using a constructed timestamp
  // (correct to within a DST hour, sufficient for week labeling).
  const local = new Date(Date.UTC(y, m, day + offsetToMonday, 5)); // 5 UTC ≈ 00 CT
  return local;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "true";

  const ct = nowInChicago();
  const isWindow = ct.day === 0 && ((ct.hour === 17 && ct.minute >= 30) || (ct.hour === 18 && ct.minute <= 30));
  if (!isWindow && !force) {
    return new Response(JSON.stringify({ skipped: true, reason: "outside Sunday 18:00 CT window", ct }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const isoWeek = getISOWeek(now);
    const cadenceType: "self" | "formal" = isoWeek % 2 === 0 ? "self" : "formal";
    const wantEvalType = cadenceType === "self" ? "self_eval" : "formal_eval";
    const weekStart = chicagoWeekStart(now);
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400_000 - 1);
    const weekKey = weekStart.toISOString().slice(0, 10);

    const body = wantEvalType === "self_eval"
      ? "Self-eval owed this week"
      : "Formal eval owed this week";

    // Active coaches.
    const { data: staff, error: staffErr } = await supabase
      .from("staff")
      .select("name, role, is_active")
      .eq("is_active", true);
    if (staffErr) throw staffErr;
    const coaches = (staff || []).filter((s: any) => {
      const roles = Array.isArray(s.role) ? s.role : [s.role];
      return roles.some((r: string) => (r || "").toLowerCase() === "coach");
    });

    let sent = 0;
    let skippedMet = 0;
    let skippedDuplicate = 0;
    const audit: any[] = [];

    for (const coach of coaches) {
      // Did this coach meet the obligation this week?
      const { data: scs } = await supabase
        .from("fv_scorecards")
        .select("id, submitted_at, eval_type")
        .eq("evaluatee_name", coach.name)
        .eq("eval_type", wantEvalType)
        .gte("submitted_at", weekStart.toISOString())
        .lte("submitted_at", weekEnd.toISOString())
        .limit(1);

      if (scs && scs.length > 0) {
        skippedMet++;
        audit.push({ coach: coach.name, status: "met", obligation: cadenceType });
        continue;
      }

      // Idempotency — already notified for this coach + week?
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("notification_type", "cadence_reminder")
        .eq("target_user", coach.name)
        .contains("meta", { week_start: weekKey })
        .limit(1);

      if (existing && existing.length > 0) {
        skippedDuplicate++;
        audit.push({ coach: coach.name, status: "already_sent", obligation: cadenceType });
        continue;
      }

      const { error: insErr } = await supabase.from("notifications").insert({
        notification_type: "cadence_reminder",
        title: "Cadence reminder",
        body,
        target_user: coach.name,
        meta: {
          week_start: weekKey,
          obligation: cadenceType,
          tap_route: "/scorecards/me",
        },
      });

      if (insErr) {
        audit.push({ coach: coach.name, status: "error", error: insErr.message });
      } else {
        sent++;
        audit.push({ coach: coach.name, status: "sent", obligation: cadenceType });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      week_key: weekKey,
      cadence_type: cadenceType,
      total_coaches: coaches.length,
      sent,
      skipped_met: skippedMet,
      skipped_duplicate: skippedDuplicate,
      audit,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
