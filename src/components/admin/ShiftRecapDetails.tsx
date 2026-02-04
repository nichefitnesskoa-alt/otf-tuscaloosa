import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Phone, MessageSquare, Mail, Instagram, Users, DollarSign, Calendar, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface IntroBooked {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  lead_source: string;
  booked_by: string | null;
  intro_owner: string | null;
  booking_status: string | null;
}

interface IntroRun {
  id: string;
  member_name: string;
  run_date: string | null;
  class_time: string;
  lead_source: string | null;
  result: string;
  intro_owner: string | null;
  commission_amount: number | null;
  goal_why_captured: string | null;
  relationship_experience: string | null;
  made_a_friend: boolean | null;
  notes: string | null;
}

interface Sale {
  id: string;
  member_name: string;
  lead_source: string;
  membership_type: string;
  commission_amount: number | null;
}

interface ShiftRecapDetailsProps {
  shiftRecapId: string;
  staffName: string;
  shiftDate: string;
  shiftType: string;
  callsMade: number;
  textsSent: number;
  emailsSent: number;
  dmsSent: number;
  otherInfo?: string | null;
}

export default function ShiftRecapDetails({
  shiftRecapId,
  staffName,
  shiftDate,
  shiftType,
  callsMade,
  textsSent,
  emailsSent,
  dmsSent,
  otherInfo,
}: ShiftRecapDetailsProps) {
  const [introsBooked, setIntrosBooked] = useState<IntroBooked[]>([]);
  const [introsRun, setIntrosRun] = useState<IntroRun[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetails = async () => {
      setIsLoading(true);
      try {
        const [bookingsResult, runsResult, salesResult] = await Promise.all([
          supabase
            .from('intros_booked')
            .select('id, member_name, class_date, intro_time, lead_source, booked_by, intro_owner, booking_status')
            .eq('shift_recap_id', shiftRecapId)
            .order('class_date', { ascending: true }),
          supabase
            .from('intros_run')
            .select('id, member_name, run_date, class_time, lead_source, result, intro_owner, commission_amount, goal_why_captured, relationship_experience, made_a_friend, notes')
            .eq('shift_recap_id', shiftRecapId)
            .order('run_date', { ascending: true }),
          supabase
            .from('sales_outside_intro')
            .select('id, member_name, lead_source, membership_type, commission_amount')
            .eq('shift_recap_id', shiftRecapId)
            .order('created_at', { ascending: true }),
        ]);

        if (bookingsResult.data) setIntrosBooked(bookingsResult.data);
        if (runsResult.data) setIntrosRun(runsResult.data);
        if (salesResult.data) setSales(salesResult.data);
      } catch (error) {
        console.error('Error fetching shift details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [shiftRecapId]);

  const totalCommission = [
    ...introsRun.map(r => r.commission_amount || 0),
    ...sales.map(s => s.commission_amount || 0),
  ].reduce((sum, c) => sum + c, 0);

  const totalContacts = callsMade + textsSent + emailsSent + dmsSent;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">{staffName}</h3>
          <p className="text-sm text-muted-foreground">
            {format(new Date(shiftDate), 'EEEE, MMMM d, yyyy')} • {shiftType}
          </p>
        </div>
        {totalCommission > 0 && (
          <Badge variant="default" className="text-sm">
            ${totalCommission.toFixed(2)} commission
          </Badge>
        )}
      </div>

      <Separator />

      {/* Outreach Metrics */}
      <div>
        <h4 className="font-medium text-sm mb-2">Outreach ({totalContacts} total)</h4>
        <div className="grid grid-cols-4 gap-2">
          <div className="flex items-center gap-1.5 text-sm">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{callsMade} calls</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{textsSent} texts</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Instagram className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{dmsSent} DMs</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{emailsSent} emails</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Intros Booked */}
      <div>
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Intros Booked ({introsBooked.length})
        </h4>
        {introsBooked.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No intros booked this shift</p>
        ) : (
          <div className="space-y-2">
            {introsBooked.map((booking) => (
              <div key={booking.id} className="p-2 bg-muted/50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{booking.member_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(booking.class_date), 'MMM d, yyyy')}
                      {booking.intro_time && ` at ${booking.intro_time}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {booking.lead_source}
                  </Badge>
                </div>
                {(booking.booked_by || booking.intro_owner) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {booking.booked_by && <span>Booked by: {booking.booked_by}</span>}
                    {booking.booked_by && booking.intro_owner && <span> • </span>}
                    {booking.intro_owner && <span>Owner: {booking.intro_owner}</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Intros Run */}
      <div>
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Users className="w-4 h-4" />
          Intros Run ({introsRun.length})
        </h4>
        {introsRun.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No intros run this shift</p>
        ) : (
          <div className="space-y-2">
            {introsRun.map((run) => (
              <div key={run.id} className="p-2 bg-muted/50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{run.member_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {run.run_date && format(new Date(run.run_date), 'MMM d, yyyy')} at {run.class_time}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={run.result.toLowerCase().includes('premier') || run.result.toLowerCase().includes('elite') || run.result.toLowerCase().includes('basic') ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {run.result}
                    </Badge>
                    {(run.commission_amount ?? 0) > 0 && (
                      <Badge variant="outline" className="text-xs text-success">
                        ${run.commission_amount?.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                </div>
                {run.intro_owner && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Intro Owner: {run.intro_owner}
                  </p>
                )}
                {/* Lead Measures */}
                <div className="flex flex-wrap gap-1 mt-1">
                  {run.goal_why_captured && (
                    <Badge variant="outline" className="text-xs">
                      Goal: {run.goal_why_captured}
                    </Badge>
                  )}
                  {run.relationship_experience && (
                    <Badge variant="outline" className="text-xs">
                      Relationship: {run.relationship_experience}
                    </Badge>
                  )}
                  {run.made_a_friend && (
                    <Badge variant="outline" className="text-xs bg-success/10 text-success">
                      Made a friend ✓
                    </Badge>
                  )}
                </div>
                {run.notes && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    "{run.notes}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Sales Outside Intro */}
      <div>
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Sales Outside Intro ({sales.length})
        </h4>
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No sales outside intro this shift</p>
        ) : (
          <div className="space-y-2">
            {sales.map((sale) => (
              <div key={sale.id} className="p-2 bg-muted/50 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-sm">{sale.member_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {sale.membership_type} • {sale.lead_source}
                    </p>
                  </div>
                  {(sale.commission_amount ?? 0) > 0 && (
                    <Badge variant="outline" className="text-xs text-success">
                      ${sale.commission_amount?.toFixed(2)}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {otherInfo && (
        <>
          <Separator />
          <div>
            <h4 className="font-medium text-sm mb-2">Notes</h4>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{otherInfo}</p>
          </div>
        </>
      )}
    </div>
  );
}
