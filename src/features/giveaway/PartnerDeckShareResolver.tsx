import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PartnerDeckPage from './PartnerDeckPage';
import NotFound from '@/pages/NotFound';

// Slugs that map to real top-level app routes — must never be intercepted.
const RESERVED = new Set([
  'my-day', 'coach-view', 'recaps', 'wig', 'the-table', 'vips', 'my-intros',
  'pipeline', 'admin', 'login', 'scripts', 'settings', 'meeting', 'q', 'story',
  'vip-register', 'vip-availability', 'vip', 'apply', 'join-the-team', 'giveaway',
  'partner-deck', 'questionnaire', 'scorecards', 'coaches', 'sas', 'dashboard',
  'my-shifts', 'shift-recap', 'reports', 'leads',
]);

export default function PartnerDeckShareResolver() {
  const { shareSlug } = useParams<{ shareSlug: string }>();
  const [resolvedSlug, setResolvedSlug] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!shareSlug) { setResolvedSlug(null); return; }
    if (RESERVED.has(shareSlug.toLowerCase())) { setResolvedSlug(null); return; }
    (async () => {
      const { data } = await (supabase
        .from('giveaway_studios') as any)
        .select('studio_slug')
        .ilike('share_slug', shareSlug)
        .maybeSingle();
      setResolvedSlug(data?.studio_slug ?? null);
    })();
  }, [shareSlug]);

  if (resolvedSlug === undefined) {
    return <div className="min-h-screen bg-[#0A0A0A]" />;
  }
  if (!resolvedSlug) {
    return <NotFound />;
  }
  return <PartnerDeckPage studioSlug={resolvedSlug} />;
}
