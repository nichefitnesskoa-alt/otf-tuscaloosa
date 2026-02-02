import React, { createContext, useContext, useState, useCallback } from 'react';
import { IGLead, ShiftRecap } from '@/types';

interface DataContextType {
  igLeads: IGLead[];
  shiftRecaps: ShiftRecap[];
  addIGLead: (lead: Omit<IGLead, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateIGLead: (id: string, updates: Partial<IGLead>) => void;
  deleteIGLead: (id: string) => void;
  addShiftRecap: (recap: Omit<ShiftRecap, 'id' | 'createdAt'>) => void;
  findMatchingIGLead: (name: string, phone?: string, email?: string) => IGLead | undefined;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [igLeads, setIGLeads] = useState<IGLead[]>(() => {
    const saved = localStorage.getItem('otf_ig_leads');
    return saved ? JSON.parse(saved) : [];
  });

  const [shiftRecaps, setShiftRecaps] = useState<ShiftRecap[]>(() => {
    const saved = localStorage.getItem('otf_shift_recaps');
    return saved ? JSON.parse(saved) : [];
  });

  const saveIGLeads = (leads: IGLead[]) => {
    setIGLeads(leads);
    localStorage.setItem('otf_ig_leads', JSON.stringify(leads));
  };

  const saveShiftRecaps = (recaps: ShiftRecap[]) => {
    setShiftRecaps(recaps);
    localStorage.setItem('otf_shift_recaps', JSON.stringify(recaps));
  };

  const addIGLead = useCallback((lead: Omit<IGLead, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newLead: IGLead = {
      ...lead,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...igLeads, newLead];
    saveIGLeads(updated);
  }, [igLeads]);

  const updateIGLead = useCallback((id: string, updates: Partial<IGLead>) => {
    const updated = igLeads.map(lead =>
      lead.id === id ? { ...lead, ...updates, updatedAt: new Date().toISOString() } : lead
    );
    saveIGLeads(updated);
  }, [igLeads]);

  const deleteIGLead = useCallback((id: string) => {
    const updated = igLeads.filter(lead => lead.id !== id);
    saveIGLeads(updated);
  }, [igLeads]);

  const addShiftRecap = useCallback((recap: Omit<ShiftRecap, 'id' | 'createdAt'>) => {
    const newRecap: ShiftRecap = {
      ...recap,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const updated = [...shiftRecaps, newRecap];
    saveShiftRecaps(updated);
  }, [shiftRecaps]);

  const findMatchingIGLead = useCallback((name: string, phone?: string, email?: string): IGLead | undefined => {
    const nameLower = name.toLowerCase();
    return igLeads.find(lead => {
      const leadNameLower = `${lead.firstName} ${lead.lastName || ''}`.toLowerCase().trim();
      const nameMatch = leadNameLower.includes(nameLower) || nameLower.includes(leadNameLower);
      const phoneMatch = phone && lead.phoneNumber && lead.phoneNumber.replace(/\D/g, '') === phone.replace(/\D/g, '');
      const emailMatch = email && lead.email && lead.email.toLowerCase() === email.toLowerCase();
      return nameMatch || phoneMatch || emailMatch;
    });
  }, [igLeads]);

  return (
    <DataContext.Provider value={{
      igLeads,
      shiftRecaps,
      addIGLead,
      updateIGLead,
      deleteIGLead,
      addShiftRecap,
      findMatchingIGLead,
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
