import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, UserPlus, X, Users, CalendarPlus, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { WalkInIntroSheet } from '@/components/dashboard/WalkInIntroSheet';
import { BookIntroSheet } from '@/components/dashboard/BookIntroSheet';
import { CloseOutShift } from '@/components/dashboard/CloseOutShift';

interface QuickAddFABProps {
  onRefresh: () => void;
  completedIntros?: number;
  activeIntros?: number;
  scriptsSent?: number;
  followUpsSent?: number;
  purchaseCount?: number;
  noShowCount?: number;
  didntBuyCount?: number;
  topObjection?: string | null;
  onEndShift?: () => void;
}

export function QuickAddFAB({
  onRefresh,
  completedIntros = 0,
  activeIntros = 0,
  scriptsSent = 0,
  followUpsSent = 0,
  purchaseCount = 0,
  noShowCount = 0,
  didntBuyCount = 0,
  topObjection,
  onEndShift,
}: QuickAddFABProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [showBookIntro, setShowBookIntro] = useState(false);
  const [showEndShift, setShowEndShift] = useState(false);

  const handleAddLead = () => { setExpanded(false); setShowAddLead(true); };
  const handleWalkInIntro = () => { setExpanded(false); setShowWalkIn(true); };
  const handleBookIntro = () => { setExpanded(false); setShowBookIntro(true); };
  const handleEndShift = () => { setExpanded(false); onEndShift?.(); setShowEndShift(true); };

  const actions = [
    {
      icon: LogOut,
      label: 'End Shift',
      onClick: handleEndShift,
      color: 'bg-destructive text-destructive-foreground',
    },
    {
      icon: CalendarPlus,
      label: 'Book Intro',
      onClick: handleBookIntro,
      color: 'bg-primary text-primary-foreground',
    },
    {
      icon: Users,
      label: 'Walk-In Intro',
      onClick: handleWalkInIntro,
      color: 'bg-orange-500 text-white',
    },
    {
      icon: UserPlus,
      label: 'Add Lead',
      onClick: handleAddLead,
      color: 'bg-secondary text-secondary-foreground',
    },
  ];

  return (
    <>
      {expanded && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setExpanded(false)} />
      )}

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

      <AddLeadDialog open={showAddLead} onOpenChange={setShowAddLead} onLeadAdded={onRefresh} />
      <WalkInIntroSheet open={showWalkIn} onOpenChange={setShowWalkIn} onSaved={onRefresh} />
      <BookIntroSheet open={showBookIntro} onOpenChange={setShowBookIntro} onSaved={onRefresh} />

      {/* End Shift dialog — controlled externally from FAB */}
      <CloseOutShift
        completedIntros={completedIntros}
        activeIntros={activeIntros}
        scriptsSent={scriptsSent}
        followUpsSent={followUpsSent}
        purchaseCount={purchaseCount}
        noShowCount={noShowCount}
        didntBuyCount={didntBuyCount}
        topObjection={topObjection}
        forceOpen={showEndShift}
        onForceOpenChange={setShowEndShift}
      />
    </>
  );
}
