import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ClipboardCheck, CheckCircle2, MessageSquare, Users, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getLocalDateString } from '@/lib/utils';


interface CloseOutShiftProps {
  completedIntros: number;
  activeIntros: number;
  scriptsSent: number;
  followUpsSent: number;
  purchaseCount: number;
  noShowCount: number;
  didntBuyCount: number;
}

export function CloseOutShift({
  completedIntros,
  activeIntros,
  scriptsSent,
  followUpsSent,
  purchaseCount,
  noShowCount,
  didntBuyCount,
}: CloseOutShiftProps) {
  const { user } = useAuth();
  const { refreshData } = useData();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [visible, setVisible] = useState(false);

  // Show button after shift has been going for a while
  useEffect(() => {
    const hour = new Date().getHours();
    // Show after 11am for morning, 3pm for mid, 7pm for evening
    const shouldShow = hour >= 11 && (completedIntros + scriptsSent + followUpsSent) > 0;
    setVisible(shouldShow);
  }, [completedIntros, scriptsSent, followUpsSent]);

  const handleSubmit = async () => {
    if (!user?.name) return;
    setSubmitting(true);

    try {
      const today = getLocalDateString();
      const hour = new Date().getHours();
      const shiftType = hour < 12 ? 'AM Shift' : hour < 16 ? 'Mid Shift' : 'PM Shift';

      // Check if recap already exists
      const { data: existing } = await supabase
        .from('shift_recaps')
        .select('id')
        .eq('staff_name', user.name)
        .eq('shift_date', today)
        .limit(1)
        .maybeSingle();

      let recapId: string;

      if (existing) {
        // Update existing
        await supabase
          .from('shift_recaps')
          .update({
            other_info: notes || null,
            submitted_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        recapId = existing.id;
      } else {
        // Create new recap
        const { data: newRecap } = await supabase
          .from('shift_recaps')
          .insert({
            staff_name: user.name,
            shift_date: today,
            shift_type: shiftType,
            other_info: notes || null,
            submitted_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        recapId = newRecap?.id || '';
      }

      // Post to GroupMe via edge function
      try {
        const summary = [
          `📋 ${user.name} — Shift Close Out`,
          `📅 ${format(new Date(), 'EEEE MMM d')}`,
          ``,
          `Intros: ${completedIntros} logged (${purchaseCount} purchased, ${didntBuyCount} didn't buy, ${noShowCount} no-show)`,
          `Follow-ups: ${followUpsSent} sent`,
          `Scripts: ${scriptsSent} sent`,
          notes ? `\nNotes: ${notes}` : '',
        ].filter(Boolean).join('\n');

        await supabase.functions.invoke('post-groupme', {
          body: { text: summary },
        });
      } catch (err) {
        console.error('GroupMe post error:', err);
      }

      await refreshData();
      toast.success('Shift closed out! Great work today.');
      setOpen(false);
    } catch (err) {
      console.error('Close out error:', err);
      toast.error('Failed to close out shift');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <Button
        className="w-full gap-2 bg-primary hover:bg-primary/90"
        size="lg"
        onClick={() => setOpen(true)}
      >
        <ClipboardCheck className="w-5 h-5" />
        Close Out Shift
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              Your Shift Summary
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <Calendar className="w-4 h-4 mx-auto mb-1 text-primary" />
                <p className="text-xl font-bold">{completedIntros}</p>
                <p className="text-[10px] text-muted-foreground">Intros Logged</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
                <p className="text-xl font-bold">{purchaseCount}</p>
                <p className="text-[10px] text-muted-foreground">Purchased</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <MessageSquare className="w-4 h-4 mx-auto mb-1 text-info" />
                <p className="text-xl font-bold">{scriptsSent}</p>
                <p className="text-[10px] text-muted-foreground">Scripts Sent</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-center">
                <Users className="w-4 h-4 mx-auto mb-1 text-warning" />
                <p className="text-xl font-bold">{followUpsSent}</p>
                <p className="text-[10px] text-muted-foreground">Follow-Ups</p>
              </div>
            </div>

            {/* Breakdown */}
            <div className="text-xs space-y-1 px-1">
              {noShowCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">No-shows</span>
                  <span className="font-medium text-destructive">{noShowCount}</span>
                </div>
              )}
              {didntBuyCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Didn't buy</span>
                  <span className="font-medium">{didntBuyCount}</span>
                </div>
              )}
              {activeIntros > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Still pending</span>
                  <Badge variant="outline" className="text-[10px]">{activeIntros}</Badge>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                Anything to add?
              </label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Shift notes, equipment issues, member interactions..."
                className="text-sm min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Shift Recap'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
