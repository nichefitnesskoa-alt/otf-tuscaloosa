import { Star } from 'lucide-react';
import { VipSchedulerTab } from '@/features/pipeline/components/VipSchedulerTab';
import { VipPerformanceDashboard } from './VipPerformanceDashboard';

export default function VipsPage() {
  return (
    <div className="p-4 pb-24 space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Star className="w-5 h-5 text-[#E8540A]" /> VIP Scheduler
        </h1>
        <p className="text-xs text-muted-foreground">
          Manage group class availability and track performance.
        </p>
      </div>

      <VipPerformanceDashboard />

      <VipSchedulerTab />
    </div>
  );
}
