import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScriptPickerSheet } from '@/components/scripts/ScriptPickerSheet';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

interface ClientBooking {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  coach_name: string;
  booked_by: string | null;
  lead_source: string;
  fitness_goal: string | null;
  booking_status: string | null;
  intro_owner: string | null;
  originating_booking_id: string | null;
}

interface ClientRun {
  id: string;
  member_name: string;
  run_date: string | null;
  class_time: string;
  result: string;
  intro_owner: string | null;
  ran_by: string | null;
  lead_source: string | null;
  notes: string | null;
  commission_amount: number | null;
  linked_intro_booked_id: string | null;
}

interface ClientJourney {
  memberKey: string;
  memberName: string;
  bookings: ClientBooking[];
  runs: ClientRun[];
  hasSale: boolean;
  totalCommission: number;
  latestIntroOwner: string | null;
  status: 'active' | 'purchased' | 'not_interested' | 'no_show' | 'unknown';
}

interface PipelineScriptPickerProps {
  journey: ClientJourney;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getSuggestedCategories(journey: ClientJourney): string[] {
  const now = new Date();
  const today = getLocalDateString(now);
  const currentTime = now.toTimeString().slice(0, 5);

  const latestActiveBooking = journey.bookings.find(
    (b) => !b.booking_status || b.booking_status === 'Active'
  );

  if (journey.status === 'no_show') {
    return ['no_show'];
  }

  if (journey.status === 'not_interested') {
    return ['cold_lead'];
  }

  // Check runs for post-class scenarios
  const hasRunNoSale = journey.runs.some(
    (r) => r.result === 'Follow-up needed' || r.result === 'Booked 2nd intro'
  );
  if (hasRunNoSale) {
    return ['post_class_no_close'];
  }

  if (latestActiveBooking) {
    const bookingDate = latestActiveBooking.class_date;
    const bookingTime = latestActiveBooking.intro_time;

    // Upcoming (future date)
    if (bookingDate > today) {
      // Check if it's tomorrow
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = getLocalDateString(tomorrow);
      if (bookingDate === tomorrowStr) {
        return ['pre_class_reminder', 'booking_confirmation'];
      }
      return ['booking_confirmation', 'pre_class_reminder'];
    }

    // Today
    if (bookingDate === today) {
      if (bookingTime && bookingTime > currentTime) {
        return ['pre_class_reminder'];
      }
      // Past time today — could be no-show or post-class
      return ['no_show', 'post_class_no_close'];
    }

    // Past booking
    if (bookingDate < today) {
      return ['post_class_no_close', 'no_show'];
    }
  }

  // Default — show all relevant categories
  return ['booking_confirmation', 'pre_class_reminder', 'no_show', 'post_class_no_close', 'cold_lead'];
}

function buildMergeContext(journey: ClientJourney): Record<string, string> {
  const nameParts = journey.memberName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const latestBooking = journey.bookings[0];
  const context: Record<string, string> = {
    'first-name': firstName,
    'last-name': lastName,
  };

  if (latestBooking) {
    try {
      const classDate = parseLocalDate(latestBooking.class_date);
      context.day = format(classDate, 'EEEE, MMMM d');

      // Determine today/tomorrow
      const now = new Date();
      const todayStr = getLocalDateString(now);
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = getLocalDateString(tomorrow);

      if (latestBooking.class_date === todayStr) {
        context['today/tomorrow'] = 'today';
      } else if (latestBooking.class_date === tomorrowStr) {
        context['today/tomorrow'] = 'tomorrow';
      } else {
        context['today/tomorrow'] = context.day;
      }
    } catch {
      // skip
    }

    if (latestBooking.intro_time) {
      // Format time from HH:MM:SS to readable
      const [h, m] = latestBooking.intro_time.split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      context.time = `${hour12}:${m} ${ampm}`;
    }
  }

  return context;
}

export function PipelineScriptPicker({ journey, open, onOpenChange }: PipelineScriptPickerProps) {
  const [questionnaireLink, setQuestionnaireLink] = useState<string | undefined>();
  const suggestedCategories = getSuggestedCategories(journey);
  const mergeContext = buildMergeContext(journey);

  // Fetch questionnaire link for the latest booking
  useEffect(() => {
    if (!open || !journey.bookings[0]) return;

    const fetchQLink = async () => {
      const booking = journey.bookings[0];
      const { data } = await supabase
        .from('intro_questionnaires')
        .select('slug')
        .eq('booking_id', booking.id)
        .maybeSingle();

      if (data?.slug) {
        setQuestionnaireLink(`https://otf-tuscaloosa.lovable.app/q/${data.slug}`);
      }
    };

    fetchQLink();
  }, [open, journey.bookings]);

  const fullMergeContext = {
    ...mergeContext,
    ...(questionnaireLink ? { 'questionnaire-link': questionnaireLink } : {}),
  };

  return (
    <ScriptPickerSheet
      open={open}
      onOpenChange={onOpenChange}
      suggestedCategories={suggestedCategories}
      mergeContext={fullMergeContext}
      bookingId={journey.bookings[0]?.id}
    />
  );
}
