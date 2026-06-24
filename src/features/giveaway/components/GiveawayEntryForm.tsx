import { useMemo, useState, useEffect } from 'react';
import { Instagram, LogOut, Copy, Share2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useGiveawayStudio } from '../hooks/useGiveawayStudio';
import { useGiveawayPartners } from '../hooks/useGiveawayPartners';
import { useGiveawayEntry, normalizePhone, type GiveawayEntryRow } from '../hooks/useGiveawayEntry';
import { Countdown } from './Countdown';
import { AchievementCard } from './AchievementCard';
import { ScreenshotUpload } from './ScreenshotUpload';
import { LiveEntryCounter } from './LiveEntryCounter';
import { ConfirmationScreen } from './ConfirmationScreen';
import { PrizeShowcase } from './PrizeShowcase';
import { FitText } from './FitText';
import { useIsMobile } from '@/hooks/use-mobile';
import { getParticipantStudioName, getParticipantBrandName, getStudioCity, getStudioIgHandle } from '@/lib/studioNames';
import { getGiveawayEndAt } from '../lib/endAt';

import { getGiveawayTitle, getCoBrandParts } from '../lib/giveawayTitle';
import { getEntryFormPrizeFraming } from '../lib/winnerCopy';
import { BUILT_IN_ACTION_DEFAULTS, getActionLabel } from '../lib/actionLabels';


interface PartnerActionState {
  partner_id: string;
  completed: boolean;
  screenshot_url: string | null;
}

interface Props {
  slug: string;
  previewMode?: boolean;
  entrySlug?: string;
}

function computeBonus(
  entry: GiveawayEntryRow,
  partners: { id: string }[],
): number {
  const partnerActions: PartnerActionState[] = Array.isArray(entry.partner_actions) ? entry.partner_actions : [];
  const partnerCount = partnerActions.filter(a =>
    a.completed && partners.some(p => p.id === a.partner_id)
  ).length;
  return (
    (entry.action_instagram_follow ? 1 : 0) +
    (entry.action_post_engagement ? 1 : 0) +
    (entry.action_story_share ? 1 : 0) +
    (entry.action_free_class ? 1 : 0) +
    partnerCount
  );
}

export function GiveawayEntryForm({ slug, previewMode, entrySlug }: Props) {
  const { studio, loading: studioLoading } = useGiveawayStudio(slug);
  const { partners } = useGiveawayPartners(slug);
  const isMobile = useIsMobile();
  const { entry, loading: entryLoading, startEntry, resumeByPhone, resumeBySlug, updateEntry, signOut } =
    useGiveawayEntry(previewMode ? undefined : slug);

  const [justCreated, setJustCreated] = useState(false);

  // Auto-resume from /:entrySlug
  useEffect(() => {
    if (!entrySlug || previewMode) return;
    if (entry?.entry_slug === entrySlug) return;
    resumeBySlug(entrySlug).catch(() => {});
  }, [entrySlug, previewMode, entry?.entry_slug, resumeBySlug]);

  const loading = studioLoading || entryLoading;

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

  const giveawayTitle = getGiveawayTitle(slug, partners, studio.title_format, studio.custom_title);
  const coBrandParts = getCoBrandParts(slug, partners);

  const now = Date.now();
  const liveAt = studio.goes_live_at ? new Date(studio.goes_live_at).getTime() : null;
  const endAt = getGiveawayEndAt(studio);

  // Lifecycle screens
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

  // First-time confetti
  if (justCreated && entry) {
    return (
      <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE]">
        <ConfirmationScreen firstName={entry.first_name} totalEntries={entry.bonus_entries} />
        <div className="text-center pb-12">
          <button
            onClick={() => setJustCreated(false)}
            className="font-display font-bold uppercase tracking-wider text-sm bg-[#E8540A] text-white px-8 py-3 rounded-lg hover:bg-[#ff6a1f]"
          >
            Earn more entries
          </button>
        </div>
      </div>
    );
  }

  // GATE — collect contact info before showing actions
  if (!previewMode && !entry) {
    return (
      <Shell>
        <EntryGate
          slug={slug}
          isMobile={isMobile}
          giveawayTitle={giveawayTitle}
          partners={partners}
          studio={studio}
          coBrandParts={coBrandParts}
          endAt={endAt}
          onStart={async (input) => {
            const res = await startEntry(input);
            if (res.created) setJustCreated(true);
          }}
          onResume={async (phone) => {
            const found = await resumeByPhone(phone);
            if (!found) throw new Error("No entry yet for that number. Tap Start my entry.");
          }}
        />
      </Shell>
    );
  }


  // ACTIONS — entry exists (or preview)
  return (
    <Shell>
      <EntryActions
        slug={slug}
        studio={studio}
        partners={partners}
        entry={entry}
        previewMode={previewMode}
        giveawayTitle={giveawayTitle}
        coBrandParts={coBrandParts}
        isMobile={isMobile}
        endAt={endAt}
        onUpdate={updateEntry}
        onSignOut={signOut}
      />
    </Shell>
  );
}

/* ───────── Gate screen ───────── */

function EntryGate({
  slug, isMobile, giveawayTitle, partners, studio, coBrandParts, endAt, onStart, onResume,
}: {
  slug: string;
  isMobile: boolean;
  giveawayTitle: string;
  partners: any[];
  studio: any;
  coBrandParts: string[];
  endAt: number | null;
  onStart: (input: { first_name: string; last_name: string; email: string; phone: string; instagram_handle: string }) => Promise<void>;
  onResume: (phone: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<'start' | 'resume'>('start');
  const [first_name, setFirst] = useState('');
  const [last_name, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram_handle, setIg] = useState('');
  const [resumePhone, setResumePhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const igClean = instagram_handle.trim().replace(/^@/, '').toLowerCase();
  const igValid = /^[a-z0-9._]{1,30}$/.test(igClean);
  const phoneValid = normalizePhone(phone).length === 10;
  const resumePhoneValid = normalizePhone(resumePhone).length === 10;
  const canStart = first_name.trim() && last_name.trim() && email.trim() && phoneValid && igValid;

  const submit = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      if (tab === 'start') {
        if (!canStart) throw new Error('Please fill out all fields.');
        await onStart({ first_name, last_name, email, phone, instagram_handle });
      } else {
        if (!resumePhoneValid) throw new Error('Enter your 10-digit phone number.');
        await onResume(resumePhone);
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  const ef = getEntryFormPrizeFraming(studio?.winner_structure ?? 'single');

  return (
    <div className="w-full max-w-[880px] mx-auto px-4 md:px-12 py-6 md:py-10">
      <div className="mb-6 text-center">
        {isMobile ? (
          <MobileStackedTitle studioName={getParticipantBrandName()} partners={partners} />
        ) : (
          <FitText
            as="h1" min={28} max={56} multiline
            style={{
              fontFamily: "'PP Right Grotesk', 'Arial Black', Arial, sans-serif",
              fontWeight: 900, color: '#E8540A', lineHeight: 0.95,
              letterSpacing: '0.01em', textTransform: 'uppercase',
            }}
          >
            {giveawayTitle}
          </FitText>
        )}
        <p className="font-body text-[#F5F2EE]/70 mt-4">
          Drop your info to unlock entry actions. Come back anytime to add more entries.
        </p>
      </div>

      {endAt && (
        <div className="mb-8 flex justify-center">
          <Countdown targetIso={new Date(endAt).toISOString()} label="Closes in" />
        </div>
      )}

      {studio && (
        <div className="mb-8">
          <PrizeShowcase slug={studio.studio_slug} partners={partners} showWinnerBadge={ef.showWinnerBadgeOnCards} />
          <div className="mt-3 w-full rounded text-center font-display font-bold"
            style={{ background: 'rgba(232, 84, 10, 0.15)', border: '1px solid #E8540A', color: '#E8540A', fontSize: 14, padding: '10px 16px' }}>
            {ef.bannerText}
          </div>
          <p className="font-body italic text-[13px] text-[#8E8E93] mt-2 text-center">{ef.winnerRuleStatement}</p>
        </div>
      )}


      <div className="flex justify-center mb-4">
        <div className="rounded-xl border border-[#3a3a3c] bg-[#1f1f21] p-1 inline-flex">
          <button
            onClick={() => setTab('start')}
            className={`min-h-[40px] px-4 rounded-lg font-display text-xs font-bold uppercase tracking-wider cursor-pointer ${tab === 'start' ? 'bg-[#E8540A] text-white' : 'text-[#F5F2EE]/60 hover:text-[#F5F2EE]'}`}
          >
            First time
          </button>
          <button
            onClick={() => setTab('resume')}
            className={`min-h-[40px] px-4 rounded-lg font-display text-xs font-bold uppercase tracking-wider cursor-pointer ${tab === 'resume' ? 'bg-[#E8540A] text-white' : 'text-[#F5F2EE]/60 hover:text-[#F5F2EE]'}`}
          >
            Coming back
          </button>
        </div>
      </div>


      {tab === 'start' ? (
        <div className="rounded-xl bg-[#1f1f21] border border-[#3a3a3c] p-4 md:p-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="First name" value={first_name} onChange={setFirst} />
            <Field label="Last name" value={last_name} onChange={setLast} />
            <Field label="Email" type="email" value={email} onChange={setEmail} />
            <Field label="Phone" type="tel" value={phone} onChange={setPhone} />
          </div>
          <label className="block">
            <span className="block font-display text-[10px] uppercase tracking-[0.2em] text-[#8E8E93] font-bold mb-1.5">Instagram handle</span>
            <div className="flex items-center rounded-xl bg-[#181819] border border-[#3a3a3c] focus-within:border-[#E8540A] overflow-hidden">
              <span className="pl-3 pr-1 text-[#8E8E93] font-body select-none">@</span>
              <input
                type="text"
                value={instagram_handle}
                onChange={(e) => setIg(e.target.value.replace(/^@/, ''))}
                placeholder="yourhandle"
                autoCapitalize="none" autoCorrect="off" spellCheck={false}
                className="flex-1 min-h-[44px] bg-transparent px-1 py-2 text-[#F5F2EE] font-body focus:outline-none"
              />
            </div>
            {instagram_handle.trim() && !igValid && (
              <span className="block font-body text-xs text-red-400 mt-1">Letters, numbers, dots, underscores only (max 30 chars).</span>
            )}
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            onClick={submit}
            disabled={!canStart || busy}
            className="w-full min-h-[56px] rounded-xl bg-[#E8540A] hover:bg-[#ff6a1f] disabled:bg-[#3a3a3c] disabled:text-[#F5F2EE]/40 text-white font-display font-black text-lg uppercase tracking-wider transition cursor-pointer"
            style={{ letterSpacing: '0.08em' }}
          >
            {busy ? 'Starting…' : 'Start my entry'}
          </button>
          <p className="font-body text-xs text-[#F5F2EE]/50 text-center">We only use this to verify entries and notify winners.</p>
        </div>
      ) : (
        <div className="rounded-xl bg-[#1f1f21] border border-[#3a3a3c] p-4 md:p-6 space-y-3">
          <Field label="Phone" type="tel" value={resumePhone} onChange={setResumePhone} />
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            onClick={submit}
            disabled={!resumePhoneValid || busy}
            className="w-full min-h-[56px] rounded-xl bg-[#E8540A] hover:bg-[#ff6a1f] disabled:bg-[#3a3a3c] disabled:text-[#F5F2EE]/40 text-white font-display font-black text-lg uppercase tracking-wider transition cursor-pointer"
            style={{ letterSpacing: '0.08em' }}
          >
            {busy ? 'Looking…' : 'Resume my entry'}
          </button>
          <p className="font-body text-xs text-[#F5F2EE]/50 text-center">Same number you entered with. No code, no password.</p>
        </div>
      )}
    </div>
  );
}

/* ───────── Actions screen ───────── */

function EntryActions({
  slug, studio, partners, entry, previewMode, giveawayTitle, coBrandParts, isMobile, endAt, onUpdate, onSignOut,
}: {
  slug: string;
  studio: any;
  partners: any[];
  entry: GiveawayEntryRow | null;
  previewMode?: boolean;
  giveawayTitle: string;
  coBrandParts: string[];
  isMobile: boolean;
  endAt: number | null;
  onUpdate: (patch: Partial<GiveawayEntryRow>) => Promise<void>;
  onSignOut: () => void;
}) {
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

  // Preview mode synthesizes an empty entry shape so the UI renders the same.
  const e: GiveawayEntryRow = entry ?? {
    id: 'preview', studio_slug: slug, first_name: 'Preview', last_name: '', email: '',
    phone: '', phone_normalized: '', instagram_handle: '', entry_slug: 'preview',
    base_entries: 0, bonus_entries: 0, total_entries: 0,
    action_instagram_follow: false,
    action_post_engagement: false, action_post_engagement_screenshot_url: null,
    action_story_share: false, action_story_share_screenshot_url: null,
    action_free_class: false, action_free_class_screenshot_url: null,
    partner_actions: [],
    submitted_at: new Date().toISOString(),
  };

  // IG follow checks: previously checked = all true; otherwise allow per-account
  const [igChecks, setIgChecks] = useState<Record<string, boolean>>(() =>
    e.action_instagram_follow
      ? Object.fromEntries(igAccounts.map(a => [a.handle, true]))
      : {}
  );
  useEffect(() => {
    if (e.action_instagram_follow) {
      setIgChecks(Object.fromEntries(igAccounts.map(a => [a.handle, true])));
    }
  }, [e.action_instagram_follow, igAccounts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const igFollowComplete = igAccounts.length > 0 && igAccounts.every(a => igChecks[a.handle]);

  // Sync ig follow boolean to server when changes
  useEffect(() => {
    if (previewMode || !entry) return;
    if (igFollowComplete !== entry.action_instagram_follow) {
      patchAndRecompute({ action_instagram_follow: igFollowComplete });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igFollowComplete]);

  // Ensure partner_actions has a slot per partner
  useEffect(() => {
    if (previewMode || !entry) return;
    const current: PartnerActionState[] = Array.isArray(entry.partner_actions) ? entry.partner_actions : [];
    const map = new Map(current.map(a => [a.partner_id, a]));
    const next = partners.map(p => map.get(p.id) || { partner_id: p.id, completed: false, screenshot_url: null });
    const same = next.length === current.length && next.every((a, i) => a.partner_id === current[i].partner_id);
    if (!same) patchAndRecompute({ partner_actions: next });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partners.length, entry?.id]);

  const patchAndRecompute = async (patch: Partial<GiveawayEntryRow>) => {
    if (previewMode || !entry) return;
    const merged = { ...entry, ...patch } as GiveawayEntryRow;
    const bonus = computeBonus(merged, partners);
    try {
      await onUpdate({ ...patch, bonus_entries: bonus });
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    }
  };

  const setPartnerAction = (partnerId: string, patch: Partial<PartnerActionState>) => {
    const current: PartnerActionState[] = Array.isArray(e.partner_actions) ? e.partner_actions : [];
    const next = current.map(a => a.partner_id === partnerId ? { ...a, ...patch } : a);
    patchAndRecompute({ partner_actions: next });
  };

  const personalUrl = entry ? `${window.location.origin}/giveaway/${slug}/e/${entry.entry_slug}` : '';
  const copyLink = async () => {
    if (!personalUrl) return;
    try {
      await navigator.clipboard.writeText(personalUrl);
      toast.success('Link copied — bookmark or text it to yourself.');
    } catch {
      toast.error("Couldn't copy — long-press the link to copy it.");
    }
  };

  const bonusCount = computeBonus(e, partners);
  const maxPossible = 5 + partners.length;

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-12 py-6 md:py-10">
      {/* Hero */}
      <div className="mb-8 md:mb-10">
        {isMobile ? (
          <MobileStackedTitle studioName={getParticipantBrandName()} partners={partners} />
        ) : (
          <FitText
            as="h1" min={28} max={56} multiline
            style={{
              fontFamily: "'PP Right Grotesk', 'Arial Black', Arial, sans-serif",
              fontWeight: 900, color: '#E8540A', lineHeight: 0.95,
              letterSpacing: '0.01em', textTransform: 'uppercase',
            }}
          >
            {giveawayTitle}
          </FitText>
        )}
        <p className="font-body text-[#F5F2EE]/70 mt-4 max-w-2xl">
          Welcome back{entry ? `, ${entry.first_name}` : ''}. Complete actions below to earn more entries.
        </p>
      </div>

      {/* Identity bar */}
      {entry && (
        <div className="mb-4 rounded-xl border border-[#3a3a3c] bg-[#1f1f21] px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <p className="font-display text-[10px] uppercase tracking-[0.2em] text-[#8E8E93] font-bold">Signed in as</p>
            <p className="font-body text-sm text-[#F5F2EE] font-semibold">
              {entry.first_name} {entry.last_name} · {entry.phone}
            </p>
          </div>
          <button
            onClick={copyLink}
            className="min-h-[40px] px-3 rounded-lg border border-[#E8540A] text-[#E8540A] hover:bg-[#E8540A]/10 font-display text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5" /> Save my link
          </button>
          <button
            onClick={onSignOut}
            className="min-h-[40px] px-3 rounded-lg border border-[#3a3a3c] text-[#F5F2EE]/70 hover:text-[#F5F2EE] hover:border-[#F5F2EE]/40 font-display text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      )}

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
            <div className="mt-2 mb-3 w-full rounded text-center font-display font-bold"
              style={{ background: 'rgba(232, 84, 10, 0.15)', border: '1px solid #E8540A', color: '#E8540A', fontSize: 14, padding: '10px 16px' }}>
              {ef.bannerText}
            </div>
            <p className="font-body italic text-[13px] text-[#8E8E93] mb-8">{ef.winnerRuleStatement}</p>
          </>
        );
      })()}

      <div className="mb-4 rounded-xl border-2 border-[#E8540A] bg-[#E8540A]/10 p-4">
        <p className="font-display font-black text-[#E8540A] text-sm md:text-base uppercase tracking-wider text-center">
          Required to win: Follow all accounts in Step 1
        </p>
        <p className="font-body text-[12px] md:text-[13px] text-[#F5F2EE]/80 mt-1 text-center">
          That's the minimum to be eligible. Everything else is bonus entries on top.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="md:col-span-2">
          <AchievementCard
            number={1}
            title="Follow on Instagram"
            description={igAccounts.length > 1
              ? `Follow ${studioParticipantName} (${studioIgDisplay}) and ${igAccounts.length - 1} partner${igAccounts.length - 1 === 1 ? '' : 's'} on Instagram. You must complete this to be eligible to win.`
              : `Follow ${studioParticipantName} on Instagram (${studioIgDisplay}). You must complete this to be eligible to win.`}
            unlocked={igFollowComplete}
            badge="required"
          >

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {igAccounts.map(acc => {
                const checked = !!igChecks[acc.handle];
                return (
                  <label key={acc.handle} className="flex items-center gap-3 cursor-pointer min-h-[44px] rounded-lg border border-[#3a3a3c] hover:border-[#E8540A]/50 px-3 bg-[#181819]">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(ev) => setIgChecks(prev => ({ ...prev, [acc.handle]: ev.target.checked }))}
                      className="h-5 w-5 accent-[#E8540A] cursor-pointer"
                    />
                    <span className="flex-1 font-body text-sm font-semibold text-[#F5F2EE]">{acc.label}</span>
                    <a href={`https://instagram.com/${acc.handle}`} target="_blank" rel="noreferrer"
                      onClick={(ev) => ev.stopPropagation()}
                      className="font-display text-xs text-[#E8540A] hover:underline font-bold uppercase tracking-wider">
                      <Instagram className="inline h-3.5 w-3.5 mr-1" />Open
                    </a>
                  </label>
                );
              })}
            </div>
          </AchievementCard>
        </div>

        <div className="md:col-span-2 mt-2">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#3a3a3c]" />
            <p className="font-display text-[11px] font-black text-[#8E8E93] uppercase tracking-[0.2em]">Bonus entries (optional)</p>
            <div className="h-px flex-1 bg-[#3a3a3c]" />
          </div>
          {!igFollowComplete && (
            <p className="font-body text-[12px] text-[#E8540A]/90 mt-2 text-center">
              Complete Step 1 first — bonus entries only count once you're eligible.
            </p>
          )}
        </div>

        {(() => {
          const l = getActionLabel(studio.action_labels, 'post_engagement', BUILT_IN_ACTION_DEFAULTS.post_engagement);
          return (
            <AchievementCard number={2} title={l.title} description={l.description} unlocked={e.action_post_engagement} badge="bonus">
              <ActionVerification
                mode={getActionMode(studio.action_verification_modes, 'post_engagement', 'checkbox')}
                studioSlug={studio.studio_slug} draftId={e.id} actionType="post_engagement"
                checked={e.action_post_engagement} screenshotUrl={e.action_post_engagement_screenshot_url}
                onCheckboxChange={(checked) => patchAndRecompute({ action_post_engagement: checked, action_post_engagement_screenshot_url: null })}
                onUploaded={(url) => patchAndRecompute({ action_post_engagement: true, action_post_engagement_screenshot_url: url })}
                previewMode={previewMode}
              />
            </AchievementCard>
          );
        })()}

        {(() => {
          const l = getActionLabel(studio.action_labels, 'story_share', BUILT_IN_ACTION_DEFAULTS.story_share);
          return (
            <AchievementCard number={3} title={l.title} description={l.description} unlocked={e.action_story_share} badge="bonus">
              <ActionVerification
                mode={getActionMode(studio.action_verification_modes, 'story_share', 'checkbox')}
                studioSlug={studio.studio_slug} draftId={e.id} actionType="story_share"
                checked={e.action_story_share} screenshotUrl={e.action_story_share_screenshot_url}
                onCheckboxChange={(checked) => patchAndRecompute({ action_story_share: checked, action_story_share_screenshot_url: null })}
                onUploaded={(url) => patchAndRecompute({ action_story_share: true, action_story_share_screenshot_url: url })}
                previewMode={previewMode}
              />
            </AchievementCard>
          );
        })()}

        {(() => {
          const l = getActionLabel(studio.action_labels, 'free_class', BUILT_IN_ACTION_DEFAULTS.free_class);
          return (
            <AchievementCard number={4} title={l.title} description={l.description} unlocked={e.action_free_class} badge="bonus">
              <ActionVerification
                mode={getActionMode(studio.action_verification_modes, 'free_class', 'checkbox')}
                studioSlug={studio.studio_slug} draftId={e.id} actionType="free_class"
                checked={e.action_free_class} screenshotUrl={e.action_free_class_screenshot_url}
                onCheckboxChange={(checked) => patchAndRecompute({ action_free_class: checked, action_free_class_screenshot_url: null })}
                onUploaded={(url) => patchAndRecompute({ action_free_class: true, action_free_class_screenshot_url: url })}
                screenshotLabel="Tap to upload story screenshot"
                previewMode={previewMode}
              />
            </AchievementCard>
          );
        })()}

        {partners.map((p, idx) => {
          const list: PartnerActionState[] = Array.isArray(e.partner_actions) ? e.partner_actions : [];
          const state = list.find(a => a.partner_id === p.id);
          const handle = (p.partner_ig_handle || '').trim().replace(/^@/, '');
          const partnerKey = `partner:${p.id}`;
          const mode = getActionMode(studio.action_verification_modes, partnerKey, 'screenshot');
          return (
            <AchievementCard
              key={p.id} number={5 + idx} title={`Visit ${p.partner_name}`}
              description={p.receipt_instructions?.trim() || `Visit ${p.partner_name}${mode === 'screenshot' ? ' and upload a photo of your receipt.' : '.'}`}
              unlocked={!!state?.completed}
              badge="bonus"
            >
              {handle && (
                <p className="font-body text-xs text-[#8E8E93] mb-2">
                  <a href={`https://instagram.com/${handle}`} target="_blank" rel="noreferrer" className="hover:text-[#E8540A]">@{handle}</a>
                </p>
              )}
              {(() => {
                const labels = Array.isArray((p as any).prize_labels)
                  ? ((p as any).prize_labels as string[]).filter(x => (x || '').trim())
                  : [];
                const distinct = Array.from(new Set(labels.map(l => l.trim())));
                const text = distinct.length > 1
                  ? `Prizes: ${distinct.join(' · ')}`
                  : p.prize_description ? `Prize: ${p.prize_description}` : null;
                return text ? (
                  <div className="mb-3 inline-flex items-start gap-1.5 rounded-md border border-[#E8540A]/40 bg-[#E8540A]/10 text-[#E8540A] px-2 py-1 font-display font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.05em' }}>
                    <span>🎁</span><span>{text}</span>
                  </div>
                ) : null;
              })()}
              <ActionVerification
                mode={mode}
                studioSlug={studio.studio_slug} draftId={e.id}
                actionType={`partner_${p.id}`}
                checked={!!state?.completed}
                screenshotUrl={state?.screenshot_url ?? null}
                onCheckboxChange={(checked) => setPartnerAction(p.id, { completed: checked, screenshot_url: null })}
                onUploaded={(url) => setPartnerAction(p.id, { completed: true, screenshot_url: url })}
                previewMode={previewMode}
              />
            </AchievementCard>
          );
        })}


        <div className="md:col-span-2">
          <LiveEntryCounter entries={bonusCount} max={maxPossible} />
        </div>

        {entry && (
          <div className={`md:col-span-2 rounded-xl border p-4 flex items-center gap-3 flex-wrap ${igFollowComplete ? 'border-[#E8540A]/40 bg-[#E8540A]/5' : 'border-[#3a3a3c] bg-[#1f1f21]'}`}>
            <Check className={`h-5 w-5 flex-shrink-0 ${igFollowComplete ? 'text-[#E8540A]' : 'text-[#8E8E93]'}`} />
            <p className="font-body text-sm text-[#F5F2EE] flex-1 min-w-[200px]">
              {igFollowComplete ? (
                <>You're eligible with <span className="font-bold text-[#E8540A]">{bonusCount}</span> {bonusCount === 1 ? 'entry' : 'entries'}. Anything you check off saves automatically.</>
              ) : (
                <>Not eligible yet — finish Step 1 (Follow on Instagram) to be entered to win. Bonus actions saved: <span className="font-bold text-[#E8540A]">{bonusCount}</span>.</>
              )}
            </p>
            <button
              onClick={copyLink}
              className="min-h-[40px] px-3 rounded-lg bg-[#E8540A] text-white hover:bg-[#ff6a1f] font-display text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5" /> Copy my link
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

/* ───────── Shared building blocks (unchanged) ───────── */

const TITLE_FONT = "'PP Right Grotesk', 'Arial Black', Arial, sans-serif";

function MobileStackedTitle({ studioName, partners }: { studioName: string; partners: { partner_name: string }[] }) {
  const baseStyle: React.CSSProperties = {
    fontFamily: TITLE_FONT, fontWeight: 900, lineHeight: 0.95,
    letterSpacing: '0.01em', textTransform: 'uppercase', textAlign: 'center',
  };

  const sep = (
    <div style={{ fontFamily: TITLE_FONT, fontWeight: 900, color: '#E8540A', fontSize: 20, textAlign: 'center', margin: '4px 0', lineHeight: 1 }}>×</div>
  );
  return (
    <div className="w-full max-w-full overflow-hidden">
      <FitText as="div" min={24} max={48} multiline style={{ ...baseStyle, color: '#FDF7EA' }}>{studioName}</FitText>
      {partners.map((p, i) => (
        <div key={i}>
          {sep}
          <FitText as="div" min={20} max={48} multiline style={{ ...baseStyle, color: '#E8540A' }}>{p.partner_name}</FitText>
        </div>
      ))}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#1C1C1E] text-[#F5F2EE]"
      style={{ touchAction: 'pan-y' }}
    >
      {children}
    </div>
  );
}

function CoBrandBar({ parts }: { parts: string[] }) {
  return (
    <div className="w-full bg-[#242426] border-b border-[#3a3a3c]">
      <div className="max-w-[1200px] mx-auto px-4 md:px-12 py-2.5 md:py-3 flex flex-wrap items-center justify-center md:justify-start gap-1.5">
        <span className="font-display font-bold uppercase text-[#8E8E93]" style={{ fontSize: 11, letterSpacing: '0.15em' }}>Presented by</span>
        {parts.map((p, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <span className="font-display font-bold text-[#E8540A]" style={{ fontSize: 13 }}>+</span>}
            <span className="font-display font-bold uppercase text-[#F5F2EE]" style={{ fontSize: 'clamp(11px, 1.1vw, 13px)', letterSpacing: '0.05em' }}>{p}</span>
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

export function getActionMode(
  modes: Record<string, 'checkbox' | 'screenshot'> | null | undefined,
  key: string,
  fallback: 'checkbox' | 'screenshot',
): 'checkbox' | 'screenshot' {
  const v = modes?.[key];
  return v === 'checkbox' || v === 'screenshot' ? v : fallback;
}

function ActionVerification({
  mode, studioSlug, draftId, actionType, checked, screenshotUrl,
  onCheckboxChange, onUploaded, screenshotLabel, previewMode,
}: {
  mode: 'checkbox' | 'screenshot';
  studioSlug: string; draftId: string; actionType: string;
  checked: boolean; screenshotUrl: string | null;
  onCheckboxChange: (checked: boolean) => void;
  onUploaded: (url: string) => void;
  screenshotLabel?: string; previewMode?: boolean;
}) {
  if (mode === 'screenshot') {
    return (
      <ScreenshotUpload
        studioSlug={studioSlug} draftId={draftId} actionType={actionType}
        value={screenshotUrl} onUploaded={onUploaded}
        label={screenshotLabel} previewMode={previewMode}
      />
    );
  }
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-3 cursor-pointer min-h-[56px] rounded-lg border border-[#3a3a3c] hover:border-[#E8540A]/50 px-4 bg-[#181819]">
        <input
          type="checkbox" checked={checked}
          onChange={(e) => onCheckboxChange(e.target.checked)}
          className="h-5 w-5 accent-[#E8540A] cursor-pointer"
        />
        <span className="flex-1 font-body text-sm font-semibold text-[#F5F2EE]">
          {checked ? "Got it — marked complete" : "I completed this action"}
        </span>
      </label>
      <p className="font-body text-[11px] leading-snug text-[#E8540A]/90 bg-[#E8540A]/10 border border-[#E8540A]/40 rounded px-3 py-2">
        ⚠ We check every entry. Falsely marking this complete disqualifies your entries and bans you from future giveaways.
      </p>
    </div>
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
        <p className="font-display font-bold text-[#F5F2EE]/70 mt-3 uppercase" style={{ fontSize: 'clamp(12px, 1.4vw, 16px)', letterSpacing: '0.35em' }}>{city}</p>
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
