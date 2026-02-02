import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { syncIGLead, syncShiftRecap } from '@/lib/sheets-sync';

// Types
export type LeadStatus = 'not_booked' | 'booked' | 'no_show' | 'closed';

export interface IGLead {
  id: string;
  sa_name: string;
  date_added: string;
  instagram_handle: string;
  first_name: string;
  last_name?: string | null;
  phone_number?: string | null;
  email?: string | null;
  interest_level: string;
  notes?: string | null;
  status: LeadStatus;
  synced_to_sheets?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShiftRecap {
  id: string;
  staff_name: string;
  shift_date: string;
  shift_type: string;
  calls_made: number;
  texts_sent: number;
  emails_sent: number;
  dms_sent: number;
  otbeat_sales?: number | null;
  otbeat_buyer_names?: string | null;
  upgrades?: number | null;
  upgrade_details?: string | null;
  downgrades?: number | null;
  downgrade_details?: string | null;
  cancellations?: number | null;
  cancellation_details?: string | null;
  freezes?: number | null;
  freeze_details?: string | null;
  milestones_celebrated?: string | null;
  equipment_issues?: string | null;
  other_info?: string | null;
  synced_to_sheets?: boolean;
  created_at: string;
  submitted_at?: string | null;
}

interface DataContextType {
  igLeads: IGLead[];
  shiftRecaps: ShiftRecap[];
  isLoading: boolean;
  addIGLead: (lead: Omit<IGLead, 'id' | 'created_at' | 'updated_at' | 'synced_to_sheets'>) => Promise<IGLead | null>;
  updateIGLead: (id: string, updates: Partial<IGLead>) => Promise<void>;
  deleteIGLead: (id: string) => Promise<void>;
  addShiftRecap: (recap: Omit<ShiftRecap, 'id' | 'created_at' | 'synced_to_sheets'>) => Promise<ShiftRecap | null>;
  findMatchingIGLead: (name: string, phone?: string, email?: string) => IGLead | undefined;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [igLeads, setIGLeads] = useState<IGLead[]>([]);
  const [shiftRecaps, setShiftRecaps] = useState<ShiftRecap[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [leadsResult, recapsResult] = await Promise.all([
        supabase.from('ig_leads').select('*').order('created_at', { ascending: false }),
        supabase.from('shift_recaps').select('*').order('created_at', { ascending: false }),
      ]);

      if (leadsResult.data) {
        setIGLeads(leadsResult.data as IGLead[]);
      }
      if (recapsResult.data) {
        setShiftRecaps(recapsResult.data as ShiftRecap[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addIGLead = useCallback(async (lead: Omit<IGLead, 'id' | 'created_at' | 'updated_at' | 'synced_to_sheets'>): Promise<IGLead | null> => {
    try {
      const { data, error } = await supabase
        .from('ig_leads')
        .insert({
          sa_name: lead.sa_name,
          date_added: lead.date_added,
          instagram_handle: lead.instagram_handle,
          first_name: lead.first_name,
          last_name: lead.last_name,
          phone_number: lead.phone_number,
          email: lead.email,
          interest_level: lead.interest_level,
          notes: lead.notes,
          status: lead.status,
        })
        .select()
        .single();

      if (error) throw error;
      
      const newLead = data as IGLead;
      setIGLeads(prev => [newLead, ...prev]);
      
      // Sync to Google Sheets in background
      syncIGLead(newLead as unknown as Record<string, unknown>);
      
      return newLead;
    } catch (error) {
      console.error('Error adding IG lead:', error);
      return null;
    }
  }, []);

  const updateIGLead = useCallback(async (id: string, updates: Partial<IGLead>) => {
    try {
      const { error } = await supabase
        .from('ig_leads')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      setIGLeads(prev => prev.map(lead => 
        lead.id === id ? { ...lead, ...updates, updated_at: new Date().toISOString() } : lead
      ));
    } catch (error) {
      console.error('Error updating IG lead:', error);
    }
  }, []);

  const deleteIGLead = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('ig_leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setIGLeads(prev => prev.filter(lead => lead.id !== id));
    } catch (error) {
      console.error('Error deleting IG lead:', error);
    }
  }, []);

  const addShiftRecap = useCallback(async (recap: Omit<ShiftRecap, 'id' | 'created_at' | 'synced_to_sheets'>): Promise<ShiftRecap | null> => {
    try {
      const { data, error } = await supabase
        .from('shift_recaps')
        .insert({
          staff_name: recap.staff_name,
          shift_date: recap.shift_date,
          shift_type: recap.shift_type,
          calls_made: recap.calls_made,
          texts_sent: recap.texts_sent,
          emails_sent: recap.emails_sent,
          dms_sent: recap.dms_sent,
          otbeat_sales: recap.otbeat_sales,
          otbeat_buyer_names: recap.otbeat_buyer_names,
          upgrades: recap.upgrades,
          upgrade_details: recap.upgrade_details,
          downgrades: recap.downgrades,
          downgrade_details: recap.downgrade_details,
          cancellations: recap.cancellations,
          cancellation_details: recap.cancellation_details,
          freezes: recap.freezes,
          freeze_details: recap.freeze_details,
          milestones_celebrated: recap.milestones_celebrated,
          equipment_issues: recap.equipment_issues,
          other_info: recap.other_info,
          submitted_at: recap.submitted_at,
        })
        .select()
        .single();

      if (error) throw error;
      
      const newRecap = data as ShiftRecap;
      setShiftRecaps(prev => [newRecap, ...prev]);
      
      // Sync to Google Sheets in background
      syncShiftRecap(newRecap as unknown as Record<string, unknown>);
      
      return newRecap;
    } catch (error) {
      console.error('Error adding shift recap:', error);
      return null;
    }
  }, []);

  const findMatchingIGLead = useCallback((name: string, phone?: string, email?: string): IGLead | undefined => {
    const nameLower = name.toLowerCase();
    return igLeads.find(lead => {
      const leadNameLower = `${lead.first_name} ${lead.last_name || ''}`.toLowerCase().trim();
      const nameMatch = leadNameLower.includes(nameLower) || nameLower.includes(leadNameLower);
      const phoneMatch = phone && lead.phone_number && lead.phone_number.replace(/\D/g, '') === phone.replace(/\D/g, '');
      const emailMatch = email && lead.email && lead.email.toLowerCase() === email.toLowerCase();
      return nameMatch || phoneMatch || emailMatch;
    });
  }, [igLeads]);

  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return (
    <DataContext.Provider value={{
      igLeads,
      shiftRecaps,
      isLoading,
      addIGLead,
      updateIGLead,
      deleteIGLead,
      addShiftRecap,
      findMatchingIGLead,
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
