import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSpreadsheetId } from '@/lib/sheets-sync';

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
  lead_source: string;
  fitness_goal?: string | null;
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
  pay_period_start?: string | null;
  pay_period_end?: string | null;
  created_at: string;
}

interface DataContextType {
  shiftRecaps: ShiftRecap[];
  introsBooked: IntroBooked[];
  introsRun: IntroRun[];
  sales: Sale[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [shiftRecaps, setShiftRecaps] = useState<ShiftRecap[]>([]);
  const [introsBooked, setIntrosBooked] = useState<IntroBooked[]>([]);
  const [introsRun, setIntrosRun] = useState<IntroRun[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [recapsResult, bookingsResult, runsResult, salesResult] = await Promise.all([
        supabase.from('shift_recaps').select('*').order('created_at', { ascending: false }),
        supabase.from('intros_booked').select('*').order('created_at', { ascending: false }),
        supabase.from('intros_run').select('*').order('created_at', { ascending: false }),
        supabase.from('sales_outside_intro').select('*').order('created_at', { ascending: false }),
      ]);

      if (recapsResult.data) setShiftRecaps(recapsResult.data as ShiftRecap[]);
      if (bookingsResult.data) setIntrosBooked(bookingsResult.data as IntroBooked[]);
      if (runsResult.data) setIntrosRun(runsResult.data as IntroRun[]);
      if (salesResult.data) setSales(salesResult.data as Sale[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return (
    <DataContext.Provider value={{
      shiftRecaps,
      introsBooked,
      introsRun,
      sales,
      isLoading,
      refreshData,
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
