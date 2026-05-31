/**
 * FriendRuleNotice — display-only warning that surfaces the existing
 * personal-friend attribution rule (computeExpectedIntroOwner /
 * applyIntroOutcomeUpdate) at the point a user picks lead source.
 *
 * No attribution logic lives here. This only mirrors the rule the system
 * already runs: when lead source contains "personal friend", commission
 * (intro_owner) goes to whoever booked the person.
 */
import { Info } from 'lucide-react';

interface FriendRuleNoticeProps {
  leadSource?: string | null;
  bookedByName?: string | null;
  className?: string;
}

const isPersonalFriend = (s?: string | null) =>
  !!s && s.toLowerCase().includes('personal friend');

export function FriendRuleNotice({ leadSource, bookedByName, className }: FriendRuleNoticeProps) {
  if (!isPersonalFriend(leadSource)) return null;
  return (
    <div
      className={
        'mt-2 flex items-start gap-2 rounded-md border border-[#E8540A]/40 bg-[#E8540A]/10 px-3 py-2 text-xs text-muted-foreground ' +
        (className ?? '')
      }
    >
      <Info className="h-4 w-4 shrink-0 text-[#E8540A] mt-0.5" aria-hidden />
      <div className="leading-snug">
        <div className="text-foreground">
          Heads up: with this lead source, the intro owner (commission) goes to whoever booked
          this person, not the coach who runs the intro.
        </div>
        {bookedByName ? (
          <div className="mt-1">
            Intro owner will be: <span className="font-medium text-foreground">{bookedByName}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default FriendRuleNotice;
