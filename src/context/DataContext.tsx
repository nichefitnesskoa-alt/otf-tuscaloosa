import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { writeCache, readCache, getLastCacheTime } from '@/lib/offline/cache';
import { getPendingCount } from '@/lib/offline/writeQueue';
import { runSync, SyncResult } from '@/lib/offline/sync';

export interface ShiftRecap {
  id: string;
  shift_id?: string | null;
  staff_name: string;
  shift_date: string;
  shift_type: string;
  calls_made: number;
  texts_sent: number;
  emails_sent: number;
  dms_sent: number;
  other_info?: string | null;
  synced_to_sheets?: boolean;
  created_at: string;
  submitted_at?: string | null;
}

export interface IntroBooked {
  id: string;
  booking_id?: string | null;
  member_name: string;
  class_date: string;
  intro_time?: string | null;
  coach_name: string;
  sa_working_shift: string;
  booked_by?: string | null;
  lead_source: string;
  fitness_goal?: string | null;
  intro_owner?: string | null;
  intro_owner_locked?: boolean | null;
  originating_booking_id?: string | null;
  is_vip?: boolean | null;
  created_at: string;
}

export interface IntroRun {
  id: string;
  run_id?: string | null;
  member_name: string;
  run_date?: string | null;
  class_time: string;
  lead_source?: string | null;
  intro_owner?: string | null;
  intro_owner_locked?: boolean;
  result: string;
  goal_quality?: string | null;
  pricing_engagement?: string | null;
  fvc_completed?: boolean;
  rfg_presented?: boolean;
  choice_architecture?: boolean;
  halfway_encouragement?: boolean;
  premobility_encouragement?: boolean;
  coaching_summary_presence?: boolean;
  notes?: string | null;
  sa_name?: string | null;
  commission_amount?: number | null;
  linked_intro_booked_id?: string | null;
  buy_date?: string | null;
  created_at: string;
}

export interface Sale {
  id: string;
  sale_id?: string | null;
  sale_type?: string | null;
  member_name: string;
  lead_source: string;
  membership_type: string;
  commission_amount?: number | null;
  intro_owner?: string | null;
  date_closed?: string | null;
  pay_period_start?: string | null;
  pay_period_end?: string | null;
  created_at: string;
}

export type FollowUpQueueRow = Tables<'follow_up_queue'>;
export type FollowupTouchRow = Tables<'followup_touches'>;

interface DataContextType {
  shiftRecaps: ShiftRecap[];
  introsBooked: IntroBooked[];
  introsRun: IntroRun[];
  sales: Sale[];
  followUpQueue: FollowUpQueueRow[];
  followupTouches: FollowupTouchRow[];
  isLoading: boolean;
  lastUpdated: Date | null;
  lastSyncAt: string | null;
  pendingQueueCount: number;
  usingCachedData: boolean;
  refreshData: () => Promise<void>;
  refreshFollowUps: () => Promise<void>;
  refreshTouches: () => Promise<void>;
  runSyncNow: () => Promise<SyncResult>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [shiftRecaps, setShiftRecaps] = useState<ShiftRecap[]>([]);
  const [introsBooked, setIntrosBooked] = useState<IntroBooked[]>([]);
  const [introsRun, setIntrosRun] = useState<IntroRun[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [followUpQueue, setFollowUpQueue] = useState<FollowUpQueueRow[]>([]);
  const [followupTouches, setFollowupTouches] = useState<FollowupTouchRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(getLastCacheTime());
  const [pendingQueueCount, setPendingQueueCount] = useState(getPendingCount());
  const [usingCachedData, setUsingCachedData] = useState(false);

  const getCutoff = () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 120);
    return cutoffDate.toISOString();
  };

  // Load cached data on mount (instant UI)
  useEffect(() => {
    const cached = {
      intros_booked: readCache<IntroBooked[]>('intros_booked'),
      intros_run: readCache<IntroRun[]>('intros_run'),
      follow_up_queue: readCache<FollowUpQueueRow[]>('follow_up_queue'),
      followup_touches: readCache<FollowupTouchRow[]>('followup_touches'),
      shift_recaps: readCache<ShiftRecap[]>('shift_recaps'),
      sales: readCache<Sale[]>('sales'),
    };

    let hasCached = false;
    if (cached.intros_booked?.data) { setIntrosBooked(cached.intros_booked.data); hasCached = true; }
    if (cached.intros_run?.data) { setIntrosRun(cached.intros_run.data); hasCached = true; }
    if (cached.follow_up_queue?.data) { setFollowUpQueue(cached.follow_up_queue.data); hasCached = true; }
    if (cached.followup_touches?.data) { setFollowupTouches(cached.followup_touches.data); hasCached = true; }
    if (cached.shift_recaps?.data) { setShiftRecaps(cached.shift_recaps.data); hasCached = true; }
    if (cached.sales?.data) { setSales(cached.sales.data); hasCached = true; }

    if (hasCached) {
      setUsingCachedData(true);
      setIsLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const cutoff = getCutoff();

      const [recapsResult, bookingsResult, runsResult, salesResult, fuQueueResult, touchesResult] = await Promise.all([
        supabase.from('shift_recaps').select('*').gte('created_at', cutoff).order('created_at', { ascending: false }),
        supabase.from('intros_booked').select('*').gte('created_at', cutoff).order('created_at', { ascending: false }),
        supabase.from('intros_run').select('*').gte('created_at', cutoff).order('created_at', { ascending: false }),
        supabase.from('sales_outside_intro').select('*').gte('created_at', cutoff).order('created_at', { ascending: false }),
        supabase.from('follow_up_queue').select('*').gte('created_at', cutoff).order('scheduled_date', { ascending: true }),
        supabase.from('followup_touches').select('*').gte('created_at', cutoff).order('created_at', { ascending: false }),
      ]);

      if (recapsResult.data) { setShiftRecaps(recapsResult.data as ShiftRecap[]); writeCache('shift_recaps', recapsResult.data); }
      if (bookingsResult.data) { setIntrosBooked(bookingsResult.data as IntroBooked[]); writeCache('intros_booked', bookingsResult.data); }
      if (runsResult.data) { setIntrosRun(runsResult.data as IntroRun[]); writeCache('intros_run', runsResult.data); }
      if (salesResult.data) { setSales(salesResult.data as Sale[]); writeCache('sales', salesResult.data); }
      if (fuQueueResult.data) { setFollowUpQueue(fuQueueResult.data); writeCache('follow_up_queue', fuQueueResult.data); }
      if (touchesResult.data) { setFollowupTouches(touchesResult.data); writeCache('followup_touches', touchesResult.data); }
      
      const now = new Date();
      setLastUpdated(now);
      setLastSyncAt(now.toISOString());
      setUsingCachedData(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      // If fetch fails and we have no data, the cached data from mount is still showing
      if (!lastUpdated) {
        setUsingCachedData(true);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll pending queue count
  useEffect(() => {
    const interval = setInterval(() => {
      setPendingQueueCount(getPendingCount());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    const handleOnline = async () => {
      if (getPendingCount() > 0) {
        const result = await runSync();
        setPendingQueueCount(getPendingCount());
        if (result.synced > 0) {
          await fetchData();
        }
      } else {
        await fetchData();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [fetchData]);

  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const refreshFollowUps = useCallback(async () => {
    try {
      const cutoff = getCutoff();
      const { data } = await supabase.from('follow_up_queue').select('*').gte('created_at', cutoff).order('scheduled_date', { ascending: true });
      if (data) {
        setFollowUpQueue(data);
        writeCache('follow_up_queue', data);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error refreshing follow-ups:', error);
    }
  }, []);

  const refreshTouches = useCallback(async () => {
    try {
      const cutoff = getCutoff();
      const { data } = await supabase.from('followup_touches').select('*').gte('created_at', cutoff).order('created_at', { ascending: false });
      if (data) {
        setFollowupTouches(data);
        writeCache('followup_touches', data);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error refreshing touches:', error);
    }
  }, []);

  const runSyncNow = useCallback(async (): Promise<SyncResult> => {
    const result = await runSync();
    setPendingQueueCount(getPendingCount());
    if (result.synced > 0) {
      await fetchData();
    }
    return result;
  }, [fetchData]);

  return (
    <DataContext.Provider value={{
      shiftRecaps,
      introsBooked,
      introsRun,
      sales,
      followUpQueue,
      followupTouches,
      isLoading,
      lastUpdated,
      lastSyncAt,
      pendingQueueCount,
      usingCachedData,
      refreshData,
      refreshFollowUps,
      refreshTouches,
      runSyncNow,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
