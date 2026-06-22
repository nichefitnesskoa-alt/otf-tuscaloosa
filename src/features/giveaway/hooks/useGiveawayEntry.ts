import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PartnerActionRow } from './useGiveawayEntries';

export interface GiveawayEntryRow {
  id: string;
  studio_slug: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  phone_normalized: string;
  instagram_handle: string | null;
  entry_slug: string;
  base_entries: number;
  bonus_entries: number;
  total_entries: number;
  action_instagram_follow: boolean;
  action_post_engagement: boolean;
  action_post_engagement_screenshot_url: string | null;
  action_story_share: boolean;
  action_story_share_screenshot_url: string | null;
  action_free_class: boolean;
  action_free_class_screenshot_url: string | null;
  partner_actions: PartnerActionRow[] | null;
  submitted_at: string;
}

export function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  return digits.slice(-10);
}

const lsKey = (slug: string) => `otf_giveaway_entry_${slug}`;

interface StartArgs {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  instagram_handle: string;
}

export function useGiveawayEntry(studioSlug: string | undefined) {
  const [entry, setEntry] = useState<GiveawayEntryRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // On mount, try resuming from localStorage
  useEffect(() => {
    if (!studioSlug) { setLoading(false); return; }
    const id = localStorage.getItem(lsKey(studioSlug));
    if (!id) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('giveaway_entries' as any)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (data) setEntry(data as any as GiveawayEntryRow);
      else localStorage.removeItem(lsKey(studioSlug));
      setLoading(false);
    })();
  }, [studioSlug]);

  const resumeBySlug = useCallback(async (entrySlug: string) => {
    if (!studioSlug) return null;
    const { data } = await supabase
      .from('giveaway_entries' as any)
      .select('*')
      .eq('entry_slug', entrySlug)
      .maybeSingle();
    if (!data) return null;
    const row = data as any as GiveawayEntryRow;
    if (row.studio_slug !== studioSlug) return null;
    localStorage.setItem(lsKey(studioSlug), row.id);
    setEntry(row);
    return row;
  }, [studioSlug]);

  const resumeByPhone = useCallback(async (phone: string) => {
    if (!studioSlug) return null;
    const phone_normalized = normalizePhone(phone);
    if (phone_normalized.length !== 10) {
      throw new Error('Please enter a valid 10-digit phone number.');
    }
    const { data } = await supabase
      .from('giveaway_entries' as any)
      .select('*')
      .eq('studio_slug', studioSlug)
      .eq('phone_normalized', phone_normalized)
      .maybeSingle();
    if (!data) return null;
    const row = data as any as GiveawayEntryRow;
    localStorage.setItem(lsKey(studioSlug), row.id);
    setEntry(row);
    return row;
  }, [studioSlug]);

  const startEntry = useCallback(async (input: StartArgs) => {
    if (!studioSlug) throw new Error('Missing studio');
    const phone_normalized = normalizePhone(input.phone);
    if (phone_normalized.length !== 10) {
      throw new Error('Please enter a valid 10-digit phone number.');
    }

    // If a row exists for this phone+studio, resume it.
    const existing = await supabase
      .from('giveaway_entries' as any)
      .select('*')
      .eq('studio_slug', studioSlug)
      .eq('phone_normalized', phone_normalized)
      .maybeSingle();
    if (existing.data) {
      const row = existing.data as any as GiveawayEntryRow;
      localStorage.setItem(lsKey(studioSlug), row.id);
      setEntry(row);
      return { row, created: false };
    }

    const ig = input.instagram_handle.trim().replace(/^@/, '').toLowerCase();
    const { data, error } = await supabase
      .from('giveaway_entries' as any)
      .insert({
        studio_slug: studioSlug,
        first_name: input.first_name.trim(),
        last_name: input.last_name.trim(),
        email: input.email.trim().toLowerCase() || null,
        phone: input.phone.trim(),
        phone_normalized,
        instagram_handle: ig || null,
        base_entries: 0,
        bonus_entries: 0,
        action_instagram_follow: false,
        action_post_engagement: false,
        action_story_share: false,
        action_free_class: false,
        action_partner_visit: false,
        partner_actions: [],
      })
      .select()
      .single();
    if (error) throw error;
    const row = data as any as GiveawayEntryRow;
    localStorage.setItem(lsKey(studioSlug), row.id);
    setEntry(row);
    return { row, created: true };
  }, [studioSlug]);

  const updateEntry = useCallback(async (patch: Partial<GiveawayEntryRow>) => {
    if (!entry) return;
    const prev = entry;
    const optimistic = { ...entry, ...patch } as GiveawayEntryRow;
    setEntry(optimistic);
    setSaving(true);
    const { data, error } = await supabase
      .from('giveaway_entries' as any)
      .update(patch)
      .eq('id', entry.id)
      .select()
      .single();
    setSaving(false);
    if (error) { setEntry(prev); throw error; }
    if (data) setEntry(data as any as GiveawayEntryRow);
  }, [entry]);

  const signOut = useCallback(() => {
    if (studioSlug) localStorage.removeItem(lsKey(studioSlug));
    setEntry(null);
  }, [studioSlug]);

  return {
    entry,
    loading,
    saving,
    startEntry,
    resumeByPhone,
    resumeBySlug,
    updateEntry,
    signOut,
  };
}
