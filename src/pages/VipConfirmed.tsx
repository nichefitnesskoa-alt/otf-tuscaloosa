/**
 * Public VIP claim confirmation page — /vip/:slug/confirmed
 * Off-white background, OTF orange header, no auth.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Copy, Check, Share2, Download, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { QRCodeCanvas } from 'qrcode.react';
import { formatDisplayTime } from '@/lib/time/timeUtils';
import { buildGoogleCalendarUrl, downloadIcs } from '@/lib/vip/calendar';
import { downloadBrandedQr, slugifyGroup } from '@/lib/vip/qrDownload';

const sb = supabase as any;
const ORANGE = '#E8540A';
const OFF_WHITE = '#F5F2EE';

interface SessionInfo {
  id: string;
  session_date: string;
  session_time: string;
  status: string;
  reserved_by_group: string | null;
  shareable_slug: string | null;
}

export default function VipConfirmed() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) { navigate('/vip-availability', { replace: true }); return; }
    (async () => {
      const { data } = await sb
        .from('vip_sessions')
        .select('id, session_date, session_time, status, reserved_by_group, shareable_slug')
        .eq('shareable_slug', slug)
        .is('archived_at', null)
        .single();
      if (!data || (data as any).status !== 'reserved') {
        navigate('/vip-availability', { replace: true });
        return;
      }
      setSession(data as SessionInfo);
      setLoading(false);
    })();
  }, [slug, navigate]);

  const registerUrl = useMemo(
    () => `https://otf-tuscaloosa.lovable.app/vip/${slug}/register`,
    [slug],
  );

  const canShare = typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(registerUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await (navigator as any).share({
        title: 'Join us at OTF Tuscaloosa',
        text: "I just booked us a private class at OrangeTheory Tuscaloosa! Fill out your info so we're all set for class.",
        url: registerUrl,
      });
    } catch { /* user cancelled */ }
  };

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: OFF_WHITE }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: ORANGE }} />
      </div>
    );
  }

  const d = new Date(session.session_date + 'T00:00:00');
  const dayName = format(d, 'EEEE');
  const fullDate = format(d, 'MMMM d, yyyy');
  const timeLabel = formatDisplayTime(session.session_time);
  const groupName = session.reserved_by_group;

  const calEvent = {
    session_date: session.session_date,
    session_time: session.session_time,
    group_name: groupName,
  };

  const handleQrDownload = () => {
    downloadBrandedQr({
      qrCanvasId: 'vip-confirm-qr',
      fileName: `OTF-VIP-${slugifyGroup(groupName)}-${format(d, 'MMddyyyy')}.png`,
      titleLine: 'OTF Tuscaloosa — Private Group Class',
      dateTimeLine: `${fullDate} at ${timeLabel}`,
    });
  };

  const handleAppleCal = () => {
    downloadIcs(calEvent, `otf-vip-${format(d, 'MMddyyyy')}.ics`);
  };

  const steps = [
    { n: 1, label: 'Claim', sub: '', done: true },
    { n: 2, label: 'Share with your group', sub: 'Send them the link below so everyone can fill out their info' },
    { n: 3, label: 'Show up 15 min early', sub: "We'll get your heart rate monitors set up" },
    { n: 4, label: 'First class free', sub: "Bring your energy. We'll handle the rest." },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: OFF_WHITE }}>
      {/* Header bar */}
      <header className="w-full text-white py-5 px-4 text-center" style={{ backgroundColor: ORANGE }}>
        <h1 className="text-xl font-extrabold tracking-wide">OTF TUSCALOOSA</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        {/* Hero */}
        <section className="text-center space-y-2">
          <h2 className="text-5xl md:text-6xl font-extrabold tracking-tight text-neutral-900">
            You're in.
          </h2>
          <p className="text-base md:text-lg text-neutral-500">
            Here's what happens next.
          </p>
        </section>

        {/* Date/time block */}
        <section
          className="rounded-2xl bg-white px-6 py-6 text-center mx-auto max-w-xl"
          style={{ border: `2px solid ${ORANGE}` }}
        >
          <p className="text-sm uppercase tracking-widest text-neutral-500 font-semibold">{dayName}</p>
          <p className="text-2xl md:text-3xl font-bold mt-1 text-neutral-900">{fullDate}</p>
          <p className="text-xl md:text-2xl font-semibold mt-1" style={{ color: ORANGE }}>{timeLabel}</p>
          {groupName && (
            <p className="text-sm text-neutral-600 mt-2">Group: <span className="font-semibold">{groupName}</span></p>
          )}
        </section>

        {/* Timeline */}
        <section>
          <ol className="flex flex-col md:flex-row gap-6 md:gap-3 md:justify-between">
            {steps.map((step) => (
              <li key={step.n} className="flex md:flex-col items-start md:items-center gap-3 md:gap-2 flex-1 md:text-center">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-base shrink-0"
                  style={{
                    backgroundColor: step.done ? ORANGE : 'transparent',
                    color: step.done ? '#fff' : ORANGE,
                    border: `2px solid ${ORANGE}`,
                  }}
                >
                  {step.n}
                </div>
                <div>
                  <p className="font-semibold text-neutral-900 text-sm md:text-base">{step.label}</p>
                  {step.sub && (
                    <p className="text-xs md:text-sm text-neutral-500 leading-snug mt-0.5 max-w-[200px]">
                      {step.sub}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Share section */}
        <section className="space-y-3 max-w-xl mx-auto">
          <div className="text-center">
            <h3 className="text-xl font-bold text-neutral-900">Share this with your group</h3>
            <p className="text-sm text-neutral-500 mt-1">
              Each person fills out their own info before class.
            </p>
          </div>
          <div className="rounded-xl bg-white border border-neutral-200 px-3 py-2">
            <Input
              readOnly
              value={registerUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="text-xs md:text-sm border-0 bg-transparent focus-visible:ring-0 px-0 h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleCopy}
              className="min-h-[44px] h-12 font-semibold text-white"
              style={{ backgroundColor: copied ? '#16a34a' : ORANGE }}
            >
              {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            {canShare ? (
              <Button
                onClick={handleShare}
                variant="outline"
                className="min-h-[44px] h-12 font-semibold"
                style={{ borderColor: ORANGE, color: ORANGE }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            ) : (
              <Button
                onClick={handleCopy}
                variant="outline"
                className="min-h-[44px] h-12 font-semibold"
                style={{ borderColor: ORANGE, color: ORANGE }}
              >
                <Copy className="w-4 h-4 mr-2" />
                {copied ? 'Copied!' : 'Copy Link'}
              </Button>
            )}
          </div>
        </section>

        {/* QR code */}
        <section className="flex flex-col items-center gap-3">
          <div className="bg-white p-3 rounded-lg" style={{ border: `4px solid ${ORANGE}` }}>
            <QRCodeCanvas
              id="vip-confirm-qr"
              value={registerUrl}
              size={180}
              bgColor="#FFFFFF"
              fgColor="#000000"
              level="M"
            />
          </div>
          <p className="text-sm text-neutral-500">Or scan to register</p>
          <Button
            onClick={handleQrDownload}
            variant="outline"
            className="min-h-[44px] h-12 w-full md:w-auto md:px-8 font-semibold"
            style={{ borderColor: ORANGE, color: ORANGE }}
          >
            <Download className="w-4 h-4 mr-2" />
            Download QR Code
          </Button>
        </section>

        {/* Add to calendar */}
        <section className="max-w-xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-3">
          <a
            href={buildGoogleCalendarUrl(calEvent)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center min-h-[44px] h-12 rounded-md font-semibold text-white px-4"
            style={{ backgroundColor: ORANGE }}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Add to Google Calendar
          </a>
          <Button
            onClick={handleAppleCal}
            variant="outline"
            className="min-h-[44px] h-12 font-semibold"
            style={{ borderColor: ORANGE, color: ORANGE }}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Add to Apple Calendar
          </Button>
        </section>

        <div className="h-8" />
      </main>
    </div>
  );
}
