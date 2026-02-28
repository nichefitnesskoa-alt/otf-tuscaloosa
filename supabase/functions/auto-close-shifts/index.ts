import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Chicago",
    }); // YYYY-MM-DD in CST

    console.log(`Auto-close shifts for ${today}`);

    // 1. Close unsubmitted shift recaps for today
    const { data: openRecaps } = await supabase
      .from("shift_recaps")
      .select("id, staff_name, shift_date, calls_made, texts_sent, dms_sent, emails_sent")
      .eq("shift_date", today)
      .is("submitted_at", null);

    const closedRecaps: string[] = [];

    if (openRecaps && openRecaps.length > 0) {
      for (const recap of openRecaps) {
        await supabase
          .from("shift_recaps")
          .update({ submitted_at: new Date().toISOString() })
          .eq("id", recap.id);
        closedRecaps.push(recap.staff_name);
      }
    }

    // 2. Find staff with activity today but no recap
    const todayStart = `${today}T00:00:00`;
    const todayEnd = `${today}T23:59:59`;

    const [{ data: todayBookings }, { data: todayRuns }, { data: todayActions }] =
      await Promise.all([
        supabase
          .from("intros_booked")
          .select("sa_working_shift, booked_by")
          .gte("created_at", todayStart)
          .lte("created_at", todayEnd),
        supabase
          .from("intros_run")
          .select("sa_name, intro_owner")
          .eq("run_date", today),
        supabase
          .from("script_actions")
          .select("completed_by")
          .gte("completed_at", todayStart)
          .lte("completed_at", todayEnd),
      ]);

    // Collect all active staff names
    const activeStaff = new Set<string>();
    (todayBookings || []).forEach((b: any) => {
      if (b.sa_working_shift) activeStaff.add(b.sa_working_shift);
      if (b.booked_by && b.booked_by !== "Self booked" && b.booked_by !== "Self-booked")
        activeStaff.add(b.booked_by);
    });
    (todayRuns || []).forEach((r: any) => {
      if (r.intro_owner) activeStaff.add(r.intro_owner);
      if (r.sa_name) activeStaff.add(r.sa_name);
    });
    (todayActions || []).forEach((a: any) => {
      if (a.completed_by) activeStaff.add(a.completed_by);
    });

    // Get existing recaps for today
    const { data: existingRecaps } = await supabase
      .from("shift_recaps")
      .select("staff_name")
      .eq("shift_date", today);

    const existingNames = new Set(
      (existingRecaps || []).map((r: any) => r.staff_name)
    );

    const autoCreated: string[] = [];

    for (const staffName of activeStaff) {
      if (existingNames.has(staffName)) continue;

      // Count activity
      const booked = (todayBookings || []).filter(
        (b: any) => b.sa_working_shift === staffName || b.booked_by === staffName
      ).length;
      const ran = (todayRuns || []).filter(
        (r: any) => r.intro_owner === staffName || r.sa_name === staffName
      ).length;

      if (booked === 0 && ran === 0) continue;

      await supabase.from("shift_recaps").insert({
        staff_name: staffName,
        shift_date: today,
        shift_type: "Auto-closed",
        calls_made: 0,
        texts_sent: 0,
        dms_sent: 0,
        emails_sent: 0,
        other_info: `Auto-submitted at 7:00 PM. Activity: ${booked} booked, ${ran} ran.`,
        submitted_at: new Date().toISOString(),
      });

      autoCreated.push(staffName);
    }

    // 3. Post to GroupMe
    const groupmeBotId = Deno.env.get("GROUPME_BOT_ID");
    if (groupmeBotId && (closedRecaps.length > 0 || autoCreated.length > 0)) {
      const lines: string[] = ["🔒 Auto-Close Shift Recaps"];
      if (closedRecaps.length > 0) {
        lines.push(`Submitted for: ${closedRecaps.join(", ")}`);
      }
      if (autoCreated.length > 0) {
        lines.push(`Auto-created for: ${autoCreated.join(", ")}`);
      }

      await fetch("https://api.groupme.com/v3/bots/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_id: groupmeBotId, text: lines.join("\n") }),
      });
    }

    const summary = {
      date: today,
      closedRecaps,
      autoCreated,
      totalProcessed: closedRecaps.length + autoCreated.length,
    };

    console.log("Auto-close result:", summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Auto-close error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
