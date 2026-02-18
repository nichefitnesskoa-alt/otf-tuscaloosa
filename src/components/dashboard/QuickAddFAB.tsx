import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, UserPlus, X, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { WalkInIntroSheet } from '@/components/dashboard/WalkInIntroSheet';

interface QuickAddFABProps {
  onRefresh: () => void;
}

export function QuickAddFAB({ onRefresh }: QuickAddFABProps) {
  const [expanded, setExpanded] = useState(false);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);

  const handleAddLead = () => {
    setExpanded(false);
    setShowAddLead(true);
  };

  const handleWalkInIntro = () => {
    setExpanded(false);
    setShowWalkIn(true);
  };

  const actions = [
    {
      icon: Users,
      label: 'Walk-In Intro',
      onClick: handleWalkInIntro,
      color: 'bg-primary text-primary-foreground',
    },
    {
      icon: UserPlus,
      label: 'Add Lead',
      onClick: handleAddLead,
      color: 'bg-info text-info-foreground',
    },
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

      {/* Walk-In Intro Sheet */}
      <WalkInIntroSheet
        open={showWalkIn}
        onOpenChange={setShowWalkIn}
        onSaved={onRefresh}
      />
    </>
  );
}
