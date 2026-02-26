import { useAuth } from '@/context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';
import { GroupMeSettings } from '@/components/admin/GroupMeSettings';
import DataHealthPanel from '@/components/admin/DataHealthPanel';
import { LeadSheetImport } from '@/components/admin/LeadSheetImport';
import { useMemo } from 'react';
import { getDateRangeForPreset } from '@/lib/pay-period';

export default function SettingsPage() {
  const { user } = useAuth();
  const healthDateRange = useMemo(() => getDateRangeForPreset('all_time'), []);

  if (user?.role !== 'Admin') {
    return <Navigate to="/my-day" replace />;
  }

  return (
    <div className="p-4 space-y-6">
      <div className="mb-2">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          System configuration and health monitoring
        </p>
      </div>

      <LeadSheetImport />

      <GroupMeSettings />

      <DataHealthPanel
        dateRange={healthDateRange}
        onFixComplete={() => {}}
      />
    </div>
  );
}
