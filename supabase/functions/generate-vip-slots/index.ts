/**
 * generate-vip-slots — Generates VIP session slots from templates.
 * Looks 8 weeks ahead from current Monday. Skips dates where a session already exists.
 * Triggered weekly via pg_cron or manually.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch active templates
    const { data: templates, error: tErr } = await sb
      .from("vip_slot_templates")
      .select("*")
      .eq("is_active", true);

    if (tErr) throw tErr;
    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active templates", created: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Compute today and 8-week window
    const now = new Date();
    // Start from today
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 56); // 8 weeks

    // 3. For each template, find matching dates in the window
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monthNames = [
      "jan","feb","mar","apr","may","jun",
      "jul","aug","sep","oct","nov","dec",
    ];

    const toInsert: any[] = [];
    const datesToCheck: string[] = [];

    // Build list of all date+time combos we might need
    const combos: { date: string; time: string; template: any }[] = [];
    for (const t of templates) {
      const d = new Date(startDate);
      while (d < endDate) {
        if (d.getDay() === t.day_of_week) {
          const dateStr = d.toISOString().split("T")[0];
          combos.push({ date: dateStr, time: t.slot_time, template: t });
          if (!datesToCheck.includes(dateStr)) datesToCheck.push(dateStr);
        }
        d.setDate(d.getDate() + 1);
      }
    }

    // 4. Fetch existing sessions in the date range to avoid duplicates
    const { data: existing } = await sb
      .from("vip_sessions")
      .select("session_date, session_time")
      .gte("session_date", startDate.toISOString().split("T")[0])
      .lte("session_date", endDate.toISOString().split("T")[0]);

    const existingSet = new Set(
      (existing || []).map(
        (e: any) => `${e.session_date}|${e.session_time}`
      )
    );

    // 5. Build insert list
    for (const c of combos) {
      // session_time from DB may be HH:MM:SS, template slot_time is HH:MM:SS
      const key = `${c.date}|${c.time}`;
      if (existingSet.has(key)) continue;

      const dd = new Date(c.date + "T00:00:00");
      const month = monthNames[dd.getMonth()];
      const day = dd.getDate();
      const [h, m] = c.time.split(":");
      const hour = parseInt(h);
      const min = m || "00";
      const ampm = hour >= 12 ? "pm" : "am";
      const h12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const slug = `vip-${month}${day}-${h12}${min !== "00" ? min : ""}${ampm}`;

      toInsert.push({
        vip_class_name: `VIP ${dayNames[dd.getDay()]} ${month.charAt(0).toUpperCase() + month.slice(1)} ${day}`,
        session_date: c.date,
        session_time: c.time,
        status: "open",
        is_on_availability_page: true,
        shareable_slug: slug,
        created_by: "system",
      });
    }

    // 6. Batch insert
    let created = 0;
    if (toInsert.length > 0) {
      // Insert in batches of 50 to avoid payload limits
      for (let i = 0; i < toInsert.length; i += 50) {
        const batch = toInsert.slice(i, i + 50);
        const { error: insErr } = await sb.from("vip_sessions").insert(batch);
        if (insErr) {
          console.error("Insert error:", insErr);
        } else {
          created += batch.length;
        }
      }
    }

    return new Response(
      JSON.stringify({ message: "VIP slots generated", created, checked: combos.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("generate-vip-slots error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
