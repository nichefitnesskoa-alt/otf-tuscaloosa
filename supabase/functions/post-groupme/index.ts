import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GROUPME_BOT_ID = Deno.env.get('GROUPME_BOT_ID');
    
    if (!GROUPME_BOT_ID) {
      console.error('GROUPME_BOT_ID not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'GroupMe bot not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { text, action } = await req.json();

    // Test connection action
    if (action === 'test') {
      const testMessage = '✅ GroupMe connected successfully';
      const response = await fetch('https://api.groupme.com/v3/bots/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bot_id: GROUPME_BOT_ID,
          text: testMessage,
        }),
      });

      if (response.ok || response.status === 202) {
        return new Response(
          JSON.stringify({ success: true, message: 'Test message sent successfully' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        const errorText = await response.text();
        console.error('GroupMe test failed:', errorText);
        return new Response(
          JSON.stringify({ success: false, error: `GroupMe API error: ${response.status}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Post recap action
    if (!text) {
      return new Response(
        JSON.stringify({ success: false, error: 'No text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Posting to GroupMe:', text.substring(0, 100) + '...');

    const response = await fetch('https://api.groupme.com/v3/bots/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bot_id: GROUPME_BOT_ID,
        text: text,
      }),
    });

    if (response.ok || response.status === 202) {
      console.log('GroupMe post successful');
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      const errorText = await response.text();
      console.error('GroupMe post failed:', response.status, errorText);
      return new Response(
        JSON.stringify({ success: false, error: `GroupMe API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in post-groupme function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
