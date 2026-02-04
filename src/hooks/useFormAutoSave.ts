import { useState, useEffect, useCallback } from 'react';

interface FormData {
  shiftType: string;
  date: string;
  callsMade: number;
  textsSent: number;
  emailsSent: number;
  dmsSent: number;
  introsBooked: any[];
  introsRun: any[];
  sales: any[];
  notes: string;
}

const STORAGE_KEY = 'otf_shift_recap_draft';
const AUTO_SAVE_INTERVAL = 1000; // 1 second

export function useFormAutoSave(userName: string | undefined) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Get the storage key unique to the user
  const getStorageKey = useCallback(() => {
    return `${STORAGE_KEY}_${userName || 'unknown'}`;
  }, [userName]);

  // Load saved form data
  const loadDraft = useCallback((): FormData | null => {
    try {
      const saved = localStorage.getItem(getStorageKey());
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check if the draft is from today
        const today = new Date().toISOString().split('T')[0];
        if (parsed.date === today) {
          return parsed;
        }
        // Clear old drafts
        localStorage.removeItem(getStorageKey());
      }
      return null;
    } catch (error) {
      console.error('Error loading draft:', error);
      return null;
    }
  }, [getStorageKey]);

  // Save form data
  const saveDraft = useCallback((data: FormData) => {
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(data));
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving draft:', error);
    }
  }, [getStorageKey]);

  // Clear saved draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(getStorageKey());
      setLastSaved(null);
    } catch (error) {
      console.error('Error clearing draft:', error);
    }
  }, [getStorageKey]);

  // Check if there's a saved draft
  const hasDraft = useCallback((): boolean => {
    try {
      const saved = localStorage.getItem(getStorageKey());
      if (saved) {
        const parsed = JSON.parse(saved);
        const today = new Date().toISOString().split('T')[0];
        return parsed.date === today;
      }
      return false;
    } catch {
      return false;
    }
  }, [getStorageKey]);

  return {
    loadDraft,
    saveDraft,
    clearDraft,
    hasDraft,
    lastSaved,
    AUTO_SAVE_INTERVAL,
  };
}
