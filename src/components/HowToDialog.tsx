import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Flag, AtSign, Bell, CheckCircle } from 'lucide-react';

const STORAGE_KEY = 'own_it_how_to_seen_v1';

/**
 * One-time orientation modal shown after the user signs in. Seen state is
 * stored in localStorage only — clearing localStorage will show it again,
 * which is acceptable for a one-time orientation modal.
 */
export function HowToDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setOpen(true);
  }, []);

  const dismiss = () => {
    try { window.localStorage.setItem(STORAGE_KEY, '1'); } catch {}
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick tour</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex gap-3">
            <CheckCircle className="w-5 h-5 text-[#E8540A] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">My Day</div>
              <div className="text-muted-foreground">Your shift home base — intros, follow-ups, scripts.</div>
            </div>
          </div>
          <div className="flex gap-3">
            <Flag className="w-5 h-5 text-[#E8540A] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Own It</div>
              <div className="text-muted-foreground">The weekly accountability table. Lock in your update, then Build / Flag / Offer on each other.</div>
            </div>
          </div>
          <div className="flex gap-3">
            <AtSign className="w-5 h-5 text-[#E8540A] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Tag a teammate</div>
              <div className="text-muted-foreground">
                Type <span className="font-mono bg-muted px-1 rounded">@Name</span> or <span className="font-mono bg-muted px-1 rounded">@Lane Owner</span>{' '}
                (e.g. <span className="font-mono bg-muted px-1 rounded">@IG Owner</span>) anywhere in Own It and they'll be notified.
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Bell className="w-5 h-5 text-[#E8540A] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Notifications</div>
              <div className="text-muted-foreground">The bell shows when you're tagged, when teammates respond, and when they see your tag back.</div>
            </div>
          </div>
        </div>
        <Button onClick={dismiss} className="w-full bg-[#E8540A] hover:bg-[#E8540A]/90">
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
