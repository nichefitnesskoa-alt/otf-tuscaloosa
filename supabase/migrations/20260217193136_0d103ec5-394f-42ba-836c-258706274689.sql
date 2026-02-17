
-- Add canonical fields to intros_booked
ALTER TABLE public.intros_booked
  ADD COLUMN IF NOT EXISTS class_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_type_canon text NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS questionnaire_status_canon text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS questionnaire_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS questionnaire_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS questionnaire_link text,
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS phone_source text;

-- Validation trigger for booking_type_canon
CREATE OR REPLACE FUNCTION public.validate_booking_type_canon()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.booking_type_canon NOT IN ('STANDARD', 'VIP') THEN
    RAISE EXCEPTION 'Invalid booking_type_canon: %', NEW.booking_type_canon;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_booking_type_canon
  BEFORE INSERT OR UPDATE ON public.intros_booked
  FOR EACH ROW EXECUTE FUNCTION public.validate_booking_type_canon();

-- Validation trigger for questionnaire_status_canon
CREATE OR REPLACE FUNCTION public.validate_questionnaire_status_canon()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.questionnaire_status_canon NOT IN ('not_sent', 'sent', 'completed') THEN
    RAISE EXCEPTION 'Invalid questionnaire_status_canon: %', NEW.questionnaire_status_canon;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_questionnaire_status_canon
  BEFORE INSERT OR UPDATE ON public.intros_booked
  FOR EACH ROW EXECUTE FUNCTION public.validate_questionnaire_status_canon();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_intros_booked_class_start_at ON public.intros_booked (class_start_at);
CREATE INDEX IF NOT EXISTS idx_intros_booked_booking_type_canon ON public.intros_booked (booking_type_canon);
CREATE INDEX IF NOT EXISTS idx_intros_booked_questionnaire_status_canon ON public.intros_booked (questionnaire_status_canon);

-- Backfill class_start_at from class_date + intro_time
UPDATE public.intros_booked
SET class_start_at = (class_date::text || 'T' || intro_time::text)::timestamptz
WHERE class_start_at IS NULL
  AND intro_time IS NOT NULL;

-- Backfill booking_type_canon for VIP records
UPDATE public.intros_booked
SET booking_type_canon = 'VIP'
WHERE booking_type_canon = 'STANDARD'
  AND (
    is_vip = true
    OR vip_session_id IS NOT NULL
    OR lower(lead_source) LIKE '%vip%'
  );

-- Backfill questionnaire_status_canon from intro_questionnaires
UPDATE public.intros_booked b
SET questionnaire_status_canon = 'completed',
    questionnaire_completed_at = q.submitted_at
FROM public.intro_questionnaires q
WHERE q.booking_id = b.id
  AND (q.status = 'completed' OR q.status = 'submitted')
  AND b.questionnaire_status_canon = 'not_sent';

UPDATE public.intros_booked b
SET questionnaire_status_canon = 'sent',
    questionnaire_sent_at = q.created_at
FROM public.intro_questionnaires q
WHERE q.booking_id = b.id
  AND q.status = 'sent'
  AND b.questionnaire_status_canon = 'not_sent';

-- Backfill phone_e164 from existing phone field (10-digit US numbers)
UPDATE public.intros_booked
SET phone_e164 = '+1' || regexp_replace(phone, '[^0-9]', '', 'g'),
    phone_source = 'legacy_phone_field'
WHERE phone_e164 IS NULL
  AND phone IS NOT NULL
  AND length(regexp_replace(phone, '[^0-9]', '', 'g')) = 10;

-- Self-booked: auto-set booked_by for Online Intro Offer
UPDATE public.intros_booked
SET booked_by = 'Self-booked'
WHERE lead_source = 'Online Intro Offer (self-booked)'
  AND (booked_by IS NULL OR booked_by = '');

-- Auto-set booked_by trigger for self-booked
CREATE OR REPLACE FUNCTION public.auto_set_self_booked()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.lead_source = 'Online Intro Offer (self-booked)' AND (NEW.booked_by IS NULL OR NEW.booked_by = '') THEN
    NEW.booked_by := 'Self-booked';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_set_self_booked
  BEFORE INSERT OR UPDATE ON public.intros_booked
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_self_booked();

-- Add category_canon to script_templates for tab filtering
ALTER TABLE public.script_templates
  ADD COLUMN IF NOT EXISTS category_canon text;

-- Backfill category_canon
UPDATE public.script_templates SET category_canon = 'confirmation' WHERE lower(category) LIKE '%confirm%';
UPDATE public.script_templates SET category_canon = 'questionnaire' WHERE lower(category) LIKE '%questionnaire%';
UPDATE public.script_templates SET category_canon = 'follow_up' WHERE lower(category) IN ('no_show', 'post_class_no_close', 'cancel_freeze');
UPDATE public.script_templates SET category_canon = 'outreach' WHERE lower(category) IN ('web_lead', 'cold_lead', 'ig_dm');
UPDATE public.script_templates SET category_canon = 'post_sale' WHERE lower(category) IN ('post_class_joined', 'referral_ask');
UPDATE public.script_templates SET category_canon = 'promo' WHERE lower(category) = 'promo';
UPDATE public.script_templates SET category_canon = 'other' WHERE category_canon IS NULL;

CREATE INDEX IF NOT EXISTS idx_script_templates_category_canon ON public.script_templates (category_canon);

-- RPC: backfill_booking_phones
CREATE OR REPLACE FUNCTION public.backfill_booking_phones(p_days_back int DEFAULT 120)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated int := 0;
  v_rec RECORD;
  v_phone text;
  v_digits text;
BEGIN
  FOR v_rec IN
    SELECT b.id, ie.payload
    FROM intros_booked b
    JOIN intake_events ie ON ie.booking_id = b.id
    WHERE b.phone_e164 IS NULL
      AND b.created_at >= now() - (p_days_back || ' days')::interval
      AND ie.payload IS NOT NULL
  LOOP
    -- Extract phone from payload text
    v_digits := regexp_replace(
      (regexp_match(v_rec.payload::text, '(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})'))[1],
      '[^0-9]', '', 'g'
    );
    IF v_digits IS NOT NULL AND length(v_digits) = 10 THEN
      UPDATE intros_booked
      SET phone_e164 = '+1' || v_digits,
          phone_source = 'email_parse_backfill'
      WHERE id = v_rec.id AND phone_e164 IS NULL;
      v_updated := v_updated + 1;
    END IF;
  END LOOP;
  RETURN json_build_object('updated', v_updated);
END;
$$;
