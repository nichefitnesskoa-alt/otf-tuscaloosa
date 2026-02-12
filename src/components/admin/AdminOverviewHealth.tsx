import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import {
  Target, TrendingUp, TrendingDown, Users, DollarSign, Activity,
  CheckCircle, AlertTriangle, XCircle,
} from 'lucide-react';
import { format, parseISO, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import {
  LineChart, Line, ResponsiveContainer, Tooltip as RechartsTooltip,
  XAxis, BarChart, Bar, YAxis, CartesianGrid,
} from 'recharts';
import { isMembershipSale, getSaleDate, isDateInRange } from '@/lib/sales-detection';
import { DateRange } from '@/lib/pay-period';

const AMC_TARGET = 400;

interface AmcEntry {
  id: string;
  logged_date: string;
  amc_value: number;
  note: string | null;
}

interface AdminOverviewHealthProps {
  dateRange: DateRange;
}

export default function AdminOverviewHealth({ dateRange }: AdminOverviewHealthProps) {
  const [amcEntries, setAmcEntries] = useState<AmcEntry[]>([]);
  const [referralStats, setReferralStats] = useState({ pending: 0, qualified: 0, liability: 0 });
  const [systemHealth, setSystemHealth] = useState<{
    lastGroupMePost: string | null;
    failedRecaps: number;
    lastSyncStatus: string | null;
    lastSyncTime: string | null;
  }>({ lastGroupMePost: null, failedRecaps: 0, lastSyncStatus: null, lastSyncTime: null });
  const [leadSourceData, setLeadSourceData] = useState<{ source: string; booked: number; sold: number; rate: number }[]>([]);
  const [weeklyGains, setWeeklyGains] = useState<{ week: string; net: number }[]>([]);

  useEffect(() => {
    fetchAll();
  }, [dateRange]);

  const fetchAll = async () => {
    const startStr = format(dateRange.start, 'yyyy-MM-dd');
    const endStr = format(dateRange.end, 'yyyy-MM-dd');

    // Parallel fetches
    const [amcRes, referralRes, recapRes, syncRes, bookingsRes, runsRes] = await Promise.all([
      supabase.from('amc_log').select('*').order('logged_date', { ascending: true }),
      supabase.from('referrals').select('*'),
      supabase.from('daily_recaps').select('status, created_at').order('created_at', { ascending: false }).limit(50),
      supabase.from('sheets_sync_log').select('status, created_at').order('created_at', { ascending: false }).limit(1),
      supabase.from('intros_booked').select('id, lead_source, class_date, originating_booking_id, deleted_at, is_vip').is('deleted_at', null),
      supabase.from('intros_run').select('linked_intro_booked_id, result, run_date, buy_date, created_at, commission_amount'),
    ]);

    // AMC
    if (amcRes.data) setAmcEntries(amcRes.data as AmcEntry[]);

    // Referral liability
    if (referralRes.data && runsRes.data) {
      const allRuns = runsRes.data;
      const memberSales = new Set<string>();
      allRuns.forEach(r => {
        if (isMembershipSale(r.result)) memberSales.add(r.linked_intro_booked_id || '');
      });

      let qualified = 0;
      let pending = 0;
      (referralRes.data as any[]).forEach(ref => {
        const friendBookingLinked = ref.referred_booking_id && memberSales.has(ref.referred_booking_id);
        const referrerBookingLinked = ref.referrer_booking_id && memberSales.has(ref.referrer_booking_id);
        if (friendBookingLinked && referrerBookingLinked) qualified++;
        else pending++;
      });
      setReferralStats({ pending, qualified, liability: qualified * 50 });
    }

    // System health
    const failedRecaps = (recapRes.data || []).filter(r => r.status === 'failed').length;
    const lastSent = (recapRes.data || []).find(r => r.status === 'sent');
    const syncLog = syncRes.data?.[0];
    setSystemHealth({
      lastGroupMePost: lastSent?.created_at || null,
      failedRecaps,
      lastSyncStatus: syncLog?.status || null,
      lastSyncTime: syncLog?.created_at || null,
    });

    // Lead source performance
    if (bookingsRes.data && runsRes.data) {
      const bookings = (bookingsRes.data as any[]).filter(b =>
        !b.originating_booking_id && !b.is_vip && isDateInRange(b.class_date, startStr, endStr)
      );
      const runs = runsRes.data;

      const sourceMap = new Map<string, { booked: number; sold: number }>();
      bookings.forEach(b => {
        const src = b.lead_source || 'Unknown';
        const entry = sourceMap.get(src) || { booked: 0, sold: 0 };
        entry.booked++;
        const linkedRuns = runs.filter(r => r.linked_intro_booked_id === b.id);
        if (linkedRuns.some(r => isMembershipSale(r.result))) entry.sold++;
        sourceMap.set(src, entry);
      });

      const sourceArr = Array.from(sourceMap.entries())
        .map(([source, v]) => ({
          source: source.length > 18 ? source.substring(0, 16) + '…' : source,
          booked: v.booked,
          sold: v.sold,
          rate: v.booked > 0 ? Math.round((v.sold / v.booked) * 100) : 0,
        }))
        .filter(s => s.booked >= 2)
        .sort((a, b) => b.booked - a.booked);

      setLeadSourceData(sourceArr);
    }

    // Weekly net member gain (from AMC log)
    if (amcRes.data && amcRes.data.length > 1) {
      const entries = amcRes.data as AmcEntry[];
      const weeks: { week: string; net: number }[] = [];
      for (let i = 1; i < entries.length; i++) {
        const net = entries[i].amc_value - entries[i - 1].amc_value;
        weeks.push({
          week: format(parseISO(entries[i].logged_date), 'M/d'),
          net,
        });
      }
      setWeeklyGains(weeks.slice(-12));
    }
  };

  // AMC card data
  const latest = amcEntries.length > 0 ? amcEntries[amcEntries.length - 1] : null;
  const previous = amcEntries.length > 1 ? amcEntries[amcEntries.length - 2] : null;
  const netChange = previous && latest ? latest.amc_value - previous.amc_value : 0;
  const progressPct = latest ? Math.min((latest.amc_value / AMC_TARGET) * 100, 100) : 0;
  const amcChartData = amcEntries.slice(-30).map(e => ({
    date: format(parseISO(e.logged_date), 'M/d'),
    amc: e.amc_value,
  }));

  return (
    <div className="space-y-4">
      {/* AMC Trend */}
      {latest && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                AMC Trend
              </span>
              <Badge variant="outline" className="text-xs">Target: {AMC_TARGET}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-3">
              <span className="text-4xl font-bold">{latest.amc_value}</span>
              {netChange !== 0 && (
                <span className={`flex items-center gap-0.5 text-sm font-medium pb-1 ${netChange > 0 ? 'text-success' : 'text-destructive'}`}>
                  {netChange > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {netChange > 0 ? '+' : ''}{netChange} since {previous ? format(parseISO(previous.logged_date), 'MMM d') : ''}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progressPct.toFixed(0)}% to goal</span>
                <span>{AMC_TARGET - latest.amc_value} to go</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
            {amcChartData.length > 1 && (
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={amcChartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <RechartsTooltip contentStyle={{ fontSize: '11px', padding: '4px 8px' }} formatter={(v: number) => [v, 'AMC']} />
                    <Line type="monotone" dataKey="amc" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Net Member Gain/Loss by Entry */}
      {weeklyGains.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Net Member Change
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyGains}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <RechartsTooltip contentStyle={{ fontSize: '11px', padding: '4px 8px' }} formatter={(v: number) => [v, 'Net']} />
                  <Bar dataKey="net" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lead Source Performance */}
      {leadSourceData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Lead Source → Member Conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leadSourceData.map(s => (
                <div key={s.source} className="flex items-center gap-2 text-sm">
                  <span className="w-36 truncate text-muted-foreground">{s.source}</span>
                  <div className="flex-1">
                    <Progress value={s.rate} className="h-2" />
                  </div>
                  <span className="w-20 text-right text-xs">
                    {s.sold}/{s.booked} ({s.rate}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Referral Discount Liability */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-warning" />
            Referral Discount Liability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold">{referralStats.qualified}</p>
              <p className="text-xs text-muted-foreground">Qualified</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{referralStats.pending}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-warning">${referralStats.liability}</p>
              <p className="text-xs text-muted-foreground">Owed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <HealthRow
            label="GroupMe Posts"
            ok={systemHealth.failedRecaps === 0}
            detail={systemHealth.lastGroupMePost
              ? `Last sent ${format(parseISO(systemHealth.lastGroupMePost), 'MMM d, h:mm a')}`
              : 'No posts yet'}
            warning={systemHealth.failedRecaps > 0 ? `${systemHealth.failedRecaps} failed` : undefined}
          />
          <HealthRow
            label="Data Sync"
            ok={systemHealth.lastSyncStatus === 'success'}
            detail={systemHealth.lastSyncTime
              ? `Last sync ${format(parseISO(systemHealth.lastSyncTime), 'MMM d, h:mm a')}`
              : 'No syncs recorded'}
            warning={systemHealth.lastSyncStatus === 'error' ? 'Last sync failed' : undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function HealthRow({ label, ok, detail, warning }: { label: string; ok: boolean; detail: string; warning?: string }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
      <div className="flex items-center gap-2">
        {warning ? (
          <AlertTriangle className="w-4 h-4 text-warning" />
        ) : ok ? (
          <CheckCircle className="w-4 h-4 text-success" />
        ) : (
          <XCircle className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-right">
        <p className="text-xs text-muted-foreground">{detail}</p>
        {warning && <p className="text-xs text-warning font-medium">{warning}</p>}
      </div>
    </div>
  );
}
