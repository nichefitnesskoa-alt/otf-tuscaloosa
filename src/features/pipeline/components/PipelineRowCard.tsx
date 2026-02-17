/**
 * Single journey row card for Pipeline.
 * Expandable with booking/run details and action menus.
 */
import { memo, useCallback, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown, ChevronRight, AlertTriangle, Calendar, Target,
  MoreVertical, Edit, UserCheck, CalendarPlus, DollarSign, UserX,
  Archive, Trash2, Link, X, Plus, Copy, Phone, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { isMembershipSale } from '@/lib/sales-detection';
import { isVipBooking } from '@/lib/vip/vipRules';
import { ConvertVipToIntroDialog } from '@/components/vip/ConvertVipToIntroDialog';
import type { ClientJourney, PipelineBooking, PipelineRun, VipInfo } from '../pipelineTypes';

interface PipelineRowCardProps {
  journey: ClientJourney;
  vipInfoMap: Map<string, VipInfo>;
  isOnline: boolean;
  onOpenDialog: (type: string, data?: any) => void;
}

function capitalizeDisplay(name: string | null | undefined): string {
  if (!name) return '—';
  return name.replace(/\b\w/g, c => c.toUpperCase());
}

function getStatusBadge(status: ClientJourney['status']) {
  switch (status) {
    case 'purchased': return <Badge className="bg-success text-success-foreground">Purchased</Badge>;
    case 'not_interested': return <Badge variant="secondary">Not Interested</Badge>;
    case 'no_show': return <Badge variant="destructive">No-show</Badge>;
    case 'active': return <Badge variant="outline">Active</Badge>;
    default: return <Badge variant="secondary">Unknown</Badge>;
  }
}

export const PipelineRowCard = memo(function PipelineRowCard({
  journey, vipInfoMap, isOnline, onOpenDialog,
}: PipelineRowCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [convertBooking, setConvertBooking] = useState<PipelineBooking | null>(null);

  const copyPhone = useCallback((phone: string) => {
    navigator.clipboard.writeText(phone);
    toast.success('Phone copied');
  }, []);

  const phone = journey.bookings.find(b => b.phone)?.phone;
  const email = journey.bookings.find(b => b.email)?.email;
  const hasVipBooking = journey.bookings.some(b => isVipBooking(b as any));
  const vipStatus = journey.bookings.find(b => (b as any).vip_status)?.['vip_status' as keyof PipelineBooking] as string | null;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <div className={`p-3 rounded-lg cursor-pointer transition-colors ${
          journey.hasInconsistency
            ? 'bg-warning/10 border border-warning/30 hover:bg-warning/20'
            : 'bg-muted/50 hover:bg-muted'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-medium">{journey.memberName}</span>
              {journey.hasInconsistency && <AlertTriangle className="w-4 h-4 text-warning" />}
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(journey.status)}
              {journey.totalCommission > 0 && (
                <Badge variant="outline" className="text-success">${journey.totalCommission.toFixed(0)}</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
            <span>{journey.bookings.length} booking(s)</span>
            <span>{journey.runs.length} run(s)</span>
            {journey.latestIntroOwner && <span>Owner: {journey.latestIntroOwner}</span>}
            {journey.bookings[0]?.coach_name && journey.bookings[0].coach_name !== 'TBD' && (
              <span>🏋️ Coach: {journey.bookings[0].coach_name}</span>
            )}
            {phone ? (
              <button
                className="flex items-center gap-0.5 hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); copyPhone(phone); }}
              >
                <Copy className="w-3 h-3" /> {phone}
              </button>
            ) : (
              <span className="text-destructive">📱 No Phone</span>
            )}
            {email && <span className="truncate max-w-[180px]">✉️ {email}</span>}
            {/* VIP info */}
            {(() => {
              const vip = journey.bookings.map(b => vipInfoMap.get(b.id)).find(v => v);
              if (!vip) return null;
              return (
                <>
                  {vip.birthday && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">🎂 {vip.birthday}</span>}
                  {vip.weight_lbs && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">⚖️ {vip.weight_lbs} lbs</span>}
                </>
              );
            })()}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 ml-6 space-y-3 p-3 border rounded-lg bg-background">
          {/* Inconsistency warning */}
          {journey.hasInconsistency && journey.inconsistencyType && (
            <div className="text-xs text-warning bg-warning/10 p-2 rounded flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {journey.inconsistencyType}
            </div>
          )}

          {/* Bookings */}
          {journey.bookings.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Bookings
              </div>
              <div className="space-y-1">
                {journey.bookings.map(b => (
                  <div key={b.id} className="text-xs p-2 bg-muted/30 rounded border">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <span className="font-medium">{b.class_date}</span>
                        {b.intro_time && <span className="text-muted-foreground"> @ {b.intro_time}</span>}
                        <div className="text-muted-foreground">
                          Booked by: {capitalizeDisplay(b.booked_by || b.sa_working_shift)}
                          {b.lead_source && <span> | {b.lead_source}</span>}
                        </div>
                        {b.originating_booking_id && (
                          <Badge variant="outline" className="text-[10px] mt-0.5">2nd Intro</Badge>
                        )}
                        {b.is_vip && (
                          <Badge variant="secondary" className="text-[10px] mt-0.5 ml-1">VIP</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={b.booking_status_canon === 'CLOSED_PURCHASED' ? 'default' : 'outline'}
                          className={b.booking_status_canon === 'CLOSED_PURCHASED' ? 'bg-success' : ''}>
                          {b.booking_status || 'Active'}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onOpenDialog('edit_booking', { booking: b })}>
                              <Edit className="w-3 h-3 mr-2" /> Edit Booking
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onOpenDialog('set_owner', { booking: b })}>
                              <UserCheck className="w-3 h-3 mr-2" /> Set Intro Owner
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onOpenDialog('log_2nd_intro', { journey })}>
                              <CalendarPlus className="w-3 h-3 mr-2" /> Log 2nd Intro Run
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onOpenDialog('purchase', { booking: b })}>
                              <DollarSign className="w-3 h-3 mr-2" /> Mark as Purchased
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onOpenDialog('not_interested', { booking: b })}>
                              <UserX className="w-3 h-3 mr-2" /> Not Interested
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onOpenDialog('archive', { booking: b })}>
                              <Archive className="w-3 h-3 mr-2" /> Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onOpenDialog('hard_delete_booking', { booking: b })} className="text-destructive">
                              <Trash2 className="w-3 h-3 mr-2" /> Delete Permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Runs */}
          {journey.runs.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <Target className="w-3 h-3" /> Intro Runs
              </div>
              <div className="space-y-1">
                {journey.runs.map((r, idx) => (
                  <div key={r.id} className="text-xs p-2 bg-background rounded border">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <span className="font-medium">{r.run_date || 'No date'}</span>
                        <span className="text-muted-foreground"> @ {r.class_time}</span>
                        {idx === 0 && journey.runs.length > 1 && (
                          <Badge variant="outline" className="text-[10px] ml-1">Latest</Badge>
                        )}
                        <div className="text-muted-foreground">
                          Ran by: {capitalizeDisplay(r.ran_by)}
                          {r.intro_owner && <span> | Owner: {capitalizeDisplay(r.intro_owner)}</span>}
                        </div>
                        {!r.linked_intro_booked_id && (
                          <div className="text-warning">⚠️ Not linked to booking</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={isMembershipSale(r.result) ? 'default' : 'outline'}
                          className={isMembershipSale(r.result) ? 'bg-success' : ''}
                        >
                          {r.result}
                        </Badge>
                        {(r.commission_amount || 0) > 0 && (
                          <span className="text-success font-medium">${r.commission_amount}</span>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              if (!isOnline) { toast.error('Outcome edits require an internet connection'); return; }
                              onOpenDialog('edit_run', { run: r, journey });
                            }}>
                              <Edit className="w-3 h-3 mr-2" /> Edit Run
                            </DropdownMenuItem>
                            {!r.linked_intro_booked_id ? (
                              <>
                                <DropdownMenuItem onClick={() => onOpenDialog('link_run', { run: r, journey })}>
                                  <Link className="w-3 h-3 mr-2" /> Link to Existing Booking
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onOpenDialog('create_matching_booking', { run: r })}>
                                  <CalendarPlus className="w-3 h-3 mr-2" /> Create Matching Booking
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={() => onOpenDialog('unlink_run', { run: r })}>
                                <X className="w-3 h-3 mr-2" /> Unlink from Booking
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onOpenDialog('hard_delete_run', { run: r })} className="text-destructive">
                              <Trash2 className="w-3 h-3 mr-2" /> Delete Permanently
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 border-t border-dashed flex gap-2 flex-wrap">
            {hasVipBooking && vipStatus !== 'CONVERTED' && (
              <Button variant="default" size="sm" className="text-xs gap-1 bg-purple-600 hover:bg-purple-700"
                onClick={() => {
                  const vb = journey.bookings.find(b => isVipBooking(b as any));
                  if (vb) setConvertBooking(vb);
                }}>
                <ArrowRight className="w-3 h-3" /> Convert to Real Intro
              </Button>
            )}
            {vipStatus === 'CONVERTED' && (
              <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-300">✓ Converted</Badge>
            )}
            <Button variant="outline" size="sm" className="flex-1 text-xs"
              onClick={() => onOpenDialog('create_run', { journey })}>
              <Plus className="w-3 h-3 mr-1" /> Add Intro Run
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs"
              onClick={() => onOpenDialog('log_2nd_intro', { journey })}>
              <CalendarPlus className="w-3 h-3 mr-1" /> Log 2nd Intro Run
            </Button>
            {phone && (
              <Button variant="outline" size="sm" className="text-xs"
                onClick={() => window.open(`tel:${phone}`)}>
                <Phone className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CollapsibleContent>

      {/* VIP Conversion Dialog */}
      {convertBooking && (
        <ConvertVipToIntroDialog
          open={!!convertBooking}
          onOpenChange={(open) => { if (!open) setConvertBooking(null); }}
          vipBooking={{
            id: convertBooking.id,
            member_name: journey.memberName,
            phone: convertBooking.phone,
            email: convertBooking.email,
            coach_name: convertBooking.coach_name,
            fitness_goal: convertBooking.fitness_goal,
          }}
          onConverted={() => { setConvertBooking(null); onOpenDialog('refresh', {}); }}
        />
      )}
    </Collapsible>
  );
});
