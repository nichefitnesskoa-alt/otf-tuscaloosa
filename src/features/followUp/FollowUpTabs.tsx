/**
 * Legacy tab wrapper — now delegates to the unified FollowUpList.
 * Kept for backward compatibility if referenced elsewhere.
 */
import FollowUpList from './FollowUpList';

interface FollowUpTabsProps {
  onCountChange?: (count: number) => void;
  onRefresh?: () => void;
}

export default function FollowUpTabs({ onCountChange, onRefresh }: FollowUpTabsProps) {
  return <FollowUpList onCountChange={onCountChange} onRefresh={onRefresh} />;
}
