import { Check, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ReadyForIntroChecklistProps {
  hasPhone: boolean;
  qCompleted: boolean;
  confirmationSent: boolean;
  isSecondIntro: boolean;
}

export function ReadyForIntroChecklist({
  hasPhone,
  qCompleted,
  confirmationSent,
  isSecondIntro,
}: ReadyForIntroChecklistProps) {
  // For 2nd intros, Q doesn't apply
  const qReady = isSecondIntro || qCompleted;
  const allReady = hasPhone && qReady && confirmationSent;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <CheckItem label="Phone" ok={hasPhone} />
      {!isSecondIntro && <CheckItem label="Q" ok={qCompleted} />}
      <CheckItem label="Conf" ok={confirmationSent} />
      {allReady && (
        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-600 text-white border-transparent gap-0.5">
          <Check className="w-2.5 h-2.5" />
          Ready
        </Badge>
      )}
    </div>
  );
}

function CheckItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] px-1 py-0 rounded',
      ok ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'
    )}>
      {ok ? <Check className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
      {label}
    </span>
  );
}
