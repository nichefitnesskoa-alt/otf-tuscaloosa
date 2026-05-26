import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Eye, Presentation, ExternalLink, Gift, Share2, Copy, BarChart3, Check } from 'lucide-react';
import { getAdminStudioName } from '@/lib/studioNames';
import { toast } from 'sonner';

type Studio = { studio_slug: string; share_slug: string | null };

const RESERVED = new Set([
  'my-day','coach-view','recaps','wig','the-table','vips','my-intros','pipeline',
  'admin','login','scripts','settings','meeting','q','story','vip-register',
  'vip-availability','vip','apply','join-the-team','giveaway','partner-deck',
  'questionnaire','scorecards','coaches','sas','dashboard','my-shifts',
  'shift-recap','reports','leads',
]);

function sanitize(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 40);
}

export default function GiveawaysAdminTab() {
  const [studios, setStudios] = useState<Studio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await (supabase
      .from('giveaway_studios') as any)
      .select('studio_slug, share_slug')
      .order('studio_slug', { ascending: true });
    if (error) { setError(error.message); return; }
    setStudios(data || []);
  };

  useEffect(() => { load(); }, []);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied');
    } catch {
      toast.error("Couldn't copy — long-press the Open button instead");
    }
  };

  if (error) return <p className="text-sm text-destructive">Couldn't load studios: {error}</p>;
  if (!studios) return <p className="text-sm text-muted-foreground">Loading studios…</p>;
  if (studios.length === 0) return <p className="text-sm text-muted-foreground">No giveaway studios set up yet.</p>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Gift className="w-5 h-5" />
          Giveaways
        </h2>
        <p className="text-sm text-muted-foreground">
          Edit the short share link for each studio, then copy and send. No login required for recipients.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {studios.map((s) => (
          <StudioCard key={s.studio_slug} studio={s} onSaved={load} onCopy={copy} />
        ))}
      </div>
    </div>
  );
}

function StudioCard({
  studio,
  onSaved,
  onCopy,
}: {
  studio: Studio;
  onSaved: () => void;
  onCopy: (url: string) => void;
}) {
  const slug = studio.studio_slug;
  const [value, setValue] = useState(studio.share_slug ?? '');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Always use the published short domain for partner-facing links
  const PUBLIC_ORIGIN = 'https://otf-tuscaloosa.lovable.app';
  const publicUrl = value ? `${PUBLIC_ORIGIN}/${value}` : '';

  const save = async () => {
    const next = sanitize(value);
    if (next === (studio.share_slug ?? '')) return;
    if (!next) { toast.error('Share link cannot be empty'); setValue(studio.share_slug ?? ''); return; }
    if (RESERVED.has(next.toLowerCase())) {
      toast.error(`"${next}" is reserved by the app — pick another`);
      setValue(studio.share_slug ?? '');
      return;
    }
    setSaving(true);
    const { error } = await (supabase
      .from('giveaway_studios') as any)
      .update({ share_slug: next })
      .eq('studio_slug', slug);
    setSaving(false);
    if (error) {
      if ((error.message || '').toLowerCase().includes('duplicate') || (error.code === '23505')) {
        toast.error('That link is already taken by another studio');
      } else {
        toast.error(`Couldn't save: ${error.message}`);
      }
      setValue(studio.share_slug ?? '');
      return;
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
    onSaved();
  };

  const internal: { label: string; href: string; icon: any }[] = [
    { label: 'Admin (Entries & Draw)', href: `/admin/${slug}`, icon: Users },
    { label: 'Participant Preview', href: `/admin/${slug}/preview`, icon: Eye },
    { label: 'Edit Partner Deck', href: `/admin/${slug}/partner-deck`, icon: Presentation },
    { label: 'Partner Dashboard (live entries)', href: `/admin/${slug}/partner-view`, icon: BarChart3 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{getAdminStudioName(slug)}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Custom share link block */}
        <div className="rounded-lg border-2 border-[#E8540A]/40 bg-[#E8540A]/5 p-3 space-y-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold text-[#E8540A]">
            <Share2 className="w-3.5 h-3.5" />
            Partner Deck — Share Link
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Custom share link
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-muted-foreground font-mono shrink-0">/</span>
              <Input
                value={value}
                onChange={(e) => setValue(sanitize(e.target.value))}
                onBlur={save}
                placeholder="OTF-AUBURN-PARTNER"
                disabled={saving}
                className="font-mono text-[13px] uppercase"
              />
              {justSaved && (
                <span className="text-[11px] text-green-600 font-semibold flex items-center gap-1 shrink-0">
                  <Check className="w-3 h-3" /> Saved
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Letters, numbers, and hyphens only. Case-insensitive.
            </p>
          </div>

          {publicUrl && (
            <p className="text-[11px] text-foreground/80 break-all font-mono bg-background/50 rounded px-2 py-1.5">
              {publicUrl}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => publicUrl && onCopy(publicUrl)}
              disabled={!publicUrl}
              className="min-h-[44px] text-[13px] font-semibold bg-[#E8540A] hover:bg-[#E8540A]/90 text-white"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy link
            </Button>
            <Button asChild variant="outline" disabled={!publicUrl} className="min-h-[44px] text-[13px] font-semibold">
              <a href={publicUrl || '#'} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open
              </a>
            </Button>
          </div>
        </div>

        {/* Internal tools */}
        <div className="grid gap-2">
          {internal.map((l) => {
            const Icon = l.icon;
            return (
              <Button
                key={l.href}
                asChild
                variant="outline"
                className="justify-start min-h-[44px] text-[13px] font-semibold"
              >
                <a href={l.href} target="_blank" rel="noopener noreferrer">
                  <Icon className="w-4 h-4 mr-2" />
                  {l.label}
                </a>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
