/**
 * Win the Day — Dynamic Shift Checklist
 * Sits between the floating header and the tab system on MyDay.
 * Circles are tappable: direct-complete for SA-controlled tasks,
 * reflection bottom sheet for influenced tasks.
 */
import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Trophy, Check, Circle, ChevronDown, ChevronUp, Flame, Copy, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useWinTheDayItems, ChecklistItem } from './useWinTheDayItems';

interface WinTheDayProps {
  onSwitchTab?: (tab: string) => void;
}

type ReflectionTarget = {
  item: ChecklistItem;
} | null;

// Reflection types
type ReflectionType = 'q_send' | 'q_resend' | 'confirm_tomorrow' | 'followups_due' | 'leads_overdue' | 'cold_texts' | 'cold_dms';

const INFLUENCED_TYPES: ReflectionType[] = ['q_send', 'q_resend', 'confirm_tomorrow', 'followups_due', 'leads_overdue', 'cold_texts', 'cold_dms'];
const DIRECT_COMPLETE_TYPES = ['prep_roleplay', 'log_ig', 'shift_recap'];

function isInfluencedType(type: string): type is ReflectionType {
  return INFLUENCED_TYPES.includes(type as ReflectionType);
}

export function WinTheDay({ onSwitchTab }: WinTheDayProps) {
  const { user } = useAuth();
  const { items, isLoading, completedCount, totalCount, allComplete, progressPct, refresh } = useWinTheDayItems();
  const [isOpen, setIsOpen] = useState(true);
  const [reflectionTarget, setReflectionTarget] = useState<ReflectionTarget>(null);
  const [followupContacted, setFollowupContacted] = useState(0);
  const [followupResponded, setFollowupResponded] = useState(0);
  const [outreachCount, setOutreachCount] = useState(0);

  const effectiveOpen = allComplete ? isOpen : true;
  const userName = user?.name || '';

  // Direct complete for SA-controlled tasks
  const handleDirectComplete = useCallback(async (item: ChecklistItem) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    switch (item.type) {
      case 'prep_roleplay': {
        if (item.targetId) {
          await supabase.from('intros_booked').update({
            prepped: true,
            prepped_at: new Date().toISOString(),
            prepped_by: userName,
          }).eq('id', item.targetId);
          toast.success(`Prepped ${item.memberName}`);
        }
        break;
      }
      case 'log_ig': {
        onSwitchTab?.('igdm');
        break;
      }
      case 'shift_recap': {
        const fab = document.querySelector('[data-end-shift-trigger]') as HTMLElement;
        if (fab) fab.click();
        break;
      }
    }
    refresh();
  }, [userName, refresh, onSwitchTab]);

  // Handle circle tap
  const handleCircleTap = useCallback((item: ChecklistItem) => {
    if (item.completed) return;
    if (DIRECT_COMPLETE_TYPES.includes(item.type)) {
      handleDirectComplete(item);
    } else if (isInfluencedType(item.type)) {
      if (item.type === 'followups_due') {
        setFollowupContacted(0);
        setFollowupResponded(0);
      }
      if (item.type === 'cold_texts' || item.type === 'cold_dms') {
        setOutreachCount(0);
      }
      setReflectionTarget({ item });
    }
  }, [handleDirectComplete]);

  // Handle action button tap — performs the specific action described by the label
  const handleAction = useCallback(async (item: ChecklistItem) => {
    switch (item.type) {
      case 'q_send':
      case 'q_resend': {
        if (item.questionnaireLink) {
          await navigator.clipboard.writeText(item.questionnaireLink);
          toast.success(`Q link copied for ${item.memberName}`);
        } else {
          toast.error('No questionnaire link available');
        }
        // Also navigate to the card
        onSwitchTab?.('today');
        if (item.targetId) {
          setTimeout(() => {
            const el = document.getElementById(`intro-card-${item.targetId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        }
        break;
      }
      case 'prep_roleplay': {
        // Navigate to today tab and scroll to card, then trigger prep
        onSwitchTab?.('today');
        if (item.targetId) {
          setTimeout(() => {
            const el = document.getElementById(`intro-card-${item.targetId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            window.dispatchEvent(new CustomEvent('myday:open-prep', { detail: { bookingId: item.targetId } }));
          }, 300);
        }
        break;
      }
      case 'confirm_tomorrow': {
        // Navigate to the week tab and scroll to the specific card, then open script picker
        onSwitchTab?.('week');
        if (item.targetId) {
          setTimeout(() => {
            const el = document.getElementById(`intro-card-${item.targetId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Auto-open script picker for confirmations
            window.dispatchEvent(new CustomEvent('myday:open-script', {
              detail: { bookingId: item.targetId, isSecondIntro: false },
            }));
          }, 300);
        }
        break;
      }
      case 'followups_due': {
        onSwitchTab?.('followups');
        break;
      }
      case 'leads_overdue': {
        onSwitchTab?.('newleads');
        break;
      }
      case 'log_ig': {
        onSwitchTab?.('igdm');
        break;
      }
      case 'shift_recap': {
        const fab = document.querySelector('[data-end-shift-trigger]') as HTMLElement;
        if (fab) fab.click();
        break;
      }
      case 'cold_texts':
      case 'cold_dms': {
        setOutreachCount(0);
        setReflectionTarget({ item });
        break;
      }
    }
  }, [handleDirectComplete, onSwitchTab]);

  // Save reflection result
  const saveReflection = useCallback(async (type: string, result: string, bookingId?: string) => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    await supabase.from('win_the_day_reflections').insert({
      sa_name: userName,
      reflection_date: todayStr,
      reflection_type: type,
      result,
      booking_id: bookingId || null,
    } as any);
  }, [userName]);

  // Questionnaire reflection
  const handleQReflection = useCallback(async (result: 'answered' | 'sent_waiting' | 'unreachable' | 'already_done' | 'cancelled') => {
    const item = reflectionTarget?.item;
    if (!item) return;

    await saveReflection('questionnaire_outreach', result, item.targetId);

    // Also handle the Q send action if it's a q_send type
    if (item.type === 'q_send' && item.targetId) {
      if (item.questionnaireLink) {
        await navigator.clipboard.writeText(item.questionnaireLink);
      }
      await supabase.from('intros_booked').update({
        questionnaire_status_canon: 'sent',
        questionnaire_sent_at: new Date().toISOString(),
      }).eq('id', item.targetId);
      await supabase.from('script_actions').insert({
        booking_id: item.targetId,
        action_type: 'questionnaire_sent',
        completed_by: userName,
        script_category: 'questionnaire',
      });
    }

    toast.success(`Reflection logged for ${item.memberName}`);
    setReflectionTarget(null);
    refresh();
  }, [reflectionTarget, saveReflection, userName, refresh]);

  // Confirmation reflection
  const handleConfirmReflection = useCallback(async (result: 'confirmed' | 'sent_no_response' | 'unreachable' | 'reschedule' | 'cancelled') => {
    const item = reflectionTarget?.item;
    if (!item) return;

    await saveReflection('booking_confirmation', result, item.targetId);

    // Log confirmation script action
    if (item.targetId) {
      await supabase.from('script_actions').insert({
        booking_id: item.targetId,
        action_type: 'confirmation_sent',
        completed_by: userName,
        script_category: 'confirmation',
      });
    }

    toast.success(`Confirmation logged for ${item.memberName}`);
    setReflectionTarget(null);
    refresh();
  }, [reflectionTarget, saveReflection, userName, refresh]);

  // Follow-up reflection
  const handleFollowupReflection = useCallback(async () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    await supabase.from('followup_daily_log').upsert({
      sa_name: userName,
      log_date: todayStr,
      contacted_count: followupContacted,
      responded_count: followupResponded,
    } as any, { onConflict: 'sa_name,log_date' });

    await saveReflection('followup_daily', `contacted:${followupContacted},responded:${followupResponded}`);
    toast.success('Follow-up reflection logged');
    setReflectionTarget(null);
    refresh();
  }, [userName, followupContacted, followupResponded, saveReflection, refresh]);

  // New leads reflection
  const handleLeadsReflection = useCallback(async (result: 'all_contacted' | 'partial' | 'no_time' | 'none_assigned') => {
    await saveReflection('new_leads_contact', result);
    toast.success('Lead contact reflection logged');
    setReflectionTarget(null);
    refresh();
  }, [saveReflection, refresh]);

  // Outreach reflection (cold texts / DMs)
  const handleOutreachReflection = useCallback(async () => {
    const item = reflectionTarget?.item;
    if (!item || outreachCount <= 0) return;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const field = item.type === 'cold_texts' ? 'cold_texts_sent' : 'cold_dms_sent';

    // Check if record exists for this SA + today
    const { data: existing } = await supabase
      .from('daily_outreach_log')
      .select('id, cold_texts_sent, cold_dms_sent')
      .eq('sa_name', userName)
      .eq('log_date', todayStr)
      .limit(1);

    if (existing && existing.length > 0) {
      const current = existing[0];
      const newVal = (field === 'cold_texts_sent' ? current.cold_texts_sent : current.cold_dms_sent) + outreachCount;
      await supabase
        .from('daily_outreach_log')
        .update({ [field]: newVal })
        .eq('id', current.id);
    } else {
      await supabase
        .from('daily_outreach_log')
        .insert({
          sa_name: userName,
          log_date: todayStr,
          [field]: outreachCount,
        } as any);
    }

    const label = item.type === 'cold_texts' ? 'texts' : 'DMs';
    toast.success(`Logged ${outreachCount} ${label}`);
    setReflectionTarget(null);
    setOutreachCount(0);
    refresh();
  }, [reflectionTarget, outreachCount, userName, refresh]);

  if (isLoading && items.length === 0) return null;
  if (totalCount === 0) return null;

  const reflectionItem = reflectionTarget?.item;
  const firstName = reflectionItem?.memberName?.split(' ')[0] || '';

  return (
    <div className="border-b border-primary/30 bg-background">
      <Collapsible open={effectiveOpen} onOpenChange={setIsOpen}>
        {/* Section guidance */}
        <div className="px-4 pt-2 pb-1">
          <p className="text-[11px] text-muted-foreground border-l-2 border-primary/40 pl-2">
            Your shift checklist. Tap ○ to reflect, tap the button to take action. Complete every item to win the day.
          </p>
        </div>
        {/* Header */}
        <div className="px-4 pt-1 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold">Win the Day</span>
              <span className="text-xs text-muted-foreground">{format(new Date(), 'MMM d')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {completedCount} of {totalCount} complete
              </span>
              {allComplete && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    {effectiveOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>
          <div className="mt-2">
            <Progress value={progressPct} className="h-2 bg-muted" />
          </div>
        </div>

        {allComplete && (
          <div className="mx-4 mb-2 rounded-lg bg-primary py-2.5 px-4 flex items-center justify-center gap-2">
            <Flame className="w-4 h-4 text-primary-foreground" />
            <span className="text-sm font-bold text-primary-foreground">You're winning today!</span>
            <Flame className="w-4 h-4 text-primary-foreground" />
          </div>
        )}

        <CollapsibleContent>
          <div className="px-4 pb-3 space-y-1">
            {items.filter(i => !i.completed).map(item => (
              <ChecklistRow
                key={item.id}
                item={item}
                onAction={handleAction}
                onCircleTap={handleCircleTap}
              />
            ))}
            {/* Completed tasks collapse into dropdown */}
            {items.filter(i => i.completed).length > 0 && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground mt-2 py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
                    <Check className="w-3 h-3 text-success" />
                    <span>Completed ✓ ({items.filter(i => i.completed).length})</span>
                    <ChevronDown className="w-3 h-3 ml-auto" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1 mt-1">
                    {items.filter(i => i.completed).map(item => (
                      <ChecklistRow
                        key={item.id}
                        item={item}
                        onAction={handleAction}
                        onCircleTap={handleCircleTap}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ═══ REFLECTION BOTTOM SHEETS ═══ */}

      {/* Questionnaire reflection */}
      <Drawer open={!!reflectionItem && (reflectionItem.type === 'q_send' || reflectionItem.type === 'q_resend')} onOpenChange={(open) => { if (!open) setReflectionTarget(null); }}>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-base">Questionnaire — {reflectionItem?.memberName}</DrawerTitle>
            <p className="text-sm text-muted-foreground">Were you able to reach {firstName}?</p>
          </DrawerHeader>
          <div className="space-y-2">
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleQReflection('answered')}
            >
              <span className="text-lg">✓</span>
              <span className="text-sm font-medium">Sent and they answered</span>
            </button>
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleQReflection('sent_waiting')}
            >
              <span className="text-lg">📨</span>
              <span className="text-sm font-medium">Sent, waiting on response</span>
            </button>
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleQReflection('unreachable')}
            >
              <span className="text-lg">📵</span>
              <span className="text-sm font-medium">Couldn't reach them</span>
            </button>
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleQReflection('already_done')}
            >
              <span className="text-lg">📋</span>
              <span className="text-sm font-medium">Already completed the Q</span>
            </button>
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleQReflection('cancelled')}
            >
              <span className="text-lg">🚫</span>
              <span className="text-sm font-medium">Cancelled / not coming</span>
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Confirmation reflection */}
      <Drawer open={!!reflectionItem && reflectionItem.type === 'confirm_tomorrow'} onOpenChange={(open) => { if (!open) setReflectionTarget(null); }}>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-base">Confirmation — {reflectionItem?.memberName}</DrawerTitle>
            <p className="text-sm text-muted-foreground">Did {firstName} confirm?</p>
          </DrawerHeader>
          <div className="space-y-2">
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleConfirmReflection('confirmed')}
            >
              <span className="text-lg">✓</span>
              <span className="text-sm font-medium">Confirmed — they're coming</span>
            </button>
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleConfirmReflection('sent_no_response')}
            >
              <span className="text-lg">💬</span>
              <span className="text-sm font-medium">Sent, no response yet</span>
            </button>
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleConfirmReflection('unreachable')}
            >
              <span className="text-lg">✗</span>
              <span className="text-sm font-medium">Couldn't reach them</span>
            </button>
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleConfirmReflection('reschedule')}
            >
              <span className="text-lg">🔄</span>
              <span className="text-sm font-medium">Wants to reschedule</span>
            </button>
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleConfirmReflection('cancelled')}
            >
              <span className="text-lg">🚫</span>
              <span className="text-sm font-medium">Cancelled — not coming</span>
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Follow-ups reflection */}
      <Drawer open={!!reflectionItem && reflectionItem.type === 'followups_due'} onOpenChange={(open) => { if (!open) setReflectionTarget(null); }}>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-base">Follow-Ups — Today</DrawerTitle>
            <p className="text-sm text-muted-foreground">How did your follow-ups go?</p>
          </DrawerHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Contacted</span>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setFollowupContacted(Math.max(0, followupContacted - 1))}>
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <span className="text-lg font-bold w-8 text-center">{followupContacted}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setFollowupContacted(followupContacted + 1)}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Responded</span>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setFollowupResponded(Math.max(0, followupResponded - 1))}>
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <span className="text-lg font-bold w-8 text-center">{followupResponded}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setFollowupResponded(followupResponded + 1)}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={handleFollowupReflection}>Mark Complete</Button>
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => { setFollowupContacted(0); setFollowupResponded(0); handleFollowupReflection(); }}
            >
              <span className="text-lg">🈳</span>
              <span className="text-sm font-medium">No follow-ups due today</span>
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* New leads reflection */}
      <Drawer open={!!reflectionItem && reflectionItem.type === 'leads_overdue'} onOpenChange={(open) => { if (!open) setReflectionTarget(null); }}>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-base">New Leads — Today</DrawerTitle>
            <p className="text-sm text-muted-foreground">Were you able to contact all overdue leads?</p>
          </DrawerHeader>
          <div className="space-y-2">
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleLeadsReflection('all_contacted')}
            >
              <span className="text-lg">✓</span>
              <span className="text-sm font-medium">Yes — contacted everyone</span>
            </button>
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleLeadsReflection('partial')}
            >
              <span className="text-lg">〜</span>
              <span className="text-sm font-medium">Partially — got most of them</span>
            </button>
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleLeadsReflection('no_time')}
            >
              <span className="text-lg">✗</span>
              <span className="text-sm font-medium">No — ran out of time</span>
            </button>
            <button
              className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center gap-3"
              onClick={() => handleLeadsReflection('none_assigned')}
            >
              <span className="text-lg">📭</span>
              <span className="text-sm font-medium">No new leads today</span>
            </button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Cold Texts / DMs reflection */}
      <Drawer open={!!reflectionItem && (reflectionItem.type === 'cold_texts' || reflectionItem.type === 'cold_dms')} onOpenChange={(open) => { if (!open) setReflectionTarget(null); }}>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader className="px-0">
            <DrawerTitle className="text-base">
              {reflectionItem?.type === 'cold_texts' ? 'Cold Lead Texts' : 'Cold DMs'} — Today
            </DrawerTitle>
            <p className="text-sm text-muted-foreground">How many did you send this shift?</p>
          </DrawerHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {reflectionItem?.type === 'cold_texts' ? 'Texts sent' : 'DMs sent'}
              </span>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOutreachCount(Math.max(0, outreachCount - 1))}>
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <span className="text-lg font-bold w-8 text-center">{outreachCount}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setOutreachCount(outreachCount + 1)}>
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <Button className="w-full" onClick={handleOutreachReflection} disabled={outreachCount <= 0}>
              Log {outreachCount} {reflectionItem?.type === 'cold_texts' ? 'Texts' : 'DMs'}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function ChecklistRow({ item, onAction, onCircleTap }: { item: ChecklistItem; onAction: (item: ChecklistItem) => void; onCircleTap: (item: ChecklistItem) => void }) {
  const urgencyBorder = item.urgency === 'red'
    ? 'border-l-destructive'
    : item.urgency === 'amber'
    ? 'border-l-warning'
    : 'border-l-transparent';

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 border-l-2 transition-all',
        urgencyBorder,
        item.completed ? 'opacity-60' : 'bg-muted/30',
      )}
    >
      {/* Tappable status indicator */}
      <button
        className="shrink-0 p-0.5 rounded-full transition-colors hover:bg-muted/50 active:scale-95"
        onClick={() => onCircleTap(item)}
        disabled={item.completed}
        aria-label={item.completed ? 'Completed' : `Mark ${item.text} complete`}
      >
        {item.completed ? (
          <Check className="w-4 h-4 text-emerald-500" />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {/* Text */}
      <span
        className={cn(
          'flex-1 text-xs leading-tight',
          item.completed && 'line-through text-muted-foreground',
          !item.completed && item.urgency === 'red' && 'text-destructive font-medium',
          !item.completed && item.urgency === 'amber' && 'text-warning font-medium',
        )}
      >
        {item.text}
      </span>

      {/* Action button */}
      {!item.completed && (
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] px-2 shrink-0 whitespace-nowrap"
          onClick={() => onAction(item)}
        >
          {item.type === 'q_send' && <Copy className="w-3 h-3 mr-1" />}
          {item.actionLabel}
        </Button>
      )}
    </div>
  );
}
