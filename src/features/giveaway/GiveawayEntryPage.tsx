import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useGiveawayStudio } from './hooks/useGiveawayStudio';
import { useGiveawayPartners, GiveawayPartner } from './hooks/useGiveawayPartners';
import { Countdown } from './components/Countdown';
import { AchievementCard } from './components/AchievementCard';
import { ScreenshotUpload } from './components/ScreenshotUpload';
import { LiveEntryCounter } from './components/LiveEntryCounter';
import { ConfirmationScreen } from './components/ConfirmationScreen';
import { PrizeShowcase } from './components/PrizeShowcase';
import { getStudioIg, getStudioCity } from './lib/studioBrand';

interface PartnerActionState {
  partner_id: string;
  completed: boolean;
  screenshot_url: string | null;
}

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  ig_checks: Record<string, boolean>; // keyed by handle (without @)
  action_post_engagement: boolean;
  action_post_engagement_screenshot_url: string | null;
  action_story_share: boolean;
  action_story_share_screenshot_url: string | null;
  action_free_class: boolean;
  action_free_class_screenshot_url: string | null;
  partner_actions: PartnerActionState[];
}

const baseEmpty: Omit<FormState, 'ig_checks' | 'partner_actions'> = {
  first_name: '', last_name: '', email: '', phone: '',
  action_post_engagement: false, action_post_engagement_screenshot_url: null,
  action_story_share: false, action_story_share_screenshot_url: null,
  action_free_class: false, action_free_class_screenshot_url: null,
};

export default function GiveawayEntryPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const { studio, loading } = useGiveawayStudio(studioSlug);
  const { partners } = useGiveawayPartners(studioSlug);
  const [form, setForm] = useState<FormState>({ ...baseEmpty, ig_checks: {}, partner_actions: [] });
  const [draftId] = useState<string>(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ firstName: string; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const studioIg = getStudioIg(studioSlug || '');

  // Build IG accounts list: studio first, then partners with handles in display_order.
  const igAccounts = useMemo(() => {
    const list: { handle: string; label: string }[] = [
      { handle: studioIg.handle, label: studioIg.display },
    ];
    for (const p of partners) {
      const h = (p.partner_ig_handle || '').trim().replace(/^@/, '');
      if (h) list.push({ handle: h, label: `@${h}` });
    }
    return list;
  }, [studioIg.handle, studioIg.display, partners]);

  // Sync partner_actions array with current partners list.
  useEffect(() => {
    setForm(prev => {
      const map = new Map(prev.partner_actions.map(a => [a.partner_id, a]));
      const next = partners.map(p => map.get(p.id) || { partner_id: p.id, completed: false, screenshot_url: null });
      // Only update if changed
      if (next.length === prev.partner_actions.length &&
          next.every((a, i) => a.partner_id === prev.partner_actions[i].partner_id)) {
        return prev;
      }
      return { ...prev, partner_actions: next };
    });
  }, [partners]);

  // Derived: ig follow complete only when ALL accounts checked
  const igFollowComplete = igAccounts.length > 0 && igAccounts.every(a => form.ig_checks[a.handle]);

  const partnerCompletedCount = form.partner_actions.filter(a => a.completed).length;
  const bonusCount =
    (igFollowComplete ? 1 : 0) +
    (form.action_post_engagement ? 1 : 0) +
    (form.action_story_share ? 1 : 0) +
    (form.action_free_class ? 1 : 0) +
    partnerCompletedCount;

  const maxPossible = 5 + partners.length;


  if (loading) {
    return <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] flex items-center justify-center">Loading…</div>;
  }

  if (!studio) {
    return (
      <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] flex items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-3xl font-black mb-2">Studio not found</h1>
          <p className="text-[#F5F2EE]/70">Check the link and try again.</p>
        </div>
      </div>
    );
  }

  const now = Date.now();
  const liveAt = studio.goes_live_at ? new Date(studio.goes_live_at).getTime() : null;
  const endAt = liveAt ? liveAt + studio.countdown_duration_days * 86400 * 1000 : null;

  if (!liveAt) {
    return <ComingSoonScreen studioName={studio.studio_name} slug={studio.studio_slug} />;
  }

  if (now < liveAt) {
    return (
      <Shell>
        <div className="text-center max-w-lg">
          <p className="text-sm uppercase tracking-[0.3em] text-[#E8540A] font-bold mb-3">Get Ready</p>
          <h1 className="text-4xl sm:text-6xl font-black mb-2">{studio.studio_name}</h1>
          <p className="text-lg text-[#F5F2EE]/70 mb-8">Win a free membership. Entries open in:</p>
          <Countdown targetIso={new Date(liveAt).toISOString()} />
        </div>
      </Shell>
    );
  }

  if (endAt && now >= endAt) {
    return (
      <Shell>
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-[#E8540A] font-bold mb-3">That's a wrap</p>
          <h1 className="text-5xl sm:text-7xl font-black mb-4">Giveaway has ended</h1>
          <p className="text-lg text-[#F5F2EE]/70">Thanks for playing. Follow us to catch the next one.</p>
        </div>
      </Shell>
    );
  }

  if (submitted) {
    return <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE]"><ConfirmationScreen firstName={submitted.firstName} totalEntries={submitted.total} /></div>;
  }

  const fieldsValid = form.first_name.trim() && form.last_name.trim() && form.email.trim() && form.phone.trim();
  const canSubmit = fieldsValid && bonusCount >= 1;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const emailLower = form.email.trim().toLowerCase();
      const { data: existing } = await supabase
        .from('giveaway_entries' as any)
        .select('id')
        .eq('studio_slug', studio.studio_slug)
        .ilike('email', emailLower)
        .maybeSingle();
      if (existing) {
        setError("You've already entered at this studio.");
        setSubmitting(false);
        return;
      }
      const { error: insErr } = await supabase.from('giveaway_entries' as any).insert({
        studio_slug: studio.studio_slug,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: emailLower,
        phone: form.phone.trim(),
        base_entries: 0,
        bonus_entries: bonusCount,
        action_instagram_follow: igFollowComplete,
        action_post_engagement: form.action_post_engagement,
        action_post_engagement_screenshot_url: form.action_post_engagement_screenshot_url,
        action_story_share: form.action_story_share,
        action_story_share_screenshot_url: form.action_story_share_screenshot_url,
        action_free_class: form.action_free_class,
        action_free_class_screenshot_url: form.action_free_class_screenshot_url,
        partner_actions: form.partner_actions,
        // legacy fields kept null
        action_partner_visit: false,
        action_partner_visit_photo_url: null,
      });
      if (insErr) {
        if ((insErr as any).code === '23505') {
          setError("You've already entered at this studio.");
        } else {
          setError(insErr.message);
        }
        setSubmitting(false);
        return;
      }
      setSubmitted({ firstName: form.first_name.trim(), total: bonusCount });
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  const setPartnerAction = (partnerId: string, patch: Partial<PartnerActionState>) => {
    setForm(prev => ({
      ...prev,
      partner_actions: prev.partner_actions.map(a => a.partner_id === partnerId ? { ...a, ...patch } : a),
    }));
  };

  return (
    <Shell>
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs sm:text-sm uppercase tracking-[0.25em] text-[#E8540A] font-bold mb-2">Free Membership Giveaway</p>
            <h1 className="text-4xl sm:text-6xl font-black leading-[0.95]">WIN A FREE<br/>MEMBERSHIP</h1>
            <p className="text-base sm:text-lg text-[#F5F2EE]/70 mt-3">Complete actions below to earn entries. More entries = more chances to win.</p>
          </div>
          <span className="flex-shrink-0 text-xs font-bold uppercase tracking-wider bg-[#2a2a2c] border border-[#3a3a3c] text-[#F5F2EE] px-3 py-2 rounded">
            {studio.studio_name.replace(/^OTF /, '')}
          </span>
        </div>

        {endAt && (
          <div className="mb-8 flex justify-center">
            <Countdown targetIso={new Date(endAt).toISOString()} label="Closes in" />
          </div>
        )}

        <div className="rounded-xl bg-[#1f1f21] border border-[#3a3a3c] p-4 sm:p-5 mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
            <Field label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label="Phone" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
        </div>

        <div className="space-y-3 mb-6">
          <AchievementCard
            number={1}
            title="Follow on Instagram"
            description={igAccounts.length > 1
              ? `Follow all ${igAccounts.length} accounts to earn this entry.`
              : `Follow ${igAccounts[0]?.label || ''} on Instagram.`}
            unlocked={igFollowComplete}
          >
            <div className="space-y-2">
              {igAccounts.map(acc => {
                const checked = !!form.ig_checks[acc.handle];
                return (
                  <label key={acc.handle} className="flex items-center gap-3 cursor-pointer min-h-[44px] rounded-lg border border-[#3a3a3c] hover:border-[#E8540A]/50 px-3 bg-[#181819]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setForm({ ...form, ig_checks: { ...form.ig_checks, [acc.handle]: e.target.checked } })}
                      className="h-5 w-5 accent-[#E8540A] cursor-pointer"
                    />
                    <span className="flex-1 text-sm font-semibold text-[#F5F2EE]">{acc.label}</span>
                    <a
                      href={`https://instagram.com/${acc.handle}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-[#E8540A] hover:underline font-bold uppercase tracking-wider"
                    >
                      Open
                    </a>
                  </label>
                );
              })}
            </div>
          </AchievementCard>

          <AchievementCard number={2} title="Like, comment & tag a friend" description="Like our giveaway post, leave a comment, and tag a local friend. Upload a screenshot." unlocked={form.action_post_engagement}>
            <ScreenshotUpload studioSlug={studio.studio_slug} draftId={draftId} actionType="post_engagement"
              value={form.action_post_engagement_screenshot_url}
              onUploaded={(url) => setForm({ ...form, action_post_engagement: true, action_post_engagement_screenshot_url: url })}
            />
          </AchievementCard>

          <AchievementCard number={3} title="Share to your story" description="Share our giveaway post to your Instagram story. Upload a screenshot." unlocked={form.action_story_share}>
            <ScreenshotUpload studioSlug={studio.studio_slug} draftId={draftId} actionType="story_share"
              value={form.action_story_share_screenshot_url}
              onUploaded={(url) => setForm({ ...form, action_story_share: true, action_story_share_screenshot_url: url })}
            />
          </AchievementCard>

          <AchievementCard number={4} title="Try a free OTF class" description="Book and attend a free intro class. Upload your check-in confirmation or a class screenshot." unlocked={form.action_free_class}>
            <ScreenshotUpload studioSlug={studio.studio_slug} draftId={draftId} actionType="free_class"
              value={form.action_free_class_screenshot_url}
              onUploaded={(url) => setForm({ ...form, action_free_class: true, action_free_class_screenshot_url: url })}
            />
          </AchievementCard>

          {partners.map((p, idx) => {
            const state = form.partner_actions.find(a => a.partner_id === p.id);
            const handle = (p.partner_ig_handle || '').trim().replace(/^@/, '');
            return (
              <AchievementCard
                key={p.id}
                number={5 + idx}
                title={`Visit ${p.partner_name}`}
                description={p.receipt_instructions?.trim() || `Visit ${p.partner_name} and upload a photo of your receipt.`}
                unlocked={!!state?.completed}
              >
                {handle && (
                  <p className="text-xs text-[#F5F2EE]/50 mb-2">
                    <a href={`https://instagram.com/${handle}`} target="_blank" rel="noreferrer" className="hover:text-[#E8540A]">@{handle}</a>
                  </p>
                )}
                <ScreenshotUpload
                  studioSlug={studio.studio_slug}
                  draftId={draftId}
                  actionType={`partner_${p.id}`}
                  value={state?.screenshot_url ?? null}
                  onUploaded={(url) => setPartnerAction(p.id, { completed: true, screenshot_url: url })}
                />
              </AchievementCard>
            );
          })}
        </div>

        <div className="mb-6">
          <LiveEntryCounter entries={bonusCount} max={maxPossible} />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 text-red-300 px-4 py-3 text-sm">{error}</div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full min-h-[60px] rounded-xl bg-[#E8540A] hover:bg-[#ff6a1f] disabled:bg-[#3a3a3c] disabled:text-[#F5F2EE]/40 text-white font-black text-xl tracking-wider transition cursor-pointer"
        >
          {submitting ? 'Submitting…' : 'ENTER NOW'}
        </button>
        <p className="text-center text-xs text-[#F5F2EE]/50 mt-3">
          {bonusCount === 0
            ? 'Complete at least one action to earn entries.'
            : 'One entry per email per studio.'}
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] px-4 py-8 flex items-start sm:items-center justify-center">
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-[#F5F2EE]/60 mb-1 font-bold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[44px] rounded-lg bg-[#2a2a2c] border border-[#3a3a3c] focus:border-[#E8540A] focus:outline-none px-3 text-[#F5F2EE] text-base"
      />
    </label>
  );
}

function ComingSoonScreen({ studioName, slug }: { studioName: string; slug: string }) {
  const ig = getStudioIg(slug);
  const city = getStudioCity(slug);
  const displayName = studioName.replace(/^OTF\s+/i, '').toUpperCase();
  return (
    <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] flex flex-col">
      <div className="h-1.5 bg-[#E8540A] w-full" />
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p style={{ letterSpacing: '0.35em' }} className="text-[11px] uppercase text-[#E8540A] font-black mb-6">
          Orangetheory Fitness
        </p>
        <h1
          style={{ fontFamily: '"Big Shoulders Display", "Bebas Neue", Impact, sans-serif', fontSize: 52, lineHeight: 1, letterSpacing: '0.02em' }}
          className="font-black text-[#F5F2EE]"
        >
          {displayName}
        </h1>
        <p
          style={{ fontFamily: '"Jura", system-ui, sans-serif', fontSize: 9, letterSpacing: '0.5em', fontWeight: 300 }}
          className="text-[#F5F2EE]/60 mt-2"
        >
          {city}
        </p>
        <div className="h-px w-10 bg-[#E8540A] my-8" />
        <h2
          style={{ fontFamily: '"Big Shoulders Display", "Bebas Neue", Impact, sans-serif', fontSize: 28, letterSpacing: '0.03em' }}
          className="font-black text-[#F5F2EE]"
        >
          SOMETHING BIG IS COMING.
        </h2>
        <p className="text-[14px] text-[#F5F2EE]/60 mt-3">A giveaway you won't want to miss.</p>
        <a
          href={`https://instagram.com/${ig.handle}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 mt-8 text-[12px] text-[#E8540A] font-bold hover:underline cursor-pointer"
        >
          <Instagram className="h-4 w-4" /> {ig.display}
        </a>
      </div>
      <div className="px-6 pb-3 flex justify-end">
        <p className="text-[8px] tracking-[0.3em] uppercase text-[#F5F2EE]/40">More Life. More Energy. More You.</p>
      </div>
      <div className="h-1.5 bg-[#E8540A] w-full" />
    </div>
  );
}
