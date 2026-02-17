/**
 * Pipeline filters bar with tabs and search.
 * Preserves exact same filter behavior as original ClientJourneyPanel.
 */
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, AlertTriangle, Users, Clock, Calendar, CalendarCheck,
  UserX, UserMinus, CalendarPlus, Filter, Star,
} from 'lucide-react';
import type { JourneyTab, TabCounts } from '../pipelineTypes';

interface PipelineFiltersBarProps {
  activeTab: JourneyTab;
  setActiveTab: (tab: JourneyTab) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filterInconsistencies: boolean;
  setFilterInconsistencies: (v: boolean) => void;
  inconsistencyCount: number;
  tabCounts: TabCounts;
  selectedLeadSource: string | null;
  setSelectedLeadSource: (source: string | null) => void;
  leadSourceOptions: string[];
}

export function PipelineFiltersBar({
  activeTab, setActiveTab,
  searchTerm, setSearchTerm,
  filterInconsistencies, setFilterInconsistencies,
  inconsistencyCount, tabCounts,
  selectedLeadSource, setSelectedLeadSource,
  leadSourceOptions,
}: PipelineFiltersBarProps) {
  return (
    <div className="space-y-3">
      {/* Search + Issues */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or intro owner..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant={filterInconsistencies ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterInconsistencies(!filterInconsistencies)}
        >
          <AlertTriangle className="w-4 h-4 mr-1" />
          Issues ({inconsistencyCount})
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as JourneyTab)} className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="all" className="flex-1 min-w-[70px] text-xs gap-1">
            <Users className="w-3 h-3" /> All
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex-1 min-w-[80px] text-xs gap-1">
            <Clock className="w-3 h-3" /> Upcoming
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.upcoming}</Badge>
          </TabsTrigger>
          <TabsTrigger value="today" className="flex-1 min-w-[70px] text-xs gap-1">
            <Calendar className="w-3 h-3" /> Today
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.today}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 min-w-[85px] text-xs gap-1">
            <CalendarCheck className="w-3 h-3" /> Completed
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.completed}</Badge>
          </TabsTrigger>
          <TabsTrigger value="no_show" className="flex-1 min-w-[80px] text-xs gap-1 text-destructive data-[state=active]:text-destructive">
            <UserX className="w-3 h-3" /> No-shows
            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.no_show}</Badge>
          </TabsTrigger>
          <TabsTrigger value="missed_guest" className="flex-1 min-w-[80px] text-xs gap-1 text-warning data-[state=active]:text-warning">
            <UserMinus className="w-3 h-3" /> Missed
            <Badge className="ml-1 h-5 px-1.5 text-[10px] bg-warning text-warning-foreground">{tabCounts.missed_guest}</Badge>
          </TabsTrigger>
          <TabsTrigger value="second_intro" className="flex-1 min-w-[70px] text-xs gap-1">
            <CalendarPlus className="w-3 h-3" /> 2nd
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.second_intro}</Badge>
          </TabsTrigger>
          <TabsTrigger value="not_interested" className="flex-1 min-w-[100px] text-xs gap-1 text-muted-foreground data-[state=active]:text-muted-foreground">
            <UserX className="w-3 h-3" /> Not Interested
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.not_interested}</Badge>
          </TabsTrigger>
          <TabsTrigger value="vip_class" className="flex-1 min-w-[60px] text-xs gap-1 text-purple-600 data-[state=active]:text-purple-700">
            <Star className="w-3 h-3" /> VIP
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{tabCounts.vip_class}</Badge>
          </TabsTrigger>
          <TabsTrigger value="by_lead_source" className="flex-1 min-w-[80px] text-xs gap-1">
            <Filter className="w-3 h-3" /> By Source
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Lead source filter */}
      {activeTab === 'by_lead_source' && (
        <Select
          value={selectedLeadSource || 'all'}
          onValueChange={(v) => setSelectedLeadSource(v === 'all' ? null : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select lead source..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lead Sources</SelectItem>
            {leadSourceOptions.map(source => (
              <SelectItem key={source} value={source}>{source}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
