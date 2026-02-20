/**
 * Hook that fetches Pipeline data and returns derived, memoized structures.
 * Uses canon fields first with legacy fallback.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useData } from '@/context/DataContext';
import { toast } from 'sonner';
import {
  buildJourneys,
  computeTabCounts,
  filterJourneysByTab,
  filterBySearch,
  getLeadSourceOptions,
  groupByVipClass,
} from './selectors';
import type {
  PipelineBooking,
  PipelineRun,
  ClientJourney,
  JourneyTab,
  VipInfo,
} from './pipelineTypes';

const BOOKING_SELECT = 'id, booking_id, member_name, class_date, intro_time, coach_name, sa_working_shift, booked_by, lead_source, fitness_goal, booking_status, booking_status_canon, booking_type_canon, intro_owner, intro_owner_locked, originating_booking_id, vip_class_name, phone, email, is_vip, rebooked_from_booking_id, rebook_reason, rebooked_at';
const RUN_SELECT = 'id, run_id, member_name, run_date, class_time, result, result_canon, intro_owner, ran_by, lead_source, goal_quality, pricing_engagement, notes, commission_amount, linked_intro_booked_id, goal_why_captured, relationship_experience, made_a_friend, buy_date, coach_name, sa_name, amc_incremented_at';

export function usePipelineData() {
  const { refreshData: refreshGlobalData } = useData();
  const [bookings, setBookings] = useState<PipelineBooking[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [vipInfoMap, setVipInfoMap] = useState<Map<string, VipInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<JourneyTab>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterInconsistencies, setFilterInconsistencies] = useState(false);
  const [selectedLeadSource, setSelectedLeadSource] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [bookingsRes, runsRes] = await Promise.all([
        supabase.from('intros_booked').select(BOOKING_SELECT).is('deleted_at', null).order('class_date', { ascending: false }),
        supabase.from('intros_run').select(RUN_SELECT).order('run_date', { ascending: false }),
      ]);
      if (bookingsRes.error) throw bookingsRes.error;
      if (runsRes.error) throw runsRes.error;
      setBookings((bookingsRes.data || []) as PipelineBooking[]);
      setRuns((runsRes.data || []) as PipelineRun[]);
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
      toast.error('Failed to load pipeline data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchVipInfo = useCallback(async () => {
    const { data } = await supabase.from('vip_registrations').select('booking_id, birthday, weight_lbs');
    if (data) {
      const map = new Map<string, VipInfo>();
      data.forEach((r: any) => {
        if (r.booking_id) map.set(r.booking_id, { birthday: r.birthday, weight_lbs: r.weight_lbs });
      });
      setVipInfoMap(map);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchVipInfo();
  }, [fetchData, fetchVipInfo]);

  // Derived data
  const journeys = useMemo(() => buildJourneys(bookings, runs), [bookings, runs]);
  const tabCounts = useMemo(() => computeTabCounts(journeys), [journeys]);
  const leadSourceOptions = useMemo(() => getLeadSourceOptions(journeys), [journeys]);
  const inconsistencyCount = useMemo(() => journeys.filter(j => j.hasInconsistency).length, [journeys]);

  const filteredJourneys = useMemo(() => {
    let filtered = journeys;
    filtered = filterBySearch(filtered, searchTerm);
    if (filterInconsistencies) filtered = filtered.filter(j => j.hasInconsistency);
    filtered = filterJourneysByTab(filtered, activeTab, selectedLeadSource);
    return filtered;
  }, [journeys, searchTerm, filterInconsistencies, activeTab, selectedLeadSource]);

  const vipGroups = useMemo(() => {
    if (activeTab !== 'vip_class') return null;
    return groupByVipClass(filteredJourneys);
  }, [filteredJourneys, activeTab]);

  const refreshAll = useCallback(async () => {
    await fetchData();
    await refreshGlobalData();
  }, [fetchData, refreshGlobalData]);

  return {
    // Data
    bookings,
    runs,
    journeys,
    filteredJourneys,
    vipGroups,
    vipInfoMap,
    tabCounts,
    leadSourceOptions,
    inconsistencyCount,
    isLoading,
    // Filter state
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
    filterInconsistencies,
    setFilterInconsistencies,
    selectedLeadSource,
    setSelectedLeadSource,
    // Actions
    fetchData,
    refreshAll,
  };
}
