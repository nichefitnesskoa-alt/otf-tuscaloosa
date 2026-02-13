import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardList, MessageSquare, FileText, Phone, Copy, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { PrepDrawer } from '@/components/dashboard/PrepDrawer';
import { ClientSearchScriptPicker } from '@/components/scripts/ClientSearchScriptPicker';
import { supabase } from '@/integrations/supabase/client';

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
  bookings,
  runs,
}: IntroActionBarProps) {
  const [prepOpen, setPrepOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);

  const prepBookingId = firstBookingId || bookingId;

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

  const handleCopyPhone = async () => {
    if (phone) {
      await navigator.clipboard.writeText(phone);
      toast.success('Phone copied!');
    } else {
      const nameParts = memberName.trim().split(/\s+/);
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ');
      const { data } = await supabase
        .from('leads')
        .select('phone')
        .ilike('first_name', firstName)
        .ilike('last_name', lastName || '')
        .limit(1)
        .maybeSingle();
      if (data?.phone) {
        await navigator.clipboard.writeText(data.phone);
        toast.success('Phone copied!');
      } else {
        toast.info('No phone number on file');
      }
    }
  };

  const handleSendQ = async () => {
    const nameParts = memberName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

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
      const link = `https://otf-tuscaloosa.lovable.app/q/${slug}`;
      await navigator.clipboard.writeText(link);
      if (record.status === 'not_sent') {
        await supabase.from('intro_questionnaires').update({ status: 'sent' }).eq('id', record.id);
      }
      toast.success('Q link copied!');
    } else {
      const { data: byName } = await supabase
        .from('intro_questionnaires')
        .select('id, slug, status' as any)
        .ilike('client_first_name', firstName)
        .ilike('client_last_name', lastName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nameRecord = byName as any;
      if (nameRecord) {
        const slug = nameRecord.slug || nameRecord.id;
        const link = `https://otf-tuscaloosa.lovable.app/q/${slug}`;
        await navigator.clipboard.writeText(link);
        toast.success('Q link copied!');
      } else {
        toast.info('No questionnaire found – create one from the booking form');
      }
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
        <ActionButton icon={<ClipboardList className="w-3.5 h-3.5" />} label="Prep" onClick={() => setPrepOpen(true)} />
        <ActionButton icon={<MessageSquare className="w-3.5 h-3.5" />} label="Script" onClick={() => setScriptOpen(true)} />
        {!isSecondIntro ? (
          <ActionButton icon={<FileText className="w-3.5 h-3.5" />} label="Send Q" onClick={handleSendQ} />
        ) : (
          <ActionButton icon={<Eye className="w-3.5 h-3.5" />} label="View Q" onClick={() => setPrepOpen(true)} />
        )}
        <ActionButton icon={<Phone className="w-3.5 h-3.5" />} label="Phone" onClick={handleCopyPhone} />
      </div>

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
        onGenerateScript={() => { setPrepOpen(false); setScriptOpen(true); }}
        onSendQ={handleSendQ}
      />

      <ClientSearchScriptPicker
        open={scriptOpen}
        onOpenChange={setScriptOpen}
        preSelectedPerson={{
          type: 'booking',
          id: bookingId,
          name: memberName,
          firstName: memberName.split(' ')[0] || '',
          lastName: memberName.split(' ').slice(1).join(' ') || '',
          classDate,
          classTime: classTime || undefined,
          source: leadSource,
          detail: `Booking · ${classDate}${classTime ? ' at ' + classTime : ''} · Active`,
        }}
      />
    </>
  );
}

// ─── Lead Action Bar ────────────────────────────────────────────────────────

import { CalendarPlus, CalendarCheck, CheckCircle, User } from 'lucide-react';

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
  const [scriptOpen, setScriptOpen] = useState(false);

  const handleCopyPhone = async () => {
    if (phone) {
      await navigator.clipboard.writeText(phone);
      toast.success('Phone copied!');
    } else {
      toast.info('No phone number on file');
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
        <ActionButton icon={<MessageSquare className="w-3.5 h-3.5" />} label="Contact" onClick={() => setScriptOpen(true)} />
        <ActionButton icon={<CalendarPlus className="w-3.5 h-3.5" />} label="Book" onClick={onBookIntro} />
        <ActionButton icon={<User className="w-3.5 h-3.5" />} label="Profile" onClick={onOpenDetail} />
        <ActionButton icon={<Phone className="w-3.5 h-3.5" />} label="Phone" onClick={handleCopyPhone} />
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

      <ClientSearchScriptPicker
        open={scriptOpen}
        onOpenChange={setScriptOpen}
        preSelectedPerson={{
          type: 'lead',
          id: leadId,
          name: `${firstName} ${lastName}`,
          firstName,
          lastName,
          stage,
          source,
          detail: `Lead · ${stage} · ${source}`,
        }}
      />
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
