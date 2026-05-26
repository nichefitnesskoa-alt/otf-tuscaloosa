import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Eye, Presentation, ExternalLink, Gift } from 'lucide-react';
import { getAdminStudioName } from '@/lib/studioNames';

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

  if (error) {
    return <p className="text-sm text-destructive">Couldn't load studios: {error}</p>;
  }
  if (!studios) {
    return <p className="text-sm text-muted-foreground">Loading studios…</p>;
  }
  if (studios.length === 0) {
    return <p className="text-sm text-muted-foreground">No giveaway studios set up yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Gift className="w-5 h-5" />
          Giveaways
        </h2>
        <p className="text-sm text-muted-foreground">
          Quick links to admin, preview, and partner deck for every studio. Each opens in a new tab.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {studios.map((s) => {
          const slug = s.studio_slug;
          const links: { label: string; href: string; icon: any }[] = [
            { label: 'Admin (Entries & Draw)', href: `/admin/${slug}`, icon: Users },
            { label: 'Participant Preview', href: `/admin/${slug}/preview`, icon: Eye },
            { label: 'Partner Deck (Admin)', href: `/admin/${slug}/partner-deck`, icon: Presentation },
            { label: 'Partner View', href: `/admin/${slug}/partner-view`, icon: ExternalLink },
          ];
          return (
            <Card key={slug}>
              <CardHeader>
                <CardTitle className="text-base">{getAdminStudioName(slug)}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {links.map((l) => {
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
