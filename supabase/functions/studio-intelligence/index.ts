import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Check if already generated today
    const { data: existing } = await sb.from("studio_intelligence").select("id").eq("report_date", yesterdayStr).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ message: "Already generated", id: existing.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch yesterday's data
    const [{ data: runs }, { data: bookings }, { data: followups }] = await Promise.all([
      sb.from("intros_run").select("id, result, result_canon, commission_amount, intro_owner, ran_by, lead_source, primary_objection").eq("run_date", yesterdayStr),
      sb.from("intros_booked").select("id, lead_source").eq("class_date", yesterdayStr).is("deleted_at", null),
      sb.from("follow_up_queue").select("id, status, person_name").eq("status", "pending").lte("scheduled_date", yesterdayStr),
    ]);

    const totalRuns = (runs || []).length;
    const sales = (runs || []).filter(r => r.result_canon === "PURCHASED");
    const closeRate = totalRuns > 0 ? Math.round((sales.length / totalRuns) * 100) : 0;

    // Top SA
    const saMap = new Map<string, { ran: number; sold: number }>();
    (runs || []).forEach(r => {
      const sa = r.intro_owner || r.ran_by || "Unknown";
      const e = saMap.get(sa) || { ran: 0, sold: 0 };
      e.ran++;
      if (r.result_canon === "PURCHASED") e.sold++;
      saMap.set(sa, e);
    });
    let topSA = "N/A"; let topSARate = 0;
    saMap.forEach((v, k) => { const rate = v.ran > 0 ? v.sold / v.ran * 100 : 0; if (rate > topSARate || (rate === topSARate && v.ran > 0)) { topSA = k; topSARate = rate; } });

    // Lead source performance
    const srcMap = new Map<string, { ran: number; sold: number }>();
    (runs || []).forEach(r => {
      const src = r.lead_source || "Unknown";
      const e = srcMap.get(src) || { ran: 0, sold: 0 };
      e.ran++;
      if (r.result_canon === "PURCHASED") e.sold++;
      srcMap.set(src, e);
    });
    let bestSource = "N/A"; let bestSourceRate = 0;
    srcMap.forEach((v, k) => { const rate = v.ran > 0 ? v.sold / v.ran * 100 : 0; if (rate > bestSourceRate) { bestSource = k; bestSourceRate = rate; } });

    // Top objection
    const objMap = new Map<string, number>();
    (runs || []).filter(r => r.primary_objection).forEach(r => {
      objMap.set(r.primary_objection!, (objMap.get(r.primary_objection!) || 0) + 1);
    });
    let topObjection = "N/A"; let topObjCount = 0;
    objMap.forEach((v, k) => { if (v > topObjCount) { topObjection = k; topObjCount = v; } });

    const pendingFollowups = (followups || []).length;

    const dataPrompt = `Generate a Studio Intelligence report for ${yesterdayStr}.

YESTERDAY:
- Intros ran: ${totalRuns}
- Sales: ${sales.length}
- Close rate: ${closeRate}%
- Best lead source: ${bestSource} (${Math.round(bestSourceRate)}% close rate)
- Top SA: ${topSA} (${Math.round(topSARate)}% close rate)
- Most common objection: ${topObjection} (${topObjCount} occurrences)
- Pending follow-ups: ${pendingFollowups}

Write a brief, actionable Studio Intelligence report with 3 sections:
1. YESTERDAY - 3-4 bullet points summarizing performance
2. THIS PAY PERIOD - 1-2 insights about trends
3. TODAY'S FOCUS - One specific, actionable recommendation

Keep it under 200 words. Be specific and data-driven. No fluff.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: dataPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      const t = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, t);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI generation failed");
    }

    const aiResult = await aiResponse.json();
    const reportText = aiResult.choices?.[0]?.message?.content || "";

    const contentJson = {
      report_date: yesterdayStr,
      intros_ran: totalRuns,
      sales: sales.length,
      close_rate: closeRate,
      best_source: bestSource,
      best_source_rate: Math.round(bestSourceRate),
      top_sa: topSA,
      top_sa_rate: Math.round(topSARate),
      top_objection: topObjection,
      top_objection_count: topObjCount,
      pending_followups: pendingFollowups,
      report_text: reportText,
    };

    const { data: inserted, error } = await sb.from("studio_intelligence").insert({
      report_date: yesterdayStr,
      content_json: contentJson,
    }).select("id").single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, id: inserted.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("studio-intelligence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
