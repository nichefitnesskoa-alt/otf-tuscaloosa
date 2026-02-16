import { MeetingSection } from './MeetingSection';
import { Target } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

interface Props {
  closeRate: number;
  wigTarget: string;
  wigCommitments: string;
  previousCommitments: string | null;
  onTargetChange: (v: string) => void;
  onCommitmentsChange: (v: string) => void;
  isAdmin: boolean;
  isPresentMode: boolean;
}

export function WigSection({ closeRate, wigTarget, wigCommitments, previousCommitments, onTargetChange, onCommitmentsChange, isAdmin, isPresentMode }: Props) {
  return (
    <MeetingSection title="WIG Session" icon={<Target className={isPresentMode ? 'w-10 h-10' : 'w-5 h-5'} />} sectionId="wig" isPresentMode={isPresentMode}>
      {isPresentMode ? (
        <div className="text-white space-y-8">
          <p className="text-lg text-white/50">Led by Alex</p>

          <div className="text-center">
            <p className="text-5xl font-black">{closeRate.toFixed(0)}%</p>
            <p className="text-xl text-white/60 mt-2">Current Close Rate</p>
            {wigTarget && <p className="text-lg text-yellow-400 mt-1">Target: {wigTarget}</p>}
          </div>

          {previousCommitments && (
            <div className="bg-white/10 rounded-xl p-6">
              <p className="text-lg font-semibold text-yellow-400 mb-3">Last Week's Commitments</p>
              <p className="text-lg text-white/80 whitespace-pre-wrap">{previousCommitments}</p>
            </div>
          )}

          {wigCommitments && (
            <div className="bg-white/10 rounded-xl p-6">
              <p className="text-lg font-semibold text-green-400 mb-3">This Week's Commitments</p>
              <p className="text-lg text-white/80 whitespace-pre-wrap">{wigCommitments}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Led by Alex</p>

          <div className="flex items-center gap-4">
            <div className="text-center p-3 bg-muted rounded-lg">
              <p className="text-2xl font-bold">{closeRate.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">Close Rate</p>
            </div>
            {isAdmin ? (
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">WIG Target</label>
                <Input value={wigTarget} onChange={e => onTargetChange(e.target.value)} placeholder="e.g. 45% close rate" />
              </div>
            ) : wigTarget ? (
              <p className="text-sm">Target: {wigTarget}</p>
            ) : null}
          </div>

          {previousCommitments && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
              <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">Last Week's Commitments</p>
              <p className="text-yellow-700 dark:text-yellow-300 whitespace-pre-wrap">{previousCommitments}</p>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground block mb-1">This Week's Commitments</label>
            {isAdmin ? (
              <Textarea
                value={wigCommitments}
                onChange={e => onCommitmentsChange(e.target.value)}
                placeholder="Type commitments during/after the meeting..."
                rows={3}
              />
            ) : wigCommitments ? (
              <p className="text-sm whitespace-pre-wrap">{wigCommitments}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No commitments yet.</p>
            )}
          </div>
        </div>
      )}
    </MeetingSection>
  );
}
