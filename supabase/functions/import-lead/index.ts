import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate API key
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("LEADS_API_KEY");
  if (!apiKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Invalid API key" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { first_name, last_name, email, phone, source } = body;

    // Validate required fields
    if (!first_name || !last_name || !email || !phone) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: first_name, last_name, email, phone",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Duplicate detection: check by email OR phone
    const { data: existing } = await supabase
      .from("leads")
      .select("id, first_name, last_name")
      .or(`email.eq.${email},phone.eq.${phone}`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Log duplicate activity on existing lead
      const now = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      await supabase.from("lead_activities").insert({
        lead_id: existing.id,
        activity_type: "duplicate_detected",
        performed_by: "System",
        notes: `Duplicate lead received from Orangebook on ${now}. Lead already exists in pipeline.`,
      });

      return new Response(
        JSON.stringify({
          status: "duplicate",
          message: `Lead already exists: ${existing.first_name} ${existing.last_name}`,
          existing_lead_id: existing.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create new lead
    const { data: newLead, error } = await supabase
      .from("leads")
      .insert({
        first_name,
        last_name,
        email,
        phone,
        stage: "new",
        source: source || "Orangebook Web Lead",
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({
        status: "created",
        lead_id: newLead.id,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
