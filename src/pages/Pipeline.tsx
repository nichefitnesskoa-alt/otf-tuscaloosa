import ClientJourneyPanel from '@/components/admin/ClientJourneyPanel';
import MembershipPurchasesPanel from '@/components/admin/MembershipPurchasesPanel';
import { GitBranch } from 'lucide-react';

export default function Pipeline() {
  return (
    <div className="p-4 space-y-4">
      <div className="mb-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GitBranch className="w-5 h-5" />
          Client Pipeline
        </h1>
        <p className="text-sm text-muted-foreground">
          Track clients from booking through purchase
        </p>
      </div>

      <ClientJourneyPanel />
      <MembershipPurchasesPanel />
    </div>
  );
}
