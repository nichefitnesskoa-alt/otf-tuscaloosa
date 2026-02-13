import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { capitalizeName, parseLocalDate } from '@/lib/utils';
import { isMembershipSale } from '@/lib/sales-detection';
import {
  User, Calendar, Target, ClipboardList, DollarSign, Phone, Mail,
  MessageSquare, FileText, Copy, History,
} from 'lucide-react';
import { toast } from 'sonner';
import { EirmaPlaybook } from './EirmaPlaybook';
import { IntroTypeBadge, LeadSourceTag } from './IntroTypeBadge';

interface QuestionnaireData {
  q1_fitness_goal: string | null;
  q2_fitness_level: number | null;
  q3_obstacle: string | null;
  q4_past_experience: string | null;
  q5_emotional_driver: string | null;
  q6_weekly_commitment: string | null;
  q6b_available_days: string | null;
  q7_coach_notes: string | null;
  status: string;
}

interface SendLogEntry {
  id: string;
  sent_at: string;
  sent_by: string;
  message_body_sent: string;
  template_name?: string;
}

interface PrepDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  memberKey: string;
  bookingId: string;
  classDate: string;
  classTime: string | null;
  coachName: string;
  leadSource: string;
  isSecondIntro: boolean;
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
  onGenerateScript?: () => void;
  onSendQ?: () => void;
}

export function PrepDrawer({
  open, onOpenChange, memberName, memberKey, bookingId, classDate, classTime,
  coachName, leadSource, isSecondIntro, phone, email, bookings, runs,
  onGenerateScript, onSendQ,
}: PrepDrawerProps) {
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [sendLogs, setSendLogs] = useState<SendLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    const bookingIds = defaultBookings.map(b => b.id);

    // Fetch questionnaire + send logs in parallel
    Promise.all([
      supabase
        .from('intro_questionnaires')
        .select('q1_fitness_goal, q2_fitness_level, q3_obstacle, q4_past_experience, q5_emotional_driver, q6_weekly_commitment, q6b_available_days, q7_coach_notes, status' as any)
        .in('booking_id', bookingIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('script_send_log')
        .select('id, sent_at, sent_by, message_body_sent')
        .in('booking_id', bookingIds)
        .order('sent_at', { ascending: false })
        .limit(20),
    ]).then(([qRes, logRes]) => {
      setQuestionnaire(qRes.data as unknown as QuestionnaireData | null);
      setSendLogs((logRes.data || []) as SendLogEntry[]);
      setLoading(false);
    });
  }, [open, bookingId]);

  const hasSale = defaultRuns.some(r => isMembershipSale(r.result));
  const totalCommission = defaultRuns.reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  const formatDate = (dateStr: string) =>
    parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const handleCopyPhone = () => {
    if (phone) {
      navigator.clipboard.writeText(phone);
      toast.success('Phone copied!');
    } else {
      toast.info('No phone number on file');
    }
  };

  const handleCallPhone = () => {
    if (phone) window.open(`tel:${phone}`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 pb-3 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5" />
            {memberName}
          </SheetTitle>
          <SheetDescription className="sr-only">Client preparation details</SheetDescription>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <IntroTypeBadge isSecondIntro={isSecondIntro} />
            <LeadSourceTag source={leadSource} />
            {hasSale && <Badge className="bg-success text-success-foreground text-[10px]">Purchased</Badge>}
            {totalCommission > 0 && (
              <Badge variant="outline" className="text-success text-[10px]">
                <DollarSign className="w-3 h-3 mr-0.5" />${totalCommission.toFixed(0)}
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-4 space-y-4">
            {/* Section 1: Quick Info */}
            <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1.5">
              <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Date" value={`${classDate}${classTime ? ` @ ${classTime.substring(0, 5)}` : ''}`} />
              <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Coach" value={coachName} />
              <InfoRow icon={<Target className="w-3.5 h-3.5" />} label="Source" value={leadSource} />
              {phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground text-xs w-16">Phone</span>
                  <button onClick={handleCallPhone} className="text-primary underline text-xs font-medium">{phone}</button>
                </div>
              )}
              {email && (
                <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={email} />
              )}
            </div>

            {/* Section 2: Full Questionnaire Responses */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide text-muted-foreground">
                <ClipboardList className="w-3.5 h-3.5 text-primary" />
                Questionnaire Responses
              </h3>
              {loading ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : questionnaire?.status === 'completed' ? (
                <div className="rounded-lg p-3 text-xs space-y-2 border-l-4 border-l-primary bg-primary/5">
                  <QRow label="What is your fitness goal?" value={questionnaire.q1_fitness_goal} />
                  <QRow label="Current fitness level (1-5)" value={questionnaire.q2_fitness_level ? `${questionnaire.q2_fitness_level}/5` : null} />
                  <QRow label="Biggest obstacle?" value={questionnaire.q3_obstacle} />
                  <QRow label="What have you tried before?" value={questionnaire.q4_past_experience} />
                  <QRow label="What would reaching your goal mean to you?" value={questionnaire.q5_emotional_driver} />
                  <QRow label="Days per week you can commit?" value={questionnaire.q6_weekly_commitment} />
                  <QRow label="Which days work best?" value={questionnaire.q6b_available_days} />
                  {questionnaire.q7_coach_notes && (
                    <QRow label="Coach notes" value={questionnaire.q7_coach_notes} />
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic flex items-center gap-2 p-2 rounded border">
                  <ClipboardList className="w-3.5 h-3.5" />
                  {questionnaire ? `Questionnaire ${questionnaire.status === 'sent' ? 'sent but not completed' : 'not yet sent'}` : 'No questionnaire on file'}
                  {onSendQ && (!questionnaire || questionnaire.status === 'not_sent') && (
                    <Button variant="outline" size="sm" className="h-6 text-[10px] ml-auto" onClick={onSendQ}>
                      Send Q
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Section 3: EIRMA Objection Playbook */}
            {questionnaire?.status === 'completed' && (
              <EirmaPlaybook
                obstacles={questionnaire.q3_obstacle}
                fitnessLevel={questionnaire.q2_fitness_level}
                emotionalDriver={questionnaire.q5_emotional_driver}
                clientName={memberName}
                fitnessGoal={questionnaire.q1_fitness_goal}
                pastExperience={questionnaire.q4_past_experience}
              />
            )}

            {/* Section 4: Activity Timeline */}
            {(sendLogs.length > 0 || defaultRuns.length > 0 || defaultBookings.length > 1) && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold flex items-center gap-1.5 uppercase tracking-wide text-muted-foreground">
                  <History className="w-3.5 h-3.5 text-primary" />
                  Activity Timeline
                </h3>
                <div className="space-y-1.5">
                  {/* Bookings */}
                  {defaultBookings.map(b => (
                    <TimelineItem
                      key={b.id}
                      icon={<Calendar className="w-3 h-3" />}
                      label={`Booked: ${formatDate(b.class_date)}${b.intro_time ? ` @ ${b.intro_time.substring(0, 5)}` : ''}`}
                      detail={`${b.coach_name} · ${b.booking_status || 'Active'}${b.booked_by ? ` · By ${capitalizeName(b.booked_by)}` : ''}`}
                    />
                  ))}
                  {/* Runs */}
                  {defaultRuns.map(r => (
                    <TimelineItem
                      key={r.id}
                      icon={<Target className="w-3 h-3" />}
                      label={`Ran: ${r.run_date ? formatDate(r.run_date) : 'No date'} → ${r.result}`}
                      detail={r.notes || undefined}
                      highlight={isMembershipSale(r.result)}
                    />
                  ))}
                  {/* Scripts sent */}
                  {sendLogs.map(l => (
                    <TimelineItem
                      key={l.id}
                      icon={<MessageSquare className="w-3 h-3" />}
                      label={`Script sent by ${capitalizeName(l.sent_by)}`}
                      detail={new Date(l.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Section 5: Action Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              {onGenerateScript && (
                <Button variant="default" size="sm" className="text-xs" onClick={onGenerateScript}>
                  <MessageSquare className="w-3.5 h-3.5 mr-1" /> Generate Script
                </Button>
              )}
              {onSendQ && !isSecondIntro && (
                <Button variant="outline" size="sm" className="text-xs" onClick={onSendQ}>
                  <FileText className="w-3.5 h-3.5 mr-1" /> Send Q
                </Button>
              )}
              <Button variant="outline" size="sm" className="text-xs" onClick={handleCopyPhone}>
                <Copy className="w-3.5 h-3.5 mr-1" /> Copy Phone
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground w-16">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function QRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value || '—'}</p>
    </div>
  );
}

function TimelineItem({ icon, label, detail, highlight }: { icon: React.ReactNode; label: string; detail?: string; highlight?: boolean }) {
  return (
    <div className={`flex items-start gap-2 text-xs p-1.5 rounded ${highlight ? 'bg-success/10' : ''}`}>
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div>
        <p className={`font-medium ${highlight ? 'text-success' : ''}`}>{label}</p>
        {detail && <p className="text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}
