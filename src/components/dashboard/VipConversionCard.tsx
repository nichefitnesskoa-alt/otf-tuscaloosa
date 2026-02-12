import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, TrendingUp } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { DateRange } from '@/lib/pay-period';
import { isWithinInterval } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

interface VipConversionCardProps {
  dateRange?: DateRange | null;
}

export function VipConversionCard({ dateRange }: VipConversionCardProps) {
  const { introsBooked } = useData();

  const stats = useMemo(() => {
    // Get all VIP bookings
    const vipBookings = introsBooked.filter(b => (b as any).is_vip === true);
    
    // Get unique VIP member names (lowercased for matching)
    const vipMembers = new Map<string, { name: string; vipClassName: string | null; vipDate: string }>();
    vipBookings.forEach(b => {
      const key = b.member_name.toLowerCase().replace(/\s+/g, '');
      if (!vipMembers.has(key)) {
        vipMembers.set(key, {
          name: b.member_name,
          vipClassName: (b as any).vip_class_name || null,
          vipDate: b.class_date,
        });
      }
    });

    // Get all non-VIP bookings (real intros)
    const realBookings = introsBooked.filter(b => {
      if ((b as any).is_vip === true) return false;
      const status = ((b as any).booking_status || '').toUpperCase();
      if (status.includes('DUPLICATE') || status.includes('DELETED')) return false;
      if (dateRange) {
        try {
          const d = parseLocalDate(b.class_date);
          if (!isWithinInterval(d, { start: dateRange.start, end: dateRange.end })) return false;
        } catch { return false; }
      }
      return true;
    });

    // Find VIP members who later booked a real intro
    let converted = 0;
    realBookings.forEach(b => {
      const key = b.member_name.toLowerCase().replace(/\s+/g, '');
      if (vipMembers.has(key)) {
        converted++;
      }
    });

    const totalVip = vipMembers.size;
    const conversionRate = totalVip > 0 ? (converted / totalVip) * 100 : 0;

    return { totalVip, converted, conversionRate };
  }, [introsBooked, dateRange]);

  if (stats.totalVip === 0) return null;

  return (
    <Card className="border-purple-200/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-4 h-4 text-purple-600" />
          VIP Conversions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="text-center flex-1">
            <p className="text-2xl font-bold">{stats.converted}</p>
            <p className="text-xs text-muted-foreground">Booked Real Intro</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-muted-foreground">{stats.totalVip}</p>
            <p className="text-xs text-muted-foreground">Total VIP Attendees</p>
          </div>
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-purple-600">{stats.conversionRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
