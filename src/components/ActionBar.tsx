import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ClipboardList, MessageSquare, FileText, User, Phone, Copy, CalendarPlus, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { ClientProfileSheet } from '@/components/dashboard/ClientProfileSheet';
import { IntroPrepCard } from '@/components/dashboard/IntroPrepCard';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface ActionBarButton {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  hidden?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
}

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
  bookings,
  runs,
}: IntroActionBarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  const navigate = useNavigate();

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
      // Try to find phone from leads table
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
    // Generate questionnaire link and copy
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
      // Try by name
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
        <ActionButton icon={<MessageSquare className="w-3.5 h-3.5" />} label="Script" onClick={() => navigate('/scripts')} />
        {!isSecondIntro ? (
          <ActionButton icon={<FileText className="w-3.5 h-3.5" />} label="Send Q" onClick={handleSendQ} />
        ) : (
          <ActionButton icon={<Eye className="w-3.5 h-3.5" />} label="View Q" onClick={() => setPrepOpen(true)} />
        )}
        <ActionButton icon={<User className="w-3.5 h-3.5" />} label="Profile" onClick={() => setProfileOpen(true)} />
        <ActionButton icon={<Phone className="w-3.5 h-3.5" />} label="Phone" onClick={handleCopyPhone} />
      </div>

      <ClientProfileSheet
        open={profileOpen}
        onOpenChange={setProfileOpen}
        memberName={memberName}
        memberKey={memberKey}
        bookings={defaultBookings}
        runs={runs || []}
      />

      <IntroPrepCard
        open={prepOpen}
        onOpenChange={setPrepOpen}
        memberName={memberName}
        classDate={classDate}
        classTime={classTime}
        coachName={coachName}
        bookingId={prepBookingId}
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
}: LeadActionBarProps) {
  const navigate = useNavigate();

  const handleCopyPhone = async () => {
    if (phone) {
      await navigator.clipboard.writeText(phone);
      toast.success('Phone copied!');
    } else {
      toast.info('No phone number on file');
    }
  };

  const handleContact = () => {
    navigate('/scripts');
  };

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide py-1">
      <ActionButton icon={<MessageSquare className="w-3.5 h-3.5" />} label="Contact" onClick={handleContact} />
      <ActionButton icon={<CalendarPlus className="w-3.5 h-3.5" />} label="Book" onClick={onBookIntro} />
      <ActionButton icon={<User className="w-3.5 h-3.5" />} label="Profile" onClick={onOpenDetail} />
      <ActionButton icon={<Phone className="w-3.5 h-3.5" />} label="Phone" onClick={handleCopyPhone} />
      {stage === 'new' && onMarkContacted && (
        <ActionButton icon={<CheckCircle className="w-3.5 h-3.5" />} label="Contacted" onClick={onMarkContacted} />
      )}
    </div>
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
