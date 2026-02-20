/**
 * TodayActivityLog — Collapsible log of everything created/logged today.
 * Shows bookings created, outcomes logged, outside sales, and follow-up purchases.
 * Edit buttons open the existing edit sheets.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TodayBooking {
  id: string;
  member_name: string;
  intro_time: string | null;
  coach_name: string;
  lead_source: string;
  created_at: string;
}

interface TodayOutcome {
  id: string;
  member_name: string;
  result: string;
  commission_amount: number | null;
  created_at: string;
  linked_intro_booked_id: string | null;
}

interface TodaySale {
  id: string;
  member_name: string;
  membership_type: string;
  sale_type: string | null;
  commission_amount: number | null;
  created_at: string;
}

interface TodayActivityLogProps {
  onEditBooking?: (bookingId: string) => void;
  onEditOutcome?: (runId: string) => void;
  /** Refresh trigger — increment to force a reload */
  refreshKey?: number;
}

const SALE_RESULTS = ['Premier + OTbeat', 'Premier', 'Elite + OTbeat', 'Elite', 'Basic + OTbeat', 'Basic', 'Premier + OTBeat', 'Elite + OTBeat', 'Basic + OTBeat'];

function isSaleResult(result: string) {
  return SALE_RESULTS.some(r => result.toLowerCase().includes(r.toLowerCase().replace(' + otbeat', '')) && result !== 'No-show' && result !== "Didn't Buy");
}

function formatCommission(amount: number | null | undefined): string {
  if (!amount) return '';
  return ` · $${amount.toFixed(2)}`;
}

function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  try {
    const [h, m] = timeStr.split(':');
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m));
    return format(d, 'h:mm a');
  } catch {
    return timeStr;
  }
}

export function TodayActivityLog({ onEditBooking, onEditOutcome, refreshKey }: TodayActivityLogProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [bookings, setBookings] = useState<TodayBooking[]>([]);
  const [outcomes, setOutcomes] = useState<TodayOutcome[]>([]);
  const [sales, setSales] = useState<TodaySale[]>([]);
  const [loading, setLoading] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayStart = today + 'T00:00:00';

  const fetchData = useCallback(async () => {
    if (!user?.name) return;
    setLoading(true);
    try {
      const [bookingsRes, outcomesRes, salesRes] = await Promise.all([
        // Bookings created today by this SA (exclude VIP/COMP)
        supabase
          .from('intros_booked')
          .select('id, member_name, intro_time, coach_name, lead_source, created_at, booking_type_canon')
          .eq('booked_by', user.name)
          .gte('created_at', todayStart)
          .is('deleted_at', null)
          .not('booking_type_canon', 'in', '("VIP","COMP")')
          .order('created_at', { ascending: true }),

        // Outcomes logged today by this SA (intros_run)
        supabase
          .from('intros_run')
          .select('id, member_name, result, commission_amount, created_at, linked_intro_booked_id')
          .eq('sa_name', user.name)
          .gte('created_at', todayStart)
          .order('created_at', { ascending: true }),

        // Outside sales logged today by this SA
        supabase
          .from('sales_outside_intro')
          .select('id, member_name, membership_type, sale_type, commission_amount, created_at')
          .eq('intro_owner', user.name)
          .gte('created_at', todayStart)
          .order('created_at', { ascending: true }),
      ]);

      setBookings((bookingsRes.data || []) as TodayBooking[]);
      setOutcomes((outcomesRes.data || []) as TodayOutcome[]);
      setSales((salesRes.data || []) as TodaySale[]);
    } finally {
      setLoading(false);
    }
  }, [user?.name, todayStart]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  const totalCount = bookings.length + outcomes.length + sales.length;

  if (totalCount === 0 && !loading) return null;

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="text-sm font-semibold">Today's Activity</span>
          {totalCount > 0 && (
            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{totalCount}</span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{loading ? 'Loading...' : (open ? 'Collapse' : 'View all')}</span>
      </button>

      {open && (
        <div className="border-t border-border px-3 pb-3 space-y-3 pt-2">
          {/* ── Bookings ── */}
          {bookings.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Bookings Created Today</p>
              <div className="space-y-1">
                {bookings.map(b => (
                  <div key={b.id} className="flex items-center justify-between gap-2 rounded bg-muted/40 px-2.5 py-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{b.member_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {formatTime(b.intro_time)}{b.intro_time ? ' · ' : ''}{b.coach_name} · {b.lead_source}
                      </p>
                    </div>
                    {onEditBooking && (
                      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => onEditBooking(b.id)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Outcomes ── */}
          {outcomes.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Outcomes Logged Today</p>
              <div className="space-y-1">
                {outcomes.map(o => (
                  <div key={o.id} className={cn(
                    'flex items-center justify-between gap-2 rounded px-2.5 py-1.5',
                    isSaleResult(o.result) ? 'bg-green-500/10' : 'bg-muted/40'
                  )}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{o.member_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {o.result}{formatCommission(o.commission_amount)}
                      </p>
                    </div>
                    {onEditOutcome && o.linked_intro_booked_id && (
                      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => onEditOutcome(o.id)}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Outside Sales ── */}
          {sales.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Outside Sales Today</p>
              <div className="space-y-1">
                {sales.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-2 rounded bg-green-500/10 px-2.5 py-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{s.member_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {s.sale_type || 'Sale'} · {s.membership_type}{formatCommission(s.commission_amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
