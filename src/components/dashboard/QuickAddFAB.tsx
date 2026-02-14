import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, UserPlus, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { getLocalDateString } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface QuickAddFABProps {
  onRefresh: () => void;
}

export function QuickAddFAB({ onRefresh }: QuickAddFABProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [walkInNote, setWalkInNote] = useState('');
  const [savingWalkIn, setSavingWalkIn] = useState(false);

  const handleBooking = () => {
    setExpanded(false);
    navigate('/shift-recap');
  };

  const handleAddLead = () => {
    setExpanded(false);
    setShowAddLead(true);
  };

  const handleWalkIn = () => {
    setExpanded(false);
    setShowWalkIn(true);
  };

  const saveWalkIn = async () => {
    if (!walkInNote.trim()) {
      toast.error('Please add a note');
      return;
    }
    setSavingWalkIn(true);
    try {
      const today = getLocalDateString();
      // Find or create today's recap
      const { data: existing } = await supabase
        .from('shift_recaps')
        .select('id, other_info')
        .eq('staff_name', user?.name || '')
        .eq('shift_date', today)
        .limit(1)
        .maybeSingle();

      if (existing) {
        const combined = [existing.other_info, `Walk-in: ${walkInNote}`].filter(Boolean).join('\n');
        await supabase.from('shift_recaps').update({ other_info: combined }).eq('id', existing.id);
      } else {
        const hour = new Date().getHours();
        const shiftType = hour < 12 ? 'AM Shift' : hour < 16 ? 'Mid Shift' : 'PM Shift';
        await supabase.from('shift_recaps').insert({
          staff_name: user?.name || '',
          shift_date: today,
          shift_type: shiftType,
          other_info: `Walk-in: ${walkInNote}`,
        });
      }
      toast.success('Walk-in note saved');
      setWalkInNote('');
      setShowWalkIn(false);
      onRefresh();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSavingWalkIn(false);
    }
  };

  const actions = [
    { icon: Calendar, label: 'Book Intro', onClick: handleBooking, color: 'bg-primary text-primary-foreground' },
    { icon: UserPlus, label: 'Add Lead', onClick: handleAddLead, color: 'bg-info text-info-foreground' },
    { icon: FileText, label: 'Walk-in Note', onClick: handleWalkIn, color: 'bg-warning text-warning-foreground' },
  ];

  return (
    <>
      {/* Backdrop */}
      {expanded && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setExpanded(false)} />
      )}

      {/* FAB and mini-actions */}
      <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
        {expanded && actions.map((action, i) => (
          <div
            key={action.label}
            className="flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="text-xs font-medium bg-card px-2 py-1 rounded shadow-sm border">
              {action.label}
            </span>
            <Button
              size="icon"
              className={cn('h-10 w-10 rounded-full shadow-lg', action.color)}
              onClick={action.onClick}
            >
              <action.icon className="w-4 h-4" />
            </Button>
          </div>
        ))}

        <Button
          size="icon"
          className="h-14 w-14 rounded-full shadow-xl bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
        </Button>
      </div>

      {/* Add Lead Dialog */}
      <AddLeadDialog
        open={showAddLead}
        onOpenChange={setShowAddLead}
        onLeadAdded={onRefresh}
      />

      {/* Walk-in Note Dialog */}
      <Dialog open={showWalkIn} onOpenChange={setShowWalkIn}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Walk-in Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={walkInNote}
              onChange={e => setWalkInNote(e.target.value)}
              placeholder="Who walked in and what happened..."
              rows={3}
            />
            <Button onClick={saveWalkIn} disabled={savingWalkIn} className="w-full">
              {savingWalkIn ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
