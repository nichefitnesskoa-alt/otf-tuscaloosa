/**
 * Referral Ask Actions — actionable card on MyDay.
 *
 * For every recent membership sale that hasn't been asked for a referral yet,
 * shows: Send script · Copy phone · Asked at POS · Reached out after.
 * Pulls from the shared useReferralAskQueue so WIG stats stay in lockstep.
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Users, Check, Clock, Loader2, Send, Copy } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { ScriptSendDrawer } from '@/components/scripts/ScriptSendDrawer';
import { toast } from 'sonner';
import { useReferralAskQueue, type ReferralAskRow } from '@/features/referralAsk/useReferralAskQueue';
import type { DateRange } from '@/lib/pay-period';

interface Props {
  /** Optional date filter. Default: last 14 days of sales. */
  dateRange?: DateRange | null;
}

function defaultRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 14);
  return { start, end };
}

function normalizePhoneDisplay(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return phone;
  return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
}

export function ReferralAskActions({ dateRange }: Props) {
  const { user } = useAuth();
  const range = useMemo(() => dateRange ?? defaultRange(), [dateRange]);
  const { rows, pendingCount, completedCount, isLoading, savingId, markAsked, markFollowupPending } =
    useReferralAskQueue({ dateRange: range });

  const [showCompleted, setShowCompleted] = useState(false);
  const [scriptRow, setScriptRow] = useState<ReferralAskRow | null>(null);

  const visibleRows = showCompleted ? rows : rows.filter(r => !r.coachReferralAsked);

  const handleCopyPhone = async (r: ReferralAskRow) => {
    const display = normalizePhoneDisplay(r.phone);
    if (!display) {
      toast.error('No phone on file for this member');
      return;
    }
    try {
      await navigator.clipboard.writeText(display);
      toast.success(`Copied ${display}`);
    } catch {
      toast.error('Could not copy phone');
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Ask for a referral
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Every new member, within 24 hours. Catch them at the POS desk if you can — text them right after if not.
            Their warmest "yes" is the friend they'd bring next.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="px-4 py-2 border-b flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Badge className="bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/15">{pendingCount} to do</Badge>
              <Badge className="bg-success/15 text-success border-success/30 hover:bg-success/15">{completedCount} asked</Badge>
            </div>
            {completedCount > 0 && (
              <div className="flex items-center gap-2">
                <Switch id="myday-show-completed-ref" checked={showCompleted} onCheckedChange={setShowCompleted} />
                <Label htmlFor="myday-show-completed-ref" className="text-xs text-muted-foreground cursor-pointer">Show completed</Label>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
              <span className="text-xs text-muted-foreground">Loading…</span>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No recent membership sales to ask about yet.
            </p>
          ) : visibleRows.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              All caught up — every new member has been asked.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {visibleRows.map(r => {
                const saving = savingId === r.bookingId;
                let dateLabel = r.saleDate;
                let hoursOld = 0;
                try {
                  const d = parseLocalDate(r.saleDate);
                  dateLabel = format(d, 'MMM d');
                  hoursOld = differenceInHours(new Date(), d);
                } catch {}
                const overdue = !r.coachReferralAsked && hoursOld >= 24;
                const phoneDisplay = normalizePhoneDisplay(r.phone);

                return (
                  <div key={r.bookingId} className="p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          r.coachReferralAsked ? 'bg-success'
                          : r.followupPending ? 'bg-warning'
                          : overdue ? 'bg-destructive' : 'bg-muted-foreground/40'
                        }`}
                        aria-hidden
                      />
                      <span className="text-sm font-medium">{r.memberName}</span>
                      <span className="text-[11px] text-muted-foreground">sold by {r.introOwner} · {dateLabel}</span>
                      {r.coachReferralAsked ? (
                        <Badge className="bg-success/20 text-success border-success/40 hover:bg-success/20 text-[9px] h-4">
                          <Check className="w-2.5 h-2.5 mr-0.5" /> Asked
                        </Badge>
                      ) : r.followupPending ? (
                        <Badge className="bg-warning/20 text-warning border-warning/40 hover:bg-warning/20 text-[9px] h-4">
                          <Clock className="w-2.5 h-2.5 mr-0.5" /> Follow up pending
                        </Badge>
                      ) : overdue ? (
                        <Badge className="bg-destructive/20 text-destructive border-destructive/40 hover:bg-destructive/20 text-[9px] h-4">
                          Past 24h
                        </Badge>
                      ) : null}
                    </div>

                    {!r.coachReferralAsked && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[44px] text-xs cursor-pointer"
                          onClick={() => setScriptRow(r)}
                          disabled={saving}
                        >
                          <Send className="w-3.5 h-3.5 mr-1" /> Send script
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-[44px] text-xs cursor-pointer"
                          onClick={() => handleCopyPhone(r)}
                          disabled={saving || !phoneDisplay}
                          title={phoneDisplay ? `Copy ${phoneDisplay}` : 'No phone on file'}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          {phoneDisplay ? `Copy ${phoneDisplay}` : 'No phone'}
                        </Button>
                        {r.followupPending ? (
                          <Button
                            size="sm"
                            className="min-h-[44px] text-xs"
                            onClick={() => markAsked(r.bookingId, 'Referral asked after the fact from MyDay')}
                            disabled={saving}
                          >
                            <Check className="w-3.5 h-3.5 mr-1" /> Done — asked them
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              className="min-h-[44px] text-xs"
                              onClick={() => markAsked(r.bookingId, 'POS referral ask logged on MyDay')}
                              disabled={saving}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" /> Asked at POS
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-[44px] text-xs cursor-pointer"
                              onClick={() => markFollowupPending(r.bookingId, 'Referral ask deferred from MyDay')}
                              disabled={saving}
                            >
                              <Clock className="w-3.5 h-3.5 mr-1" /> Reach out after
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ScriptSendDrawer
        open={!!scriptRow}
        onOpenChange={(o) => { if (!o) setScriptRow(null); }}
        leadName={scriptRow?.memberName || null}
        leadPhone={scriptRow?.phone || null}
        categoryFilter="post_class_joined"
        saName={user?.name || 'Unknown'}
        soldByName={scriptRow?.introOwner || null}
      />
    </>
  );
}
