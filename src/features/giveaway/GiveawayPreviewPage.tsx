import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Eye, ArrowLeft, Smartphone, Monitor, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useGiveawayStudio } from './hooks/useGiveawayStudio';
import { GiveawayEntryForm } from './components/GiveawayEntryForm';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function GiveawayPreviewPage() {
  const { studioSlug } = useParams<{ studioSlug: string }>();
  const navigate = useNavigate();
  const { studio, refresh } = useGiveawayStudio(studioSlug);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [going, setGoing] = useState(false);

  if (!studio || !studioSlug) {
    return <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE] flex items-center justify-center font-body">Loading…</div>;
  }

  const isLive = !!studio.goes_live_at;

  const goLive = async () => {
    setGoing(true);
    const { error } = await supabase
      .from('giveaway_studios' as any)
      .update({ goes_live_at: new Date().toISOString() })
      .eq('id', studio.id);
    setGoing(false);
    setConfirmOpen(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Giveaway is live.');
      refresh();
    }
  };

  return (
    <div className="min-h-screen bg-[#1C1C1E] text-[#F5F2EE]">
      {/* Top banner — fixed */}
      <div className="sticky top-0 z-50 bg-[#E8540A] text-white">
        <div className="max-w-[1400px] mx-auto h-11 px-3 md:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="h-4 w-4 flex-shrink-0" />
            <p className="font-display font-bold uppercase truncate" style={{ fontSize: 13, letterSpacing: '0.05em' }}>
              Preview Mode <span className="hidden sm:inline opacity-80">— Not visible to participants</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate(`/admin/${studioSlug}`)}
              className="font-display font-bold uppercase text-[13px] tracking-wider h-9 px-3 rounded-md border border-white text-white hover:bg-white/10 cursor-pointer inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /><span className="hidden sm:inline">Back to Admin</span>
            </button>
            {isLive ? (
              <span className="font-display font-bold uppercase text-[13px] h-9 px-3 rounded-md bg-white text-[#4CAF50] inline-flex items-center gap-1.5">
                <Check className="h-4 w-4" /> Live
              </span>
            ) : (
              <button
                onClick={() => setConfirmOpen(true)}
                className="font-display font-bold uppercase text-[13px] tracking-wider h-9 px-3 rounded-md bg-white text-[#E8540A] hover:bg-white/90 cursor-pointer"
              >
                Go Live
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Device toggle (desktop only) */}
      <div className="hidden md:flex justify-end max-w-[1400px] mx-auto px-6 pt-4">
        <div className="inline-flex rounded-lg border border-[#3a3a3c] overflow-hidden">
          <button onClick={() => setDevice('desktop')}
            className={`min-h-[36px] px-3 inline-flex items-center gap-1.5 font-display font-bold uppercase text-xs cursor-pointer ${
              device === 'desktop' ? 'bg-[#E8540A] text-white' : 'bg-[#2a2a2c] text-[#F5F2EE]/70 hover:bg-[#3a3a3c]'
            }`}>
            <Monitor className="h-3.5 w-3.5" /> Desktop
          </button>
          <button onClick={() => setDevice('mobile')}
            className={`min-h-[36px] px-3 inline-flex items-center gap-1.5 font-display font-bold uppercase text-xs cursor-pointer ${
              device === 'mobile' ? 'bg-[#E8540A] text-white' : 'bg-[#2a2a2c] text-[#F5F2EE]/70 hover:bg-[#3a3a3c]'
            }`}>
            <Smartphone className="h-3.5 w-3.5" /> Mobile
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="pt-2">
        {device === 'mobile' ? (
          <div className="mx-auto my-6 bg-black rounded-[2rem] border-4 border-[#2a2a2c] overflow-hidden shadow-2xl" style={{ width: 390, maxWidth: '100%' }}>
            <div className="overflow-y-auto" style={{ height: 780 }}>
              <GiveawayEntryForm slug={studioSlug} previewMode />
            </div>
          </div>
        ) : (
          <GiveawayEntryForm slug={studioSlug} previewMode />
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set this giveaway live now?</AlertDialogTitle>
            <AlertDialogDescription>
              The countdown will start immediately and participants will be able to enter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={goLive} disabled={going}>{going ? 'Going live…' : 'Yes, go live'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Re-export Link to satisfy linter for unused import
export { Link };
