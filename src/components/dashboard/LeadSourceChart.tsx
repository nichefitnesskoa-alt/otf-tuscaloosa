import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Users, UserCheck, Target, ArrowDown, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FunnelDrillSheet, DrillPerson } from './FunnelDrillSheet';
import { LeadSourcePerson } from '@/hooks/useDashboardMetrics';

export interface LeadSourceData {
  source: string;
  booked: number;
  showed: number;
  sold: number;
  revenue: number;
  bookedPeople?: LeadSourcePerson[];
  showedPeople?: LeadSourcePerson[];
  soldPeople?: LeadSourcePerson[];
}

interface LeadSourceChartProps {
  data: LeadSourceData[];
  className?: string;
}

type SortKey = 'booked' | 'showed' | 'sold' | 'rate';

function bookToSaleColor(rate: number): string {
  if (rate >= 30) return 'text-success';
  if (rate >= 20) return 'text-warning';
  return 'text-destructive';
}

function dropoffColor(rate: number): string {
  if (rate >= 75) return 'text-success';
  if (rate >= 50) return 'text-warning';
  return 'text-destructive';
}

interface SourceRowProps {
  label: string;
  data: { booked: number; showed: number; sold: number };
  highlight?: boolean;
  onBoxClick?: (category: 'booked' | 'showed' | 'sold') => void;
}

function SourceRow({ label, data, highlight, onBoxClick }: SourceRowProps) {
  const showRate = data.booked > 0 ? (data.showed / data.booked) * 100 : 0;
  const closeRate = data.showed > 0 ? (data.sold / data.showed) * 100 : 0;
  const bookingToSale = data.booked > 0 ? (data.sold / data.booked) * 100 : 0;

  const clickable = !!onBoxClick;

  return (
    <div className={cn('rounded-lg border p-3 space-y-2', highlight && 'bg-primary/5 border-primary/30')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className={cn('text-[11px] font-medium', bookToSaleColor(bookingToSale))}>
          {bookingToSale.toFixed(0)}% book→sale
        </span>
      </div>
      <div className="flex items-center gap-1">
        <div
          className={cn('flex-1 text-center p-2 rounded bg-info/10 border border-info/20', clickable && 'cursor-pointer hover:ring-1 hover:ring-info/40 active:scale-95 transition-all')}
          onClick={() => onBoxClick?.('booked')}
        >
          <Users className="w-3.5 h-3.5 mx-auto mb-0.5 text-info" />
          <p className="text-lg font-bold text-info">{data.booked}</p>
          <p className="text-[10px] text-muted-foreground">Booked</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <ArrowDown className="w-3 h-3 text-muted-foreground" />
          <span className={cn('text-[10px] font-medium', dropoffColor(showRate))}>
            {showRate.toFixed(0)}%
          </span>
        </div>
        <div
          className={cn('flex-1 text-center p-2 rounded bg-warning/10 border border-warning/20', clickable && 'cursor-pointer hover:ring-1 hover:ring-warning/40 active:scale-95 transition-all')}
          onClick={() => onBoxClick?.('showed')}
        >
          <UserCheck className="w-3.5 h-3.5 mx-auto mb-0.5 text-warning" />
          <p className="text-lg font-bold text-warning">{data.showed}</p>
          <p className="text-[10px] text-muted-foreground">Showed</p>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <ArrowDown className="w-3 h-3 text-muted-foreground" />
          <span className={cn('text-[10px] font-medium', dropoffColor(closeRate))}>
            {closeRate.toFixed(0)}%
          </span>
        </div>
        <div
          className={cn('flex-1 text-center p-2 rounded bg-success/10 border border-success/20', clickable && 'cursor-pointer hover:ring-1 hover:ring-success/40 active:scale-95 transition-all')}
          onClick={() => onBoxClick?.('sold')}
        >
          <Target className="w-3.5 h-3.5 mx-auto mb-0.5 text-success" />
          <p className="text-lg font-bold text-success">{data.sold}</p>
          <p className="text-[10px] text-muted-foreground">Sold</p>
        </div>
      </div>
    </div>
  );
}

export function LeadSourceChart({ data, className }: LeadSourceChartProps) {
  const [sortKey, setSortKey] = useState<SortKey>('booked');
  const [sortDesc, setSortDesc] = useState(true);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillPeople, setDrillPeople] = useState<DrillPerson[]>([]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(prev => !prev);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  const openDrill = (source: string, category: 'booked' | 'showed' | 'sold', item: LeadSourceData) => {
    const labelMap = { booked: 'Booked', showed: 'Showed', sold: 'Sold' };
    setDrillTitle(`${source} — ${labelMap[category]}`);
    const people = category === 'booked' ? item.bookedPeople
      : category === 'showed' ? item.showedPeople
      : item.soldPeople;
    setDrillPeople(people || []);
    setDrillOpen(true);
  };

  const sorted = [...data].filter(d => d.booked > 0).sort((a, b) => {
    let aVal: number, bVal: number;
    switch (sortKey) {
      case 'booked': aVal = a.booked; bVal = b.booked; break;
      case 'showed': aVal = a.showed; bVal = b.showed; break;
      case 'sold': aVal = a.sold; bVal = b.sold; break;
      case 'rate': aVal = a.booked > 0 ? a.sold / a.booked : 0; bVal = b.booked > 0 ? b.sold / b.booked : 0; break;
      default: aVal = a.booked; bVal = b.booked;
    }
    return sortDesc ? bVal - aVal : aVal - bVal;
  });

  const total = sorted.reduce(
    (acc, d) => ({
      booked: acc.booked + d.booked, showed: acc.showed + d.showed, sold: acc.sold + d.sold,
      bookedPeople: [...acc.bookedPeople, ...(d.bookedPeople || [])],
      showedPeople: [...acc.showedPeople, ...(d.showedPeople || [])],
      soldPeople: [...acc.soldPeople, ...(d.soldPeople || [])],
    }),
    { booked: 0, showed: 0, sold: 0, bookedPeople: [] as LeadSourcePerson[], showedPeople: [] as LeadSourcePerson[], soldPeople: [] as LeadSourcePerson[] },
  );

  if (sorted.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Lead Source Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No booking data yet</p>
        </CardContent>
      </Card>
    );
  }

  const sortButtons: { key: SortKey; label: string }[] = [
    { key: 'booked', label: 'Booked' },
    { key: 'showed', label: 'Showed' },
    { key: 'sold', label: 'Sold' },
    { key: 'rate', label: 'Rate' },
  ];

  return (
    <>
      <Card className={cn(className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Lead Source Analytics
          </CardTitle>
          <div className="flex items-center gap-1 mt-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground mr-1">Sort:</span>
            {sortButtons.map(({ key, label }) => (
              <Button
                key={key}
                variant={sortKey === key ? 'secondary' : 'ghost'}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => handleSort(key)}
              >
                {label}
                {sortKey === key && (
                  <ArrowUpDown className="w-3 h-3 ml-0.5" />
                )}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.map(d => (
            <SourceRow
              key={d.source}
              label={d.source}
              data={d}
              onBoxClick={(cat) => openDrill(d.source, cat, d)}
            />
          ))}

          <div className="border-t pt-2">
            <SourceRow
              label="Total (All Sources)"
              data={total}
              highlight
              onBoxClick={(cat) => openDrill('Total (All Sources)', cat, { source: 'Total', ...total, revenue: 0 })}
            />
          </div>

          <p className="text-[10px] text-muted-foreground/70 text-center">Excludes VIP events · Tap a number to see people</p>
        </CardContent>
      </Card>

      <FunnelDrillSheet
        open={drillOpen}
        onOpenChange={setDrillOpen}
        title={drillTitle}
        people={drillPeople}
      />
    </>
  );
}
