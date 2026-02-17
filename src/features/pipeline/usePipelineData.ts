/**
 * usePipelineData — consumes raw Supabase data and returns memoized pipeline structures.
 * Fetches directly (not from DataContext) to get full field sets including canon columns.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useData } from '@/context/DataContext';
import type {
  PipelineBooking,
  PipelineRun,
  ClientJourney,
  JourneyTab,
  TabCounts,
  VipInfo,
} from './pipelineTypes';
import {
  buildJourneys,
  computeTabCounts,
  filterJourneysByTab,
  filterJourneysBySearch,
  getLeadSourceOptions,
  groupByVipClass,
} from './selectors';

export interface UsePipelineDataReturn {
  journeys: ClientJourney[];
  filteredJourneys: ClientJourney[];
  tabCounts: TabCounts;
  leadSourceOptions: string[];
  vipGroups: [string, ClientJourney[]][] | null;
  inconsistencyCount: number;
  isLoading: boolean;
  vipInfoMap: Map<string, VipInfo>;
  // Filter state
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  activeTab: JourneyTab;
  setActiveTab: (t: JourneyTab) => void;
  filterInconsistencies: boolean;
  setFilterInconsistencies: (v: boolean) => void;
  selectedLeadSource: string | null;
  setSelectedLeadSource: (s: string | null) => void;
  // Actions
  fetchData: () => Promise<void>;
  allBookings: PipelineBooking[];
  allRuns: PipelineRun[];
}

export function usePipelineData(): UsePipelineDataReturn {
  const { refreshData: refreshGlobalData } = useData();
  const [bookings, setBookings] = useState<PipelineBooking[]>([]);
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [vipInfoMap, setVipInfoMap] = useState<Map<string, VipInfo>>(new Map());

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<JourneyTab>('all');
  const [filterInconsistencies, setFilterInconsistencies] = useState(false);
  const [selectedLeadSource, setSelectedLeadSource] = useState<string | null>(null);

  const fetchVipInfo = useCallback(async () => {
    const { data } = await supabase
      .from('vip_registrations')
      .select('booking_id, birthday, weight_lbs');
    if (data) {
      const map = new Map<string, VipInfo>();
      data.forEach((r: any) => {
        if (r.booking_id) map.set(r.booking_id, { birthday: r.birthday, weight_lbs: r.weight_lbs });
      });
      setVipInfoMap(map);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [bookingsRes, runsRes] = await Promise.all([
        supabase
          .from('intros_booked')
          .select('id, booking_id, member_name, class_date, intro_time, coach_name, sa_working_shift, booked_by, lead_source, fitness_goal, booking_status, booking_status_canon, intro_owner, intro_owner_locked, originating_booking_id, vip_class_name, phone, email, is_vip, rebooked_from_booking_id, rebook_reason, rebooked_at, deleted_at')
          .order('class_date', { ascending: false }),
        supabase
          .from('intros_run')
          .select('id, run_id, member_name, run_date, class_time, result, result_canon, intro_owner, ran_by, lead_source, goal_quality, pricing_engagement, notes, commission_amount, linked_intro_booked_id, goal_why_captured, relationship_experience, made_a_friend, buy_date, coach_name, sa_name')
          .order('run_date', { ascending: false }),
      ]);

      if (bookingsRes.error) throw bookingsRes.error;
      if (runsRes.error) throw runsRes.error;

      setBookings((bookingsRes.data || []) as PipelineBooking[]);
      setRuns((runsRes.data || []) as PipelineRun[]);
    } catch (error) {
      console.error('Error fetching pipeline data:', error);
    } finally {
      setIsLoading(false);
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

  const inconsistencyCount = useMemo(() =>
    journeys.filter(j => j.hasInconsistency).length,
    [journeys]
  );

  const filteredJourneys = useMemo(() => {
    let filtered = journeys;
    filtered = filterJourneysBySearch(filtered, searchTerm);
    if (filterInconsistencies) {
      filtered = filtered.filter(j => j.hasInconsistency);
    }
    filtered = filterJourneysByTab(filtered, activeTab, selectedLeadSource);
    return filtered;
  }, [journeys, searchTerm, filterInconsistencies, activeTab, selectedLeadSource]);

  const vipGroups = useMemo(() => {
    if (activeTab !== 'vip_class') return null;
    return groupByVipClass(filteredJourneys);
  }, [filteredJourneys, activeTab]);

  return {
    journeys,
    filteredJourneys,
    tabCounts,
    leadSourceOptions,
    vipGroups,
    inconsistencyCount,
    isLoading,
    vipInfoMap,
    searchTerm,
    setSearchTerm,
    activeTab,
    setActiveTab,
    filterInconsistencies,
    setFilterInconsistencies,
    selectedLeadSource,
    setSelectedLeadSource,
    fetchData,
    allBookings: bookings,
    allRuns: runs,
  };
}
