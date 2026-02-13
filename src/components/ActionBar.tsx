import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardList, MessageSquare, Copy, CalendarPlus, CalendarCheck, CheckCircle, User } from 'lucide-react';
import { toast } from 'sonner';
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
  bookings,
  runs,
}: IntroActionBarProps) {
  const { user } = useAuth();
  const [prepOpen, setPrepOpen] = useState(false);
  const [scriptMode, setScriptMode] = useState<ScriptMode>('closed');
  const { data: templates = [] } = useScriptTemplates();

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
      qSlug: questionnaireSlug,
      introResult,
      primaryObjection,
    }, templates);
  }, [templates, classDate, classTime, isSecondIntro, bookingCreatedAt, qCompleted, questionnaireSlug, introResult, primaryObjection]);

  // Build merge context
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
    // Part 8A: Include Q link only if Q not completed and not 2nd intro
    if (!qCompleted && !isSecondIntro && questionnaireSlug) {
      ctx['questionnaire-link'] = `${PUBLISHED_URL}/q/${questionnaireSlug}`;
    }
    return ctx;
  }, [firstName, lastName, user?.name, classDate, classTime, coachName, qCompleted, isSecondIntro, questionnaireSlug]);

  // Part 8A: Strip Q link lines from body when Q is done
  const bodyOverride = useMemo(() => {
    if (!qCompleted || !smartResult.template) return undefined;
    const body = smartResult.template.body;
    if (!body.includes('{questionnaire-link}')) return undefined;
    return body
      .split('\n')
      .filter(line => !line.includes('{questionnaire-link}') && !line.includes('{friend-questionnaire-link}'))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }, [qCompleted, smartResult.template]);

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

  // Keep handleSendQ for PrepDrawer manual override
  const handleSendQ = async () => {
    const nameParts = memberName.trim().split(/\s+/);
    const fn = nameParts[0] || '';
    const ln = nameParts.slice(1).join(' ') || '';

    const { data: existing } = await supabase
      .from('intro_questionnaires')
      .select('id, slug, status' as any)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const record = existing as any;
    if (record) {
      const slug = record.slug || record.id;
      const link = `${PUBLISHED_URL}/q/${slug}`;
      await navigator.clipboard.writeText(link);
      if (record.status === 'not_sent') {
        await supabase.from('intro_questionnaires').update({ status: 'sent' }).eq('id', record.id);
      }
      toast.success('Q link copied!');
    } else {
      const { data: byName } = await supabase
        .from('intro_questionnaires')
        .select('id, slug, status' as any)
        .ilike('client_first_name', fn)
        .ilike('client_last_name', ln)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nameRecord = byName as any;
      if (nameRecord) {
        const slug = nameRecord.slug || nameRecord.id;
        const link = `${PUBLISHED_URL}/q/${slug}`;
        await navigator.clipboard.writeText(link);
        toast.success('Q link copied!');
      } else {
        toast.info('No questionnaire found – create one from the booking form');
      }
    }
  };

  const handleScriptTap = () => {
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
    questionnaireSlug: questionnaireSlug || undefined,
    detail: `Booking · ${classDate}${classTime ? ' at ' + classTime : ''} · Active`,
  };

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
        <ActionButton icon={<ClipboardList className="w-3.5 h-3.5" />} label="Prep" onClick={() => setPrepOpen(true)} />
        <ActionButton icon={<MessageSquare className="w-3.5 h-3.5" />} label="Script" onClick={handleScriptTap} />
        <ActionButton icon={<Copy className="w-3.5 h-3.5" />} label="Copy #" onClick={handleCopyPhone} />
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
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
        <ActionButton icon={<MessageSquare className="w-3.5 h-3.5" />} label="Script" onClick={handleScriptTap} />
        <ActionButton icon={<CalendarPlus className="w-3.5 h-3.5" />} label="Book" onClick={onBookIntro} />
        <ActionButton icon={<User className="w-3.5 h-3.5" />} label="Profile" onClick={onOpenDetail} />
        <ActionButton icon={<Copy className="w-3.5 h-3.5" />} label="Copy #" onClick={handleCopyPhone} />
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

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-2 text-[11px] gap-1 flex-shrink-0 min-w-0"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {icon}
      {label}
    </Button>
  );
}
