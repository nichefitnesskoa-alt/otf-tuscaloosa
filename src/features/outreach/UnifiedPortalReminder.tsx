/**
 * Persistent reminder banner shown above New Leads and Follow-Up.
 * Every text sent from this app must ALSO be marked off in Unified Portal
 * (Lead Management) so the studio doesn't double-contact.
 */
import { AlertCircle } from 'lucide-react';
import { OTF } from '@/lib/otfBrand';

export function UnifiedPortalReminder() {
  return (
    <div
      className="rounded-md border-l-4 p-3 flex items-start gap-3"
      style={{
        borderLeftColor: OTF.orange,
        backgroundColor: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderLeftWidth: 4,
      }}
    >
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: OTF.orange }} />
      <div>
        <p className="text-sm font-black uppercase tracking-wide leading-tight">
          Also mark this off in Unified Portal → Lead Management
        </p>
        <p className="text-xs mt-1 text-muted-foreground leading-snug">
          Every text you send here needs to be recorded there too. Otherwise the studio
          double-contacts and it looks unprofessional.
        </p>
      </div>
    </div>
  );
}
