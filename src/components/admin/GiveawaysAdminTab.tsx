import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Eye, Presentation, ExternalLink, Gift, Share2, Copy, BarChart3 } from 'lucide-react';
import { getAdminStudioName } from '@/lib/studioNames';
import { toast } from 'sonner';

type Studio = { studio_slug: string };

export default function GiveawaysAdminTab() {
  const [studios, setStudios] = useState<Studio[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase
        .from('giveaway_studios') as any)
        .select('studio_slug')
        .order('studio_slug', { ascending: true });
      if (error) { setError(error.message); return; }
      setStudios(data || []);
    })();
  }, []);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied');
    } catch {
      toast.error("Couldn't copy — long-press the Open button instead");
    }
  };

  if (error) {
    return <p className="text-sm text-destructive">Couldn't load studios: {error}</p>;
  }
  if (!studios) {
    return <p className="text-sm text-muted-foreground">Loading studios…</p>;
  }
  if (studios.length === 0) {
    return <p className="text-sm text-muted-foreground">No giveaway studios set up yet.</p>;
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Gift className="w-5 h-5" />
          Giveaways
        </h2>
        <p className="text-sm text-muted-foreground">
          Internal tools and the public share link for every studio. Use the share link when sending the deck to partners — no login required.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {studios.map((s) => {
          const slug = s.studio_slug;
          const publicDeckUrl = `${origin}/partner-deck/${slug}`;
          const internal: { label: string; href: string; icon: any }[] = [
            { label: 'Admin (Entries & Draw)', href: `/admin/${slug}`, icon: Users },
            { label: 'Participant Preview', href: `/admin/${slug}/preview`, icon: Eye },
            { label: 'Edit Partner Deck', href: `/admin/${slug}/partner-deck`, icon: Presentation },
            { label: 'Partner Dashboard (live entries)', href: `/admin/${slug}/partner-view`, icon: BarChart3 },
          ];
          return (
            <Card key={slug}>
              <CardHeader>
                <CardTitle className="text-base">{getAdminStudioName(slug)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Public share link — featured */}
                <div className="rounded-lg border-2 border-[#E8540A]/40 bg-[#E8540A]/5 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-bold text-[#E8540A]">
                    <Share2 className="w-3.5 h-3.5" />
                    Partner Deck — Share Link
                  </div>
                  <p className="text-[11px] text-muted-foreground break-all font-mono">{publicDeckUrl}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => copy(publicDeckUrl)}
                      className="min-h-[44px] text-[13px] font-semibold bg-[#E8540A] hover:bg-[#E8540A]/90 text-white"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy link
                    </Button>
                    <Button asChild variant="outline" className="min-h-[44px] text-[13px] font-semibold">
                      <a href={`/partner-deck/${slug}`} target="_blank" rel="noopener noreferrer">
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
        })}
      </div>
    </div>
  );
}
