import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Copy, Check, ExternalLink, Loader2, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface BookingWithQ {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  questionnaire_id: string | null;
  q_status: string | null;
}

export default function PastBookingQuestionnaires() {
  const [bookings, setBookings] = useState<BookingWithQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    // Can't do a LEFT JOIN via supabase-js easily, so we fetch both and merge
    const [{ data: bookingsData }, { data: questionnaires }] = await Promise.all([
      supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time')
        .is('deleted_at', null)
        .eq('booking_status', 'Active')
        .order('class_date', { ascending: false }),
      supabase
        .from('intro_questionnaires')
        .select('id, booking_id, status'),
    ]);

    const qMap = new Map<string, { id: string; status: string }>();
    questionnaires?.forEach((q) => {
      if (q.booking_id) qMap.set(q.booking_id, { id: q.id, status: q.status });
    });

    const merged: BookingWithQ[] = (bookingsData || []).map((b) => {
      const q = qMap.get(b.id);
      return {
        id: b.id,
        member_name: b.member_name,
        class_date: b.class_date,
        intro_time: b.intro_time,
        questionnaire_id: q?.id || null,
        q_status: q?.status || null,
      };
    });

    setBookings(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchBookings();
  }, [open, fetchBookings]);

  const generateLink = async (booking: BookingWithQ) => {
    setGeneratingId(booking.id);
    const nameParts = booking.member_name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const newId = crypto.randomUUID();

    const { error } = await supabase.from('intro_questionnaires').insert({
      id: newId,
      booking_id: booking.id,
      client_first_name: firstName,
      client_last_name: lastName,
      scheduled_class_date: booking.class_date,
      scheduled_class_time: booking.intro_time || null,
      status: 'not_sent',
    });

    setGeneratingId(null);
    if (error) {
      console.error('Error creating questionnaire:', error);
      toast.error('Failed to generate link');
      return;
    }

    setBookings((prev) =>
      prev.map((b) =>
        b.id === booking.id ? { ...b, questionnaire_id: newId, q_status: 'not_sent' } : b
      )
    );
    toast.success('Questionnaire link generated!');
  };

  const copyLink = async (booking: BookingWithQ) => {
    if (!booking.questionnaire_id) return;
    const link = `${window.location.origin}/q/${booking.questionnaire_id}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(booking.id);
      setTimeout(() => setCopiedId(null), 2000);
      if (booking.q_status === 'not_sent') {
        await supabase
          .from('intro_questionnaires')
          .update({ status: 'sent' })
          .eq('id', booking.questionnaire_id);
        setBookings((prev) =>
          prev.map((b) =>
            b.id === booking.id ? { ...b, q_status: 'sent' } : b
          )
        );
      }
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const statusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px] px-1.5 py-0">Completed</Badge>;
      case 'sent':
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-[10px] px-1.5 py-0">Sent</Badge>;
      case 'not_sent':
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Not Sent</Badge>;
      default:
        return null;
    }
  };

  const needsLink = bookings.filter((b) => !b.questionnaire_id);
  const hasLink = bookings.filter((b) => b.questionnaire_id);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Pre-Intro Questionnaire Links
              {open ? <ChevronDown className="w-4 h-4 ml-auto" /> : <ChevronRight className="w-4 h-4 ml-auto" />}
              {!open && needsLink.length > 0 && (
                <Badge variant="destructive" className="text-[10px] ml-1">{needsLink.length} need links</Badge>
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No active bookings found.</p>
            ) : (
              <div className="space-y-4">
                {/* Needs Link */}
                {needsLink.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Needs Link ({needsLink.length})
                    </p>
                    <div className="space-y-2">
                      {needsLink.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-md border bg-card text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{b.member_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(b.class_date + 'T00:00:00'), 'MMM d, yyyy')}
                              {b.intro_time && ` · ${b.intro_time}`}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 h-7 text-xs"
                            disabled={generatingId === b.id}
                            onClick={() => generateLink(b)}
                          >
                            {generatingId === b.id ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : null}
                            Generate Link
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Has Link */}
                {hasLink.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Link Generated ({hasLink.length})
                    </p>
                    <div className="space-y-2">
                      {hasLink.map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-md border bg-card text-sm"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{b.member_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(b.class_date + 'T00:00:00'), 'MMM d, yyyy')}
                              {b.intro_time && ` · ${b.intro_time}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {statusBadge(b.q_status)}
                            <a
                              href={`${window.location.origin}/q/${b.questionnaire_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyLink(b)}
                            >
                              {copiedId === b.id ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
