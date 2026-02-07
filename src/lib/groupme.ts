import { supabase } from '@/integrations/supabase/client';

interface RecapData {
  staffName: string;
  shiftDate: string;
  shiftType: string;
  callsMade: number;
  textsSent: number;
  dmsSent: number;
  emailsSent: number;
  introsBooked: Array<{ memberName: string; leadSource: string }>;
  introsRun: Array<{ 
    memberName: string; 
    outcome: string; 
    goalWhyCaptured: string;
    relationshipExperience: string;
    madeAFriend: boolean;
  }>;
  sales: Array<{ memberName: string; membershipType: string; commissionAmount: number }>;
  notes: string;
}

function formatRecapText(data: RecapData): string {
  const lines: string[] = [];
  
  // Header
  lines.push(`📋 SHIFT RECAP`);
  lines.push(`👤 ${data.staffName} | ${data.shiftDate} | ${data.shiftType}`);
  lines.push('');
  
  // Outreach
  lines.push(`📞 Outreach:`);
  lines.push(`• Calls: ${data.callsMade} | Texts: ${data.textsSent}`);
  lines.push(`• DMs: ${data.dmsSent} | Emails: ${data.emailsSent}`);
  lines.push('');
  
  // Intros Booked
  if (data.introsBooked.length > 0) {
    lines.push(`📅 Intros Booked (${data.introsBooked.length}):`);
    data.introsBooked.forEach((b, i) => {
      lines.push(`${i + 1}. ${b.memberName} (${b.leadSource})`);
    });
    lines.push('');
  }
  
  // Intros Run
  if (data.introsRun.length > 0) {
    lines.push(`🏃 Intros Run (${data.introsRun.length}):`);
    data.introsRun.forEach((r, i) => {
      const outcome = r.outcome || 'Pending';
      const isSale = ['Premier', 'Elite', 'Basic'].some(t => outcome.includes(t));
      const emoji = isSale ? '💰' : r.outcome === 'No-show' ? '❌' : '📋';
      lines.push(`${emoji} ${r.memberName}: ${outcome}`);
      
      // Lead measures summary
      const measures: string[] = [];
      if (r.goalWhyCaptured === 'Yes') measures.push('✓ Goal+Why');
      if (r.relationshipExperience === 'Yes') measures.push('✓ Relationship');
      if (r.madeAFriend) measures.push('✓ Friend');
      if (measures.length > 0) {
        lines.push(`   ${measures.join(' | ')}`);
      }
    });
    lines.push('');
  }
  
  // Sales (filter out entries with empty names)
  const validSales = data.sales.filter(s => s.memberName && s.memberName.trim());
  if (validSales.length > 0) {
    lines.push(`💵 Outside Sales (${validSales.length}):`);
    validSales.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.memberName}: ${s.membershipType}`);
    });
    lines.push('');
  }
  
  // Notes
  if (data.notes) {
    lines.push(`📝 Notes:`);
    lines.push(data.notes);
  }
  
  return lines.join('\n');
}

export async function postShiftRecapToGroupMe(
  recapData: RecapData,
  shiftRecapId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const recapText = formatRecapText(recapData);
    
    // First, store the recap in daily_recaps table
    const { data: recapRecord, error: insertError } = await supabase
      .from('daily_recaps')
      .insert({
        shift_date: recapData.shiftDate,
        staff_name: recapData.staffName,
        recap_text: recapText,
        status: 'pending',
        shift_recap_id: shiftRecapId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert recap record:', insertError);
      return { success: false, error: 'Failed to save recap record' };
    }

    // Call the edge function to post to GroupMe
    const { data, error } = await supabase.functions.invoke('post-groupme', {
      body: { text: recapText },
    });

    if (error) {
      // Update status to failed
      await supabase
        .from('daily_recaps')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', recapRecord.id);
      
      console.error('Failed to post to GroupMe:', error);
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      // Update status to failed
      await supabase
        .from('daily_recaps')
        .update({ status: 'failed', error_message: data?.error || 'Unknown error' })
        .eq('id', recapRecord.id);
      
      return { success: false, error: data?.error || 'Unknown error' };
    }

    // Update status to sent
    await supabase
      .from('daily_recaps')
      .update({ status: 'sent' })
      .eq('id', recapRecord.id);

    return { success: true };
  } catch (err) {
    console.error('Error in postShiftRecapToGroupMe:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function resendRecapToGroupMe(recapId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get the recap record
    const { data: recap, error: fetchError } = await supabase
      .from('daily_recaps')
      .select('*')
      .eq('id', recapId)
      .single();

    if (fetchError || !recap) {
      return { success: false, error: 'Recap not found' };
    }

    // Call the edge function to post to GroupMe
    const { data, error } = await supabase.functions.invoke('post-groupme', {
      body: { text: recap.recap_text },
    });

    if (error) {
      await supabase
        .from('daily_recaps')
        .update({ status: 'failed', error_message: error.message })
        .eq('id', recapId);
      
      return { success: false, error: error.message };
    }

    if (!data?.success) {
      await supabase
        .from('daily_recaps')
        .update({ status: 'failed', error_message: data?.error || 'Unknown error' })
        .eq('id', recapId);
      
      return { success: false, error: data?.error || 'Unknown error' };
    }

    // Update status to sent
    await supabase
      .from('daily_recaps')
      .update({ status: 'sent', error_message: null })
      .eq('id', recapId);

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function testGroupMeConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('post-groupme', {
      body: { action: 'test' },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: data?.success ?? false, error: data?.error };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
