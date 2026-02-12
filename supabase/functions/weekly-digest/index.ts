import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const groupmeBotId = Deno.env.get('GROUPME_BOT_ID');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate last week date range (Mon-Sun)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - dayOfWeek - 6);
    lastMonday.setHours(0, 0, 0, 0);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    lastSunday.setHours(23, 59, 59, 999);

    const startStr = lastMonday.toISOString().split('T')[0];
    const endStr = lastSunday.toISOString().split('T')[0];

    // Fetch last week's data
    const [bookingsRes, runsRes, salesRes, leadsRes] = await Promise.all([
      supabase.from('intros_booked').select('*').gte('class_date', startStr).lte('class_date', endStr).is('deleted_at', null),
      supabase.from('intros_run').select('*').gte('run_date', startStr).lte('run_date', endStr),
      supabase.from('sales_outside_intro').select('*').gte('date_closed', startStr).lte('date_closed', endStr),
      supabase.from('leads').select('*').gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59`),
    ]);

    const bookings = bookingsRes.data || [];
    const runs = runsRes.data || [];
    const sales = salesRes.data || [];
    const leads = leadsRes.data || [];

    // Calc metrics
    const totalBooked = bookings.length;
    const totalRuns = runs.filter(r => r.result !== 'No-show').length;
    const noShows = runs.filter(r => r.result === 'No-show').length;
    
    const membershipKeywords = ['premier', 'elite', 'basic'];
    const introSales = runs.filter(r => membershipKeywords.some(k => r.result.toLowerCase().includes(k)));
    const outsideSales = sales.length;
    const totalSales = introSales.length + outsideSales;

    const closeRate = totalRuns > 0 ? Math.round((introSales.length / totalRuns) * 100) : 0;

    // Top performers by sales
    const saCounts = new Map<string, number>();
    for (const r of introSales) {
      const sa = r.intro_owner || r.sa_name || 'Unknown';
      saCounts.set(sa, (saCounts.get(sa) || 0) + 1);
    }
    for (const s of sales) {
      const sa = s.intro_owner || 'Unknown';
      saCounts.set(sa, (saCounts.get(sa) || 0) + 1);
    }
    const topPerformers = [...saCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => `${name} (${count})`);

    // This week's booked intros
    const thisMonday = new Date(now);
    thisMonday.setDate(now.getDate() - dayOfWeek + 1);
    const thisSunday = new Date(thisMonday);
    thisSunday.setDate(thisMonday.getDate() + 6);
    const thisStart = thisMonday.toISOString().split('T')[0];
    const thisEnd = thisSunday.toISOString().split('T')[0];

    const { data: thisWeekBookings } = await supabase
      .from('intros_booked')
      .select('id')
      .gte('class_date', thisStart)
      .lte('class_date', thisEnd)
      .is('deleted_at', null);

    const reportJson = {
      week_start: startStr,
      week_end: endStr,
      total_booked: totalBooked,
      total_runs: totalRuns,
      no_shows: noShows,
      total_sales: totalSales,
      close_rate: closeRate,
      new_leads: leads.length,
      top_performers: topPerformers,
      this_week_booked: thisWeekBookings?.length || 0,
    };

    // Save digest
    await supabase.from('weekly_digests').insert({
      week_start: startStr,
      report_json: reportJson,
    });

    // Format GroupMe message
    const lines = [
      `📊 WEEKLY DIGEST (${startStr} → ${endStr})`,
      '',
      `📅 Intros Booked: ${totalBooked}`,
      `🏃 Intros Run: ${totalRuns} (${noShows} no-shows)`,
      `💰 Total Sales: ${totalSales} (${closeRate}% close rate)`,
      `👥 New Leads: ${leads.length}`,
      '',
    ];

    if (topPerformers.length > 0) {
      lines.push('🏆 Top Performers:');
      topPerformers.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
      lines.push('');
    }

    lines.push(`📋 This Week: ${thisWeekBookings?.length || 0} intros scheduled`);

    const text = lines.join('\n');

    // Post to GroupMe
    if (groupmeBotId) {
      const gmRes = await fetch('https://api.groupme.com/v3/bots/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bot_id: groupmeBotId, text }),
      });
      if (!gmRes.ok) {
        console.error('GroupMe post failed:', await gmRes.text());
      }
    }

    return new Response(JSON.stringify({ success: true, report: reportJson }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Weekly digest error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
