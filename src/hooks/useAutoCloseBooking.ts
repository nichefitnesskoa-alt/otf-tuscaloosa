import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { notifyDataChanged } from '@/lib/data/invalidation';

interface MatchingBooking {
  booking_id: string;
  member_name: string;
  member_key: string;
  intro_date: string;
  intro_time: string;
  lead_source: string;
  notes: string;
  originating_booking_id: string;
  row_number: number;
}

interface AutoCloseResult {
  success: boolean;
  closedCount?: number;
  requiresConfirmation?: boolean;
  matches?: MatchingBooking[];
  error?: string;
}

/**
 * Canonical close payload. Every write branch in this hook MUST use this
 * shape — booking_status_canon is 'CLOSED_PURCHASED' (the value every
 * reader keys on across Pipeline, My Day, Follow-Up, WIG, close-rate
 * selectors, and duplicate detection). The literal 'closed' is not a
 * canon value and is read by nothing.
 */
function buildClosePayload(changedBy: string) {
  return {
    booking_status_canon: 'CLOSED_PURCHASED' as const,
    closed_at: new Date().toISOString(),
    closed_by: changedBy,
  };
}

export function useAutoCloseBooking() {
  const [isClosing, setIsClosing] = useState(false);
  const [pendingMatches, setPendingMatches] = useState<MatchingBooking[] | null>(null);
  const [pendingSaleInfo, setPendingSaleInfo] = useState<{
    saleId: string;
    memberKey: string;
    changedBy: string;
  } | null>(null);

  const normalizeName = (name: string): string => {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  };

  const closeBookingOnSale = async (
    memberName: string,
    commissionAmount: number,
    membershipType: string,
    saleId: string,
    relatedBookingId?: string,
    changedBy: string = 'System'
  ): Promise<AutoCloseResult> => {
    if (commissionAmount <= 0 && !membershipType) {
      return { success: true };
    }

    setIsClosing(true);
    try {
      if (relatedBookingId) {
        // Close directly in DB
        const { error } = await supabase
          .from('intros_booked')
          .update(buildClosePayload(changedBy))
          .eq('id', relatedBookingId);

        if (error) throw error;

        toast({
          title: 'Membership logged',
          description: 'Removed from booked intros.',
        });

        notifyDataChanged(['intros_booked', 'intros_run', 'wig'], 'auto-close:direct');
        return { success: true, closedCount: 1 };
      }

      // Find matching ACTIVE bookings by member name. DB only stores 'ACTIVE'
      // (uppercase) on booking_status_canon — the previous lowercase 'active'
      // entry was dead.
      const memberKey = normalizeName(memberName);
      const { data: matches, error: matchError } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, lead_source')
        .ilike('member_name', `%${memberName}%`)
        .eq('booking_status_canon', 'ACTIVE')
        .is('deleted_at', null);

      if (matchError) throw matchError;

      if (!matches || matches.length === 0) {
        return { success: true, closedCount: 0 };
      }

      if (matches.length === 1) {
        const { error } = await supabase
          .from('intros_booked')
          .update(buildClosePayload(changedBy))
          .eq('id', matches[0].id);

        if (error) throw error;

        toast({
          title: 'Membership logged',
          description: 'Removed from booked intros.',
        });

        notifyDataChanged(['intros_booked', 'intros_run', 'wig'], 'auto-close:name-match');
        return { success: true, closedCount: 1 };
      }

      // Multiple matches - require admin confirmation
      const mappedMatches: MatchingBooking[] = matches.map(m => ({
        booking_id: m.id,
        member_name: m.member_name,
        member_key: normalizeName(m.member_name),
        intro_date: m.class_date,
        intro_time: m.intro_time || '',
        lead_source: m.lead_source,
        notes: '',
        originating_booking_id: '',
        row_number: 0,
      }));
      
      setPendingMatches(mappedMatches);
      setPendingSaleInfo({ saleId, memberKey, changedBy });
      
      return { 
        success: true, 
        requiresConfirmation: true, 
        matches: mappedMatches 
      };

    } catch (err) {
      console.error('Error auto-closing booking:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to close booking' 
      };
    } finally {
      setIsClosing(false);
    }
  };

  const confirmCloseBooking = async (bookingId: string): Promise<AutoCloseResult> => {
    if (!pendingSaleInfo) {
      return { success: false, error: 'No pending sale info' };
    }

    setIsClosing(true);
    try {
      const { error } = await supabase
        .from('intros_booked')
        .update(buildClosePayload(pendingSaleInfo.changedBy))
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: 'Membership logged',
        description: 'Removed from booked intros.',
      });

      setPendingMatches(null);
      setPendingSaleInfo(null);

      notifyDataChanged(['intros_booked', 'intros_run', 'wig'], 'auto-close:confirm');
      return { success: true, closedCount: 1 };

    } catch (err) {
      console.error('Error confirming close:', err);
      return { 
        success: false, 
        error: err instanceof Error ? err.message : 'Failed to close booking' 
      };
    } finally {
      setIsClosing(false);
    }
  };

  const clearPendingMatches = () => {
    setPendingMatches(null);
    setPendingSaleInfo(null);
  };

  return {
    isClosing,
    pendingMatches,
    closeBookingOnSale,
    confirmCloseBooking,
    clearPendingMatches,
  };
}
