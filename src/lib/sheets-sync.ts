import { supabase } from '@/integrations/supabase/client';

const SPREADSHEET_ID_KEY = 'otf_sheets_spreadsheet_id';

export function getSpreadsheetId(): string | null {
  return localStorage.getItem(SPREADSHEET_ID_KEY);
}

export function setSpreadsheetId(id: string): void {
  localStorage.setItem(SPREADSHEET_ID_KEY, id);
}

export async function syncShiftRecap(recap: Record<string, unknown>): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    console.log('No spreadsheet ID configured, skipping sync');
    return false;
  }

  try {
    const { data, error } = await supabase.functions.invoke('sync-sheets', {
      body: {
        action: 'sync_shift_recap',
        spreadsheetId,
        data: recap,
      },
    });

    if (error) throw error;
    return data?.success ?? false;
  } catch (error) {
    console.error('Failed to sync shift recap:', error);
    return false;
  }
}

export async function syncIGLead(lead: Record<string, unknown>): Promise<boolean> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    console.log('No spreadsheet ID configured, skipping sync');
    return false;
  }

  try {
    const { data, error } = await supabase.functions.invoke('sync-sheets', {
      body: {
        action: 'sync_ig_lead',
        spreadsheetId,
        data: lead,
      },
    });

    if (error) throw error;
    return data?.success ?? false;
  } catch (error) {
    console.error('Failed to sync IG lead:', error);
    return false;
  }
}

export async function syncAllUnsynced(): Promise<{ success: boolean; recordsSynced: number }> {
  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) {
    return { success: false, recordsSynced: 0 };
  }

  try {
    const { data, error } = await supabase.functions.invoke('sync-sheets', {
      body: {
        action: 'sync_all_unsynced',
        spreadsheetId,
      },
    });

    if (error) throw error;
    return { success: data?.success ?? false, recordsSynced: data?.recordsSynced ?? 0 };
  } catch (error) {
    console.error('Failed to sync all unsynced:', error);
    return { success: false, recordsSynced: 0 };
  }
}
