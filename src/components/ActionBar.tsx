import { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardList, MessageSquare, Copy, CalendarPlus, CalendarCheck, CheckCircle, User, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';
import { cn, generateUniqueSlug } from '@/lib/utils';
import { CoachPrepCard } from '@/components/dashboard/CoachPrepCard';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PrepDrawer } from '@/components/dashboard/PrepDrawer';
import { ClientSearchScriptPicker } from '@/components/scripts/ClientSearchScriptPicker';
import { MessageGenerator } from '@/components/scripts/MessageGenerator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useScriptTemplates } from '@/hooks/useScriptTemplates';
import { selectBestScript, type ScriptContext } from '@/hooks/useSmartScriptSelect';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';

// ─── Intro Action Bar (for booking cards) ───────────────────────────────────

interface IntroActionBarProps {
  memberName: string;
  memberKey: string;
  bookingId: string;
  classDate: string;
  classTime: string | null;
  coachName: string;
  leadSource: string;
  isSecondIntro: boolean;
  firstBookingId?: string | null;
  phone?: string | null;
  email?: string | null;
  questionnaireStatus?: string | null;
  questionnaireSlug?: string | null;
  introResult?: string | null;
  primaryObjection?: string | null;
  bookingCreatedAt?: string;
  onQuestionnaireCreated?: (slug: string) => void;
  bookings?: Array<{
    id: string;
    class_date: string;
    intro_time: string | null;
    coach_name: string;
    lead_source: string;
    booking_status: string | null;
    booked_by: string | null;
    fitness_goal: string | null;
  }>;
  runs?: Array<{
    id: string;
    run_date: string | null;
    class_time: string;
    result: string;
    intro_owner: string | null;
    ran_by: string | null;
    commission_amount: number | null;
    notes: string | null;
  }>;
}

type ScriptMode = 'closed' | 'auto' | 'picker';

export function IntroActionBar({
  memberName,
  memberKey,
  bookingId,
  classDate,
  classTime,
  coachName,
  leadSource,
  isSecondIntro,
  firstBookingId,
  phone,
  email,
  questionnaireStatus,
  questionnaireSlug,
  introResult,
  primaryObjection,
  bookingCreatedAt,
  onQuestionnaireCreated,
  bookings,
  runs,
}: IntroActionBarProps) {
  const { user } = useAuth();
  const [prepOpen, setPrepOpen] = useState(false);
  const [coachPrepOpen, setCoachPrepOpen] = useState(false);
  const [scriptMode, setScriptMode] = useState<ScriptMode>('closed');
  const [isCreatingQ, setIsCreatingQ] = useState(false);
  const { data: templates = [] } = useScriptTemplates();

  // Dynamic questionnaire slug — synced from prop, updated on auto-create
  const [dynamicQSlug, setDynamicQSlug] = useState<string | null>(questionnaireSlug || null);

  // Sync from prop when it changes
  useEffect(() => {
    if (questionnaireSlug) setDynamicQSlug(questionnaireSlug);
  }, [questionnaireSlug]);

  const prepBookingId = firstBookingId || bookingId;
  const firstName = memberName.split(' ')[0] || '';
  const lastName = memberName.split(' ').slice(1).join(' ') || '';

  const defaultBookings = bookings || [{
    id: bookingId,
    class_date: classDate,
    intro_time: classTime,
    coach_name: coachName,
    lead_source: leadSource,
    booking_status: 'Active',
    booked_by: null,
    fitness_goal: null,
  }];

  // Smart script selection
  const qCompleted = questionnaireStatus === 'completed' || questionnaireStatus === 'submitted';
  const smartResult = useMemo(() => {
    if (templates.length === 0) return { template: null, note: null, relevantCategories: [] as string[] };
    return selectBestScript({
      personType: 'booking',
      isSecondIntro,
      classDate,
      classTime,
      bookingCreatedAt,
      qCompleted,
      qSlug: dynamicQSlug,
      introResult,
      primaryObjection,
    }, templates);
  }, [templates, classDate, classTime, isSecondIntro, bookingCreatedAt, qCompleted, dynamicQSlug, introResult, primaryObjection]);

  // Build merge context - uses booking_id for Q link (never name)
  const PUBLISHED_URL = 'https://otf-tuscaloosa.lovable.app';
  const mergeContext = useMemo(() => {
    const ctx: Record<string, string | undefined> = {
      'first-name': firstName,
      'last-name': lastName,
      'sa-name': user?.name,
      'location-name': 'Tuscaloosa',
    };
    if (classDate) {
      const d = parseISO(classDate);
      ctx.day = format(d, 'EEEE');
      if (isToday(d)) ctx['today/tomorrow'] = 'today';
      else if (isTomorrow(d)) ctx['today/tomorrow'] = 'tomorrow';
      else ctx['today/tomorrow'] = format(d, 'EEEE');
    }
    if (classTime) {
      try { ctx.time = format(parseISO(`2000-01-01T${classTime}`), 'h:mm a'); }
      catch { ctx.time = classTime; }
    }
    ctx.coach = coachName;
    // Q link only if NOT completed AND NOT 2nd intro AND slug exists
    if (!qCompleted && !isSecondIntro && dynamicQSlug) {
      ctx['questionnaire-link'] = `${PUBLISHED_URL}/q/${dynamicQSlug}`;
    }
    return ctx;
  }, [firstName, lastName, user?.name, classDate, classTime, coachName, qCompleted, isSecondIntro, dynamicQSlug]);

  // Strip Q link lines from body when Q is done or 2nd intro
  const bodyOverride = useMemo(() => {
    if (!smartResult.template) return undefined;
    const body = smartResult.template.body;
    const hasQLink = body.includes('{questionnaire-link}');

    // For 2nd intros, strip all Q-related lines
    if (isSecondIntro && hasQLink) {
      return body
        .split('\n')
        .filter(line => !line.includes('{questionnaire-link}') && !line.includes('{friend-questionnaire-link}'))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    // For completed Q, strip Q link and optionally reference goal
    if (qCompleted && hasQLink) {
      return body
        .split('\n')
        .filter(line => !line.includes('{questionnaire-link}') && !line.includes('{friend-questionnaire-link}'))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    return undefined;
  }, [qCompleted, isSecondIntro, smartResult.template]);

  /**
   * Ensure a questionnaire record exists for this booking.
   * Returns the slug if one exists or was created, null for 2nd intros/VIP.
   */
  const ensureQuestionnaire = useCallback(async (): Promise<string | null> => {
    // Already have a slug
    if (dynamicQSlug) return dynamicQSlug;

    // 2nd intros don't get questionnaires
    if (isSecondIntro) return null;

    try {
      // Check by booking_id first
      const { data: byBookingAll } = await supabase
        .from('intro_questionnaires')
        .select('id, slug, status, booking_id' as any)
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false });

      const byBookingList = (byBookingAll || []) as any[];
      const byBooking = byBookingList.find(q => q.status === 'completed' || q.status === 'submitted') || byBookingList[0] || null;

      const byBookingAny = byBooking as any;
      if (byBookingAny) {
        const slug = byBookingAny.slug || byBookingAny.id;
        setDynamicQSlug(slug);
        return slug;
      }

      // Check by name (case-insensitive) to avoid duplicates
      const { data: byName } = await supabase
        .from('intro_questionnaires')
        .select('id, slug, status, booking_id' as any)
        .ilike('client_first_name', firstName)
        .ilike('client_last_name', lastName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const byNameAny = byName as any;
      if (byNameAny) {
        const slug = byNameAny.slug || byNameAny.id;
        // Link orphaned questionnaire to this booking
        if (!byNameAny.booking_id) {
          await supabase.from('intro_questionnaires')
            .update({ booking_id: bookingId })
            .eq('id', byNameAny.id)
            .is('booking_id', null);
        }
        setDynamicQSlug(slug);
        return slug;
      }

      // Create new questionnaire
      const newId = crypto.randomUUID();
      const slug = await generateUniqueSlug(firstName, lastName, supabase);

      const { error } = await supabase
        .from('intro_questionnaires')
        .insert({
          id: newId,
          booking_id: bookingId,
          client_first_name: firstName,
          client_last_name: lastName,
          scheduled_class_date: classDate,
          scheduled_class_time: classTime || null,
          status: 'not_sent',
          slug,
        });

      if (error) {
        console.error('Failed to create questionnaire:', error);
        return null;
      }

      setDynamicQSlug(slug);
      onQuestionnaireCreated?.(slug);
      return slug;
    } catch (err) {
      console.error('Error in ensureQuestionnaire:', err);
      return null;
    }
  }, [dynamicQSlug, isSecondIntro, bookingId, firstName, lastName, classDate, classTime, onQuestionnaireCreated]);

  const handleCopyPhone = async () => {
    if (phone) {
      await navigator.clipboard.writeText(phone);
      toast.success('Phone number copied!');
    } else {
      const nameParts = memberName.trim().split(/\s+/);
      const fn = nameParts[0];
      const ln = nameParts.slice(1).join(' ');
      const { data } = await supabase
        .from('leads')
        .select('phone')
        .ilike('first_name', fn)
        .ilike('last_name', ln || '')
        .limit(1)
        .maybeSingle();
      if (data?.phone) {
        await navigator.clipboard.writeText(data.phone);
        toast.success('Phone number copied!');
      } else {
        toast.info('No phone number on file');
      }
    }
  };

  // handleSendQ — now auto-creates if needed
  const handleSendQ = async () => {
    setIsCreatingQ(true);
    try {
      const slug = await ensureQuestionnaire();
      if (slug) {
        const link = `${PUBLISHED_URL}/q/${slug}`;
        await navigator.clipboard.writeText(link);
        // Mark as sent if it was not_sent
        const { data: qRecords } = await supabase
          .from('intro_questionnaires')
          .select('id, status')
          .eq('booking_id', bookingId)
          .order('created_at', { ascending: false });
        const qRecord = (qRecords || []).find(q => q.status === 'not_sent') || null;
        if (qRecord && qRecord.status === 'not_sent') {
          await supabase.from('intro_questionnaires').update({ status: 'sent' }).eq('id', qRecord.id);
        }
        toast.success('Q link copied!');
      } else if (isSecondIntro) {
        toast.info('2nd intros do not use questionnaires');
      } else {
        toast.error('Failed to create questionnaire');
      }
    } finally {
      setIsCreatingQ(false);
    }
  };

  const handleScriptTap = async () => {
    // Auto-create questionnaire before opening script (for 1st intros only)
    if (!dynamicQSlug && !isSecondIntro && !qCompleted) {
      setIsCreatingQ(true);
      try {
        await ensureQuestionnaire();
      } finally {
        setIsCreatingQ(false);
      }
    }

    if (smartResult.template) {
      setScriptMode('auto');
    } else {
      if (smartResult.note) {
        toast.info(smartResult.note);
      }
      setScriptMode('picker');
    }
  };

  const preSelectedPerson = {
    type: 'booking' as const,
    id: bookingId,
    name: memberName,
    firstName,
    lastName,
    classDate,
    classTime: classTime || undefined,
    source: leadSource,
    questionnaireSlug: dynamicQSlug || undefined,
    detail: `Booking · ${classDate}${classTime ? ' at ' + classTime : ''} · Active`,
  };

  return (
    <>
      <div className="flex items-center gap-1.5 md:gap-1 py-1">
        <ActionButton icon={<ClipboardList className="w-4 h-4 md:w-3.5 md:h-3.5" />} label="Prep" onClick={() => setPrepOpen(true)} />
        <ActionButton icon={<MessageSquare className="w-4 h-4 md:w-3.5 md:h-3.5" />} label={isCreatingQ ? '...' : 'Script'} onClick={handleScriptTap} />
        <ActionButton icon={<Dumbbell className="w-4 h-4 md:w-3.5 md:h-3.5" />} label="Coach" onClick={() => setCoachPrepOpen(true)} className="text-blue-600" />
        <ActionButton icon={<Copy className="w-4 h-4 md:w-3.5 md:h-3.5" />} label="Copy #" onClick={handleCopyPhone} />
      </div>

      {/* Smart Script → MessageGenerator */}
      {scriptMode === 'auto' && smartResult.template && (
        <MessageGenerator
          open={true}
          onOpenChange={(o) => { if (!o) setScriptMode('closed'); }}
          template={smartResult.template}
          mergeContext={mergeContext}
          bookingId={bookingId}
          contextNote={smartResult.note || undefined}
          bodyOverride={bodyOverride}
          onChangeScript={() => setScriptMode('picker')}
        />
      )}

      {/* Change Script picker (filtered) */}
      {scriptMode === 'picker' && (
        <ClientSearchScriptPicker
          open={true}
          onOpenChange={(o) => { if (!o) setScriptMode('closed'); }}
          preSelectedPerson={preSelectedPerson}
          relevantCategories={smartResult.relevantCategories}
        />
      )}

      <PrepDrawer
        open={prepOpen}
        onOpenChange={setPrepOpen}
        memberName={memberName}
        memberKey={memberKey}
        bookingId={prepBookingId}
        classDate={classDate}
        classTime={classTime}
        coachName={coachName}
        leadSource={leadSource}
        isSecondIntro={isSecondIntro}
        phone={phone}
        email={email}
        bookings={defaultBookings}
        runs={runs}
        onGenerateScript={() => { setPrepOpen(false); handleScriptTap(); }}
        onSendQ={handleSendQ}
      />

      <Sheet open={coachPrepOpen} onOpenChange={setCoachPrepOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">Coach View</SheetTitle>
          </SheetHeader>
          <CoachPrepCard memberName={memberName} classTime={classTime} bookingId={prepBookingId} />
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Lead Action Bar ────────────────────────────────────────────────────────

interface LeadActionBarProps {
  leadId: string;
  firstName: string;
  lastName: string;
  phone: string;
  source: string;
  stage: string;
  onOpenDetail: () => void;
  onBookIntro: () => void;
  onMarkContacted?: () => void;
  onMarkAlreadyBooked?: () => void;
}

export function LeadActionBar({
  leadId,
  firstName,
  lastName,
  phone,
  source,
  stage,
  onOpenDetail,
  onBookIntro,
  onMarkContacted,
  onMarkAlreadyBooked,
}: LeadActionBarProps) {
  const { user } = useAuth();
  const [scriptMode, setScriptMode] = useState<ScriptMode>('closed');
  const { data: templates = [] } = useScriptTemplates();

  const smartResult = useMemo(() => {
    if (templates.length === 0) return { template: null, note: null, relevantCategories: [] as string[] };
    return selectBestScript({
      personType: 'lead',
      leadStage: stage,
      leadSource: source,
    }, templates);
  }, [templates, stage, source]);

  const mergeContext = useMemo(() => ({
    'first-name': firstName,
    'last-name': lastName,
    'sa-name': user?.name,
    'location-name': 'Tuscaloosa',
  }), [firstName, lastName, user?.name]);

  const handleCopyPhone = async () => {
    if (phone) {
      await navigator.clipboard.writeText(phone);
      toast.success('Phone number copied!');
    } else {
      toast.info('No phone number on file');
    }
  };

  const handleScriptTap = () => {
    if (smartResult.template) {
      setScriptMode('auto');
    } else {
      if (smartResult.note) toast.info(smartResult.note);
      setScriptMode('picker');
    }
  };

  const preSelectedPerson = {
    type: 'lead' as const,
    id: leadId,
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    stage,
    source,
    detail: `Lead · ${stage} · ${source}`,
  };

  return (
    <>
      <div className="flex items-center gap-1.5 md:gap-1 flex-wrap py-1">
        <ActionButton icon={<MessageSquare className="w-4 h-4 md:w-3.5 md:h-3.5" />} label="Script" onClick={handleScriptTap} />
        <ActionButton icon={<CalendarPlus className="w-4 h-4 md:w-3.5 md:h-3.5" />} label="Book" onClick={onBookIntro} />
        <ActionButton icon={<User className="w-4 h-4 md:w-3.5 md:h-3.5" />} label="Profile" onClick={onOpenDetail} />
        <ActionButton icon={<Copy className="w-4 h-4 md:w-3.5 md:h-3.5" />} label="Copy #" onClick={handleCopyPhone} />
        {stage === 'new' && onMarkContacted && (
          <ActionButton icon={<CheckCircle className="w-3.5 h-3.5" />} label="Contacted" onClick={onMarkContacted} />
        )}
        {(stage === 'new' || stage === 'contacted') && onMarkAlreadyBooked && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px] gap-1 flex-shrink-0 min-w-0 border-warning text-warning hover:bg-warning/10"
            onClick={(e) => {
              e.stopPropagation();
              onMarkAlreadyBooked();
            }}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            Already Booked
          </Button>
        )}
      </div>

      {/* Smart Script → MessageGenerator */}
      {scriptMode === 'auto' && smartResult.template && (
        <MessageGenerator
          open={true}
          onOpenChange={(o) => { if (!o) setScriptMode('closed'); }}
          template={smartResult.template}
          mergeContext={mergeContext}
          leadId={leadId}
          onChangeScript={() => setScriptMode('picker')}
        />
      )}

      {/* Change Script picker */}
      {scriptMode === 'picker' && (
        <ClientSearchScriptPicker
          open={true}
          onOpenChange={(o) => { if (!o) setScriptMode('closed'); }}
          preSelectedPerson={preSelectedPerson}
          relevantCategories={smartResult.relevantCategories}
        />
      )}
    </>
  );
}

// ─── Shared Button ──────────────────────────────────────────────────────────

function ActionButton({ icon, label, onClick, className }: { icon: React.ReactNode; label: string; onClick: () => void; className?: string }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("h-9 md:h-7 px-3 md:px-2 text-[13px] md:text-[11px] gap-1.5 md:gap-1 flex-1 md:flex-initial min-w-[44px] min-h-[44px] md:min-h-0", className)}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {icon}
      <span className="md:inline">{label}</span>
    </Button>
  );
}
