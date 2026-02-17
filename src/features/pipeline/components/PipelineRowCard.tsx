/**
 * Single pipeline row card — collapsible, with action dropdowns.
 * Identical UI to original ClientJourneyPanel row.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Calendar,
  DollarSign,
  Target,
  Edit,
  MoreVertical,
  UserCheck,
  UserX,
  Archive,
  Trash2,
  Link,
  Plus,
  X,
  CalendarPlus,
} from 'lucide-react';
import { capitalizeName } from '@/lib/utils';
import { isMembershipSale } from '@/lib/sales-detection';
import { normalizeIntroResult, isMembershipSaleResult } from '@/lib/domain/outcomes/types';
import type { ClientJourney, PipelineBooking, PipelineRun, VipInfo } from '../pipelineTypes';

interface PipelineRowCardProps {
  journey: ClientJourney;
  isExpanded: boolean;
  onToggle: () => void;
  vipInfo: VipInfo | null;
  isSaving: boolean;
  onEditBooking: (b: PipelineBooking) => void;
  onEditRun: (r: PipelineRun) => void;
  onPurchase: (b: PipelineBooking) => void;
  onMarkNotInterested: (b: PipelineBooking) => void;
  onSetOwner: (b: PipelineBooking) => void;
  onSoftDelete: (b: PipelineBooking) => void;
  onHardDeleteBooking: (b: PipelineBooking) => void;
  onHardDeleteRun: (r: PipelineRun) => void;
  onLog2ndIntroRun: () => void;
  onBook2ndIntro: () => void;
  onCreateRun: () => void;
  onLinkRun: (r: PipelineRun, bookings: PipelineBooking[]) => void;
  onCreateMatchingBooking: (r: PipelineRun) => void;
  onUnlinkRun: (r: PipelineRun) => void;
  onMarkRunNotInterested: (r: PipelineRun) => void;
}

function getStatusBadge(status: ClientJourney['status']) {
  switch (status) {
    case 'purchased':
      return <Badge className="bg-success text-success-foreground">Purchased</Badge>;
    case 'not_interested':
      return <Badge variant="secondary">Not Interested</Badge>;
    case 'no_show':
      return <Badge variant="destructive">No-show</Badge>;
    case 'active':
      return <Badge variant="outline">Active</Badge>;
    default:
      return <Badge variant="secondary">Unknown</Badge>;
  }
}

export default function PipelineRowCard({
  journey,
  isExpanded,
  onToggle,
  vipInfo,
  isSaving,
  onEditBooking,
  onEditRun,
  onPurchase,
  onMarkNotInterested,
  onSetOwner,
  onSoftDelete,
  onHardDeleteBooking,
  onHardDeleteRun,
  onLog2ndIntroRun,
  onBook2ndIntro,
  onCreateRun,
  onLinkRun,
  onCreateMatchingBooking,
  onUnlinkRun,
  onMarkRunNotInterested,
}: PipelineRowCardProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <div
          className={`p-3 rounded-lg cursor-pointer transition-colors ${
            journey.hasInconsistency
              ? 'bg-warning/10 border border-warning/30 hover:bg-warning/20'
              : 'bg-muted/50 hover:bg-muted'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className="font-medium">{journey.memberName}</span>
              {journey.hasInconsistency && <AlertTriangle className="w-4 h-4 text-warning" />}
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(journey.status)}
              {journey.totalCommission > 0 && (
                <Badge variant="outline" className="text-success">
                  ${journey.totalCommission.toFixed(0)}
                </Badge>
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
            {(() => {
              const phone = journey.bookings.find(b => b.phone)?.phone;
              const email = journey.bookings.find(b => b.email)?.email;
              return (
                <>
                  {phone && <span>📱 {phone}</span>}
                  {email && <span className="truncate max-w-[180px]">✉️ {email}</span>}
                  {!phone && <span className="text-destructive">📱 No Phone</span>}
                </>
              );
            })()}
            {vipInfo && (
              <>
                {vipInfo.birthday && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">🎂 {vipInfo.birthday}</span>}
                {vipInfo.weight_lbs && <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">⚖️ {vipInfo.weight_lbs} lbs</span>}
              </>
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="ml-6 mt-2 space-y-3 pb-3">
          {journey.hasInconsistency && journey.inconsistencyType && (
            <div className="p-2 bg-warning/10 rounded-lg text-xs text-warning flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5" />
              <span>{journey.inconsistencyType}</span>
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
                  <div key={b.id} className="text-xs p-2 bg-background rounded border">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <span className="font-medium">{b.class_date}</span>
                        {b.intro_time && <span className="text-muted-foreground"> @ {b.intro_time}</span>}
                        <div className="text-muted-foreground">
                          Booked by: {capitalizeName(b.booked_by || b.sa_working_shift)}
                          {b.originating_booking_id && <Badge variant="outline" className="ml-1 text-[10px] py-0">2nd Intro</Badge>}
                        </div>
                        <div className="text-muted-foreground">
                          Source: {b.lead_source} | Coach: {b.coach_name}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {b.booking_status || 'Active'}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <MoreVertical className="w-3 h-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEditBooking(b)}>
                              <Edit className="w-3 h-3 mr-2" /> Edit Booking
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSetOwner(b)}>
                              <UserCheck className="w-3 h-3 mr-2" /> Set Intro Owner
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={onLog2ndIntroRun}>
                              <CalendarPlus className="w-3 h-3 mr-2" /> Log 2nd Intro Run
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onPurchase(b)}>
                              <DollarSign className="w-3 h-3 mr-2" /> Mark as Purchased
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onMarkNotInterested(b)}>
                              <UserX className="w-3 h-3 mr-2" /> Not Interested
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onSoftDelete(b)}>
                              <Archive className="w-3 h-3 mr-2" /> Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onHardDeleteBooking(b)} className="text-destructive">
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
                {journey.runs.map(r => {
                  const resultCanon = normalizeIntroResult(r.result);
                  const isSale = isMembershipSaleResult(resultCanon) || isMembershipSale(r.result);
                  return (
                    <div key={r.id} className="text-xs p-2 bg-background rounded border">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <span className="font-medium">{r.run_date || 'No date'}</span>
                          <span className="text-muted-foreground"> @ {r.class_time}</span>
                          <div className="text-muted-foreground">
                            Ran by: {capitalizeName(r.ran_by)}
                            {r.intro_owner && <span> | Owner: {capitalizeName(r.intro_owner)}</span>}
                          </div>
                          {!r.linked_intro_booked_id && (
                            <div className="text-warning">⚠️ Not linked to booking</div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant={isSale ? 'default' : 'outline'}
                            className={isSale ? 'bg-success' : ''}
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
                              <DropdownMenuItem onClick={() => onEditRun(r)}>
                                <Edit className="w-3 h-3 mr-2" /> Edit Run
                              </DropdownMenuItem>
                              {!r.linked_intro_booked_id ? (
                                <>
                                  <DropdownMenuItem onClick={() => onLinkRun(r, journey.bookings)}>
                                    <Link className="w-3 h-3 mr-2" /> Link to Existing Booking
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onCreateMatchingBooking(r)}>
                                    <CalendarPlus className="w-3 h-3 mr-2" /> Create Matching Booking
                                  </DropdownMenuItem>
                                </>
                              ) : (
                                <DropdownMenuItem onClick={() => onUnlinkRun(r)}>
                                  <X className="w-3 h-3 mr-2" /> Unlink from Booking
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onMarkRunNotInterested(r)} className="text-muted-foreground">
                                <UserX className="w-3 h-3 mr-2" /> Mark Not Interested
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onHardDeleteRun(r)} className="text-destructive">
                                <Trash2 className="w-3 h-3 mr-2" /> Delete Permanently
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 border-t border-dashed flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onCreateRun}>
              <Plus className="w-3 h-3 mr-1" /> Add Intro Run
            </Button>
            <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={onLog2ndIntroRun} disabled={isSaving}>
              <CalendarPlus className="w-3 h-3 mr-1" /> Log 2nd Intro Run
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
