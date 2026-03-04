/**
 * Auto-completes "book_2nd_intro_day2" and "book_2nd_intro_day7" follow-up tasks
 * when a new booking is created for the same member.
 * 
 * Call this after ANY new intros_booked insert to clean up Planning 2nd follow-ups.
 */
import { supabase } from '@/integrations/supabase/client';

export async function autoComplete2ndIntroFollowups(memberName: string): Promise<number> {
  try {
    const { data: pending } = await supabase
      .from('follow_up_queue')
      .select('id')
      .eq('person_name', memberName)
      .in('person_type', ['book_2nd_intro_day2', 'book_2nd_intro_day7'])
      .eq('status', 'pending');

    if (!pending || pending.length === 0) return 0;

    const ids = pending.map(p => p.id);
    await supabase
      .from('follow_up_queue')
      .update({ status: 'completed', sent_at: new Date().toISOString(), sent_by: 'Auto (2nd Intro Booked)' })
      .in('id', ids);

    console.log(`Auto-completed ${ids.length} book_2nd_intro follow-ups for ${memberName}`);
    return ids.length;
  } catch (err) {
    console.warn('autoComplete2ndIntroFollowups failed (non-critical):', err);
    return 0;
  }
}
