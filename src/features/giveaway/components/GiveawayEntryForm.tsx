import { useMemo, useState, useEffect } from 'react';
import { Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useGiveawayStudio } from '../hooks/useGiveawayStudio';
import { useGiveawayPartners } from '../hooks/useGiveawayPartners';
import { Countdown } from './Countdown';
import { AchievementCard } from './AchievementCard';
import { ScreenshotUpload } from './ScreenshotUpload';
import { LiveEntryCounter } from './LiveEntryCounter';
import { ConfirmationScreen } from './ConfirmationScreen';
import { PrizeShowcase } from './PrizeShowcase';
import { FitText } from './FitText';
import { useIsMobile } from '@/hooks/use-mobile';
import { getParticipantStudioName, getStudioCity, getStudioIgHandle } from '@/lib/studioNames';
import { getGiveawayTitle, getCoBrandParts } from '../lib/giveawayTitle';
import { getEntryFormPrizeFraming } from '../lib/winnerCopy';


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
  ig_checks: Record<string, boolean>;
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

interface Props {
  slug: string;
  previewMode?: boolean;
}

export function GiveawayEntryForm({ slug, previewMode }: Props) {
  const { studio, loading } = useGiveawayStudio(slug);
  const { partners } = useGiveawayPartners(slug);
  const isMobile = useIsMobile();
  const [form, setForm] = useState<FormState>({ ...baseEmpty, ig_checks: {}, partner_actions: [] });
  const [draftId] = useState<string>(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ firstName: string; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);


  const studioIgHandle = getStudioIgHandle(slug).replace(/^@/, '');
  const studioIgDisplay = getStudioIgHandle(slug);
  const studioParticipantName = getParticipantStudioName(slug);

  const igAccounts = useMemo(() => {
    const list: { handle: string; label: string }[] = [{ handle: studioIgHandle, label: studioIgDisplay }];
    for (const p of partners) {
      const h = (p.partner_ig_handle || '').trim().replace(/^@/, '');
      if (h) list.push({ handle: h, label: `@${h}` });
    }
    return list;
  }, [studioIgHandle, studioIgDisplay, partners]);

  useEffect(() => {
    setForm(prev => {
      const map = new Map(prev.partner_actions.map(a => [a.partner_id, a]));
      const next = partners.map(p => map.get(p.id) || { partner_id: p.id, completed: false, screenshot_url: null });
      if (next.length === prev.partner_actions.length &&
          next.every((a, i) => a.partner_id === prev.partner_actions[i].partner_id)) return prev;
      return { ...prev, partner_actions: next };
    });
  }, [partners]);

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
    return <div className="min-h-[40vh] bg-[#1C1C1E] text-[#F5F2EE] flex items-center justify-center font-body">Loading…</div>;
  }

  if (!studio) {
    return (
      <div className="min-h-[40vh] bg-[#1C1C1E] text-[#F5F2EE] flex items-center justify-center px-4 text-center">
        <div>
          <h1 className="font-display text-3xl font-black mb-2">Studio not found</h1>
          <p className="font-body text-[#F5F2EE]/70">Check the link and try again.</p>
        </div>
      </div>
    );
  }

  const giveawayTitle = getGiveawayTitle(
    slug, partners, studio.title_format, studio.custom_title,
  );
  const coBrandParts = getCoBrandParts(slug, partners);

  const now = Date.now();
  const liveAt = studio.goes_live_at ? new Date(studio.goes_live_at).getTime() : null;
  const endAt = liveAt ? liveAt + studio.countdown_duration_days * 86400 * 1000 : null;

  // In preview mode we always show the live form regardless of live state.
  if (!previewMode && !liveAt) {
    return <ComingSoonScreen slug={slug} giveawayTitle={giveawayTitle} coBrandParts={coBrandParts} />;
  }

  if (!previewMode && now < (liveAt as number)) {
    return (
      <Shell>
        <CoBrandBar parts={coBrandParts} />
        <div className="max-w-[1200px] mx-auto px-4 md:px-12 py-10 text-center">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-[#E8540A] font-bold mb-3">Get Ready</p>
          <h1 className="font-display font-black text-[#E8540A] leading-[0.95] mb-4" style={{ fontSize: 'clamp(34px, 5vw, 52px)' }}>{giveawayTitle}</h1>
          <p className="font-body text-lg text-[#F5F2EE]/70 mb-8">Entries open in:</p>
          <div className="flex justify-center"><Countdown targetIso={new Date(liveAt as number).toISOString()} /></div>
        </div>
      </Shell>
    );
  }

  if (!previewMode && endAt && now >= endAt) {
    return (
      <Shell>
        <CoBrandBar parts={coBrandParts} />
        <div className="max-w-[1200px] mx-auto px-4 md:px-12 py-12 text-center">
          <p className="font-display text-sm uppercase tracking-[0.3em] text-[#E8540A] font-bold mb-3">That's a wrap</p>
          <h1 className="font-display font-black leading-[0.95] mb-4" style={{ fontSize: 'clamp(40px, 6vw, 64px)' }}>Giveaway has ended</h1>
          <p className="font-body text-lg text-[#F5F2EE]/70">Thanks for playing. Follow us to catch the next one.</p>
        </div>
      </Shell>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE]">
        <ConfirmationScreen firstName={submitted.firstName} totalEntries={submitted.total} />
      </div>
    );
  }

  const fieldsValid = form.first_name.trim() && form.last_name.trim() && form.email.trim() && form.phone.trim();
  const canSubmit = fieldsValid && bonusCount >= 1;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    if (previewMode) {
      toast('This is a preview. Participants can submit when the giveaway is live.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const emailLower = form.email.trim().toLowerCase();
      const { data: existing } = await supabase
        .from('giveaway_entries' as any).select('id')
        .eq('studio_slug', studio.studio_slug).ilike('email', emailLower).maybeSingle();
      if (existing) {
        setError("You've already entered at this studio.");
        setSubmitting(false);
        return;
      }
      const { error: insErr } = await supabase.from('giveaway_entries' as any).insert({
        studio_slug: studio.studio_slug,
        first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        email: emailLower, phone: form.phone.trim(),
        base_entries: 0, bonus_entries: bonusCount,
        action_instagram_follow: igFollowComplete,
        action_post_engagement: form.action_post_engagement,
        action_post_engagement_screenshot_url: form.action_post_engagement_screenshot_url,
        action_story_share: form.action_story_share,
        action_story_share_screenshot_url: form.action_story_share_screenshot_url,
        action_free_class: form.action_free_class,
        action_free_class_screenshot_url: form.action_free_class_screenshot_url,
        partner_actions: form.partner_actions,
        action_partner_visit: false, action_partner_visit_photo_url: null,
      });
      if (insErr) {
        setError((insErr as any).code === '23505' ? "You've already entered at this studio." : insErr.message);
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
      <CoBrandBar parts={coBrandParts} />

      <div className="w-full max-w-[1200px] mx-auto px-4 md:px-12 py-6 md:py-10">
        {/* Hero */}
        <div className="mb-8 md:mb-10">
          {isMobile ? (
            <MobileStackedTitle studioName={getParticipantStudioName(slug)} partners={partners} />
          ) : (
            <FitText
              as="h1"
              min={28}
              max={56}
              multiline
              style={{
                fontFamily: "'PP Right Grotesk', 'Arial Black', Arial, sans-serif",
                fontWeight: 900,
                color: '#E8540A',
                lineHeight: 0.95,
                letterSpacing: '0.01em',
                textTransform: 'uppercase',
              }}
            >
              {giveawayTitle}
            </FitText>
          )}
          <p
            className="font-display font-medium uppercase text-[#8E8E93] mt-2"
            style={{ fontSize: 'clamp(10px, 1vw, 12px)', letterSpacing: '0.2em' }}
          >
            Presented by {coBrandParts.join(' + ')}
          </p>
          <p className="font-body text-[#F5F2EE]/70 mt-4 max-w-2xl">
            Complete actions below to earn entries. More entries = more chances to win.
          </p>
        </div>


        {endAt && (
          <div className="mb-8 flex justify-center md:justify-start">
            <Countdown targetIso={new Date(endAt).toISOString()} label="Closes in" />
          </div>
        )}

        {(() => {
          const ef = getEntryFormPrizeFraming(studio.winner_structure ?? 'single');
          return (
            <>
              <PrizeShowcase slug={studio.studio_slug} partners={partners} showWinnerBadge={ef.showWinnerBadgeOnCards} />
              <div
                className="mt-2 mb-3 w-full rounded text-center font-display font-bold"
                style={{
                  background: 'rgba(232, 84, 10, 0.15)',
                  border: '1px solid #E8540A',
                  color: '#E8540A',
                  fontSize: 14,
                  padding: '10px 16px',
                }}
              >
                {ef.bannerText}
              </div>
              <p className="font-body italic text-[13px] text-[#8E8E93] mb-8">
                {ef.winnerRuleStatement}
              </p>
            </>
          );
        })()}

        {/* Personal info — 2-col desktop, 1-col mobile */}
        <div className="rounded-xl bg-[#1f1f21] border border-[#3a3a3c] p-4 md:p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <Field label="First name" value={form.first_name} onChange={(v) => setForm({ ...form, first_name: v })} />
            <Field label="Last name" value={form.last_name} onChange={(v) => setForm({ ...form, last_name: v })} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label="Phone" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
        </div>

        {/* Action cards: 2-col desktop, 1-col mobile. IG, counter, submit span full. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="md:col-span-2">
            <AchievementCard
              number={1}
              title="Follow on Instagram"
              description={igAccounts.length > 1
                ? `Follow ${studioParticipantName} (${studioIgDisplay}) and ${igAccounts.length - 1} partner${igAccounts.length - 1 === 1 ? '' : 's'} on Instagram to earn this entry.`
                : `Follow ${studioParticipantName} on Instagram (${studioIgDisplay})`}
              unlocked={igFollowComplete}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
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
                      <span className="flex-1 font-body text-sm font-semibold text-[#F5F2EE]">{acc.label}</span>
                      <a
                        href={`https://instagram.com/${acc.handle}`} target="_blank" rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-display text-xs text-[#E8540A] hover:underline font-bold uppercase tracking-wider"
                      >
                        <Instagram className="inline h-3.5 w-3.5 mr-1" />Open
                      </a>
                    </label>
                  );
                })}
              </div>
            </AchievementCard>
          </div>

          <AchievementCard number={2} title="Like, comment & tag a friend"
            description="Like our giveaway post, leave a comment, and tag a local friend. Upload a screenshot."
            unlocked={form.action_post_engagement}>
            <ScreenshotUpload studioSlug={studio.studio_slug} draftId={draftId} actionType="post_engagement"
              value={form.action_post_engagement_screenshot_url}
              onUploaded={(url) => setForm({ ...form, action_post_engagement: true, action_post_engagement_screenshot_url: url })}
              previewMode={previewMode}
            />
          </AchievementCard>

          <AchievementCard number={3} title="Share to your story"
            description="Share our giveaway post to your Instagram story. Upload a screenshot."
            unlocked={form.action_story_share}>
            <ScreenshotUpload studioSlug={studio.studio_slug} draftId={draftId} actionType="story_share"
              value={form.action_story_share_screenshot_url}
              onUploaded={(url) => setForm({ ...form, action_story_share: true, action_story_share_screenshot_url: url })}
              previewMode={previewMode}
            />
          </AchievementCard>

          <AchievementCard number={4} title="Post a Class Story"
            description="Post a story of you taking a class and tag us. Upload a screenshot of your story."
            unlocked={form.action_free_class}>
            <ScreenshotUpload studioSlug={studio.studio_slug} draftId={draftId} actionType="free_class"
              value={form.action_free_class_screenshot_url}
              onUploaded={(url) => setForm({ ...form, action_free_class: true, action_free_class_screenshot_url: url })}
              label="Tap to upload story screenshot"
              previewMode={previewMode}
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
                  <p className="font-body text-xs text-[#8E8E93] mb-2">
                    <a href={`https://instagram.com/${handle}`} target="_blank" rel="noreferrer" className="hover:text-[#E8540A]">@{handle}</a>
                  </p>
                )}
                {p.prize_description && (
                  <div className="mb-3 inline-flex items-start gap-1.5 rounded-md border border-[#E8540A]/40 bg-[#E8540A]/10 text-[#E8540A] px-2 py-1 font-display font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.05em' }}>
                    <span>🎁</span><span>Prize: {p.prize_description}</span>
                  </div>
                )}
                <ScreenshotUpload
                  studioSlug={studio.studio_slug}
                  draftId={draftId}
                  actionType={`partner_${p.id}`}
                  value={state?.screenshot_url ?? null}
                  onUploaded={(url) => setPartnerAction(p.id, { completed: true, screenshot_url: url })}
                  previewMode={previewMode}
                />
              </AchievementCard>
            );
          })}

          <div className="md:col-span-2">
            <LiveEntryCounter entries={bonusCount} max={maxPossible} />
          </div>

          {error && (
            <div className="md:col-span-2 rounded-lg border border-red-500/50 bg-red-500/10 text-red-300 px-4 py-3 text-sm font-body">{error}</div>
          )}

          <div className="md:col-span-2">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full min-h-[60px] rounded-xl bg-[#E8540A] hover:bg-[#ff6a1f] disabled:bg-[#3a3a3c] disabled:text-[#F5F2EE]/40 text-white font-display font-black text-xl uppercase tracking-wider transition cursor-pointer"
              style={{ letterSpacing: '0.08em' }}
            >
              {submitting ? 'Submitting…' : previewMode ? 'ENTER NOW (Preview — submissions disabled)' : 'ENTER NOW'}
            </button>
            <p className="font-body text-center text-xs text-[#F5F2EE]/50 mt-3">
              {bonusCount === 0
                ? 'Complete at least one action to earn entries.'
                : 'One entry per email per studio.'}
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE]">{children}</div>;
}

function CoBrandBar({ parts }: { parts: string[] }) {
  return (
    <div className="w-full bg-[#242426] border-b border-[#3a3a3c]">
      <div className="max-w-[1200px] mx-auto px-4 md:px-12 py-2.5 md:py-3 flex flex-wrap items-center justify-center md:justify-start gap-1.5">
        <span className="font-display font-bold uppercase text-[#8E8E93]" style={{ fontSize: 11, letterSpacing: '0.15em' }}>
          Presented by
        </span>
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="font-display font-bold text-[#E8540A]" style={{ fontSize: 13 }}>+</span>}
            <span className="font-display font-bold uppercase text-[#F5F2EE]" style={{ fontSize: 'clamp(11px, 1.1vw, 13px)', letterSpacing: '0.05em' }}>
              {p}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="block font-body text-[11px] uppercase tracking-wider text-[#F5F2EE]/60 mb-1 font-bold">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="font-body w-full min-h-[44px] rounded-lg bg-[#2a2a2c] border border-[#3a3a3c] focus:border-[#E8540A] focus:outline-none px-3 text-[#F5F2EE] text-base"
      />
    </label>
  );
}

function ComingSoonScreen({
  slug, giveawayTitle, coBrandParts,
}: {
  slug: string; giveawayTitle: string; coBrandParts: string[];
}) {
  const igHandle = getStudioIgHandle(slug);
  const igHandleStripped = igHandle.replace(/^@/, '');
  const city = getStudioCity(slug);
  return (
    <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] flex flex-col">
      <div className="h-1.5 bg-[#E8540A] w-full" />
      <CoBrandBar parts={coBrandParts} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display font-black text-[#F5F2EE]" style={{ fontSize: 'clamp(40px, 7vw, 64px)', lineHeight: 1, letterSpacing: '0.01em' }}>
          OrangeTheory Fitness
        </h1>
        <p className="font-display font-bold text-[#F5F2EE]/70 mt-3 uppercase" style={{ fontSize: 'clamp(12px, 1.4vw, 16px)', letterSpacing: '0.35em' }}>
          {city}
        </p>
        <div className="h-px w-10 bg-[#E8540A] my-8" />
        <h2 className="font-display font-black text-[#E8540A] uppercase max-w-xl line-clamp-2" style={{ fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '0.02em' }}>
          {giveawayTitle}
        </h2>
        <p className="font-body text-sm text-[#F5F2EE]/60 mt-3">A giveaway you won't want to miss is on the way.</p>
        <a href={`https://instagram.com/${igHandleStripped}`} target="_blank" rel="noreferrer"
          className="font-display inline-flex items-center gap-1.5 mt-8 text-[12px] text-[#E8540A] font-bold hover:underline cursor-pointer uppercase tracking-wider">
          <Instagram className="h-4 w-4" /> {igHandle}
        </a>
      </div>
      <div className="px-6 pb-3 flex justify-end">
        <p className="font-display text-[8px] tracking-[0.3em] uppercase text-[#F5F2EE]/40">More Life. More Energy. More You.</p>
      </div>
      <div className="h-1.5 bg-[#E8540A] w-full" />
    </div>
  );
}
