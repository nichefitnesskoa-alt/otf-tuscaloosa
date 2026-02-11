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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get completed questionnaires
    const { data: questionnaires, error: qError } = await supabase
      .from("intro_questionnaires")
      .select("id, client_first_name, client_last_name")
      .eq("status", "completed");

    if (qError) throw qError;
    if (!questionnaires || questionnaires.length === 0) {
      return new Response(
        JSON.stringify({ deleted: 0, message: "No completed questionnaires" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get intros run with their created_at (only non-no-show results)
    const { data: introsRun, error: iError } = await supabase
      .from("intros_run")
      .select("member_name, created_at, result")
      .neq("result", "No-show");

    if (iError) throw iError;

    // Build map of member name -> earliest run created_at
    const runDateByName = new Map<string, string>();
    introsRun?.forEach((r) => {
      const key = r.member_name?.toLowerCase().trim();
      if (!key) return;
      const existing = runDateByName.get(key);
      if (!existing || r.created_at < existing) {
        runDateByName.set(key, r.created_at);
      }
    });

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const idsToDelete: string[] = [];

    for (const q of questionnaires) {
      const fullName = `${q.client_first_name || ""} ${q.client_last_name || ""}`.trim().toLowerCase();
      const runDate = runDateByName.get(fullName);
      if (runDate && runDate < threeDaysAgo) {
        idsToDelete.push(q.id);
      }
    }

    if (idsToDelete.length === 0) {
      return new Response(
        JSON.stringify({ deleted: 0, message: "No questionnaires eligible for cleanup" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: delError } = await supabase
      .from("intro_questionnaires")
      .delete()
      .in("id", idsToDelete);

    if (delError) throw delError;

    return new Response(
      JSON.stringify({ deleted: idsToDelete.length, message: `Cleaned up ${idsToDelete.length} questionnaires` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
