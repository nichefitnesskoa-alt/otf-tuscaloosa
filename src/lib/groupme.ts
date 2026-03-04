import { supabase } from '@/integrations/supabase/client';

/**
 * Post a shift recap to GroupMe via the server-side edge function.
 * The edge function builds the message from database data.
 */
export async function postShiftRecapToGroupMe(
  staffName: string,
  shiftDate: string,
  shiftType: string,
  shiftRecapId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('post-groupme', {
      body: {
        action: 'post',
        staffName,
        date: shiftDate,
        shiftType,
      },
    });

    if (error) {
      console.error('GroupMe post error:', error);
      return { success: false, error: error.message };
    }

    if (data?.skipped) {
      return { success: true }; // No activity — not an error
    }

    return { success: data?.success ?? false, error: data?.error };
  } catch (err) {
    console.error('GroupMe exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Resend a failed recap to GroupMe by its daily_recaps ID.
 */
export async function resendRecapToGroupMe(recapId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('post-groupme', {
      body: { action: 'resend', recapId },
    });

    if (error) return { success: false, error: error.message };
    return { success: data?.success ?? false, error: data?.error };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Test the GroupMe bot connection.
 */
export async function testGroupMeConnection(staffName?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('post-groupme', {
      body: { action: 'test', staffName },
    });

    if (error) return { success: false, error: error.message };
    return { success: data?.success ?? false, error: data?.error };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
