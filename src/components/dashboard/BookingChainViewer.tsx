import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link, Calendar, User, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, parseLocalDate } from '@/lib/utils';
import { format } from 'date-fns';

interface BookingChainNode {
  id: string;
  memberName: string;
  classDate: string;
  bookedBy: string;
  introOwner: string | null;
  status: string;
  isOriginal: boolean;
  chainPosition: number;
}

interface BookingChainViewerProps {
  chain: BookingChainNode[];
  className?: string;
}

export function BookingChainViewer({ chain, className }: BookingChainViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!chain || chain.length === 0) {
    return null;
  }

  const sortedChain = [...chain].sort((a, b) => a.chainPosition - b.chainPosition);
  const original = sortedChain.find(n => n.isOriginal);
  const displayedNodes = isExpanded ? sortedChain : sortedChain.slice(0, 2);

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('closed') || s.includes('purchased')) return 'bg-success/20 text-success border-success/30';
    if (s.includes('active')) return 'bg-info/20 text-info border-info/30';
    if (s.includes('no-show')) return 'bg-destructive/20 text-destructive border-destructive/30';
    return 'bg-muted text-muted-foreground border-border';
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(parseLocalDate(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Link className="w-4 h-4 text-primary" />
          Booking Chain
          <Badge variant="outline" className="ml-auto text-xs">
            {chain.length} {chain.length === 1 ? 'intro' : 'intros'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative">
          {/* Chain visualization */}
          <div className="space-y-2">
            {displayedNodes.map((node, index) => (
              <div key={node.id} className="relative">
                {/* Connector line */}
                {index > 0 && (
                  <div className="absolute left-4 -top-2 w-0.5 h-2 bg-border" />
                )}
                
                <div className={cn(
                  'flex items-start gap-3 p-2 rounded-lg border transition-all',
                  node.isOriginal ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'
                )}>
                  {/* Position indicator */}
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    node.isOriginal ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>
                    {node.chainPosition === 1 ? '1st' : `${node.chainPosition}nd`}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{node.memberName}</span>
                      <Badge variant="outline" className={cn('text-xs', getStatusColor(node.status))}>
                        {node.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(node.classDate)}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        Booked: {node.bookedBy}
                      </span>
                    </div>

                    {node.introOwner && (
                      <div className="mt-1 text-xs">
                        <span className="text-muted-foreground">Owner: </span>
                        <span className="font-medium text-primary">{node.introOwner}</span>
                      </div>
                    )}
                  </div>

                  {/* Arrow to next */}
                  {index < displayedNodes.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 mt-2" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Expand/collapse button */}
          {chain.length > 2 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full mt-2 text-xs"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3 mr-1" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  Show {chain.length - 2} more
                </>
              )}
            </Button>
          )}
        </div>

        {/* Summary */}
        {original && chain.length > 1 && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            Originally booked by <span className="font-medium">{original.bookedBy}</span> on {formatDate(original.classDate)}
            {original.introOwner && (
              <> • Intro owner: <span className="font-medium text-primary">{original.introOwner}</span></>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
