import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, ClipboardList, MessageSquare, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { ClientProfileSheet } from '@/components/dashboard/ClientProfileSheet';
import { PrepDrawer } from '@/components/dashboard/PrepDrawer';
import { useNavigate } from 'react-router-dom';

interface ClientActionMenuProps {
  memberName: string;
  memberKey: string;
  bookingId: string;
  classDate: string;
  classTime: string | null;
  coachName: string;
  leadSource: string;
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
  /** If true, use the first booking's ID for intro prep (2nd intro scenario) */
  firstBookingId?: string | null;
  isSecondIntro?: boolean;
  children: React.ReactNode;
}

export function ClientActionMenu({
  memberName,
  memberKey,
  bookingId,
  classDate,
  classTime,
  coachName,
  leadSource,
  phone,
  email,
  bookings,
  runs,
  firstBookingId,
  isSecondIntro = false,
  children,
}: ClientActionMenuProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
  const navigate = useNavigate();

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

  const defaultRuns = runs || [];

  const handleCopyPhone = () => {
    if (phone) {
      navigator.clipboard.writeText(phone);
      toast.success('Phone number copied!');
    } else {
      toast.info('No phone number on file');
    }
  };

  const prepBookingId = firstBookingId || bookingId;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {children}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => setProfileOpen(true)}>
            <User className="w-4 h-4 mr-2" />
            View Client Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPrepOpen(true)}>
            <ClipboardList className="w-4 h-4 mr-2" />
            Intro Prep Card
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/scripts')}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Generate Script
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyPhone}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Phone Number
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClientProfileSheet
        open={profileOpen}
        onOpenChange={setProfileOpen}
        memberName={memberName}
        memberKey={memberKey}
        bookings={defaultBookings}
        runs={defaultRuns}
      />

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
        runs={defaultRuns}
      />
    </>
  );
}
