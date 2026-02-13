import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, MessageSquare, UserPlus, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftScanOverlayProps {
  introsCount: number;
  followUpsCount: number;
  newLeadsCount: number;
  unresolvedCount: number;
  userName: string;
}

export function ShiftScanOverlay({
  introsCount,
  followUpsCount,
  newLeadsCount,
  unresolvedCount,
  userName,
}: ShiftScanOverlayProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Show only once per session (use sessionStorage)
    const key = `shift_scan_${new Date().toDateString()}`;
    if (!sessionStorage.getItem(key)) {
      const total = introsCount + followUpsCount + newLeadsCount + unresolvedCount;
      if (total > 0) {
        setDismissed(false);
        sessionStorage.setItem(key, 'shown');
      }
    }
  }, [introsCount, followUpsCount, newLeadsCount, unresolvedCount]);

  if (dismissed) return null;

  const items = [
    { icon: Calendar, label: 'intros today', count: introsCount, color: 'text-primary' },
    { icon: MessageSquare, label: 'follow-ups due', count: followUpsCount, color: 'text-warning' },
    { icon: UserPlus, label: 'new leads', count: newLeadsCount, color: 'text-info' },
    { icon: AlertTriangle, label: 'unresolved', count: unresolvedCount, color: 'text-destructive' },
  ].filter(i => i.count > 0);

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6"
        onClick={() => setDismissed(true)}
      >
        <X className="w-4 h-4" />
      </Button>
      <p className="text-sm font-semibold">Your shift at a glance</p>
      <div className="flex items-center gap-4 flex-wrap">
        {items.map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <item.icon className={cn('w-4 h-4', item.color)} />
            <span className="text-sm font-bold">{item.count}</span>
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
