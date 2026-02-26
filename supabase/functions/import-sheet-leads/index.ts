import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Google Auth (same pattern as sync-sheets) ──

interface GoogleAuth { access_token: string; expires_at: number; }
let cachedAuth: GoogleAuth | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedAuth && Date.now() < cachedAuth.expires_at - 60000) {
    return cachedAuth.access_token;
  }

  let serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not configured');

  serviceAccountJson = serviceAccountJson.trim();
  if ((serviceAccountJson.startsWith('"') && serviceAccountJson.endsWith('"')) ||
      (serviceAccountJson.startsWith("'") && serviceAccountJson.endsWith("'"))) {
    serviceAccountJson = serviceAccountJson.slice(1, -1);
  }
  if (serviceAccountJson.includes('\\"')) {
    serviceAccountJson = serviceAccountJson.replace(/\\"/g, '"');
  }
  serviceAccountJson = serviceAccountJson
    .replace(/\r\n/g, '\\n').replace(/\r/g, '\\n').replace(/\n/g, '\\n').replace(/\t/g, '\\t');

  const serviceAccount = JSON.parse(serviceAccountJson);
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Service account JSON missing required fields');
  }

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: unknown) => {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const unsignedToken = `${encode(header)}.${encode(payload)}`;
  const pemContent = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(atob(pemContent), (c: string) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsignedToken));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  if (!tokenResponse.ok) throw new Error(`Failed to get access token: ${await tokenResponse.text()}`);
  const tokenData = await tokenResponse.json();
  cachedAuth = { access_token: tokenData.access_token, expires_at: Date.now() + (tokenData.expires_in * 1000) };
  return cachedAuth.access_token;
}

// ── Sheet reading ──

async function readSheet(spreadsheetId: string, tabName: string, accessToken: string): Promise<string[][]> {
  const range = `${tabName}!A:ZZ`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, { method: 'GET', headers: { 'Authorization': `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Failed to read sheet "${tabName}": ${await response.text()}`);
  const data = await response.json();
  return data.values || [];
}

// ── Phone normalization ──

function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
}

// ── Date parsing (flexible) ──

function parseFlexDate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const m2 = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (m2) {
    const yr = parseInt(m2[3]) > 50 ? `19${m2[3]}` : `20${m2[3]}`;
    return `${yr}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`;
  }
  return null;
}

// ── Time parsing (flexible) ──

function parseFlexTime(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) return trimmed.slice(0, 5);
  const m = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    let hour = parseInt(m[1], 10);
    const min = m[2];
    const ampm = m[3].toUpperCase();
    if (ampm === 'PM' && hour !== 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${min}`;
  }
  return null;
}

// ── Dynamic header mapping ──

interface HeaderMap {
  firstName: number;
  lastName: number;
  name: number;
  email: number;
  phone: number;
  date: number;
  time: number;
  source: number;
  coach: number;
}

function buildHeaderMap(headers: string[]): HeaderMap {
  const map: HeaderMap = { firstName: -1, lastName: -1, name: -1, email: -1, phone: -1, date: -1, time: -1, source: -1, coach: -1 };
  headers.forEach((h, i) => {
    const lower = h.toLowerCase().trim();
    if (lower === 'first name' || lower === 'first_name' || lower === 'firstname') map.firstName = i;
    else if (lower === 'last name' || lower === 'last_name' || lower === 'lastname') map.lastName = i;
    else if (lower === 'name' || lower === 'full name' || lower === 'member name' || lower === 'client name') map.name = i;
    else if (lower === 'email' || lower === 'email address') map.email = i;
    else if (lower === 'phone' || lower === 'phone number' || lower === 'phone_number' || lower === 'cell' || lower === 'mobile') map.phone = i;
    else if (lower === 'date' || lower === 'class date' || lower === 'intro date' || lower === 'appointment date' || lower === 'class_date') map.date = i;
    else if (lower === 'time' || lower === 'class time' || lower === 'intro time' || lower === 'appointment time' || lower === 'class_time') map.time = i;
    else if (lower === 'source' || lower === 'lead source' || lower === 'lead_source' || lower === 'how did you hear') map.source = i;
    else if (lower === 'coach' || lower === 'coach name' || lower === 'coach_name' || lower === 'instructor') map.coach = i;
  });
  return map;
}

function getVal(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return '';
  return (row[idx] || '').trim();
}

function parseName(row: string[], hm: HeaderMap): { first: string; last: string } | null {
  if (hm.firstName >= 0) {
    const first = getVal(row, hm.firstName);
    const last = getVal(row, hm.lastName);
    if (!first) return null;
    return { first, last: last || '' };
  }
  if (hm.name >= 0) {
    const full = getVal(row, hm.name);
    if (!full) return null;
    const parts = full.split(/\s+/);
    return { first: parts[0], last: parts.slice(1).join(' ') || '' };
  }
  return null;
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Get spreadsheet ID and mode from body or secret
    let spreadsheetId: string | null = null;
    let mode: string = 'import';
    try {
      const body = await req.json();
      spreadsheetId = body.spreadsheetId || null;
      mode = body.mode || 'import';
    } catch { /* no body */ }

    if (!spreadsheetId) {
      spreadsheetId = Deno.env.get('LEADS_SPREADSHEET_ID') || null;
    }
    if (!spreadsheetId) {
      return jsonResponse({ error: 'No spreadsheetId provided and LEADS_SPREADSHEET_ID secret not set' }, 400);
    }

    const accessToken = await getAccessToken();
    const TAB_NAME = 'OTF Lead Intake';

    console.log(`[import-sheet-leads] Reading from "${TAB_NAME}" (mode: ${mode})...`);
    const rows = await readSheet(spreadsheetId, TAB_NAME, accessToken);

    if (rows.length < 2) {
      return jsonResponse({ success: true, imported: 0, skipped_duplicate: 0, skipped_empty: 0, errors: 0, rows_scanned: 0, message: 'No data rows found' });
    }

    const headers = rows[0];
    const hm = buildHeaderMap(headers);
    console.log(`[import-sheet-leads] Header map:`, JSON.stringify(hm));

    if (hm.firstName < 0 && hm.name < 0) {
      return jsonResponse({ error: 'Could not find a name column in the sheet headers. Found: ' + headers.join(', ') }, 400);
    }

    let imported = 0;
    let skippedDuplicate = 0;
    let skippedEmpty = 0;
    let errors = 0;
    const details: string[] = [];
    const rowsScanned = rows.length - 1;

    // Both 'import' and 'backfill' modes read ALL rows — backfill is just explicit about it
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      try {
        const nameResult = parseName(row, hm);
        if (!nameResult || !nameResult.first) { skippedEmpty++; continue; }

        const { first, last } = nameResult;
        const memberName = last ? `${first} ${last}` : first;
        const email = getVal(row, hm.email).toLowerCase() || null;
        const rawPhone = getVal(row, hm.phone);
        const phone = normalizePhone(rawPhone);
        const rawDate = getVal(row, hm.date);
        const rawTime = getVal(row, hm.time);
        const classDate = parseFlexDate(rawDate);
        const introTime = parseFlexTime(rawTime);
        const source = getVal(row, hm.source) || 'OTF Lead Intake Sheet';
        const coach = getVal(row, hm.coach) || 'TBD';

        const hasBookingInfo = !!classDate;

        if (hasBookingInfo) {
          // ── BOOKING PATH ──
          const { data: existByNameDate } = await supabase
            .from('intros_booked')
            .select('id')
            .ilike('member_name', memberName)
            .eq('class_date', classDate)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();

          if (existByNameDate) {
            skippedDuplicate++;
            continue;
          }

          if (phone) {
            const { data: existByPhone } = await supabase
              .from('intros_booked')
              .select('id, member_name, class_date')
              .is('deleted_at', null)
              .or(`phone.eq.${phone},phone_e164.eq.+1${phone}`)
              .eq('class_date', classDate)
              .limit(1)
              .maybeSingle();

            if (existByPhone) {
              skippedDuplicate++;
              continue;
            }
          }

          if (email) {
            const { data: existByEmail } = await supabase
              .from('intros_booked')
              .select('id')
              .is('deleted_at', null)
              .ilike('email', email)
              .eq('class_date', classDate)
              .limit(1)
              .maybeSingle();

            if (existByEmail) {
              skippedDuplicate++;
              continue;
            }
          }

          const { error: insertErr } = await supabase.from('intros_booked').insert({
            member_name: memberName,
            class_date: classDate,
            intro_time: introTime,
            lead_source: source,
            coach_name: coach,
            sa_working_shift: 'Online',
            booked_by: 'System (Sheet Import)',
            booking_status: 'Active',
            booking_status_canon: 'ACTIVE',
            phone: phone || null,
            phone_e164: phone ? `+1${phone}` : null,
            phone_source: phone ? 'sheet_import' : null,
            email: email,
          });

          if (insertErr) {
            console.error(`Row ${i + 1} booking insert error:`, insertErr);
            errors++;
            details.push(`Row ${i + 1}: booking insert failed — ${insertErr.message}`);
          } else {
            imported++;
            details.push(`Row ${i + 1}: booked ${memberName} on ${classDate}`);
          }

        } else {
          // ── LEAD PATH (no date) ──
          if (!phone && !email) {
            skippedEmpty++;
            details.push(`Row ${i + 1}: skipped ${memberName} — no phone or email`);
            continue;
          }

          const orFilters: string[] = [];
          if (email) orFilters.push(`email.eq.${email}`);
          if (phone) orFilters.push(`phone.eq.${phone}`);

          const { data: existingLead } = await supabase
            .from('leads')
            .select('id')
            .or(orFilters.join(','))
            .limit(1)
            .maybeSingle();

          if (existingLead) {
            skippedDuplicate++;
            continue;
          }

          let dupConfidence: string | null = null;
          let dupMatchType: string | null = null;
          let dupNotes: string | null = null;
          let autoStage = 'new';

          if (phone) {
            const { data: phoneMatch } = await supabase
              .from('intros_booked')
              .select('id, member_name, class_date, booking_status_canon')
              .is('deleted_at', null)
              .or(`phone.eq.${phone},phone_e164.eq.+1${phone}`)
              .limit(1)
              .maybeSingle();

            if (phoneMatch) {
              dupConfidence = 'HIGH';
              dupMatchType = 'phone';
              dupNotes = `Phone match: ${phoneMatch.member_name} — booked on ${phoneMatch.class_date}`;
              autoStage = 'already_in_system';
            }
          }

          if (!dupConfidence && email) {
            const { data: emailMatch } = await supabase
              .from('intros_booked')
              .select('id, member_name, class_date')
              .is('deleted_at', null)
              .ilike('email', email)
              .limit(1)
              .maybeSingle();

            if (emailMatch) {
              dupConfidence = 'HIGH';
              dupMatchType = 'email';
              dupNotes = `Email match: ${emailMatch.member_name} — booked on ${emailMatch.class_date}`;
              autoStage = 'already_in_system';
            }
          }

          if (!dupConfidence) {
            const { data: nameMatch } = await supabase
              .from('intros_booked')
              .select('id, member_name, class_date')
              .is('deleted_at', null)
              .ilike('member_name', memberName)
              .limit(1)
              .maybeSingle();

            if (nameMatch) {
              dupConfidence = 'MEDIUM';
              dupMatchType = 'name_only';
              dupNotes = `Name match: ${nameMatch.member_name} — booked on ${nameMatch.class_date}`;
              autoStage = 'flagged';
            }
          }

          if (!dupConfidence) {
            const { data: saleMatch } = await supabase
              .from('sales_outside_intro')
              .select('id, member_name')
              .ilike('member_name', memberName)
              .limit(1)
              .maybeSingle();

            if (saleMatch) {
              dupConfidence = 'HIGH';
              dupMatchType = 'name_date';
              dupNotes = `Active member match: ${saleMatch.member_name}`;
              autoStage = 'already_in_system';
            }
          }

          const { error: insertErr } = await supabase.from('leads').insert({
            first_name: first,
            last_name: last || 'Unknown',
            email: email,
            phone: phone || rawPhone || '',
            stage: autoStage,
            source: source,
            duplicate_confidence: dupConfidence,
            duplicate_match_type: dupMatchType,
            duplicate_notes: dupNotes,
          });

          if (insertErr) {
            console.error(`Row ${i + 1} lead insert error:`, insertErr);
            errors++;
            details.push(`Row ${i + 1}: lead insert failed — ${insertErr.message}`);
          } else {
            imported++;
            details.push(`Row ${i + 1}: lead ${memberName} (stage: ${autoStage})`);
          }
        }
      } catch (rowErr) {
        console.error(`Row ${i + 1} error:`, rowErr);
        errors++;
        details.push(`Row ${i + 1}: ${String(rowErr)}`);
      }
    }

    // Log to sheets_sync_log
    try {
      await supabase.from('sheets_sync_log').insert({
        sync_type: mode === 'backfill' ? 'backfill_sheet_leads' : 'import_sheet_leads',
        status: errors > 0 ? 'partial' : 'success',
        records_synced: imported,
        error_message: errors > 0 ? `${errors} errors. ${details.filter(d => d.includes('failed')).join('; ')}` : null,
      });
    } catch (logErr) {
      console.error('[import-sheet-leads] Failed to log sync:', logErr);
    }

    console.log(`[import-sheet-leads] Done: imported=${imported}, skipped_dup=${skippedDuplicate}, skipped_empty=${skippedEmpty}, errors=${errors}`);

    return jsonResponse({
      success: true,
      imported,
      skipped_duplicate: skippedDuplicate,
      skipped_empty: skippedEmpty,
      errors,
      rows_scanned: rowsScanned,
      details: details.slice(0, 50),
    });

  } catch (err) {
    console.error('[import-sheet-leads] Fatal error:', err);

    // Log error — wrapped in try/catch to avoid the .catch() crash
    try {
      const supabase2 = createClient(supabaseUrl, supabaseServiceKey);
      await supabase2.from('sheets_sync_log').insert({
        sync_type: 'import_sheet_leads',
        status: 'error',
        records_synced: 0,
        error_message: String(err),
      });
    } catch (logErr) {
      console.error('[import-sheet-leads] Failed to log error:', logErr);
    }

    return jsonResponse({ error: 'Internal server error', details: String(err) }, 500);
  }
});
