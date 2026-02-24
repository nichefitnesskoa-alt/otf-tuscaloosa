/**
 * Win the Day — Dynamic Shift Checklist
 * Sits between the floating header and the tab system on MyDay.
 */
import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Trophy, Check, Circle, ChevronDown, ChevronUp, Flame, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { useWinTheDayItems, ChecklistItem } from './useWinTheDayItems';

interface WinTheDayProps {
  onSwitchTab?: (tab: string) => void;
}

export function WinTheDay({ onSwitchTab }: WinTheDayProps) {
  const { user } = useAuth();
  const { items, isLoading, completedCount, totalCount, allComplete, progressPct, refresh } = useWinTheDayItems();
  const [isOpen, setIsOpen] = useState(true);

  // Auto-collapse when all complete
  const effectiveOpen = allComplete ? isOpen : true;

  const handleAction = useCallback(async (item: ChecklistItem) => {
    switch (item.type) {
      case 'q_send': {
        // Copy questionnaire link & mark as sent
        if (item.questionnaireLink) {
          await navigator.clipboard.writeText(item.questionnaireLink);
          toast.success(`Questionnaire link copied for ${item.memberName}`);
        } else if (item.targetId) {
          // Generate link from booking
          const baseUrl = window.location.origin;
          const link = `${baseUrl}/questionnaire/${item.targetId}`;
          await navigator.clipboard.writeText(link);
          toast.success(`Questionnaire link copied for ${item.memberName}`);
        }
        // Mark questionnaire as sent
        if (item.targetId) {
          await supabase
            .from('intros_booked')
            .update({
              questionnaire_status_canon: 'sent',
              questionnaire_sent_at: new Date().toISOString(),
            })
            .eq('id', item.targetId);
          // Log script action
          await supabase.from('script_actions').insert({
            booking_id: item.targetId,
            action_type: 'questionnaire_sent',
            completed_by: user?.name || '',
            script_category: 'questionnaire',
          });
        }
        refresh();
        break;
      }
      case 'q_resend': {
        // Open script picker for this booking
        if (item.targetId) {
          window.dispatchEvent(new CustomEvent('myday:open-script', { detail: { bookingId: item.targetId } }));
        }
        break;
      }
      case 'confirm_tomorrow': {
        // Open script picker for confirmation
        if (item.targetId) {
          window.dispatchEvent(new CustomEvent('myday:open-script', { detail: { bookingId: item.targetId } }));
        }
        break;
      }
      case 'prep_roleplay': {
        if (item.targetId) {
          window.dispatchEvent(new CustomEvent('myday:open-prep', { detail: { bookingId: item.targetId } }));
        }
        break;
      }
      case 'followups_due': {
        onSwitchTab?.('followups');
        break;
      }
      case 'leads_overdue': {
        onSwitchTab?.('leads');
        break;
      }
      case 'log_ig': {
        onSwitchTab?.('igdm');
        break;
      }
      case 'shift_recap': {
        // Dispatch the end shift event (QuickAddFAB handles this)
        const fab = document.querySelector('[data-end-shift-trigger]') as HTMLElement;
        if (fab) fab.click();
        break;
      }
    }
  }, [user?.name, refresh, onSwitchTab]);

  if (isLoading && items.length === 0) return null;
  if (totalCount === 0) return null;

  return (
    <div className="border-b border-primary/30 bg-background">
      <Collapsible open={effectiveOpen} onOpenChange={setIsOpen}>
        {/* Header */}
        <div className="px-4 pt-3 pb-2">
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

          {/* Progress bar */}
          <div className="mt-2">
            <Progress value={progressPct} className="h-2 bg-muted" />
          </div>
        </div>

        {/* Celebration banner */}
        {allComplete && (
          <div className="mx-4 mb-2 rounded-lg bg-primary py-2.5 px-4 flex items-center justify-center gap-2">
            <Flame className="w-4 h-4 text-primary-foreground" />
            <span className="text-sm font-bold text-primary-foreground">You're winning today!</span>
            <Flame className="w-4 h-4 text-primary-foreground" />
          </div>
        )}

        <CollapsibleContent>
          {/* Checklist items */}
          <div className="px-4 pb-3 space-y-1">
            {items.map(item => (
              <ChecklistRow key={item.id} item={item} onAction={handleAction} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ChecklistRow({ item, onAction }: { item: ChecklistItem; onAction: (item: ChecklistItem) => void }) {
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
      {/* Status indicator */}
      {item.completed ? (
        <Check className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
      )}

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
