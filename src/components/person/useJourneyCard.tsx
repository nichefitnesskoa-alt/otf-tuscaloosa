/**
 * useJourneyCard — canonical open-path for the PersonJourneyCard.
 *
 * Every name-list surface in the app opens the SAME card via this hook.
 * There is no second card-open path; the card component itself is
 * unchanged from Phase 1.
 *
 * Usage:
 *   const journey = useJourneyCard();
 *   <button onClick={(e) => { e.stopPropagation(); journey.openByBooking(bookingId); }}>
 *     {memberName}
 *   </button>
 *   {journey.element}
 *
 * Or for non-booking identifiers (leads, referral asks, search results):
 *   journey.open({ name, phone, email });
 *
 * The returned `element` must be rendered somewhere in the tree (usually
 * at the end of the component's JSX). It renders nothing when closed.
 */
import { ReactNode, useCallback, useState } from 'react';
import { PersonJourneyCard } from '@/components/person/PersonJourneyCard';
import type { PersonIdentifier } from '@/lib/person/resolvePerson';

export interface UseJourneyCard {
  /** Open by intros_booked id (strongest — uses the booking's contact info). */
  openByBooking: (bookingId: string) => void;
  /** Open by a free identifier (name/phone/email). Used for leads, referral
   *  asks, registrants, search results — anywhere we don't have a bookingId. */
  open: (id: PersonIdentifier) => void;
  /** Close the card. */
  close: () => void;
  /** Element to render in the tree; renders nothing when closed. */
  element: ReactNode;
  /** True when the card is open. */
  isOpen: boolean;
}

export function useJourneyCard(scopeBadge?: string): UseJourneyCard {
  const [identifier, setIdentifier] = useState<PersonIdentifier | null>(null);

  const openByBooking = useCallback((bookingId: string) => {
    setIdentifier({ bookingId });
  }, []);

  const open = useCallback((id: PersonIdentifier) => {
    setIdentifier(id);
  }, []);

  const close = useCallback(() => setIdentifier(null), []);

  const element = identifier ? (
    <PersonJourneyCard
      open={!!identifier}
      onOpenChange={(o) => { if (!o) setIdentifier(null); }}
      identifier={identifier}
      scopeBadge={scopeBadge}
    />
  ) : null;

  return { openByBooking, open, close, element, isOpen: !!identifier };
}
