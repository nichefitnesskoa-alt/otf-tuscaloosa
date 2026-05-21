import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useGiveawayStudio } from './hooks/useGiveawayStudio';
import { Countdown } from './components/Countdown';
import { AchievementCard } from './components/AchievementCard';
import { ScreenshotUpload } from './components/ScreenshotUpload';
import { LiveEntryCounter } from './components/LiveEntryCounter';
import { ConfirmationScreen } from './components/ConfirmationScreen';

const IG_HANDLES: Record<string, string> = {
  tuscaloosa: '@otftuscaloosa',
  auburn: '@otfauburn',
  montgomery: '@otfmontgomery',
  vestavia: '@otfvestavia',
};

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  action_instagram_follow: boolean;
  action_post_engagement: boolean;
  action_post_engagement_screenshot_url: string | null;
  action_story_share: boolean;
  action_story_share_screenshot_url: string | null;
  action_free_class: boolean;
  action_free_class_screenshot_url: string | null;
  action_partner_visit: boolean;
  action_partner_visit_photo_url: string | null;
}

const empty: FormState = {
  first_name: '', last_name: '', email: '', phone: '',
  action_instagram_follow: false,
  action_post_engagement: false, action_post_engagement_screenshot_url: null,
  action_story_share: false, action_story_share_screenshot_url: null,
  action_free_class: false, action_free_class_screenshot_url: null,
  action_partner_visit: false, action_partner_visit_photo_url: null,
};

export default function GiveawayEntryPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const { studio, loading } = useGiveawayStudio(studioSlug);
  const [form, setForm] = useState<FormState>(empty);
  const [draftId] = useState<string>(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ firstName: string; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bonusCount = useMemo(() => {
    return [
      form.action_instagram_follow,
      form.action_post_engagement,
      form.action_story_share,
      form.action_free_class,
      form.action_partner_visit,
    ].filter(Boolean).length;
  }, [form]);
  const totalEntries = 1 + bonusCount;

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
    return (
      <Shell>
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-[#E8540A] font-bold mb-3">Coming Soon</p>
          <h1 className="text-5xl sm:text-7xl font-black mb-4">{studio.studio_name}</h1>
          <p className="text-lg text-[#F5F2EE]/70">A giveaway you won't want to miss is on the way.</p>
        </div>
      </Shell>
    );
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

  const canSubmit = form.first_name.trim() && form.last_name.trim() && form.email.trim() && form.phone.trim();

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
        base_entries: 1,
        bonus_entries: bonusCount,
        action_instagram_follow: form.action_instagram_follow,
        action_post_engagement: form.action_post_engagement,
        action_post_engagement_screenshot_url: form.action_post_engagement_screenshot_url,
        action_story_share: form.action_story_share,
        action_story_share_screenshot_url: form.action_story_share_screenshot_url,
        action_free_class: form.action_free_class,
        action_free_class_screenshot_url: form.action_free_class_screenshot_url,
        action_partner_visit: form.action_partner_visit,
        action_partner_visit_photo_url: form.action_partner_visit_photo_url,
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
      setSubmitted({ firstName: form.first_name.trim(), total: totalEntries });
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
      setSubmitting(false);
    }
  };

  const igHandle = IG_HANDLES[studio.studio_slug] || '@orangetheory';
  const partnerName = studio.partner_name?.trim() || 'a local partner business';
  const partnerInstr = studio.partner_instructions?.trim() || 'Visit our local partner and show your receipt. Upload a photo of your receipt.';

  return (
    <Shell>
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <p className="text-xs sm:text-sm uppercase tracking-[0.25em] text-[#E8540A] font-bold mb-2">Free Membership Giveaway</p>
            <h1 className="text-4xl sm:text-6xl font-black leading-[0.95]">WIN A FREE<br/>MEMBERSHIP</h1>
            <p className="text-base sm:text-lg text-[#F5F2EE]/70 mt-3">Complete actions below to earn more entries. More entries = more chances to win.</p>
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
          <AchievementCard number={1} title="Follow us on Instagram" description={`Follow ${igHandle} on Instagram`} unlocked={form.action_instagram_follow}>
            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={form.action_instagram_follow}
                onChange={(e) => setForm({ ...form, action_instagram_follow: e.target.checked })}
                className="h-5 w-5 accent-[#E8540A]"
              />
              <span className="text-sm">I followed the account</span>
            </label>
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

          <AchievementCard
            number={5}
            title={studio.partner_name?.trim() ? `Visit ${studio.partner_name}` : 'Visit a partner business'}
            description={partnerInstr}
            unlocked={form.action_partner_visit}
          >
            <ScreenshotUpload studioSlug={studio.studio_slug} draftId={draftId} actionType="partner_visit"
              value={form.action_partner_visit_photo_url}
              onUploaded={(url) => setForm({ ...form, action_partner_visit: true, action_partner_visit_photo_url: url })}
            />
            {!studio.partner_name?.trim() && (
              <p className="text-xs text-[#F5F2EE]/50 mt-2">Partner business: {partnerName}</p>
            )}
          </AchievementCard>
        </div>

        <div className="mb-6">
          <LiveEntryCounter entries={totalEntries} />
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
        <p className="text-center text-xs text-[#F5F2EE]/50 mt-3">One entry per email per studio.</p>
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
