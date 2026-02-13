import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Clock, SkipForward, X, CheckCircle, Send, Layers, Filter, ArrowUpDown } from 'lucide-react';
import { format, differenceInDays, parseISO, addDays } from 'date-fns';
import { toast } from 'sonner';
import { MessageGenerator } from '@/components/scripts/MessageGenerator';
import { useScriptTemplates, ScriptTemplate } from '@/hooks/useScriptTemplates';
import { selectBestScript } from '@/hooks/useSmartScriptSelect';
import { cn } from '@/lib/utils';
import { SectionHelp } from '@/components/dashboard/SectionHelp';
import { CardGuidance, getFollowUpGuidance } from '@/components/dashboard/CardGuidance';
import { LogPastContactDialog } from '@/components/dashboard/LogPastContactDialog';
import { History } from 'lucide-react';

interface FollowUpItem {
  id: string;
  booking_id: string | null;
  lead_id: string | null;
  person_name: string;
  person_type: string;
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
  is_legacy: boolean;
  lead_source?: string | null;
}

interface FollowUpsDueTodayProps {
  onRefresh: () => void;
  onCountChange?: (count: number) => void;
}

export function FollowUpsDueToday({ onRefresh, onCountChange }: FollowUpsDueTodayProps) {
  const { user } = useAuth();
  const { data: templates = [] } = useScriptTemplates();
  const [items, setItems] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scriptItem, setScriptItem] = useState<FollowUpItem | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptTemplate | null>(null);
  const [pastContactItem, setPastContactItem] = useState<FollowUpItem | null>(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchIndex, setBatchIndex] = useState(0);
  const [sortBy, setSortBy] = useState<'date' | 'type'>('date');
  const [filterType, setFilterType] = useState<'all' | 'no_show' | 'didnt_buy'>('all');

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => { fetchQueue(); }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('follow_up_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_date', today)
        .eq('is_vip', false)
        .order('scheduled_date', { ascending: true })
        .limit(30);

      if (error) throw error;

      if (data && data.length > 0) {
        const personNames = [...new Set(data.map(d => d.person_name))];
        const bookingIds = [...new Set(data.map(d => d.booking_id).filter(Boolean))] as string[];
        const sixDaysAgo = format(addDays(new Date(), -6), 'yyyy-MM-dd');
        
        // Fetch lead_source from intros_booked for all booking IDs
        let leadSourceMap = new Map<string, string>();
        if (bookingIds.length > 0) {
          const { data: bookings } = await supabase
            .from('intros_booked')
            .select('id, lead_source')
            .in('id', bookingIds);
          if (bookings) {
            leadSourceMap = new Map(bookings.map(b => [b.id, b.lead_source]));
          }
        }

        // 6-day cooling guardrail
        const { data: recentSent } = await supabase
          .from('follow_up_queue')
          .select('person_name')
          .eq('status', 'sent')
          .gte('sent_at', sixDaysAgo + 'T00:00:00')
          .in('person_name', personNames);

        // Also check script_actions for manual contacts
        const { data: recentActions } = await supabase
          .from('script_actions')
          .select('booking_id')
          .gte('completed_at', sixDaysAgo + 'T00:00:00');

        const recentlySentNames = new Set((recentSent || []).map(r => r.person_name));
        
        // Get booking IDs that had recent actions
        const recentActionBookingIds = new Set(
          (recentActions || []).map(a => a.booking_id).filter(Boolean)
        );
        
        const filtered = data.filter(d => {
          if (recentlySentNames.has(d.person_name)) return false;
          if (d.booking_id && recentActionBookingIds.has(d.booking_id)) return false;
          return true;
        }).map(d => ({
          ...d,
          lead_source: d.booking_id ? leadSourceMap.get(d.booking_id) || null : null,
        }));

        setItems(filtered as FollowUpItem[]);
        onCountChange?.(filtered.length);
      } else {
        setItems([]);
        onCountChange?.(0);
      }
    } catch (err) {
      console.error('FollowUpsDueToday fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let filtered = items;
    if (filterType !== 'all') {
      filtered = filtered.filter(i => i.person_type === filterType);
    }
    if (sortBy === 'type') {
      filtered = [...filtered].sort((a, b) => {
        if (a.person_type !== b.person_type) return a.person_type === 'no_show' ? -1 : 1;
        return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
      });
    }
    return filtered;
  }, [items, filterType, sortBy]);

  const regularItems = useMemo(() => filteredItems.filter(i => !i.is_legacy), [filteredItems]);
  const legacyItems = useMemo(() => filteredItems.filter(i => i.is_legacy), [filteredItems]);
  
  const noShowCount = useMemo(() => items.filter(i => i.person_type === 'no_show').length, [items]);
  const didntBuyCount = useMemo(() => items.filter(i => i.person_type === 'didnt_buy').length, [items]);

  const handleSend = (item: FollowUpItem) => {
    const scriptResult = selectBestScript({
      personType: 'booking',
      classDate: item.trigger_date,
      introResult: item.person_type === 'no_show' ? 'No-show' : "Didn't Buy",
      primaryObjection: item.primary_objection,
    }, templates);

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
      .update({ scheduled_date: newDate, snoozed_until: newDate })
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
    await supabase
      .from('follow_up_queue')
      .update({ status: 'dormant' })
      .eq('person_name', item.person_name)
      .eq('status', 'pending');
    toast.success('Removed from follow-up queue');
    fetchQueue();
    onRefresh();
  };

  const handleStartSequence = async (item: FollowUpItem) => {
    // Convert legacy to active by leaving it pending, just remove the legacy flag
    await supabase
      .from('follow_up_queue')
      .update({ is_legacy: false } as any)
      .eq('person_name', item.person_name)
      .eq('status', 'pending');
    toast.success('Sequence started');
    fetchQueue();
  };

  const handleMarkDone = async (item: FollowUpItem) => {
    await supabase
      .from('follow_up_queue')
      .update({ status: 'converted' })
      .eq('person_name', item.person_name)
      .eq('status', 'pending');
    toast.success('Marked as done');
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

  const getLeadSourceBadgeColor = (source?: string | null) => {
    if (!source) return 'bg-muted text-muted-foreground border-border';
    const s = source.toLowerCase();
    if (s.includes('instagram') || s.includes('ig')) return 'bg-pink-100 text-pink-800 border-pink-200';
    if (s.includes('facebook') || s.includes('fb')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s.includes('referral') || s.includes('friend')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (s.includes('web') || s.includes('website')) return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    if (s.includes('walk')) return 'bg-green-100 text-green-800 border-green-200';
    return 'bg-muted text-muted-foreground border-border';
  };

  // Batch mode
  const handleBatchStart = () => {
    setBatchMode(true);
    setBatchIndex(0);
    if (regularItems.length > 0) handleSend(regularItems[0]);
  };

  const handleBatchNext = () => {
    const nextIdx = batchIndex + 1;
    if (nextIdx < regularItems.length) {
      setBatchIndex(nextIdx);
      handleSend(regularItems[nextIdx]);
    } else {
      setBatchMode(false);
      toast.success('Batch complete!');
    }
  };

  if (loading) return null;
  if (items.length === 0) return null;

  const renderFollowUpCard = (item: FollowUpItem, isLegacy = false) => {
    const daysSinceTrigger = differenceInDays(new Date(), parseISO(item.trigger_date));
    const typeLabel = item.person_type === 'no_show' ? 'No Show' :
      item.person_type === 'didnt_buy' ? "Didn't Buy" : 'Unknown outcome';
    const triggerLabel = `${typeLabel} on ${format(parseISO(item.trigger_date), 'MMM d')}`;
    const typeBadgeColor = item.person_type === 'no_show' 
      ? 'bg-destructive/10 text-destructive border-destructive/20' 
      : 'bg-amber-100 text-amber-800 border-amber-200';
    const guidance = getFollowUpGuidance({
      touchNumber: item.touch_number,
      personType: item.person_type,
      isLegacy,
      leadSource: item.lead_source,
    });

    const leadSourceColor = getLeadSourceBadgeColor(item.lead_source);

    return (
      <div key={item.id} className={cn(
        'rounded-lg border bg-card p-3 space-y-2',
        isLegacy && 'border-muted bg-muted/20'
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-sm">{item.person_name}</span>
              <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border', typeBadgeColor)}>
                {typeLabel}
              </Badge>
              {!isLegacy && (
                <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border', touchColor(item.touch_number))}>
                  Touch {item.touch_number} of 3
                </Badge>
              )}
              {item.lead_source && (
                <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border', leadSourceColor)}>
                  {item.lead_source}
                </Badge>
              )}
              {isLegacy && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground">
                  Legacy
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{triggerLabel}</p>
            {daysSinceTrigger > 0 && (
              <p className="text-[10px] text-muted-foreground/70">
                <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                {daysSinceTrigger}d since intro
              </p>
            )}
          </div>
        </div>

        {isLegacy ? (
          <div className="flex items-center gap-1 flex-wrap">
            <Button size="sm" className="h-7 text-[11px] flex-1 gap-1" onClick={() => handleStartSequence(item)}>
              <Send className="w-3 h-3" />
              Start Sequence
            </Button>
            <Button size="sm" variant="secondary" className="h-7 text-[11px] gap-1" onClick={() => setPastContactItem(item)}>
              <History className="w-3 h-3" />
              Log Past Contact
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => handleMarkDone(item)}>
              <CheckCircle className="w-3 h-3" />
              Done
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 text-muted-foreground" onClick={() => handleRemove(item)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            <Button size="sm" className="h-7 text-[11px] flex-1 gap-1" onClick={() => handleSend(item)}>
              <Send className="w-3 h-3" />
              Send
            </Button>
            <Button size="sm" variant="secondary" className="h-7 text-[11px] gap-1" onClick={() => setPastContactItem(item)}>
              <History className="w-3 h-3" />
              Log Contact
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => handleSnooze(item)}>
              <Clock className="w-3 h-3" />
              Snooze
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => handleSkip(item)}>
              <SkipForward className="w-3 h-3" />
              Skip
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 text-muted-foreground" onClick={() => handleRemove(item)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
        <CardGuidance text={guidance} />
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            Follow-Ups Due
            <SectionHelp text="These people need a follow-up text today. The script is already written for you. Tap Send to review and copy it. If the timing feels off, tap Snooze to push it a couple days. Legacy cards are people from before this system existed who still need outreach." />
            <Badge variant="default" className="ml-1 text-[10px]">{items.length}</Badge>
            {regularItems.length >= 5 && !batchMode && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-6 text-[10px] gap-1"
                onClick={handleBatchStart}
              >
                <Layers className="w-3 h-3" />
                Batch Send
              </Button>
            )}
          </CardTitle>
          {/* Sort & Filter controls */}
          {items.length > 1 && (
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <Button
                variant={filterType === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setFilterType('all')}
              >
                All ({items.length})
              </Button>
              <Button
                variant={filterType === 'no_show' ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setFilterType('no_show')}
              >
                No Show ({noShowCount})
              </Button>
              <Button
                variant={filterType === 'didnt_buy' ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setFilterType('didnt_buy')}
              >
                Didn't Buy ({didntBuyCount})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 ml-auto gap-1"
                onClick={() => setSortBy(sortBy === 'date' ? 'type' : 'date')}
              >
                <ArrowUpDown className="w-3 h-3" />
                {sortBy === 'date' ? 'By Date' : 'By Type'}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {regularItems.map(item => renderFollowUpCard(item, false))}
          
          {legacyItems.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground pt-2 border-t">
                Needs Follow-Up (Legacy) · {legacyItems.length}
              </p>
              {legacyItems.map(item => renderFollowUpCard(item, true))}
            </>
          )}
        </CardContent>
      </Card>

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
            if (batchMode) handleBatchNext();
          }}
        />
      )}
      {pastContactItem && (
        <LogPastContactDialog
          open={true}
          onOpenChange={(o) => { if (!o) setPastContactItem(null); }}
          personName={pastContactItem.person_name}
          bookingId={pastContactItem.booking_id}
          leadId={pastContactItem.lead_id}
          onDone={() => {
            setPastContactItem(null);
            fetchQueue();
            onRefresh();
          }}
        />
      )}
    </>
  );
}
