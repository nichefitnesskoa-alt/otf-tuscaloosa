import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X, Users, CalendarPlus, LogOut, ShoppingBag, TrendingUp, Watch, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WalkInIntroSheet } from '@/components/dashboard/WalkInIntroSheet';
import { BookIntroSheet } from '@/components/dashboard/BookIntroSheet';
import { CloseOutShift } from '@/components/dashboard/CloseOutShift';
import { WalkInSaleSheet, UpgradeSheet, HRMAddOnSheet } from '@/components/dashboard/OutsideSaleSheets';
import { FABFollowUpPurchaseSheet } from '@/components/dashboard/FABFollowUpPurchaseSheet';

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
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [showBookIntro, setShowBookIntro] = useState(false);
  const [showEndShift, setShowEndShift] = useState(false);
  const [showWalkInSale, setShowWalkInSale] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showHRM, setShowHRM] = useState(false);
  const [showFollowUpPurchase, setShowFollowUpPurchase] = useState(false);

  const handleWalkInIntro = () => { setExpanded(false); setShowWalkIn(true); };
  const handleBookIntro = () => { setExpanded(false); setShowBookIntro(true); };
  const handleEndShift = () => { setExpanded(false); onEndShift?.(); setShowEndShift(true); };
  const handleWalkInSale = () => { setExpanded(false); setShowWalkInSale(true); };
  const handleUpgrade = () => { setExpanded(false); setShowUpgrade(true); };
  const handleHRM = () => { setExpanded(false); setShowHRM(true); };
  const handleFollowUpPurchase = () => { setExpanded(false); setShowFollowUpPurchase(true); };

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
      icon: ShoppingBag,
      label: 'Walk-In Sale',
      onClick: handleWalkInSale,
      color: 'bg-green-600 text-white',
    },
    {
      icon: TrendingUp,
      label: 'Upgrade',
      onClick: handleUpgrade,
      color: 'bg-blue-600 text-white',
    },
    {
      icon: Watch,
      label: 'HRM Add-On',
      onClick: handleHRM,
      color: 'bg-purple-600 text-white',
    },
    {
      icon: RefreshCw,
      label: 'Follow-Up Purchase',
      onClick: handleFollowUpPurchase,
      color: 'bg-emerald-600 text-white',
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

      <WalkInIntroSheet open={showWalkIn} onOpenChange={setShowWalkIn} onSaved={onRefresh} />
      <BookIntroSheet open={showBookIntro} onOpenChange={setShowBookIntro} onSaved={onRefresh} />
      <WalkInSaleSheet open={showWalkInSale} onOpenChange={setShowWalkInSale} onSaved={onRefresh} />
      <UpgradeSheet open={showUpgrade} onOpenChange={setShowUpgrade} onSaved={onRefresh} />
      <HRMAddOnSheet open={showHRM} onOpenChange={setShowHRM} onSaved={onRefresh} />
      <FABFollowUpPurchaseSheet open={showFollowUpPurchase} onOpenChange={setShowFollowUpPurchase} onSaved={onRefresh} />

      {/* End Shift dialog */}
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
