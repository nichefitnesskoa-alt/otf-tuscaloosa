import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';

const PUBLISHED_URL = 'https://otf-tuscaloosa.lovable.app';

export interface FullScriptContext {
  mergeFields: Record<string, string | undefined>;
  questionnaireId?: string;
  friendQuestionnaireId?: string;
  isSecondIntro: boolean;
  qCompleted: boolean;
  qGoal?: string | null;
  bodyOverride?: string;
}

interface BuildContextOpts {
  bookingId: string;
  memberName: string;
  classDate: string;
  classTime: string | null;
  coachName: string;
  leadSource: string;
  isSecondIntro: boolean;
  phone?: string | null;
  email?: string | null;
  saName?: string;
  primaryObjection?: string | null;
}

/**
 * Single unified function to gather ALL merge context for a script.
 * Every script generation path should use this.
 */
export async function buildScriptContext(opts: BuildContextOpts): Promise<FullScriptContext> {
  const {
    bookingId, memberName, classDate, classTime, coachName,
    leadSource, isSecondIntro, phone, email, saName, primaryObjection,
  } = opts;

  const nameParts = memberName.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const ctx: Record<string, string | undefined> = {
    'first-name': firstName,
    'last-name': lastName,
    'sa-name': saName,
    'location-name': 'Tuscaloosa',
    coach: coachName,
  };

  // Date/time merge fields
  if (classDate) {
    try {
      const d = parseISO(classDate);
      ctx.day = format(d, 'EEEE, MMMM d');
      if (isToday(d)) ctx['today/tomorrow'] = 'today';
      else if (isTomorrow(d)) ctx['today/tomorrow'] = 'tomorrow';
      else ctx['today/tomorrow'] = format(d, 'EEEE');
    } catch { /* skip */ }
  }
  if (classTime) {
    try {
      const [h, m] = classTime.split(':');
      const hour = parseInt(h, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      ctx.time = `${hour12}:${m} ${ampm}`;
    } catch {
      ctx.time = classTime;
    }
  }

  let questionnaireId: string | undefined;
  let friendQuestionnaireId: string | undefined;
  let qCompleted = false;
  let qGoal: string | null = null;

  // Step 2: Fetch questionnaire by BOOKING ID (never by name)
  if (!isSecondIntro) {
    const { data: qRecords } = await supabase
      .from('intro_questionnaires')
      .select('id, slug, status, q1_fitness_goal, booking_id')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });

    // Pick completed record first, then fall back to most recent
    const allQ = qRecords || [];
    const qRecord = allQ.find(q => q.status === 'completed' || q.status === 'submitted') || allQ[0] || null;

    if (qRecord) {
      questionnaireId = qRecord.id;

      if (qRecord.status === 'submitted' || qRecord.status === 'completed') {
        // Q completed - reference goal instead of link
        qCompleted = true;
        qGoal = qRecord.q1_fitness_goal;
        // Don't include questionnaire-link
      } else {
        // Q exists but not completed - include link
        const slug = (qRecord as any).slug || qRecord.id;
        ctx['questionnaire-link'] = `${PUBLISHED_URL}/q/${slug}`;
      }
    }
    // If no Q exists, no link (SA needs to create it first)

    // Check for friend/paired booking questionnaire
    const { data: booking } = await supabase
      .from('intros_booked')
      .select('paired_booking_id')
      .eq('id', bookingId)
      .maybeSingle();

    if (booking?.paired_booking_id) {
      const { data: friendQ } = await supabase
        .from('intro_questionnaires')
        .select('id, slug, status')
        .eq('booking_id', booking.paired_booking_id)
        .maybeSingle();

      if (friendQ) {
        friendQuestionnaireId = friendQ.id;
        if (friendQ.status !== 'submitted' && friendQ.status !== 'completed') {
          const friendSlug = (friendQ as any).slug || friendQ.id;
          ctx['friend-questionnaire-link'] = `${PUBLISHED_URL}/q/${friendSlug}`;
        }
      }
    }
  }

  // Gather follow-up context if available
  if (primaryObjection) {
    ctx['objection'] = primaryObjection;
  }

  // Gather questionnaire answers for post-Q context
  if (qCompleted && qGoal) {
    ctx['goal'] = qGoal;
  }

  return {
    mergeFields: ctx,
    questionnaireId,
    friendQuestionnaireId,
    isSecondIntro,
    qCompleted,
    qGoal,
  };
}

/**
 * Build a body override that strips questionnaire link lines when Q is completed.
 */
export function getBodyOverride(templateBody: string, qCompleted: boolean, qGoal?: string | null): string | undefined {
  if (!qCompleted) return undefined;
  if (!templateBody.includes('{questionnaire-link}')) return undefined;

  let body = templateBody
    .split('\n')
    .filter(line => !line.includes('{questionnaire-link}') && !line.includes('{friend-questionnaire-link}'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // If goal is available, add a personalized line
  if (qGoal) {
    body += `\n\nLooking forward to helping you work toward ${qGoal}!`;
  }

  return body;
}
