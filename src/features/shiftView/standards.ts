// Standards now live in the shift_standards DB table so admins can edit them.
// This file keeps the type, the referral-row constant, and a query hook.

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type StandardKey = string;

export interface Standard {
  key: StandardKey;
  title: string;
  display_order: number;
  is_active: boolean;
}

// Fallback list used only on first paint while the query is loading.
export const FALLBACK_STANDARDS: Standard[] = [
  { key: 's1', title: 'Every intro feels expected, prepared for, and personally welcomed before they walk in.', display_order: 1, is_active: true },
  { key: 's2', title: 'Every lead interaction feels real and genuine.', display_order: 2, is_active: true },
  { key: 's3', title: 'Every follow-up moves someone forward. Not just touched. Moved.', display_order: 3, is_active: true },
  { key: 's4', title: 'Every member interaction counts.', display_order: 4, is_active: true },
  { key: 's5', title: 'Every piece of equipment is ready before the next person needs it.', display_order: 5, is_active: true },
  { key: 'other', title: 'Other shift duties', display_order: 99, is_active: true },
];

// The "ask a member" template task is rendered as a custom referral row,
// not a generic checkbox. ShiftTaskList skips it; ReferralAskRow owns it.
export const REFERRAL_ASK_TASK_NAME = 'Ask a member if they have a friend who wants a free class';

let cache: Standard[] | null = null;
const subscribers = new Set<(s: Standard[]) => void>();

async function fetchStandards(): Promise<Standard[]> {
  const { data } = await supabase
    .from('shift_standards' as any)
    .select('key, title, display_order, is_active')
    .order('display_order');
  const list = ((data as any[]) || []) as Standard[];
  return list.length ? list : FALLBACK_STANDARDS;
}

async function refresh() {
  cache = await fetchStandards();
  subscribers.forEach(cb => cb(cache!));
}

export function useShiftStandards(): { standards: Standard[]; activeStandards: Standard[]; refresh: () => Promise<void> } {
  const [standards, setStandards] = useState<Standard[]>(cache ?? FALLBACK_STANDARDS);

  useEffect(() => {
    subscribers.add(setStandards);
    if (!cache) refresh();
    else setStandards(cache);

    const channel = supabase
      .channel('shift_standards_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shift_standards' }, () => refresh())
      .subscribe();

    return () => {
      subscribers.delete(setStandards);
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    standards,
    activeStandards: standards.filter(s => s.is_active),
    refresh,
  };
}

export function standardKeyOrOther(key: string | null | undefined): StandardKey {
  return key && key.trim() ? key : 'other';
}
