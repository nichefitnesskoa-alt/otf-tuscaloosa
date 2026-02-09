import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { calculateNameSimilarity, normalizeNameForComparison, hasPartialNameMatch } from '@/lib/utils';

export interface PotentialMatch {
  id: string;
  member_name: string;
  class_date: string;
  intro_time: string | null;
  booking_status: string | null;
  lead_source: string;
  booked_by: string | null;
  coach_name: string;
  fitness_goal: string | null;
  similarity: number;
  matchType: 'exact' | 'fuzzy' | 'partial';
  warningMessage?: string;
}

const EXCLUDED_STATUSES = ['Closed (Purchased)', 'Deleted (soft)', 'Duplicate'];

function getStatusWarning(status: string | null): string | undefined {
  if (!status) return undefined;
  const upperStatus = status.toUpperCase();
  
  if (upperStatus.includes('ACTIVE')) {
    return 'This client has an active intro scheduled';
  }
  if (upperStatus.includes('2ND INTRO')) {
    return 'This client is scheduled for a 2nd intro';
  }
  if (upperStatus.includes('NOT INTERESTED')) {
    return 'This client was previously marked as not interested';
  }
  if (upperStatus.includes('NO-SHOW') || upperStatus.includes('NO SHOW')) {
    return 'This client previously no-showed';
  }
  return undefined;
}

export function useDuplicateDetection() {
  const [isChecking, setIsChecking] = useState(false);
  const [matches, setMatches] = useState<PotentialMatch[]>([]);

  const checkForDuplicates = useCallback(async (name: string): Promise<PotentialMatch[]> => {
    if (!name || name.trim().length < 2) {
      setMatches([]);
      return [];
    }

    setIsChecking(true);
    
    try {
      const { data, error } = await supabase
        .from('intros_booked')
        .select('id, member_name, class_date, intro_time, booking_status, lead_source, booked_by, coach_name, fitness_goal')
        .is('deleted_at', null);

      if (error) {
        console.error('Error checking for duplicates:', error);
        setMatches([]);
        return [];
      }

      if (!data || data.length === 0) {
        setMatches([]);
        return [];
      }

      const normalizedInput = normalizeNameForComparison(name);
      const foundMatches: PotentialMatch[] = [];

      for (const booking of data) {
        // Skip excluded statuses
        const status = booking.booking_status || '';
        if (EXCLUDED_STATUSES.some(s => status.toUpperCase().includes(s.toUpperCase()))) {
          continue;
        }

        const normalizedExisting = normalizeNameForComparison(booking.member_name);
        const similarity = calculateNameSimilarity(normalizedInput, normalizedExisting);
        
        let matchType: 'exact' | 'fuzzy' | 'partial' | null = null;

        if (similarity === 1) {
          matchType = 'exact';
        } else if (similarity >= 0.85) {
          matchType = 'fuzzy';
        } else if (similarity >= 0.6 || hasPartialNameMatch(name, booking.member_name)) {
          matchType = 'partial';
        }

        if (matchType) {
          foundMatches.push({
            id: booking.id,
            member_name: booking.member_name,
            class_date: booking.class_date,
            intro_time: booking.intro_time,
            booking_status: booking.booking_status,
            lead_source: booking.lead_source,
            booked_by: booking.booked_by,
            coach_name: booking.coach_name,
            fitness_goal: booking.fitness_goal,
            similarity,
            matchType,
            warningMessage: getStatusWarning(booking.booking_status),
          });
        }
      }

      // Sort by similarity (highest first)
      foundMatches.sort((a, b) => b.similarity - a.similarity);
      
      // Limit to top 5 matches
      const topMatches = foundMatches.slice(0, 5);
      setMatches(topMatches);
      return topMatches;
    } catch (err) {
      console.error('Error in duplicate detection:', err);
      setMatches([]);
      return [];
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clearMatches = useCallback(() => {
    setMatches([]);
  }, []);

  return {
    checkForDuplicates,
    clearMatches,
    isChecking,
    matches,
  };
}
