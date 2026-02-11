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

    // ── Detect payload format ──
    const isFormatB = body.lead && body.booking && body.meta;

    if (!isFormatB) {
      // ═══════════════════════════════════════
      // FORMAT A — existing flat payload (backward compatible)
      // ═══════════════════════════════════════
      const { first_name, last_name, email, phone, source } = body;
      if (!first_name || !last_name || !email || !phone) {
        return jsonResponse(
          { error: "Missing required fields: first_name, last_name, email, phone" },
          400
        );
      }

      const { data: existing } = await supabase
        .from("leads")
        .select("id, first_name, last_name")
        .or(`email.eq.${email},phone.eq.${phone}`)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const now = new Date().toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        });
        await supabase.from("lead_activities").insert({
          lead_id: existing.id,
          activity_type: "duplicate_detected",
          performed_by: "System",
          notes: `Duplicate lead received from Orangebook on ${now}. Lead already exists in pipeline.`,
        });
        return jsonResponse({
          status: "duplicate",
          message: `Lead already exists: ${existing.first_name} ${existing.last_name}`,
          existing_lead_id: existing.id,
        });
      }

      const { data: newLead, error } = await supabase
        .from("leads")
        .insert({ first_name, last_name, email, phone, stage: "new", source: source || "Orangebook Web Lead" })
        .select("id")
        .single();
      if (error) throw error;

      return jsonResponse({ status: "created", lead_id: newLead.id }, 201);
    }

    // ═══════════════════════════════════════
    // FORMAT B — nested payload with booking + idempotency
    // ═══════════════════════════════════════
    const { lead, booking, meta } = body;

    // Validate required nested fields
    if (!lead?.first_name || !lead?.last_name) {
      return jsonResponse({ error: "Missing lead.first_name or lead.last_name" }, 400);
    }
    if (!booking?.date || !booking?.time) {
      return jsonResponse({ error: "Missing booking.date or booking.time" }, 400);
    }
    if (!meta?.gmail_message_id) {
      return jsonResponse({ error: "Missing meta.gmail_message_id" }, 400);
    }

    // 1) Idempotency check
    const { data: existingEvent } = await supabase
      .from("intake_events")
      .select("id")
      .eq("external_id", meta.gmail_message_id)
      .maybeSingle();

    if (existingEvent) {
      return jsonResponse({ ok: true, duplicate: true });
    }

    // 2) Parse date & time
    const classDate = parseDate(booking.date);
    const introTime = parseTime(booking.time);
    if (!classDate) {
      return jsonResponse({ error: `Invalid date format: ${booking.date}. Expected MM-DD-YYYY` }, 400);
    }
    if (!introTime) {
      return jsonResponse({ error: `Invalid time format: ${booking.time}. Expected h:mm AM/PM` }, 400);
    }

    // 3) Upsert lead
    let leadId: string;
    let createdLead = false;

    const orFilters: string[] = [];
    if (lead.email) orFilters.push(`email.eq.${lead.email}`);
    if (lead.phone) orFilters.push(`phone.eq.${lead.phone}`);

    let existingLead = null;
    if (orFilters.length > 0) {
      const { data } = await supabase
        .from("leads")
        .select("id, first_name, last_name, email, phone")
        .or(orFilters.join(","))
        .limit(1)
        .maybeSingle();
      existingLead = data;
    }

    if (existingLead) {
      leadId = existingLead.id;
      // Fill in any missing fields
      const updates: Record<string, string> = {};
      if (!existingLead.email && lead.email) updates.email = lead.email;
      if (!existingLead.phone && lead.phone) updates.phone = lead.phone;
      if (!existingLead.first_name && lead.first_name) updates.first_name = lead.first_name;
      if (!existingLead.last_name && lead.last_name) updates.last_name = lead.last_name;
      if (Object.keys(updates).length > 0) {
        await supabase.from("leads").update(updates).eq("id", leadId);
      }
    } else {
      const { data: newLead, error } = await supabase
        .from("leads")
        .insert({
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email || null,
          phone: lead.phone || "",
          stage: "new",
          source: lead.source || "Orangebook Online Intro",
        })
        .select("id")
        .single();
      if (error) throw error;
      leadId = newLead.id;
      createdLead = true;
    }

    // 4) Dedupe booking
    const memberName = `${lead.first_name} ${lead.last_name}`;
    let bookingId: string | null = null;
    let createdBooking = false;

    const { data: existingBooking } = await supabase
      .from("intros_booked")
      .select("id")
      .eq("member_name", memberName)
      .eq("class_date", classDate)
      .eq("intro_time", introTime)
      .limit(1)
      .maybeSingle();

    if (!existingBooking) {
      // 5) Create booking
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
        })
        .select("id")
        .single();
      if (bookingError) throw bookingError;
      bookingId = newBooking.id;
      createdBooking = true;
    } else {
      bookingId = existingBooking.id;
    }

    // 6) Record intake event
    await supabase.from("intake_events").insert({
      source: "gmail",
      external_id: meta.gmail_message_id,
      payload: body,
      lead_id: leadId,
      booking_id: bookingId,
    });

    return jsonResponse({
      ok: true,
      lead_id: leadId,
      booking_id: bookingId,
      created_lead: createdLead,
      created_booking: createdBooking,
    });
  } catch (err) {
    console.error("import-lead error:", err);
    return jsonResponse({ error: "Internal server error", details: String(err) }, 500);
  }
});
