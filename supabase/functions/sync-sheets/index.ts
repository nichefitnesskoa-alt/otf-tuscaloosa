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

// Pay period anchor: January 26, 2026 (biweekly)
const PAY_PERIOD_ANCHOR = new Date('2026-01-26');

function getPayPeriod(date: Date): { start: Date; end: Date } {
  const anchor = PAY_PERIOD_ANCHOR.getTime();
  const target = date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const periodMs = 14 * dayMs;
  
  const diff = target - anchor;
  const periods = Math.floor(diff / periodMs);
  
  const start = new Date(anchor + (periods * periodMs));
  const end = new Date(start.getTime() + periodMs - dayMs);
  
  return { start, end };
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

async function getAccessToken(): Promise<string> {
  if (cachedAuth && Date.now() < cachedAuth.expires_at - 60000) {
    return cachedAuth.access_token;
  }

  let serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');
  }

  serviceAccountJson = serviceAccountJson.trim();
  if ((serviceAccountJson.startsWith('"') && serviceAccountJson.endsWith('"')) ||
      (serviceAccountJson.startsWith("'") && serviceAccountJson.endsWith("'"))) {
    serviceAccountJson = serviceAccountJson.slice(1, -1);
  }
  if (serviceAccountJson.includes('\\"')) {
    serviceAccountJson = serviceAccountJson.replace(/\\"/g, '"');
  }
  serviceAccountJson = serviceAccountJson
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (parseError) {
    console.error('Failed to parse service account JSON:', parseError);
    throw new Error(`Invalid GOOGLE_SERVICE_ACCOUNT_JSON format`);
  }
  
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Service account JSON missing required fields');
  }
  
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) => {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const unsignedToken = `${encode(header)}.${encode(payload)}`;

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
    headers: { 'Authorization': `Bearer ${accessToken}` },
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

async function updateSheetRow(
  spreadsheetId: string,
  sheetName: string,
  rowNumber: number,
  values: string[],
  accessToken: string
): Promise<void> {
  const range = `${sheetName}!A${rowNumber}:Z${rowNumber}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [values] }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update row ${rowNumber}: ${error}`);
  }
}

async function findRowByStableId(
  spreadsheetId: string,
  sheetName: string,
  stableIdColumn: number,
  stableId: string,
  accessToken: string
): Promise<number | null> {
  const rows = await readFromSheet(spreadsheetId, sheetName, accessToken);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][stableIdColumn] === stableId) {
      return i + 1; // 1-indexed row number
    }
  }
  return null;
}

// Column definitions for each sheet tab
const SHEET_COLUMNS = {
  app_shifts: [
    'shift_id', 'staff_name', 'shift_date', 'shift_type', 
    'calls_made', 'texts_sent', 'emails_sent', 'dms_sent',
    'created_at', 'submitted_at', 'last_edited_at', 'last_edited_by', 'edit_reason'
  ],
  app_intro_bookings: [
    'booking_id', 'member_name', 'intro_date', 'intro_time', 'lead_source', 'notes',
    'member_key', 'booking_status', 'status_reason', 'status_changed_at', 'status_changed_by',
    'originating_booking_id', 'closed_at', 'closed_sale_id',
    'booked_by', 'intro_owner',  // New: booking credit vs commission owner
    'created_at', 'last_edited_at', 'last_edited_by', 'edit_reason'
  ],
  app_intro_runs: [
    'run_id', 'booking_id', 'member_name', 'run_date', 'run_time', 'lead_source', 
    'intro_owner', 'outcome', 'goal_quality', 'pricing_engagement',
    'fvc_completed', 'rfg_presented', 'choice_architecture',
    'halfway_encouragement', 'premobility_encouragement', 'coaching_summary_presence',
    'notes', 'created_at', 'last_edited_at', 'last_edited_by', 'edit_reason'
  ],
  app_sales: [
    'sale_id', 'run_id', 'sale_type', 'member_name', 'lead_source', 
    'membership_type', 'commission_amount', 'intro_owner', 'related_booking_id',
    'date_closed', 'pay_period_start', 'pay_period_end',
    'created_at', 'last_edited_at', 'last_edited_by', 'edit_reason'
  ]
};

// Commission rates by membership type
const COMMISSION_RATES: Record<string, number> = {
  'premier + otbeat': 15.00,
  'premier w/o otbeat': 7.50,
  'elite + otbeat': 12.00,
  'elite w/o otbeat': 6.00,
  'basic + otbeat': 9.00,
  'basic w/o otbeat': 3.00,
};

function calculateCommission(membershipType: string): number {
  const normalized = membershipType.toLowerCase().trim();
  // Exact match first
  if (COMMISSION_RATES[normalized] !== undefined) {
    return COMMISSION_RATES[normalized];
  }
  // Partial matching for flexibility
  if (normalized.includes('premier') && normalized.includes('otbeat')) return 15.00;
  if (normalized.includes('premier')) return 7.50;
  if (normalized.includes('elite') && normalized.includes('otbeat')) return 12.00;
  if (normalized.includes('elite')) return 6.00;
  if (normalized.includes('basic') && normalized.includes('otbeat')) return 9.00;
  if (normalized.includes('basic')) return 3.00;
  return 0;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, spreadsheetId, data, stableId, editedBy, editReason } = await req.json();

    if (!spreadsheetId) {
      throw new Error('spreadsheetId is required');
    }

    const accessToken = await getAccessToken();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let result: Record<string, unknown> = { success: false };

    switch (action) {
      case 'import_from_sheets':
      case 'resync_from_sheets':
      case 'force_reimport': {
        // Shared import logic with different behaviors:
        // - import_from_sheets: Insert new records only (skip existing)
        // - resync_from_sheets: Upsert - update existing, insert new
        // - force_reimport: Clear all tables first, then import fresh
        
        const isResync = action === 'resync_from_sheets';
        const isForceReimport = action === 'force_reimport';
        
        const importResults = {
          shifts: { imported: 0, skipped: 0, updated: 0, errors: 0 },
          bookings: { imported: 0, skipped: 0, updated: 0, errors: 0 },
          runs: { imported: 0, skipped: 0, updated: 0, errors: 0 },
          sales: { imported: 0, skipped: 0, updated: 0, errors: 0 },
          errorLog: [] as string[],
        };

        // Helper to parse dates
        const parseDate = (dateStr: string): string | null => {
          if (!dateStr) return null;
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              const [m, d, y] = parts;
              return `${y.length === 2 ? '20' + y : y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
          }
          // Check if already in ISO format
          if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            return dateStr.split('T')[0];
          }
          return null;
        };

        const parseTime = (timeStr: string): string => {
          if (!timeStr) return '09:00';
          const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
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

        // Force reimport: Clear all tables first
        if (isForceReimport) {
          try {
            // Delete in correct order for foreign key constraints
            await supabase.from('sales_outside_intro').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('intros_run').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('intros_booked').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('shift_recaps').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            console.log('Cleared all tables for force reimport');
          } catch (err) {
            console.error('Error clearing tables:', err);
            importResults.errorLog.push(`Error clearing tables: ${err}`);
          }
        }

        // Import app_shifts
        try {
          const rows = await readFromSheet(spreadsheetId, 'app_shifts', accessToken);
          if (rows.length > 1) {
            const headers = rows[0];
            const colMap: Record<string, number> = {};
            headers.forEach((h, i) => { colMap[h.toLowerCase().trim()] = i; });

            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const shiftId = row[colMap['shift_id']];
              if (!shiftId) { importResults.shifts.skipped++; continue; }

              const shiftData = {
                shift_id: shiftId,
                staff_name: row[colMap['staff_name']] || 'Unknown',
                shift_date: parseDate(row[colMap['shift_date']] || '') || new Date().toISOString().split('T')[0],
                shift_type: row[colMap['shift_type']] || 'AM Shift',
                calls_made: parseInt(row[colMap['calls_made']]) || 0,
                texts_sent: parseInt(row[colMap['texts_sent']]) || 0,
                emails_sent: parseInt(row[colMap['emails_sent']]) || 0,
                dms_sent: parseInt(row[colMap['dms_sent']]) || 0,
                synced_to_sheets: true,
                sheets_row_number: i + 1,
              };

              const { data: existing } = await supabase
                .from('shift_recaps')
                .select('id')
                .eq('shift_id', shiftId)
                .maybeSingle();

              if (existing) {
                if (isResync || isForceReimport) {
                  const { error } = await supabase.from('shift_recaps').update(shiftData).eq('id', existing.id);
                  if (error) {
                    importResults.shifts.errors++;
                    importResults.errorLog.push(`Shift row ${i} update: ${error.message}`);
                  } else {
                    importResults.shifts.updated++;
                  }
                } else {
                  importResults.shifts.skipped++;
                }
              } else {
                const { error } = await supabase.from('shift_recaps').insert(shiftData);
                if (error) {
                  importResults.shifts.errors++;
                  importResults.errorLog.push(`Shift row ${i}: ${error.message}`);
                } else {
                  importResults.shifts.imported++;
                }
              }
            }
          }
        } catch (err) {
          console.log('app_shifts import error:', err);
          importResults.errorLog.push(`app_shifts error: ${err}`);
        }

        // Import app_intro_bookings
        try {
          const rows = await readFromSheet(spreadsheetId, 'app_intro_bookings', accessToken);
          if (rows.length > 1) {
            const headers = rows[0];
            const colMap: Record<string, number> = {};
            headers.forEach((h, i) => { colMap[h.toLowerCase().trim()] = i; });

            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const bookingId = row[colMap['booking_id']];
              if (!bookingId) { importResults.bookings.skipped++; continue; }

              const classDate = parseDate(row[colMap['intro_date']] || row[colMap['class_date']] || '');
              const bookingData = {
                booking_id: bookingId,
                member_name: row[colMap['member_name']] || 'Unknown',
                class_date: classDate || new Date().toISOString().split('T')[0],
                intro_time: parseTime(row[colMap['intro_time']] || ''),
                coach_name: row[colMap['coach_name']] || 'TBD',
                sa_working_shift: row[colMap['booked_by']] || row[colMap['sa_working_shift']] || 'TBD',
                lead_source: row[colMap['lead_source']] || 'Source Not Found',
                fitness_goal: row[colMap['notes']] || row[colMap['fitness_goal']] || null,
                sheets_row_number: i + 1,
              };

              const { data: existing } = await supabase
                .from('intros_booked')
                .select('id')
                .eq('booking_id', bookingId)
                .maybeSingle();

              if (existing) {
                if (isResync || isForceReimport) {
                  const { error } = await supabase.from('intros_booked').update(bookingData).eq('id', existing.id);
                  if (error) {
                    importResults.bookings.errors++;
                    importResults.errorLog.push(`Booking row ${i} update: ${error.message}`);
                  } else {
                    importResults.bookings.updated++;
                  }
                } else {
                  importResults.bookings.skipped++;
                }
              } else {
                const { error } = await supabase.from('intros_booked').insert(bookingData);
                if (error) {
                  importResults.bookings.errors++;
                  importResults.errorLog.push(`Booking row ${i}: ${error.message}`);
                } else {
                  importResults.bookings.imported++;
                }
              }
            }
          }
        } catch (err) {
          console.log('app_intro_bookings import error:', err);
          importResults.errorLog.push(`app_intro_bookings error: ${err}`);
        }

        // Import app_intro_runs
        try {
          const rows = await readFromSheet(spreadsheetId, 'app_intro_runs', accessToken);
          if (rows.length > 1) {
            const headers = rows[0];
            const colMap: Record<string, number> = {};
            headers.forEach((h, i) => { colMap[h.toLowerCase().trim()] = i; });

            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const runId = row[colMap['run_id']];
              if (!runId) { importResults.runs.skipped++; continue; }

              // Calculate commission from outcome/membership
              const outcome = row[colMap['outcome']] || row[colMap['result']] || '';
              let commission = 0;
              const outcomeLower = outcome.toLowerCase();
              if (outcomeLower.includes('premier') && outcomeLower.includes('otbeat')) commission = 15;
              else if (outcomeLower.includes('premier')) commission = 7.5;
              else if (outcomeLower.includes('elite') && outcomeLower.includes('otbeat')) commission = 12;
              else if (outcomeLower.includes('elite')) commission = 6;
              else if (outcomeLower.includes('basic') && outcomeLower.includes('otbeat')) commission = 9;
              else if (outcomeLower.includes('basic')) commission = 3;

              // Parse buy_date for sales filtering
              const buyDate = parseDate(row[colMap['buy_date']] || row[colMap['date_closed']] || '');
              const runDate = parseDate(row[colMap['run_date']] || '');

              const runData = {
                run_id: runId,
                linked_intro_booked_id: null,
                member_name: row[colMap['member_name']] || 'Unknown',
                run_date: runDate,
                class_time: parseTime(row[colMap['run_time']] || row[colMap['class_time']] || ''),
                lead_source: row[colMap['lead_source']] || null,
                intro_owner: row[colMap['intro_owner']] || null,
                intro_owner_locked: !!row[colMap['intro_owner']],
                result: outcome || 'Follow-up needed (no sale yet)',
                goal_quality: row[colMap['goal_quality']] || null,
                pricing_engagement: row[colMap['pricing_engagement']] || null,
                fvc_completed: row[colMap['fvc_completed']]?.toLowerCase() === 'true',
                rfg_presented: row[colMap['rfg_presented']]?.toLowerCase() === 'true',
                choice_architecture: row[colMap['choice_architecture']]?.toLowerCase() === 'true',
                halfway_encouragement: row[colMap['halfway_encouragement']]?.toLowerCase() === 'true',
                premobility_encouragement: row[colMap['premobility_encouragement']]?.toLowerCase() === 'true',
                coaching_summary_presence: row[colMap['coaching_summary_presence']]?.toLowerCase() === 'true',
                notes: row[colMap['notes']] || null,
                commission_amount: commission,
                buy_date: buyDate,
                sheets_row_number: i + 1,
              };

              const { data: existing } = await supabase
                .from('intros_run')
                .select('id')
                .eq('run_id', runId)
                .maybeSingle();

              if (existing) {
                if (isResync || isForceReimport) {
                  const { error } = await supabase.from('intros_run').update(runData).eq('id', existing.id);
                  if (error) {
                    importResults.runs.errors++;
                    importResults.errorLog.push(`Run row ${i} update: ${error.message}`);
                  } else {
                    importResults.runs.updated++;
                  }
                } else {
                  importResults.runs.skipped++;
                }
              } else {
                const { error } = await supabase.from('intros_run').insert(runData);
                if (error) {
                  importResults.runs.errors++;
                  importResults.errorLog.push(`Run row ${i}: ${error.message}`);
                } else {
                  importResults.runs.imported++;
                }
              }
            }
          }
        } catch (err) {
          console.log('app_intro_runs import error:', err);
          importResults.errorLog.push(`app_intro_runs error: ${err}`);
        }

        // Import app_sales
        // Track commission stats for summary
        let salesWithCommission = 0;
        let salesCommissionComputed = 0;
        let earliestDateClosed: string | null = null;
        let latestDateClosed: string | null = null;

        try {
          const rows = await readFromSheet(spreadsheetId, 'app_sales', accessToken);
          if (rows.length > 1) {
            const headers = rows[0];
            const colMap: Record<string, number> = {};
            headers.forEach((h, i) => { colMap[h.toLowerCase().trim()] = i; });

            for (let i = 1; i < rows.length; i++) {
              const row = rows[i];
              const saleId = row[colMap['sale_id']];
              if (!saleId) { importResults.sales.skipped++; continue; }

              // Parse date_closed (required for pay period calculation)
              const dateClosed = parseDate(row[colMap['date_closed']] || row[colMap['buy_date']] || row[colMap['created_at']] || '');
              
              // Track date range
              if (dateClosed) {
                if (!earliestDateClosed || dateClosed < earliestDateClosed) earliestDateClosed = dateClosed;
                if (!latestDateClosed || dateClosed > latestDateClosed) latestDateClosed = dateClosed;
              }

              // Get membership type for commission calculation
              const membershipType = row[colMap['membership_type']] || '';
              
              // Parse commission_amount - calculate from membership_type if missing/blank
              let rawCommission = row[colMap['commission_amount']];
              let commissionAmount = parseFloat(rawCommission);
              let wasComputed = false;
              
              if (isNaN(commissionAmount) || !rawCommission || rawCommission.trim() === '') {
                commissionAmount = calculateCommission(membershipType);
                wasComputed = true;
                if (commissionAmount > 0) salesCommissionComputed++;
              } else {
                salesWithCommission++;
              }

              // Calculate pay period from date_closed
              let payPeriodStart: string | null = null;
              let payPeriodEnd: string | null = null;
              
              if (dateClosed) {
                const dateObj = new Date(dateClosed);
                const payPeriod = getPayPeriod(dateObj);
                payPeriodStart = formatDate(payPeriod.start);
                payPeriodEnd = formatDate(payPeriod.end);
              }

              const saleData = {
                sale_id: saleId,
                sale_type: row[colMap['sale_type']] || 'outside_intro',
                member_name: row[colMap['member_name']] || 'Unknown',
                lead_source: row[colMap['lead_source']] || 'Source Not Found',
                membership_type: membershipType || 'Unknown',
                commission_amount: commissionAmount,
                intro_owner: row[colMap['intro_owner']] || null,
                date_closed: dateClosed,
                pay_period_start: payPeriodStart,
                pay_period_end: payPeriodEnd,
                sheets_row_number: i + 1,
              };

              const { data: existing } = await supabase
                .from('sales_outside_intro')
                .select('id')
                .eq('sale_id', saleId)
                .maybeSingle();

              if (existing) {
                if (isResync || isForceReimport) {
                  const { error } = await supabase.from('sales_outside_intro').update(saleData).eq('id', existing.id);
                  if (error) {
                    importResults.sales.errors++;
                    importResults.errorLog.push(`Sale row ${i} update: ${error.message}`);
                  } else {
                    importResults.sales.updated++;
                  }
                } else {
                  importResults.sales.skipped++;
                }
              } else {
                const { error } = await supabase.from('sales_outside_intro').insert(saleData);
                if (error) {
                  importResults.sales.errors++;
                  importResults.errorLog.push(`Sale row ${i}: ${error.message}`);
                } else {
                  importResults.sales.imported++;
                }
              }
            }
          }
        } catch (err) {
          console.log('app_sales import error:', err);
          importResults.errorLog.push(`app_sales error: ${err}`);
        }

        // Add commission summary to results
        const commissionSummary = {
          totalSales: importResults.sales.imported + importResults.sales.updated,
          withCommissionPresent: salesWithCommission,
          commissionComputed: salesCommissionComputed,
          earliestDateClosed,
          latestDateClosed,
        };

        // Log import
        const totalImported = importResults.shifts.imported + importResults.bookings.imported + 
                             importResults.runs.imported + importResults.sales.imported;
        const totalUpdated = importResults.shifts.updated + importResults.bookings.updated + 
                            importResults.runs.updated + importResults.sales.updated;
        
        await supabase.from('sheets_sync_log').insert({
          sync_type: action,
          status: 'success',
          records_synced: totalImported + totalUpdated,
        });

        result = { success: true, ...importResults, commissionSummary };
        break;
      }

      case 'sync_shift': {
        // Sync a single shift to Google Sheets (append or update)
        const shift = data;
        const shiftId = shift.shift_id || `shift_${shift.id}`;
        
        const rowData = [
          shiftId,
          shift.staff_name || '',
          shift.shift_date || '',
          shift.shift_type || '',
          String(shift.calls_made || 0),
          String(shift.texts_sent || 0),
          String(shift.emails_sent || 0),
          String(shift.dms_sent || 0),
          shift.created_at || new Date().toISOString(),
          shift.submitted_at || '',
          editedBy ? new Date().toISOString() : '',
          editedBy || '',
          editReason || '',
        ];

        // Check if row exists
        const existingRow = await findRowByStableId(spreadsheetId, 'app_shifts', 0, shiftId, accessToken);
        
        if (existingRow) {
          await updateSheetRow(spreadsheetId, 'app_shifts', existingRow, rowData, accessToken);
        } else {
          await appendToSheet(spreadsheetId, 'app_shifts', [rowData], accessToken);
        }

        // Update database with stable ID and row number
        await supabase.from('shift_recaps')
          .update({ 
            shift_id: shiftId,
            synced_to_sheets: true,
            last_edited_at: editedBy ? new Date().toISOString() : undefined,
            last_edited_by: editedBy || undefined,
            edit_reason: editReason || undefined,
          })
          .eq('id', shift.id);

        result = { success: true, shiftId };
        break;
      }

      case 'sync_booking': {
        const booking = data;
        const bookingId = booking.booking_id || `booking_${booking.id}`;
        
        // Normalize member name to key
        const normalizeName = (name: string): string => {
          return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        };
        const memberKey = booking.member_key || normalizeName(booking.member_name || '');
        
        const rowData = [
          bookingId,
          booking.member_name || '',
          booking.class_date || '',
          booking.intro_time || '',
          booking.lead_source || '',
          booking.fitness_goal || booking.notes || '',
          memberKey,
          booking.booking_status || 'ACTIVE',
          booking.status_reason || '',
          booking.status_changed_at || '',
          booking.status_changed_by || '',
          booking.originating_booking_id || '',
          booking.closed_at || '',
          booking.closed_sale_id || '',
          booking.booked_by || '',  // Who booked it (booking credit)
          booking.intro_owner || '', // Who runs first intro (commission owner)
          booking.created_at || new Date().toISOString(),
          editedBy ? new Date().toISOString() : '',
          editedBy || '',
          editReason || '',
        ];

        const existingRow = await findRowByStableId(spreadsheetId, 'app_intro_bookings', 0, bookingId, accessToken);
        
        if (existingRow) {
          await updateSheetRow(spreadsheetId, 'app_intro_bookings', existingRow, rowData, accessToken);
        } else {
          await appendToSheet(spreadsheetId, 'app_intro_bookings', [rowData], accessToken);
        }

        await supabase.from('intros_booked')
          .update({ 
            booking_id: bookingId,
            last_edited_at: editedBy ? new Date().toISOString() : undefined,
            last_edited_by: editedBy || undefined,
            edit_reason: editReason || undefined,
          })
          .eq('id', booking.id);

        result = { success: true, bookingId };
        break;
      }

      case 'sync_run': {
        const run = data;
        const runId = run.run_id || `run_${run.id}`;
        
        const rowData = [
          runId,
          run.linked_booking_id || '',
          run.member_name || '',
          run.run_date || run.buy_date || '',
          run.class_time || '',
          run.lead_source || '',
          run.intro_owner || run.sa_name || '',
          run.result || '',
          run.goal_quality || '',
          run.pricing_engagement || '',
          String(run.fvc_completed || false),
          String(run.rfg_presented || false),
          String(run.choice_architecture || false),
          String(run.halfway_encouragement || false),
          String(run.premobility_encouragement || false),
          String(run.coaching_summary_presence || false),
          run.notes || '',
          run.created_at || new Date().toISOString(),
          editedBy ? new Date().toISOString() : '',
          editedBy || '',
          editReason || '',
        ];

        const existingRow = await findRowByStableId(spreadsheetId, 'app_intro_runs', 0, runId, accessToken);
        
        if (existingRow) {
          await updateSheetRow(spreadsheetId, 'app_intro_runs', existingRow, rowData, accessToken);
        } else {
          await appendToSheet(spreadsheetId, 'app_intro_runs', [rowData], accessToken);
        }

        await supabase.from('intros_run')
          .update({ 
            run_id: runId,
            last_edited_at: editedBy ? new Date().toISOString() : undefined,
            last_edited_by: editedBy || undefined,
            edit_reason: editReason || undefined,
          })
          .eq('id', run.id);

        result = { success: true, runId };
        break;
      }

      case 'sync_sale': {
        const sale = data;
        const saleId = sale.sale_id || `sale_${sale.id}`;
        
        // Calculate pay period
        const saleDate = new Date(sale.created_at || new Date());
        const payPeriod = getPayPeriod(saleDate);
        
        const rowData = [
          saleId,
          sale.run_id || '',
          sale.sale_type || 'outside_intro',
          sale.member_name || '',
          sale.lead_source || '',
          sale.membership_type || '',
          String(sale.commission_amount || 0),
          sale.intro_owner || '',
          formatDate(payPeriod.start),
          formatDate(payPeriod.end),
          sale.created_at || new Date().toISOString(),
          editedBy ? new Date().toISOString() : '',
          editedBy || '',
          editReason || '',
        ];

        const existingRow = await findRowByStableId(spreadsheetId, 'app_sales', 0, saleId, accessToken);
        
        if (existingRow) {
          await updateSheetRow(spreadsheetId, 'app_sales', existingRow, rowData, accessToken);
        } else {
          await appendToSheet(spreadsheetId, 'app_sales', [rowData], accessToken);
        }

        await supabase.from('sales_outside_intro')
          .update({ 
            sale_id: saleId,
            pay_period_start: formatDate(payPeriod.start),
            pay_period_end: formatDate(payPeriod.end),
            last_edited_at: editedBy ? new Date().toISOString() : undefined,
            last_edited_by: editedBy || undefined,
            edit_reason: editReason || undefined,
          })
          .eq('id', sale.id);

        result = { success: true, saleId };
        break;
      }

      case 'read_intro_bookings': {
        // Read intro bookings directly from Google Sheets - filter to ACTIVE only
        const rows = await readFromSheet(spreadsheetId, 'app_intro_bookings', accessToken);
        const bookings: Array<{
          booking_id: string;
          member_name: string;
          member_key: string;
          intro_date: string;
          intro_time: string;
          lead_source: string;
          notes: string;
          booking_status: string;
          originating_booking_id: string;
          booked_by: string;
          intro_owner: string;
          row_number: number;
        }> = [];

        if (rows.length > 1) {
          const headers = rows[0].map(h => h.toLowerCase().trim());
          const colMap: Record<string, number> = {};
          headers.forEach((h, i) => { colMap[h] = i; });

          // Normalize member name to key for matching
          const normalizeName = (name: string): string => {
            return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
          };

          const seenBookingIds = new Set<string>();
          const seenMemberKeys = new Set<string>();

          for (let i = 1; i < rows.length && bookings.length < 500; i++) {
            const row = rows[i];
            const bookingId = row[colMap['booking_id']] || '';
            const memberName = row[colMap['member_name']] || 'Unknown';
            const memberKey = row[colMap['member_key']] || normalizeName(memberName);
            const status = (row[colMap['booking_status']] || 'ACTIVE').toUpperCase();
            
            // Only show ACTIVE bookings
            if (status !== 'ACTIVE') continue;
            
            // De-duplicate by booking_id first, then by member_key
            if (bookingId && seenBookingIds.has(bookingId)) continue;
            if (bookingId) seenBookingIds.add(bookingId);
            
            if (!bookingId && memberKey && seenMemberKeys.has(memberKey)) continue;
            if (memberKey) seenMemberKeys.add(memberKey);

            bookings.push({
              booking_id: bookingId || `temp_${i}`,
              member_name: memberName,
              member_key: memberKey,
              intro_date: row[colMap['intro_date']] || row[colMap['class_date']] || '',
              intro_time: row[colMap['intro_time']] || '',
              lead_source: row[colMap['lead_source']] || 'Unknown',
              notes: row[colMap['notes']] || '',
              booking_status: status,
              originating_booking_id: row[colMap['originating_booking_id']] || '',
              booked_by: row[colMap['booked_by']] || '',
              intro_owner: row[colMap['intro_owner']] || '',
              row_number: i + 1,
            });
          }

          // Sort alphabetically by member name for easy searching
          bookings.sort((a, b) => a.member_name.localeCompare(b.member_name));
        }

        result = { success: true, bookings, total: bookings.length };
        break;
      }

      case 'update_booking_status': {
        // Update a booking's status in Google Sheets (DEAD or CLOSED)
        const { bookingId, memberKey, newStatus, statusReason, changedBy, closedSaleId } = data;
        
        const rows = await readFromSheet(spreadsheetId, 'app_intro_bookings', accessToken);
        if (rows.length < 2) {
          throw new Error('No bookings found in sheet');
        }

        const headers = rows[0].map(h => h.toLowerCase().trim());
        const colMap: Record<string, number> = {};
        headers.forEach((h, i) => { colMap[h] = i; });

        // Normalize name for matching
        const normalizeName = (name: string): string => {
          return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        };

        // Find the row to update
        let targetRowIndex = -1;
        let originatingChainId = '';
        
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const rowBookingId = row[colMap['booking_id']] || '';
          const rowMemberKey = row[colMap['member_key']] || normalizeName(row[colMap['member_name']] || '');
          
          if (bookingId && rowBookingId === bookingId) {
            targetRowIndex = i;
            originatingChainId = row[colMap['originating_booking_id']] || rowBookingId;
            break;
          }
          if (!bookingId && memberKey && rowMemberKey === memberKey) {
            targetRowIndex = i;
            originatingChainId = row[colMap['originating_booking_id']] || row[colMap['booking_id']] || '';
            break;
          }
        }

        if (targetRowIndex === -1) {
          throw new Error('Booking not found');
        }

        const now = new Date().toISOString();
        const rowsToUpdate: { rowNumber: number; values: string[] }[] = [];

        // If closing, also close the chain
        if (newStatus === 'CLOSED' && originatingChainId) {
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const rowBookingId = row[colMap['booking_id']] || '';
            const rowOriginating = row[colMap['originating_booking_id']] || '';
            const rowStatus = (row[colMap['booking_status']] || 'ACTIVE').toUpperCase();
            
            // Skip non-ACTIVE rows
            if (rowStatus !== 'ACTIVE') continue;
            
            // Match if: this is the originating booking OR this references the originating booking
            const isInChain = (rowBookingId === originatingChainId) || (rowOriginating === originatingChainId);
            
            if (isInChain) {
              const updatedRow = [...row];
              // Ensure row has enough columns
              while (updatedRow.length < 18) updatedRow.push('');
              
              const statusColIdx = colMap['booking_status'] ?? 7;
              const reasonColIdx = colMap['status_reason'] ?? 8;
              const changedAtColIdx = colMap['status_changed_at'] ?? 9;
              const changedByColIdx = colMap['status_changed_by'] ?? 10;
              const closedAtColIdx = colMap['closed_at'] ?? 12;
              const closedSaleColIdx = colMap['closed_sale_id'] ?? 13;
              
              updatedRow[statusColIdx] = newStatus;
              updatedRow[reasonColIdx] = statusReason || 'Purchased membership';
              updatedRow[changedAtColIdx] = now;
              updatedRow[changedByColIdx] = changedBy || '';
              updatedRow[closedAtColIdx] = now.split('T')[0];
              updatedRow[closedSaleColIdx] = closedSaleId || '';
              
              rowsToUpdate.push({ rowNumber: i + 1, values: updatedRow });
            }
          }
        } else {
          // Just update the single row (DEAD status)
          const row = rows[targetRowIndex];
          const updatedRow = [...row];
          while (updatedRow.length < 18) updatedRow.push('');
          
          const statusColIdx = colMap['booking_status'] ?? 7;
          const reasonColIdx = colMap['status_reason'] ?? 8;
          const changedAtColIdx = colMap['status_changed_at'] ?? 9;
          const changedByColIdx = colMap['status_changed_by'] ?? 10;
          
          updatedRow[statusColIdx] = newStatus;
          updatedRow[reasonColIdx] = statusReason || '';
          updatedRow[changedAtColIdx] = now;
          updatedRow[changedByColIdx] = changedBy || '';
          
          rowsToUpdate.push({ rowNumber: targetRowIndex + 1, values: updatedRow });
        }

        // Perform updates
        for (const update of rowsToUpdate) {
          await updateSheetRow(spreadsheetId, 'app_intro_bookings', update.rowNumber, update.values, accessToken);
        }

        result = { success: true, updatedRows: rowsToUpdate.length };
        break;
      }

      case 'find_active_bookings_by_member': {
        // Find all ACTIVE bookings for a member (for auto-close matching)
        const { memberKey } = data;
        
        const rows = await readFromSheet(spreadsheetId, 'app_intro_bookings', accessToken);
        const matches: Array<{
          booking_id: string;
          member_name: string;
          member_key: string;
          intro_date: string;
          intro_time: string;
          lead_source: string;
          notes: string;
          originating_booking_id: string;
          row_number: number;
        }> = [];

        if (rows.length > 1) {
          const headers = rows[0].map(h => h.toLowerCase().trim());
          const colMap: Record<string, number> = {};
          headers.forEach((h, i) => { colMap[h] = i; });

          const normalizeName = (name: string): string => {
            return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
          };

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const status = (row[colMap['booking_status']] || 'ACTIVE').toUpperCase();
            if (status !== 'ACTIVE') continue;
            
            const rowMemberKey = row[colMap['member_key']] || normalizeName(row[colMap['member_name']] || '');
            
            if (rowMemberKey === memberKey) {
              matches.push({
                booking_id: row[colMap['booking_id']] || '',
                member_name: row[colMap['member_name']] || 'Unknown',
                member_key: rowMemberKey,
                intro_date: row[colMap['intro_date']] || '',
                intro_time: row[colMap['intro_time']] || '',
                lead_source: row[colMap['lead_source']] || '',
                notes: row[colMap['notes']] || '',
                originating_booking_id: row[colMap['originating_booking_id']] || '',
                row_number: i + 1,
              });
            }
          }
        }

        result = { success: true, matches, count: matches.length };
        break;
      }

      case 'get_pay_periods': {
        // Get list of pay periods for payroll export
        const periods: { start: string; end: string; label: string }[] = [];
        const now = new Date();
        
        // Get last 12 pay periods
        for (let i = 0; i < 12; i++) {
          const targetDate = new Date(now.getTime() - (i * 14 * 24 * 60 * 60 * 1000));
          const period = getPayPeriod(targetDate);
          const label = `${formatDate(period.start)} to ${formatDate(period.end)}`;
          
          // Avoid duplicates
          if (!periods.find(p => p.label === label)) {
            periods.push({
              start: formatDate(period.start),
              end: formatDate(period.end),
              label,
            });
          }
        }

        result = { success: true, periods };
        break;
      }

      case 'export_payroll': {
        // Export commission data for a pay period
        const { payPeriodStart, payPeriodEnd } = data;

        // Get all sales in the pay period
        const { data: sales } = await supabase
          .from('sales_outside_intro')
          .select('*')
          .gte('pay_period_start', payPeriodStart)
          .lte('pay_period_end', payPeriodEnd);

        // Get intros_run with commission in the period
        const { data: runs } = await supabase
          .from('intros_run')
          .select('*')
          .gte('run_date', payPeriodStart)
          .lte('run_date', payPeriodEnd)
          .gt('commission_amount', 0);

        // Aggregate by intro_owner
        const payrollByOwner: Record<string, { name: string; total: number; sales: number }> = {};

        for (const sale of (sales || [])) {
          const owner = sale.intro_owner || 'Unassigned';
          if (!payrollByOwner[owner]) {
            payrollByOwner[owner] = { name: owner, total: 0, sales: 0 };
          }
          payrollByOwner[owner].total += sale.commission_amount || 0;
          payrollByOwner[owner].sales++;
        }

        for (const run of (runs || [])) {
          const owner = run.intro_owner || run.sa_name || 'Unassigned';
          if (!payrollByOwner[owner]) {
            payrollByOwner[owner] = { name: owner, total: 0, sales: 0 };
          }
          payrollByOwner[owner].total += run.commission_amount || 0;
          payrollByOwner[owner].sales++;
        }

        result = {
          success: true,
          payPeriod: { start: payPeriodStart, end: payPeriodEnd },
          payroll: Object.values(payrollByOwner),
          totalCommission: Object.values(payrollByOwner).reduce((sum, p) => sum + p.total, 0),
        };
        break;
      }

      case 'test_write': {
        // Test write to verify sheet connection
        const testRowData = [
          `test_${Date.now()}`,
          'TEST',
          new Date().toISOString().split('T')[0],
          'Test Row',
          '0', '0', '0', '0',
          new Date().toISOString(),
          '', '', '', ''
        ];

        try {
          await appendToSheet(spreadsheetId, 'app_shifts', [testRowData], accessToken);
          
          // Log the test
          await supabase.from('sheets_sync_log').insert({
            sync_type: 'test_write',
            status: 'success',
            records_synced: 1,
          });

          result = { success: true, message: 'Test write successful' };
        } catch (writeError) {
          result = { success: false, error: `Test write failed: ${writeError}` };
        }
        break;
      }

      case 'normalize_outcomes': {
        // Normalize all outcome values in the database
        const OUTCOME_MAP: Record<string, string> = {
          'no show': 'No-show',
          'noshow': 'No-show',
          'no-show': 'No-show',
          'follow-up needed': 'Follow-up needed',
          'follow up needed': 'Follow-up needed',
          'followup needed': 'Follow-up needed',
          'booked 2nd intro': 'Booked 2nd intro',
          'booked second intro': 'Booked 2nd intro',
          'closed': 'Closed',
        };

        const { data: runs } = await supabase.from('intros_run').select('id, result');
        let normalized = 0;

        for (const run of (runs || [])) {
          if (!run.result) continue;
          const lower = run.result.toLowerCase().trim();
          if (OUTCOME_MAP[lower] && OUTCOME_MAP[lower] !== run.result) {
            await supabase.from('intros_run').update({ result: OUTCOME_MAP[lower] }).eq('id', run.id);
            normalized++;
          }
        }

        result = { success: true, normalized };
        break;
      }

      case 'auto_link_runs': {
        // Auto-link runs to bookings by member name and date
        const { data: unlinkedRuns } = await supabase
          .from('intros_run')
          .select('*')
          .is('linked_intro_booked_id', null);

        let linked = 0;
        let failed = 0;

        for (const run of (unlinkedRuns || [])) {
          // Find matching booking
          const { data: bookings } = await supabase
            .from('intros_booked')
            .select('id, class_date, intro_time')
            .eq('member_name', run.member_name);

          if (bookings && bookings.length > 0) {
            // Try exact date match first
            let match: typeof bookings[0] | undefined = bookings.find(b => b.class_date === run.run_date);
            
            // If no exact match, find closest
            if (!match && run.run_date) {
              const runDate = new Date(run.run_date).getTime();
              match = bookings.reduce<typeof bookings[0] | undefined>((closest, b) => {
                const bDate = new Date(b.class_date).getTime();
                const closestDate = closest ? new Date(closest.class_date).getTime() : Infinity;
                return Math.abs(bDate - runDate) < Math.abs(closestDate - runDate) ? b : closest;
              }, undefined);
            }

            if (!match) match = bookings[0];

            const { error } = await supabase
              .from('intros_run')
              .update({ linked_intro_booked_id: match.id })
              .eq('id', run.id);

            if (!error) {
              linked++;
            } else {
              failed++;
            }
          } else {
            failed++;
          }
        }

        result = { success: true, linked, failed, total: (unlinkedRuns || []).length };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
