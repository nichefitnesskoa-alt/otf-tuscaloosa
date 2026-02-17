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

  // Questionnaire records are now preserved forever for goal reassessment and member history.
  // This function no longer deletes any records.
  return new Response(
    JSON.stringify({ deleted: 0, message: "Questionnaire cleanup disabled — records are preserved permanently." }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});