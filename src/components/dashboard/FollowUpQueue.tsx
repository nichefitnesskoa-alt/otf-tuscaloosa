import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Clock, SkipForward, X, CheckCircle, Send, Loader2 } from 'lucide-react';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';
import { toast } from 'sonner';
import { MessageGenerator } from '@/components/scripts/MessageGenerator';
import { useScriptTemplates, ScriptTemplate } from '@/hooks/useScriptTemplates';
import { selectBestScript } from '@/hooks/useSmartScriptSelect';
import { cn } from '@/lib/utils';

interface FollowUpItem {
  id: string;
  booking_id: string | null;
  lead_id: string | null;
  person_name: string;
  person_type: 'no_show' | 'didnt_buy';
  trigger_date: string;
  touch_number: number;
  scheduled_date: string;
  status: string;
  sent_by: string | null;
  sent_at: string | null;
  snoozed_until: string | null;
  is_vip: boolean;
  primary_objection: string | null;
  fitness_goal: string | null;
}

// Cadence definitions
const NO_SHOW_CADENCE = [0, 5, 12]; // days after trigger
const DIDNT_BUY_CADENCE = [0, 6, 13];

export function generateFollowUpEntries(
  personName: string,
  personType: 'no_show' | 'didnt_buy',
  triggerDate: string,
  bookingId: string | null,
  leadId: string | null,
  isVip: boolean,
  primaryObjection?: string | null,
  fitnessGoal?: string | null,
) {
  const cadence = personType === 'no_show' ? NO_SHOW_CADENCE : DIDNT_BUY_CADENCE;
  const trigger = parseISO(triggerDate);
  
  return cadence.map((dayOffset, i) => ({
    booking_id: bookingId,
    lead_id: leadId,
    person_name: personName,
    person_type: personType,
    trigger_date: triggerDate,
    touch_number: i + 1,
    scheduled_date: format(addDays(trigger, dayOffset), 'yyyy-MM-dd'),
    status: 'pending',
    is_vip: isVip,
    primary_objection: primaryObjection || null,
    fitness_goal: fitnessGoal || null,
  }));
}

interface FollowUpQueueProps {
  onRefresh: () => void;
}

export function FollowUpQueue({ onRefresh }: FollowUpQueueProps) {
  const { user } = useAuth();
  const { data: templates = [] } = useScriptTemplates();
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scriptItem, setScriptItem] = useState<FollowUpItem | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptTemplate | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('follow_up_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_date', today)
        .eq('is_vip', false) // Part 7: VIP exclusion
        .order('scheduled_date', { ascending: true })
        .limit(20);

      if (error) throw error;

      // 6-day cooling guardrail: filter out people who had a follow-up sent within last 6 days
      if (data && data.length > 0) {
        const personNames = [...new Set(data.map(d => d.person_name))];
        const sixDaysAgo = format(addDays(new Date(), -6), 'yyyy-MM-dd');
        
        const { data: recentSent } = await supabase
          .from('follow_up_queue')
          .select('person_name')
          .eq('status', 'sent')
          .gte('sent_at', sixDaysAgo + 'T00:00:00')
          .in('person_name', personNames);

        const recentlySentNames = new Set((recentSent || []).map(r => r.person_name));
        const filtered = data.filter(d => !recentlySentNames.has(d.person_name));
        setItems(filtered as FollowUpItem[]);
      } else {
        setItems([]);
      }
    } catch (err) {
      console.error('FollowUpQueue fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (item: FollowUpItem) => {
    // Find the right script for this touch
    const scriptResult = selectBestScript({
      personType: 'booking',
      classDate: item.trigger_date,
      introResult: item.person_type === 'no_show' ? 'No-show' : "Didn't Buy",
      primaryObjection: item.primary_objection,
    }, templates);

    // Try to find the right sequence step
    let template = scriptResult.template;
    if (template && item.touch_number > 1) {
      const category = item.person_type === 'no_show' ? 'no_show' : 'post_class_no_close';
      const stepTemplate = templates.find(t =>
        t.category === category &&
        t.is_active &&
        (t.sequence_order || 1) === item.touch_number
      );
      if (stepTemplate) template = stepTemplate;
    }

    if (template) {
      setSelectedTemplate(template);
      setScriptItem(item);
    } else {
      toast.info('No matching script template found');
    }
  };

  const handleMarkSent = async (item: FollowUpItem) => {
    await supabase
      .from('follow_up_queue')
      .update({
        status: 'sent',
        sent_by: user?.name || 'Unknown',
        sent_at: new Date().toISOString(),
      })
      .eq('id', item.id);
    
    toast.success('Follow-up marked as sent');
    fetchQueue();
    onRefresh();
  };

  const handleSnooze = async (item: FollowUpItem) => {
    const newDate = format(addDays(new Date(), 2), 'yyyy-MM-dd');
    await supabase
      .from('follow_up_queue')
      .update({
        scheduled_date: newDate,
        snoozed_until: newDate,
      })
      .eq('id', item.id);

    toast.success('Snoozed for 2 days');
    fetchQueue();
  };

  const handleSkip = async (item: FollowUpItem) => {
    await supabase
      .from('follow_up_queue')
      .update({ status: 'skipped' })
      .eq('id', item.id);

    toast.success('Touch skipped');
    fetchQueue();
  };

  const handleRemove = async (item: FollowUpItem) => {
    // Mark all remaining touches for this person as dormant
    await supabase
      .from('follow_up_queue')
      .update({ status: 'dormant' })
      .eq('person_name', item.person_name)
      .eq('status', 'pending');

    toast.success('Removed from follow-up queue');
    fetchQueue();
    onRefresh();
  };

  const mergeContext = useMemo(() => {
    if (!scriptItem) return {};
    const firstName = scriptItem.person_name.split(' ')[0] || '';
    return {
      'first-name': firstName,
      'last-name': scriptItem.person_name.split(' ').slice(1).join(' ') || '',
      'sa-name': user?.name,
      'location-name': 'Tuscaloosa',
    };
  }, [scriptItem, user?.name]);

  const touchColor = (touch: number) => {
    if (touch === 1) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (touch === 2) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-orange-100 text-orange-800 border-orange-200';
  };

  const maxTouches = (type: string) => type === 'no_show' ? 3 : 3;

  if (loading) return null;
  if (items.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Follow-Ups Due
            <Badge variant="default" className="ml-1 text-[10px]">{items.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map(item => {
            const daysSinceTrigger = differenceInDays(new Date(), parseISO(item.trigger_date));
            const typeLabel = item.person_type === 'no_show' ? 'No Show' : "Didn't Buy";
            const triggerLabel = `${typeLabel} on ${format(parseISO(item.trigger_date), 'MMM d')}`;

            // Check if already sent today by someone else
            const alreadySent = item.sent_by && item.sent_at;

            return (
              <div key={item.id} className="rounded-lg border bg-card p-3 space-y-2">
                {/* Row 1: Full name */}
                <p className="font-semibold text-[17px] md:text-sm whitespace-normal break-words leading-tight">{item.person_name}</p>
                {/* Row 2: Type badge + source + date */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border', touchColor(item.touch_number))}>
                    Touch {item.touch_number} of {maxTouches(item.person_type)}
                  </Badge>
                  <span className="text-[13px] md:text-xs text-muted-foreground">{triggerLabel}</span>
                  {daysSinceTrigger > 0 && (
                    <span className="text-[11px] md:text-[10px] text-muted-foreground/70">
                      <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                      {daysSinceTrigger}d ago
                    </span>
                  )}
                </div>

                {alreadySent ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1">
                    <CheckCircle className="w-3 h-3" />
                    Sent by {item.sent_by} at {item.sent_at ? format(new Date(item.sent_at), 'h:mm a') : ''}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 md:gap-1">
                    <Button
                      size="sm"
                      className="h-9 md:h-7 text-[13px] md:text-[11px] flex-1 gap-1 min-h-[44px] md:min-h-0"
                      onClick={() => handleSend(item)}
                    >
                      <Send className="w-3.5 h-3.5 md:w-3 md:h-3" />
                      Send
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 md:h-7 text-[13px] md:text-[11px] gap-1 flex-1 md:flex-initial min-h-[44px] md:min-h-0"
                      onClick={() => handleSnooze(item)}
                    >
                      <Clock className="w-3.5 h-3.5 md:w-3 md:h-3" />
                      Snooze
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 md:h-7 text-[13px] md:text-[11px] gap-1 flex-1 md:flex-initial min-h-[44px] md:min-h-0"
                      onClick={() => handleSkip(item)}
                    >
                      <SkipForward className="w-3.5 h-3.5 md:w-3 md:h-3" />
                      Skip
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 md:h-7 text-[13px] md:text-[11px] gap-1 text-muted-foreground min-h-[44px] md:min-h-0"
                      onClick={() => handleRemove(item)}
                    >
                      <X className="w-3.5 h-3.5 md:w-3 md:h-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Script generator for follow-up sends */}
      {scriptItem && selectedTemplate && (
        <MessageGenerator
          open={true}
          onOpenChange={(o) => {
            if (!o) {
              setScriptItem(null);
              setSelectedTemplate(null);
            }
          }}
          template={selectedTemplate}
          mergeContext={mergeContext}
          bookingId={scriptItem.booking_id || undefined}
          onLogged={() => {
            handleMarkSent(scriptItem);
            setScriptItem(null);
            setSelectedTemplate(null);
          }}
        />
      )}
    </>
  );
}
