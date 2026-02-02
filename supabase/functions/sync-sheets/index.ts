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

  let serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
  }

  // Clean up the JSON string - handle common formatting issues
  serviceAccountJson = serviceAccountJson.trim();
  
  // If wrapped in extra quotes, remove them
  if ((serviceAccountJson.startsWith('"') && serviceAccountJson.endsWith('"')) ||
      (serviceAccountJson.startsWith("'") && serviceAccountJson.endsWith("'"))) {
    serviceAccountJson = serviceAccountJson.slice(1, -1);
  }
  
  // Unescape if double-escaped
  if (serviceAccountJson.includes('\\"')) {
    serviceAccountJson = serviceAccountJson.replace(/\\"/g, '"');
  }
  
  // Handle literal newlines/tabs/carriage returns that break JSON parsing
  // These can appear when the JSON is copy-pasted with formatting
  // We need to escape them properly ONLY outside of already-escaped sequences
  // Replace literal control characters with escaped versions
  serviceAccountJson = serviceAccountJson
    .replace(/\r\n/g, '\\n')  // Windows line endings
    .replace(/\r/g, '\\n')     // Old Mac line endings
    .replace(/\n/g, '\\n')     // Unix line endings
    .replace(/\t/g, '\\t');    // Tabs
  
  // Now unescape \\n back to \n for the JSON parser (it expects \n in strings)
  // But we need the actual \n character sequence, not a literal newline
  // Actually, the JSON should have \\n which represents \n in the parsed string
  // So we should NOT do the second replacement - the JSON parser handles \n

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (parseError) {
    console.error('Failed to parse service account JSON. First 100 chars:', serviceAccountJson.substring(0, 100));
    console.error('Parse error:', parseError);
    throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_JSON format: ${parseError instanceof Error ? parseError.message : 'Parse error'}`);
  }
  
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Service account JSON missing required fields (client_email or private_key)');
  }
  
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

async function readFromSheet(
  spreadsheetId: string,
  sheetName: string,
  accessToken: string
): Promise<string[][]> {
  const range = `${sheetName}!A:ZZ`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to read from sheet "${sheetName}": ${error}`);
  }

  const data = await response.json();
  return data.values || [];
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

    let result: Record<string, unknown> = { success: false, message: '', recordsSynced: 0 };

    switch (action) {
      case 'read_sheets_preview': {
        // Read preview data from all tabs for import
        const tabs = ['Form Responses 1', 'IG Leads Master'];
        const preview: Record<string, { headers: string[]; rowCount: number; sampleRows: string[][] }> = {};
        
        for (const tab of tabs) {
          try {
            const rows = await readFromSheet(spreadsheetId, tab, accessToken);
            if (rows.length > 0) {
              preview[tab] = {
                headers: rows[0] || [],
                rowCount: rows.length - 1, // Exclude header
                sampleRows: rows.slice(1, 4), // First 3 data rows
              };
            }
          } catch (err) {
            console.log(`Tab "${tab}" not found or empty`);
          }
        }
        
        result = { success: true, preview };
        break;
      }

      case 'import_historical_data': {
        // Full import from Google Sheets
        const importResults = {
          shiftRecaps: { imported: 0, skipped: 0, errors: 0 },
          igLeads: { imported: 0, skipped: 0, errors: 0 },
          introsBooked: { imported: 0, skipped: 0, errors: 0 },
          introsRun: { imported: 0, skipped: 0, errors: 0 },
          errorLog: [] as string[],
        };

        // Helper to parse dates
        const parseDate = (dateStr: string): string => {
          if (!dateStr) return new Date().toISOString().split('T')[0];
          let parsed = dateStr;
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const [m, d, y] = parts;
              parsed = `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }
          return parsed;
        };

        // Helper to parse time from datetime string
        const parseTime = (timeStr: string): string => {
          if (!timeStr) return '09:00';
          // Handle formats like "1/15/2026 9:00 AM" or "9:00 AM" or "09:00"
          const timePart = timeStr.includes(' ') ? timeStr.split(' ').slice(-2).join(' ') : timeStr;
          // Try to extract time
          const match = timePart.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (match) {
            let hours = parseInt(match[1]);
            const minutes = match[2];
            const period = match[3];
            if (period?.toUpperCase() === 'PM' && hours !== 12) hours += 12;
            if (period?.toUpperCase() === 'AM' && hours === 12) hours = 0;
            return `${hours.toString().padStart(2, '0')}:${minutes}`;
          }
          return '09:00';
        };

        // Import Shift Recaps from "Form Responses 1"
        try {
          const recapRows = await readFromSheet(spreadsheetId, 'Form Responses 1', accessToken);
          if (recapRows.length > 1) {
            const headers = recapRows[0];
            
            // Build column index map
            const colIndex: Record<string, number> = {};
            headers.forEach((h, i) => {
              colIndex[h] = i;
            });
            
            // Column mapping for Form Responses (basic fields)
            const colMap: Record<string, number> = {};
            headers.forEach((h, i) => {
              const normalized = h.toLowerCase().trim();
              if (normalized.includes('timestamp') || normalized.includes('submitted')) colMap['timestamp'] = i;
              if (normalized === 'your name' || (normalized.includes('your') && normalized.includes('name'))) colMap['staff_name'] = i;
              if (normalized.includes('today') && normalized.includes('date')) colMap['shift_date'] = i;
              if (normalized.includes('shift type')) colMap['shift_type'] = i;
              if (normalized.includes('calls')) colMap['calls_made'] = i;
              if (normalized.includes('texts')) colMap['texts_sent'] = i;
              if (normalized === 'emails sent' || (normalized.includes('emails') && normalized.includes('sent'))) colMap['emails_sent'] = i;
              if (normalized === 'dms sent' || normalized.includes('dms sent')) colMap['dms_sent'] = i;
              if (normalized.includes('otbeat') && normalized.includes('sale')) colMap['otbeat_sales'] = i;
              if (normalized.includes('otbeat') && normalized.includes('buyer')) colMap['otbeat_buyer_names'] = i;
              if (normalized === 'upgrades') colMap['upgrades'] = i;
              if (normalized.includes('upgrade') && normalized.includes('detail')) colMap['upgrade_details'] = i;
              if (normalized === 'downgrades') colMap['downgrades'] = i;
              if (normalized.includes('downgrade') && normalized.includes('detail')) colMap['downgrade_details'] = i;
              if (normalized === 'cancellations') colMap['cancellations'] = i;
              if (normalized.includes('cancellation') && normalized.includes('detail')) colMap['cancellation_details'] = i;
              if (normalized === 'freezes') colMap['freezes'] = i;
              if (normalized.includes('freeze') && normalized.includes('detail')) colMap['freeze_details'] = i;
              if (normalized.includes('milestone')) colMap['milestones_celebrated'] = i;
              if (normalized.includes('equipment')) colMap['equipment_issues'] = i;
            });

            // Find Intro Booked columns (Intro #1 through #5)
            const introBookedCols: { memberName: number; classDate: number; coach: number; saWorking: number; fitnessGoal: number; leadSource: number; }[] = [];
            for (let n = 1; n <= 5; n++) {
              const prefix = `Intro #${n} - `;
              const memberNameIdx = colIndex[`${prefix}Member Name`];
              const classDateIdx = colIndex[`${prefix}Class Date`] ?? colIndex[`${prefix}Class Date and Time`];
              const coachIdx = colIndex[`${prefix}Coach for This Class`];
              const saWorkingIdx = colIndex[`${prefix}SA Working That Shift`];
              const fitnessGoalIdx = colIndex[`${prefix}Member's Fitness Goal`];
              const leadSourceIdx = colIndex[`${prefix}Lead Source`];
              if (memberNameIdx !== undefined) {
                introBookedCols.push({
                  memberName: memberNameIdx,
                  classDate: classDateIdx,
                  coach: coachIdx,
                  saWorking: saWorkingIdx,
                  fitnessGoal: fitnessGoalIdx,
                  leadSource: leadSourceIdx,
                });
              }
            }

            // Find Intro Run columns (Intro Run #1 through #5)
            const introRunCols: { memberName: number; classTime: number; bookingSource: number; processChecklist: number; leadMeasures: number; result: number; notes: number; }[] = [];
            for (let n = 1; n <= 5; n++) {
              const prefix = `Intro Run #${n} - `;
              const memberNameIdx = colIndex[`${prefix}Member Name`];
              const classTimeIdx = colIndex[`${prefix}Class Time`];
              const bookingSourceIdx = colIndex[`${prefix}How did they get booked?`];
              const processChecklistIdx = colIndex[`${prefix}Process Checklist`];
              const leadMeasuresIdx = colIndex[`${prefix}Lead Measures`];
              const resultIdx = colIndex[`${prefix}Result`];
              const notesIdx = colIndex[`${prefix}Additional Notes`];
              if (memberNameIdx !== undefined) {
                introRunCols.push({
                  memberName: memberNameIdx,
                  classTime: classTimeIdx,
                  bookingSource: bookingSourceIdx,
                  processChecklist: processChecklistIdx,
                  leadMeasures: leadMeasuresIdx,
                  result: resultIdx,
                  notes: notesIdx,
                });
              }
            }

            console.log(`Found ${introBookedCols.length} intro booked column sets, ${introRunCols.length} intro run column sets`);

            for (let i = 1; i < recapRows.length; i++) {
              const row = recapRows[i];
              try {
                const staffName = row[colMap['staff_name']] || '';
                const shiftDate = row[colMap['shift_date']] || '';
                const timestamp = row[colMap['timestamp']] || '';

                if (!staffName || !shiftDate) {
                  importResults.shiftRecaps.skipped++;
                  continue;
                }

                const parsedShiftDate = parseDate(shiftDate);

                // Check for duplicates
                const { data: existing } = await supabase
                  .from('shift_recaps')
                  .select('id')
                  .eq('staff_name', staffName)
                  .eq('shift_date', parsedShiftDate)
                  .maybeSingle();

                let shiftRecapId: string;
                if (existing) {
                  shiftRecapId = existing.id;
                  importResults.shiftRecaps.skipped++;
                } else {
                  const { data: newRecap, error: recapError } = await supabase.from('shift_recaps').insert({
                    staff_name: staffName,
                    shift_date: parsedShiftDate,
                    shift_type: row[colMap['shift_type']] || 'AM Shift',
                    calls_made: parseInt(row[colMap['calls_made']]) || 0,
                    texts_sent: parseInt(row[colMap['texts_sent']]) || 0,
                    emails_sent: parseInt(row[colMap['emails_sent']]) || 0,
                    dms_sent: parseInt(row[colMap['dms_sent']]) || 0,
                    otbeat_sales: parseInt(row[colMap['otbeat_sales']]) || null,
                    otbeat_buyer_names: row[colMap['otbeat_buyer_names']] || null,
                    upgrades: parseInt(row[colMap['upgrades']]) || null,
                    upgrade_details: row[colMap['upgrade_details']] || null,
                    downgrades: parseInt(row[colMap['downgrades']]) || null,
                    downgrade_details: row[colMap['downgrade_details']] || null,
                    cancellations: parseInt(row[colMap['cancellations']]) || null,
                    cancellation_details: row[colMap['cancellation_details']] || null,
                    freezes: parseInt(row[colMap['freezes']]) || null,
                    freeze_details: row[colMap['freeze_details']] || null,
                    milestones_celebrated: row[colMap['milestones_celebrated']] || null,
                    equipment_issues: row[colMap['equipment_issues']] || null,
                    submitted_at: timestamp || null,
                    synced_to_sheets: true,
                  }).select('id').single();

                  if (recapError || !newRecap) {
                    throw new Error(`Failed to insert shift recap: ${recapError?.message}`);
                  }
                  shiftRecapId = newRecap.id;
                  importResults.shiftRecaps.imported++;
                }

                // Import Intros Booked from this row
                for (const cols of introBookedCols) {
                  const memberName = row[cols.memberName]?.trim();
                  if (!memberName) continue;

                  const classDateRaw = row[cols.classDate] || '';
                  const classDate = parseDate(classDateRaw);
                  const coachName = row[cols.coach] || 'Unknown';
                  const saWorking = row[cols.saWorking] || staffName;
                  const fitnessGoal = row[cols.fitnessGoal] || null;
                  const leadSource = row[cols.leadSource] || 'Unknown';

                  // Check for duplicates
                  const { data: existingIntro } = await supabase
                    .from('intros_booked')
                    .select('id')
                    .eq('member_name', memberName)
                    .eq('class_date', classDate)
                    .maybeSingle();

                  if (existingIntro) {
                    importResults.introsBooked.skipped++;
                    continue;
                  }

                  try {
                    await supabase.from('intros_booked').insert({
                      member_name: memberName,
                      class_date: classDate,
                      coach_name: coachName,
                      sa_working_shift: saWorking,
                      fitness_goal: fitnessGoal,
                      lead_source: leadSource,
                      shift_recap_id: shiftRecapId,
                    });
                    importResults.introsBooked.imported++;
                  } catch (err) {
                    importResults.introsBooked.errors++;
                    importResults.errorLog.push(`Intro Booked Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }

                // Import Intros Run from this row
                for (const cols of introRunCols) {
                  const memberName = row[cols.memberName]?.trim();
                  if (!memberName) continue;

                  const classTime = parseTime(row[cols.classTime] || '');
                  const bookingSource = row[cols.bookingSource] || null;
                  const processChecklistRaw = row[cols.processChecklist] || '';
                  const leadMeasuresRaw = row[cols.leadMeasures] || '';
                  const result = row[cols.result] || 'Follow-up needed (no sale yet)';
                  const notes = row[cols.notes] || null;

                  // Parse checklist/measures (comma or semicolon separated)
                  const processChecklist = processChecklistRaw ? processChecklistRaw.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : [];
                  const leadMeasures = leadMeasuresRaw ? leadMeasuresRaw.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : [];

                  // Check for duplicates
                  const { data: existingRun } = await supabase
                    .from('intros_run')
                    .select('id')
                    .eq('member_name', memberName)
                    .eq('class_time', classTime)
                    .eq('shift_recap_id', shiftRecapId)
                    .maybeSingle();

                  if (existingRun) {
                    importResults.introsRun.skipped++;
                    continue;
                  }

                  // Calculate commission based on result
                  let commissionAmount = 0;
                  const resultLower = result.toLowerCase();
                  if (resultLower.includes('premier') && resultLower.includes('otbeat')) commissionAmount = 15;
                  else if (resultLower.includes('premier')) commissionAmount = 7.5;
                  else if (resultLower.includes('elite') && resultLower.includes('otbeat')) commissionAmount = 12;
                  else if (resultLower.includes('elite')) commissionAmount = 6;
                  else if (resultLower.includes('basic') && resultLower.includes('otbeat')) commissionAmount = 9;
                  else if (resultLower.includes('basic')) commissionAmount = 3;

                  // Determine if self-gen based on booking source
                  const isSelfGen = bookingSource?.toLowerCase().includes('instagram') || 
                                   bookingSource?.toLowerCase().includes('self') ||
                                   bookingSource?.toLowerCase().includes('online intro offer');

                  try {
                    await supabase.from('intros_run').insert({
                      member_name: memberName,
                      class_time: classTime,
                      booking_source: bookingSource,
                      process_checklist: processChecklist,
                      lead_measures: leadMeasures,
                      result: result,
                      notes: notes,
                      sa_name: staffName,
                      shift_recap_id: shiftRecapId,
                      is_self_gen: isSelfGen,
                      commission_amount: isSelfGen ? commissionAmount : 0,
                    });
                    importResults.introsRun.imported++;
                  } catch (err) {
                    importResults.introsRun.errors++;
                    importResults.errorLog.push(`Intro Run Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }
              } catch (err) {
                importResults.shiftRecaps.errors++;
                importResults.errorLog.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
              }
            }
          }
        } catch (err) {
          console.log('Form Responses 1 not found or error:', err);
        }

        // Import IG Leads from "IG Leads Master"
        try {
          const leadRows = await readFromSheet(spreadsheetId, 'IG Leads Master', accessToken);
          if (leadRows.length > 1) {
            const headers = leadRows[0];
            
            // Column mapping for IG Leads
            const colMap: Record<string, number> = {};
            headers.forEach((h, i) => {
              const normalized = h.toLowerCase().trim();
              if (normalized.includes('timestamp') || normalized.includes('created')) colMap['created_at'] = i;
              if (normalized.includes('sa') || (normalized.includes('name') && !normalized.includes('first') && !normalized.includes('last') && !normalized.includes('member'))) colMap['sa_name'] = i;
              if (normalized.includes('date') && normalized.includes('added')) colMap['date_added'] = i;
              if (normalized.includes('instagram') || normalized.includes('handle') || normalized.includes('ig')) colMap['instagram_handle'] = i;
              if (normalized.includes('first') && normalized.includes('name')) colMap['first_name'] = i;
              if (normalized.includes('last') && normalized.includes('name')) colMap['last_name'] = i;
              if (normalized.includes('phone')) colMap['phone_number'] = i;
              if (normalized.includes('email')) colMap['email'] = i;
              if (normalized.includes('interest')) colMap['interest_level'] = i;
              if (normalized.includes('note')) colMap['notes'] = i;
              if (normalized.includes('status')) colMap['status'] = i;
            });

            for (let i = 1; i < leadRows.length; i++) {
              const row = leadRows[i];
              try {
                const instagramHandle = row[colMap['instagram_handle']] || '';
                const firstName = row[colMap['first_name']] || '';

                if (!instagramHandle && !firstName) {
                  importResults.igLeads.skipped++;
                  continue;
                }

                // Check for duplicates by instagram handle
                if (instagramHandle) {
                  const { data: existing } = await supabase
                    .from('ig_leads')
                    .select('id')
                    .eq('instagram_handle', instagramHandle.replace('@', ''))
                    .maybeSingle();

                  if (existing) {
                    importResults.igLeads.skipped++;
                    continue;
                  }
                }

                const parsedDate = parseDate(row[colMap['date_added']] || '');

                await supabase.from('ig_leads').insert({
                  sa_name: row[colMap['sa_name']] || 'Unknown',
                  date_added: parsedDate,
                  instagram_handle: (instagramHandle || 'unknown').replace('@', ''),
                  first_name: firstName || 'Unknown',
                  last_name: row[colMap['last_name']] || null,
                  phone_number: row[colMap['phone_number']] || null,
                  email: row[colMap['email']] || null,
                  interest_level: row[colMap['interest_level']] || 'Interested - Forgot to answer, reach out later',
                  notes: row[colMap['notes']] || null,
                  status: (row[colMap['status']] || 'not_booked').toLowerCase().replace(' ', '_'),
                  synced_to_sheets: true,
                });

                importResults.igLeads.imported++;
              } catch (err) {
                importResults.igLeads.errors++;
                importResults.errorLog.push(`IG Lead Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
              }
            }
          }
        } catch (err) {
          console.log('IG Leads Master not found or error:', err);
        }

        // Log the import
        await supabase.from('sheets_sync_log').insert({
          sync_type: 'historical_import',
          records_synced: importResults.shiftRecaps.imported + importResults.igLeads.imported + importResults.introsBooked.imported + importResults.introsRun.imported,
          status: 'success',
        });

        result = { success: true, importResults };
        break;
      }
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
