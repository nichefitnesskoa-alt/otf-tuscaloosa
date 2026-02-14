import { useMemo } from 'react';
import { Lightbulb } from 'lucide-react';

const GENERAL_TIPS = [
  'Intros with completed questionnaires close 2x higher on average.',
  'Referral leads typically have the highest close rate.',
  'Speed-to-lead matters — contacting within 5 min doubles your odds.',
  'The best objection handler? "What would it look like if you started?"',
  'Personal calls convert 3x better than texts for no-shows.',
  'Asking for a referral right after purchase has the highest success rate.',
  'Confirming tomorrow\'s intros today reduces no-shows by 40%.',
];

export function DailyInsight() {
  const tip = useMemo(() => {
    // Rotate daily based on day-of-year
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    return GENERAL_TIPS[dayOfYear % GENERAL_TIPS.length];
  }, []);

  return (
    <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2">
      <Lightbulb className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
      <p className="text-xs text-foreground/80">{tip}</p>
    </div>
  );
}
