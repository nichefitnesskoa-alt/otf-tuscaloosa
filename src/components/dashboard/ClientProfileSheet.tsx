import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { capitalizeName, parseLocalDate } from '@/lib/utils';
import { isMembershipSale } from '@/lib/sales-detection';
import { User, Calendar, Target, ClipboardList, DollarSign, Heart } from 'lucide-react';

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

interface ClientProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  memberKey: string;
  bookings: Array<{
    id: string;
    class_date: string;
    intro_time: string | null;
    coach_name: string;
    lead_source: string;
    booking_status: string | null;
    booked_by: string | null;
    fitness_goal: string | null;
  }>;
  runs: Array<{
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

export function ClientProfileSheet({ open, onOpenChange, memberName, memberKey, bookings, runs }: ClientProfileSheetProps) {
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || bookings.length === 0) return;
    setLoading(true);
    // Try to find questionnaire by any booking_id
    const bookingIds = bookings.map(b => b.id);
    supabase
      .from('intro_questionnaires')
      .select('q1_fitness_goal, q2_fitness_level, q3_obstacle, q4_past_experience, q5_emotional_driver, q6_weekly_commitment, q6b_available_days, q7_coach_notes, status' as any)
      .in('booking_id', bookingIds)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setQuestionnaire(data as unknown as QuestionnaireData | null);
        setLoading(false);
      });
  }, [open, bookings]);

  const hasSale = runs.some(r => isMembershipSale(r.result));
  const totalCommission = runs.reduce((sum, r) => sum + (r.commission_amount || 0), 0);

  const formatDate = (dateStr: string) =>
    parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0">
        <SheetHeader className="p-4 pb-2 border-b">
          <SheetTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {memberName}
          </SheetTitle>
          <SheetDescription className="flex gap-2 flex-wrap">
            {hasSale && <Badge className="bg-success text-success-foreground">Purchased</Badge>}
            {totalCommission > 0 && (
              <Badge variant="outline" className="text-success">
                <DollarSign className="w-3 h-3 mr-0.5" />${totalCommission.toFixed(0)}
              </Badge>
            )}
            <Badge variant="secondary">{bookings.length} booking{bookings.length !== 1 ? 's' : ''}</Badge>
            <Badge variant="secondary">{runs.length} run{runs.length !== 1 ? 's' : ''}</Badge>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-4 space-y-4">
            {/* Questionnaire Summary */}
            {questionnaire && questionnaire.status === 'completed' && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-primary" />
                  Questionnaire Responses
                </h3>
                <div className="rounded-lg p-3 text-xs space-y-1.5 border-l-4 border-l-primary bg-primary/5">
                  <ProfileRow label="Goal" value={questionnaire.q1_fitness_goal} />
                  <ProfileRow label="Fitness Level" value={questionnaire.q2_fitness_level ? `${questionnaire.q2_fitness_level}/5` : null} />
                  <ProfileRow label="Obstacle" value={questionnaire.q3_obstacle} />
                  <ProfileRow label="Past Experience" value={questionnaire.q4_past_experience} />
                  <ProfileRow label="Emotional Why" value={questionnaire.q5_emotional_driver} />
                  <ProfileRow label="Weekly Commitment" value={questionnaire.q6_weekly_commitment} />
                  <ProfileRow label="Available Days" value={questionnaire.q6b_available_days} />
                  {questionnaire.q7_coach_notes && (
                    <ProfileRow label="Coach Notes" value={questionnaire.q7_coach_notes} />
                  )}
                </div>
              </div>
            )}

            {questionnaire && questionnaire.status !== 'completed' && (
              <div className="text-xs text-muted-foreground italic flex items-center gap-1">
                <ClipboardList className="w-3 h-3" />
                Questionnaire {questionnaire.status === 'sent' ? 'sent but not completed' : 'not yet sent'}
              </div>
            )}

            {!questionnaire && !loading && (
              <div className="text-xs text-muted-foreground italic">No questionnaire on file</div>
            )}

            {/* Bookings */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                Bookings
              </h3>
              {bookings.map(b => (
                <div key={b.id} className="text-xs p-2 rounded border bg-muted/30 space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium">{formatDate(b.class_date)}{b.intro_time ? ` @ ${b.intro_time.substring(0, 5)}` : ''}</span>
                    <Badge variant="outline" className="text-[10px]">{b.booking_status || 'Active'}</Badge>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap gap-x-3">
                    {b.coach_name && <span>Coach: {b.coach_name}</span>}
                    {b.booked_by && <span>By: {capitalizeName(b.booked_by)}</span>}
                    <span>{b.lead_source}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Runs */}
            {runs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-primary" />
                  Intro Runs
                </h3>
                {runs.map(r => (
                  <div key={r.id} className="text-xs p-2 rounded border bg-muted/30 space-y-1">
                    <div className="flex justify-between">
                      <span className="font-medium">{r.run_date ? formatDate(r.run_date) : 'No date'}</span>
                      <Badge
                        variant={isMembershipSale(r.result) ? 'default' : 'outline'}
                        className={isMembershipSale(r.result) ? 'bg-success text-success-foreground text-[10px]' : 'text-[10px]'}
                      >
                        {r.result}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground flex flex-wrap gap-x-3">
                      {r.ran_by && <span>Ran by: {capitalizeName(r.ran_by)}</span>}
                      {r.commission_amount && r.commission_amount > 0 && (
                        <span className="text-success">${r.commission_amount.toFixed(2)}</span>
                      )}
                    </div>
                    {r.notes && <div className="italic text-muted-foreground">{r.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function ProfileRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <span className="font-bold text-muted-foreground w-28 shrink-0">{label.toUpperCase()}:</span>
      <span>{value || '—'}</span>
    </div>
  );
}
