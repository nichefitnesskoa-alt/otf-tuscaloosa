/**
 * At-Risk Banner: shows risk category counts and a filter toggle.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { RiskCategory } from './myDayTypes';

interface AtRiskBannerProps {
  counts: Record<RiskCategory, number>;
  showAtRiskOnly: boolean;
  onToggle: () => void;
}

const LABELS: Record<RiskCategory, string> = {
  noQ: 'No Q',
  qIncomplete: 'Q Incomplete',
  unconfirmed: 'Unconfirmed',
  coachTbd: 'Coach TBD',
  missingOwner: 'No Owner',
};

export default function AtRiskBanner({ counts, showAtRiskOnly, onToggle }: AtRiskBannerProps) {
  const totalAtRisk = Object.values(counts).reduce((sum, v) => sum + v, 0);
  if (totalAtRisk === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
      <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
      <span className="text-sm font-medium text-destructive">{totalAtRisk} at risk</span>
      <div className="flex items-center gap-1 flex-wrap">
        {(Object.entries(counts) as [RiskCategory, number][])
          .filter(([, v]) => v > 0)
          .map(([key, count]) => (
            <Badge
              key={key}
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 text-destructive border-destructive/30"
            >
              {count} {LABELS[key]}
            </Badge>
          ))}
      </div>
      <Button
        variant={showAtRiskOnly ? 'default' : 'outline'}
        size="sm"
        className="ml-auto h-6 text-[11px] px-2"
        onClick={onToggle}
      >
        {showAtRiskOnly ? 'Show all' : 'View only at-risk'}
      </Button>
    </div>
  );
}
