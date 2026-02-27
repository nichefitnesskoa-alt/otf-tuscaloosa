import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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
          .update({
            booking_status_canon: 'closed',
            closed_at: new Date().toISOString(),
            closed_by: changedBy,
          })
          .eq('id', relatedBookingId);

        if (error) throw error;

        toast({
          title: 'Membership logged',
          description: 'Removed from booked intros.',
        });

        return { success: true, closedCount: 1 };
      }

      // Find matching bookings by member name in DB
      const memberKey = normalizeName(memberName);
      const { data: matches, error: matchError } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, lead_source')
        .ilike('member_name', `%${memberName}%`)
        .in('booking_status_canon', ['active', 'ACTIVE'])
        .is('deleted_at', null);

      if (matchError) throw matchError;

      if (!matches || matches.length === 0) {
        return { success: true, closedCount: 0 };
      }

      if (matches.length === 1) {
        const { error } = await supabase
          .from('intros_booked')
          .update({
            booking_status_canon: 'closed',
            closed_at: new Date().toISOString(),
            closed_by: changedBy,
          })
          .eq('id', matches[0].id);

        if (error) throw error;

        toast({
          title: 'Membership logged',
          description: 'Removed from booked intros.',
        });

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
        .update({
          booking_status_canon: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: pendingSaleInfo.changedBy,
        })
        .eq('id', bookingId);

      if (error) throw error;

      toast({
        title: 'Membership logged',
        description: 'Removed from booked intros.',
      });

      setPendingMatches(null);
      setPendingSaleInfo(null);

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
