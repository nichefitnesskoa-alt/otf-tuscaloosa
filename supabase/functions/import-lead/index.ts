import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Convert "MM-DD-YYYY" → "YYYY-MM-DD" */
function parseDate(raw: string): string | null {
  const m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

/** Convert "h:mm AM/PM" → "HH:MM" (24-hour) */
function parseTime(raw: string): string | null {
  const m = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const min = m[2];
  const ampm = m[3].toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${min}`;
}

/**
 * Extract a US phone number from raw text/HTML content.
 * Returns 10-digit string or null.
 */
function extractPhoneFromContent(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let text = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();

  // Pass 1: tel: links
  const telMatch = text.match(/tel:\s*\+?1?(\d{10})/i);
  if (telMatch) return telMatch[1];

  const telFmtMatch = text.match(/tel:\s*\+?1?[.\s-]?(\(?\d{3}\)?[.\s-]?\d{3}[.\s-]?\d{4})/i);
  if (telFmtMatch) {
    const digits = telFmtMatch[1].replace(/\D/g, "");
    const clean = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    if (clean.length === 10) return clean;
  }

  // Pass 2: standard US formats
  const patterns = [
    /\((\d{3})\)\s*(\d{3})[.\s-](\d{4})/,
    /(?:^|\D)(\d{3})[.\s-](\d{3})[.\s-](\d{4})(?:\D|$)/,
    /\+1\s*(\d{3})\s*(\d{3})\s*(\d{4})/,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const groups = m.slice(1).filter(Boolean);
      const digits = groups.join("").replace(/\D/g, "");
      const clean = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
      if (clean.length === 10) return clean;
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Auth
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("LEADS_API_KEY");
  if (!apiKey || apiKey !== expectedKey) {
    return jsonResponse({ error: "Invalid API key" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json();
    const { lead, booking, meta } = body;

    // Try to extract phone from email body/snippet if not provided directly
    if (!lead.phone && meta?.email_body) {
      const extracted = extractPhoneFromContent(meta.email_body);
      if (extracted) lead.phone = extracted;
    }
    if (!lead.phone && meta?.email_html) {
      const extracted = extractPhoneFromContent(meta.email_html);
      if (extracted) lead.phone = extracted;
    }
    if (!lead.phone && meta?.email_snippet) {
      const extracted = extractPhoneFromContent(meta.email_snippet);
      if (extracted) lead.phone = extracted;
    }

    // Validate lead object
    if (!lead?.first_name || !lead?.last_name) {
      return jsonResponse({ error: "Missing lead.first_name or lead.last_name" }, 400);
    }

    // Idempotency check via gmail_message_id if present
    if (meta?.gmail_message_id) {
      const { data: existingEvent } = await supabase
        .from("intake_events")
        .select("id")
        .eq("external_id", meta.gmail_message_id)
        .maybeSingle();

      if (existingEvent) {
        return jsonResponse({ ok: true, duplicate: true, reason: "gmail_message_id already processed" });
      }
    }

    // Determine type: booking with a non-empty date = Type 2, otherwise Type 1
    const isType2 = booking && booking.date && booking.date.trim() !== "";

    if (!isType2) {
      // ═══════════════════════════════════════
      // TYPE 1 — Web Lead → leads table
      // ═══════════════════════════════════════
      if (!lead.email && !lead.phone) {
        return jsonResponse({ error: "Missing lead.email or lead.phone" }, 400);
      }

      // Duplicate detection on email and phone
      const orFilters: string[] = [];
      if (lead.email) orFilters.push(`email.eq.${lead.email}`);
      if (lead.phone) orFilters.push(`phone.eq.${lead.phone}`);

      const { data: existingLead } = await supabase
        .from("leads")
        .select("id, first_name, last_name")
        .or(orFilters.join(","))
        .limit(1)
        .maybeSingle();

      if (existingLead) {
        // Record intake event for audit
        if (meta?.gmail_message_id) {
          await supabase.from("intake_events").insert({
            source: "gmail",
            external_id: meta.gmail_message_id,
            payload: body,
            lead_id: existingLead.id,
          });
        }
        return jsonResponse({
          status: "duplicate",
          message: `Lead already exists: ${existingLead.first_name} ${existingLead.last_name}`,
          existing_lead_id: existingLead.id,
        });
      }

      // ── Cross-table duplicate detection ──
      // Check intros_booked by name (case-insensitive)
      const memberName = `${lead.first_name} ${lead.last_name}`;

      const { data: nameMatchBooking } = await supabase
        .from("intros_booked")
        .select("id, lead_source")
        .ilike("member_name", memberName)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      // Also check by phone via vip_registrations linked to bookings
      let phoneMatchBooking: { id: string; lead_source: string } | null = null;
      if (lead.phone) {
        const { data: vipMatch } = await supabase
          .from("vip_registrations")
          .select("booking_id")
          .eq("phone", lead.phone)
          .not("booking_id", "is", null)
          .limit(1)
          .maybeSingle();

        if (vipMatch?.booking_id) {
          const { data: bookingMatch } = await supabase
            .from("intros_booked")
            .select("id, lead_source")
            .eq("id", vipMatch.booking_id)
            .is("deleted_at", null)
            .maybeSingle();
          if (bookingMatch) phoneMatchBooking = bookingMatch;
        }
      }

      const existingBooking = nameMatchBooking || phoneMatchBooking;

      // If found in pipeline already but NOT in leads, return early
      if (existingBooking) {
        // Check if a lead record already exists for this person
        const orFiltersBookingCheck: string[] = [];
        if (lead.email) orFiltersBookingCheck.push(`email.eq.${lead.email}`);
        if (lead.phone) orFiltersBookingCheck.push(`phone.eq.${lead.phone}`);

        let existingLeadForBooking = null;
        if (orFiltersBookingCheck.length > 0) {
          const { data } = await supabase
            .from("leads")
            .select("id")
            .or(orFiltersBookingCheck.join(","))
            .limit(1)
            .maybeSingle();
          existingLeadForBooking = data;
        }

        if (!existingLeadForBooking) {
          // No lead record either — this person is already in the booking pipeline
          if (meta?.gmail_message_id) {
            await supabase.from("intake_events").insert({
              source: "gmail",
              external_id: meta.gmail_message_id,
              payload: body,
              booking_id: existingBooking.id,
            });
          }
          return jsonResponse({
            status: "already_exists",
            message: `Already exists in client pipeline as booking: ${memberName}`,
            existing_booking_id: existingBooking.id,
          });
        }
      }

      let autoStage = "new";
      let autoBookedIntroId: string | null = null;

      if (existingBooking) {
        autoBookedIntroId = existingBooking.id;
        autoStage = "booked";

        // Check if they already purchased (sale result in intros_run)
        const { data: saleRun } = await supabase
          .from("intros_run")
          .select("id")
          .eq("linked_intro_booked_id", existingBooking.id)
          .ilike("result", "%premier%")
          .limit(1)
          .maybeSingle();

        if (!saleRun) {
          // Also check other sale patterns
          const { data: saleRun2 } = await supabase
            .from("intros_run")
            .select("id, result")
            .eq("linked_intro_booked_id", existingBooking.id)
            .gt("commission_amount", 0)
            .limit(1)
            .maybeSingle();
          if (saleRun2) autoStage = "won";
        } else {
          autoStage = "won";
        }
      }

      // ── Inline dedup: check intros_booked by phone before inserting ──
      let dupConfidence: string | null = null;
      let dupNotes: string | null = null;
      let dupMatchType: string | null = null;

      if (autoStage === 'new' && lead.phone) {
        const phoneDigits = (lead.phone || '').replace(/\D/g, '');
        const normalizedPhone = phoneDigits.length === 11 && phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits;
        if (normalizedPhone.length === 10) {
          const { data: phoneMatch } = await supabase
            .from("intros_booked")
            .select("id, member_name, class_date, booking_status_canon")
            .is("deleted_at", null)
            .or(`phone.eq.${normalizedPhone},phone_e164.eq.+1${normalizedPhone}`)
            .limit(1)
            .maybeSingle();
          if (phoneMatch) {
            dupConfidence = 'HIGH';
            dupMatchType = 'phone';
            dupNotes = `Phone match: ${phoneMatch.member_name} — booked on ${phoneMatch.class_date}`;
            autoStage = 'already_in_system';
          }
        }
      }

      // Also check by name if not already flagged
      if (!dupConfidence && autoStage === 'new') {
        const memberName = `${lead.first_name} ${lead.last_name}`;
        const { data: nameMatch } = await supabase
          .from("intros_booked")
          .select("id, member_name, class_date")
          .is("deleted_at", null)
          .ilike("member_name", memberName)
          .limit(1)
          .maybeSingle();
        if (nameMatch) {
          dupConfidence = 'MEDIUM';
          dupMatchType = 'name_only';
          dupNotes = `Name match: ${nameMatch.member_name} — booked on ${nameMatch.class_date}`;
          autoStage = 'flagged';
        }
      }

      // Create new lead with correct stage + dedup info
      const { data: newLead, error: leadError } = await supabase
        .from("leads")
        .insert({
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email || null,
          phone: lead.phone || "",
          stage: autoStage,
          source: existingBooking?.lead_source || lead.source || "Orangebook Web Lead",
          booked_intro_id: autoBookedIntroId,
          duplicate_confidence: dupConfidence,
          duplicate_match_type: dupMatchType,
          duplicate_notes: dupNotes,
        })
        .select("id")
        .single();
      if (leadError) throw leadError;

      // Record intake event
      if (meta?.gmail_message_id) {
        await supabase.from("intake_events").insert({
          source: "gmail",
          external_id: meta.gmail_message_id,
          payload: body,
          lead_id: newLead.id,
        });
      }

      return jsonResponse({ status: "created", lead_id: newLead.id }, 201);

    } else {
      // ═══════════════════════════════════════
      // TYPE 2 — Online Intro → intros_booked table
      // ═══════════════════════════════════════
      if (!booking.time) {
        return jsonResponse({ error: "Missing booking.time" }, 400);
      }

      const classDate = parseDate(booking.date);
      const introTime = parseTime(booking.time);
      if (!classDate) {
        return jsonResponse({ error: `Invalid date format: ${booking.date}. Expected MM-DD-YYYY` }, 400);
      }
      if (!introTime) {
        return jsonResponse({ error: `Invalid time format: ${booking.time}. Expected h:mm AM/PM` }, 400);
      }

      const memberName = `${lead.first_name} ${lead.last_name}`;

      // Duplicate detection: check intros_booked by name + date + time
      const { data: existingBooking } = await supabase
        .from("intros_booked")
        .select("id")
        .eq("member_name", memberName)
        .eq("class_date", classDate)
        .eq("intro_time", introTime)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (existingBooking) {
        if (meta?.gmail_message_id) {
          await supabase.from("intake_events").insert({
            source: "gmail",
            external_id: meta.gmail_message_id,
            payload: body,
            booking_id: existingBooking.id,
          });
        }
        return jsonResponse({
          status: "duplicate",
          message: `Booking already exists for ${memberName} on ${classDate}`,
          existing_booking_id: existingBooking.id,
        });
      }

      // Create booking — include phone/email if available
      const { data: newBooking, error: bookingError } = await supabase
        .from("intros_booked")
        .insert({
          member_name: memberName,
          class_date: classDate,
          intro_time: introTime,
          lead_source: "Online Intro Offer (self-booked)",
          coach_name: "TBD",
          sa_working_shift: "Online",
          booked_by: "System (Auto-Import)",
          booking_status: "Active",
          phone: lead.phone || null,
          email: lead.email || null,
        })
        .select("id")
        .single();
      if (bookingError) throw bookingError;

      // Record intake event
      if (meta?.gmail_message_id) {
        await supabase.from("intake_events").insert({
          source: "gmail",
          external_id: meta.gmail_message_id,
          payload: body,
          booking_id: newBooking.id,
        });
      }

      return jsonResponse({ status: "created", booking_id: newBooking.id }, 201);
    }
  } catch (err) {
    console.error("import-lead error:", err);
    return jsonResponse({ error: "Internal server error", details: String(err) }, 500);
  }
});
