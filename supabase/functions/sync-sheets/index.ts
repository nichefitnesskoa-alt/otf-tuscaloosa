import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GoogleAuth {
  access_token: string;
  expires_at: number;
}

let cachedAuth: GoogleAuth | null = null;

async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedAuth && Date.now() < cachedAuth.expires_at - 60000) {
    return cachedAuth.access_token;
  }

  const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
  }

  const serviceAccount = JSON.parse(serviceAccountJson);
  
  // Create JWT for Google OAuth
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  // Base64url encode
  const encode = (obj: unknown) => {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  // Import the private key
  const pemContent = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Sign the token
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  
  cachedAuth = {
    access_token: tokenData.access_token,
    expires_at: Date.now() + (tokenData.expires_in * 1000),
  };

  return cachedAuth.access_token;
}

async function appendToSheet(
  spreadsheetId: string,
  sheetName: string,
  values: string[][],
  accessToken: string
): Promise<void> {
  const range = `${sheetName}!A:Z`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to append to sheet: ${error}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, spreadsheetId, data } = await req.json();

    if (!spreadsheetId) {
      throw new Error('spreadsheetId is required');
    }

    const accessToken = await getAccessToken();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let result = { success: false, message: '', recordsSynced: 0 };

    switch (action) {
      case 'sync_shift_recap': {
        // Sync a single shift recap
        const recap = data;
        const values = [[
          recap.submitted_at || new Date().toISOString(),
          recap.staff_name,
          recap.shift_date,
          recap.shift_type,
          recap.calls_made?.toString() || '0',
          recap.texts_sent?.toString() || '0',
          recap.emails_sent?.toString() || '0',
          recap.dms_sent?.toString() || '0',
          recap.otbeat_sales?.toString() || '',
          recap.otbeat_buyer_names || '',
          recap.upgrades?.toString() || '',
          recap.upgrade_details || '',
          recap.downgrades?.toString() || '',
          recap.downgrade_details || '',
          recap.cancellations?.toString() || '',
          recap.cancellation_details || '',
          recap.freezes?.toString() || '',
          recap.freeze_details || '',
          recap.milestones_celebrated || '',
          recap.equipment_issues || '',
          recap.other_info || '',
        ]];

        await appendToSheet(spreadsheetId, 'Form Responses 1', values, accessToken);
        
        // Mark as synced
        if (recap.id) {
          await supabase
            .from('shift_recaps')
            .update({ synced_to_sheets: true })
            .eq('id', recap.id);
        }

        result = { success: true, message: 'Shift recap synced', recordsSynced: 1 };
        break;
      }

      case 'sync_ig_lead': {
        // Sync a single IG lead
        const lead = data;
        const values = [[
          lead.created_at || new Date().toISOString(),
          lead.sa_name,
          lead.date_added,
          lead.instagram_handle,
          lead.first_name,
          lead.last_name || '',
          lead.phone_number || '',
          lead.email || '',
          lead.interest_level,
          lead.notes || '',
          lead.status,
        ]];

        await appendToSheet(spreadsheetId, 'IG Leads Master', values, accessToken);
        
        // Mark as synced
        if (lead.id) {
          await supabase
            .from('ig_leads')
            .update({ synced_to_sheets: true })
            .eq('id', lead.id);
        }

        result = { success: true, message: 'IG lead synced', recordsSynced: 1 };
        break;
      }

      case 'sync_all_unsynced': {
        // Sync all unsynced records
        let totalSynced = 0;

        // Get unsynced shift recaps
        const { data: recaps } = await supabase
          .from('shift_recaps')
          .select('*')
          .eq('synced_to_sheets', false);

        if (recaps && recaps.length > 0) {
          const recapValues = recaps.map(recap => [
            recap.submitted_at || new Date().toISOString(),
            recap.staff_name,
            recap.shift_date,
            recap.shift_type,
            recap.calls_made?.toString() || '0',
            recap.texts_sent?.toString() || '0',
            recap.emails_sent?.toString() || '0',
            recap.dms_sent?.toString() || '0',
            recap.otbeat_sales?.toString() || '',
            recap.otbeat_buyer_names || '',
            recap.upgrades?.toString() || '',
            recap.upgrade_details || '',
            recap.downgrades?.toString() || '',
            recap.downgrade_details || '',
            recap.cancellations?.toString() || '',
            recap.cancellation_details || '',
            recap.freezes?.toString() || '',
            recap.freeze_details || '',
            recap.milestones_celebrated || '',
            recap.equipment_issues || '',
            recap.other_info || '',
          ]);

          await appendToSheet(spreadsheetId, 'Form Responses 1', recapValues, accessToken);
          
          await supabase
            .from('shift_recaps')
            .update({ synced_to_sheets: true })
            .in('id', recaps.map(r => r.id));
          
          totalSynced += recaps.length;
        }

        // Get unsynced IG leads
        const { data: leads } = await supabase
          .from('ig_leads')
          .select('*')
          .eq('synced_to_sheets', false);

        if (leads && leads.length > 0) {
          const leadValues = leads.map(lead => [
            lead.created_at || new Date().toISOString(),
            lead.sa_name,
            lead.date_added,
            lead.instagram_handle,
            lead.first_name,
            lead.last_name || '',
            lead.phone_number || '',
            lead.email || '',
            lead.interest_level,
            lead.notes || '',
            lead.status,
          ]);

          await appendToSheet(spreadsheetId, 'IG Leads Master', leadValues, accessToken);
          
          await supabase
            .from('ig_leads')
            .update({ synced_to_sheets: true })
            .in('id', leads.map(l => l.id));
          
          totalSynced += leads.length;
        }

        // Log the sync
        await supabase.from('sheets_sync_log').insert({
          sync_type: 'bulk_sync',
          records_synced: totalSynced,
          status: 'success',
        });

        result = { success: true, message: `Synced ${totalSynced} records`, recordsSynced: totalSynced };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Log the error
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    await supabase.from('sheets_sync_log').insert({
      sync_type: 'error',
      records_synced: 0,
      status: 'failed',
      error_message: errorMessage,
    });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
