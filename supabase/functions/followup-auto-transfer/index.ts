/**
 * Daily auto-transfer edge function.
 * Runs daily at 6:00 AM Central Time.
 * 
 * 1. At 14 days: warns coaches their records will transfer in 7 days
 * 2. At 21 days: transfers coach-owned records to SA queue
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const cutoff21 = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000).toISOString();
    const cutoff14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // ─── TRANSFER: 21+ days old, coach-owned, no response ───
    const { data: toTransfer } = await supabase
      .from("follow_up_queue")
      .select("id, person_name, coach_owner")
      .eq("owner_role", "Coach")
      .is("transferred_to_sa_at", null)
      .is("not_interested_at", null)
      .lte("created_at", cutoff21);

    let transferred = 0;
    for (const item of toTransfer || []) {
      await supabase
        .from("follow_up_queue")
        .update({
          owner_role: "SA",
          transferred_to_sa_at: now.toISOString(),
        })
        .eq("id", item.id);

      // Notification for admin (Koa)
      await supabase.from("notifications").insert({
        notification_type: "followup_transfer",
        title: "Follow-up transferred",
        body: `${item.person_name} transferred from Coach ${item.coach_owner || "Unknown"} to SA queue — no response in 21 days`,
        target_user: "Koa",
      });

      transferred++;
    }

    // ─── WARN: 14+ days old, coach-owned ───
    const { data: toWarn } = await supabase
      .from("follow_up_queue")
      .select("coach_owner")
      .eq("owner_role", "Coach")
      .is("transferred_to_sa_at", null)
      .is("not_interested_at", null)
      .lte("created_at", cutoff14)
      .gt("created_at", cutoff21);

    // Group by coach
    const coachCounts: Record<string, number> = {};
    for (const item of toWarn || []) {
      const coach = (item as any).coach_owner || "Unknown";
      coachCounts[coach] = (coachCounts[coach] || 0) + 1;
    }

    for (const [coach, count] of Object.entries(coachCounts)) {
      await supabase.from("notifications").insert({
        notification_type: "followup_warning",
        title: "Follow-up deadline approaching",
        body: `You have ${count} missed guest${count !== 1 ? "s" : ""} with 7 days left before they transfer to the SA team.`,
        target_user: coach,
      });
    }

    return new Response(
      JSON.stringify({ transferred, warned: Object.keys(coachCounts).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
