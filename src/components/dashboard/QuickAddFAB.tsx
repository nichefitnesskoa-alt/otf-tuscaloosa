import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, X, CalendarPlus, ShoppingBag, TrendingUp, Watch, RefreshCw, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BookIntroSheet } from '@/components/dashboard/BookIntroSheet';
import { WalkInSaleSheet, UpgradeSheet, HRMAddOnSheet } from '@/components/dashboard/OutsideSaleSheets';
import { FABFollowUpPurchaseSheet } from '@/components/dashboard/FABFollowUpPurchaseSheet';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { IntroSchedulerLinkCard } from '@/components/admin/IntroSchedulerLinkCard';

interface QuickAddFABProps {
  onRefresh: () => void;
}

export function QuickAddFAB({ onRefresh }: QuickAddFABProps) {
  const [expanded, setExpanded] = useState(false);
  const [showBookIntro, setShowBookIntro] = useState(false);
  const [showWalkInSale, setShowWalkInSale] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showHRM, setShowHRM] = useState(false);
  const [showFollowUpPurchase, setShowFollowUpPurchase] = useState(false);
  const [showIntroLink, setShowIntroLink] = useState(false);

  const handleBookIntro = () => { setExpanded(false); setShowBookIntro(true); };
  const handleWalkInSale = () => { setExpanded(false); setShowWalkInSale(true); };
  const handleUpgrade = () => { setExpanded(false); setShowUpgrade(true); };
  const handleHRM = () => { setExpanded(false); setShowHRM(true); };
  const handleFollowUpPurchase = () => { setExpanded(false); setShowFollowUpPurchase(true); };
  const handleIntroLink = () => { setExpanded(false); setShowIntroLink(true); };

  // End Shift removed — shift score now lives on the MyDay ShiftScoreboard,
  // which computes from live data and needs no close-out ritual.
  const actions = [
    {
      icon: QrCode,
      label: 'My Intro Link',
      onClick: handleIntroLink,
      color: 'bg-orange-500 text-primary-foreground',
    },
    {
      icon: CalendarPlus,
      label: 'Book Intro',
      onClick: handleBookIntro,
      color: 'bg-primary text-primary-foreground',
    },
    {
      icon: ShoppingBag,
      label: 'Walk-In Sale',
      onClick: handleWalkInSale,
      color: 'bg-green-600 text-primary-foreground',
    },
    {
      icon: TrendingUp,
      label: 'Upgrade',
      onClick: handleUpgrade,
      color: 'bg-blue-600 text-primary-foreground',
    },
    {
      icon: Watch,
      label: 'HRM Add-On',
      onClick: handleHRM,
      color: 'bg-purple-600 text-primary-foreground',
    },
    {
      icon: RefreshCw,
      label: 'Follow-Up Purchase',
      onClick: handleFollowUpPurchase,
      color: 'bg-emerald-600 text-primary-foreground',
    },
  ];

  return (
    <>
      {expanded && (
        <div className="fixed inset-0 bg-foreground/20 z-40" onClick={() => setExpanded(false)} />
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

      <BookIntroSheet open={showBookIntro} onOpenChange={setShowBookIntro} onSaved={onRefresh} />
      <WalkInSaleSheet open={showWalkInSale} onOpenChange={setShowWalkInSale} onSaved={onRefresh} />
      <UpgradeSheet open={showUpgrade} onOpenChange={setShowUpgrade} onSaved={onRefresh} />
      <HRMAddOnSheet open={showHRM} onOpenChange={setShowHRM} onSaved={onRefresh} />
      <FABFollowUpPurchaseSheet open={showFollowUpPurchase} onOpenChange={setShowFollowUpPurchase} onSaved={onRefresh} />

      <Sheet open={showIntroLink} onOpenChange={setShowIntroLink}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>My Intro Scheduler Link</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <IntroSchedulerLinkCard />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
