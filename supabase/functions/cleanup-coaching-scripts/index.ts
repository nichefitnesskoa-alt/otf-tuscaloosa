import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Compute "today" in America/Chicago as YYYY-MM-DD
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Chicago',
      year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const todayCentral = fmt.format(new Date()); // en-CA gives YYYY-MM-DD

    const { data: stale, error: selErr } = await supabase
      .from('coaching_scripts')
      .select('id, file_url')
      .lt('script_date', todayCentral);

    if (selErr) throw selErr;

    let deleted = 0;
    for (const row of stale ?? []) {
      const parts = (row.file_url as string).split('/coaching-scripts/');
      if (parts[1]) {
        await supabase.storage.from('coaching-scripts').remove([decodeURIComponent(parts[1])]);
      }
      const { error: delErr } = await supabase.from('coaching_scripts').delete().eq('id', row.id);
      if (!delErr) deleted++;
    }

    return new Response(JSON.stringify({ today_central: todayCentral, deleted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
