/**
 * SA-facing card that generates the SA's personal Intro Scheduler Link.
 *
 * - SA name captured automatically from login (never typed).
 * - SA picks a lead source (default 'Intro Scheduler Link', or any real source
 *   including 'Event' which reveals the EventPicker).
 * - Shows link URL, QR (qrcode.react), "Download branded PNG" via downloadBrandedQr,
 *   and a copy-link button.
 */
import { useEffect, useMemo, useState } from 'react';
import { isEventOrOutreachSource } from '@/lib/sa/leadsBooked';
import { QRCodeCanvas } from 'qrcode.react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { LEAD_SOURCES } from '@/types';
import { EventPicker } from '@/components/events/EventPicker';
import { buildShortIntroUrl, ensureIntroLinkCode, PUBLIC_BOOKING_BASE } from '@/lib/introScheduler/linkUrl';
import { downloadBrandedQr } from '@/lib/vip/qrDownload';
import { Copy, Download, Link as LinkIcon, QrCode, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_SOURCE = 'Intro Scheduler Link';

interface Props {
  /** Optional override — used when Admin views a specific SA's link (falls back to logged-in user). */
  saName?: string;
}

export function IntroSchedulerLinkCard({ saName }: Props) {
  const { user } = useAuth();
  const sa = saName || user?.name || '';
  const [source, setSource] = useState<string>(DEFAULT_SOURCE);
  const [eventId, setEventId] = useState<string | null>(null);

  const sources = useMemo(() => {
    const base = [...LEAD_SOURCES] as string[];
    if (!base.includes(DEFAULT_SOURCE)) base.unshift(DEFAULT_SOURCE);
    // Sort but keep 'Intro Scheduler Link' first for discoverability
    const sorted = base.filter(s => s !== DEFAULT_SOURCE).sort();
    return [DEFAULT_SOURCE, ...sorted];
  }, []);

  const [url, setUrl] = useState<string>('');
  const [loadingCode, setLoadingCode] = useState(false);

  useEffect(() => {
    if (!sa) { setUrl(''); return; }
    if (isEventOrOutreachSource(source) && !eventId) { setUrl(''); return; }
    let cancelled = false;
    setLoadingCode(true);
    (async () => {
      try {
        const code = await ensureIntroLinkCode({
          saName: sa,
          source,
          eventId: isEventOrOutreachSource(source) ? eventId : null,
        });
        if (!cancelled) setUrl(buildShortIntroUrl(PUBLIC_BOOKING_BASE, code));
      } catch (e) {
        console.error('[IntroLink] failed to mint short code', e);
        if (!cancelled) setUrl('');
      } finally {
        if (!cancelled) setLoadingCode(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sa, source, eventId]);

  const canvasId = `intro-link-qr-${sa || 'anon'}`;

  if (!sa) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">Sign in to generate your personal intro link.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <QrCode className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Your Intro Scheduler Link</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Share this link or QR anywhere. Every booking is credited to <strong className="text-foreground">{sa}</strong> automatically.
      </p>

      <div className="space-y-2">
        <Label>Lead source</Label>
        <Select value={source} onValueChange={v => { setSource(v); if (!isEventOrOutreachSource(v)) setEventId(null); }}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            {sources.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {isEventOrOutreachSource(source) && (
          <EventPicker value={eventId} onValueChange={setEventId} required dense />
        )}
      </div>

      {loadingCode && !url && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Generating your link…</div>
      )}

      {url && (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
            <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input readOnly value={url} className="h-8 border-0 bg-transparent focus-visible:ring-0 text-xs" />
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => { await navigator.clipboard.writeText(url); toast.success('Link copied'); }}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex flex-col items-center gap-3 py-2">
            <div className="p-3 bg-card rounded-lg">
              <QRCodeCanvas id={canvasId} value={url} size={200} includeMargin={false} />
            </div>
            <Button
              variant="outline"
              onClick={() => downloadBrandedQr({
                qrCanvasId: canvasId,
                fileName: `otf-intro-link-${sa.toLowerCase().replace(/\s+/g, '-')}.png`,
                titleLine: 'OTF Tuscaloosa — Book Your Free Intro',
                dateTimeLine: `Booked with ${sa}`,
                ctaLine: 'Scan to pick your class',
              })}
            >
              <Download className="w-4 h-4 mr-2" /> Download branded PNG
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
