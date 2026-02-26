/**
 * Data Audit Dashboard — Admin-only self-audit results viewer.
 * Shows plain-English descriptions with fix/view actions.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ShieldCheck, AlertTriangle, XCircle, RefreshCw, ChevronDown, ChevronRight, Wrench, TrendingUp, TrendingDown, Minus, Zap, Loader2 } from 'lucide-react';
import { useDataAudit } from '@/hooks/useDataAudit';
import { runAutomatedFix, runAllFixes, getAuditHistory, type AuditCheckResult } from '@/lib/audit/dataAuditEngine';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

function StatusIcon({ status }: { status: 'pass' | 'warn' | 'fail' }) {
  if (status === 'pass') return <ShieldCheck className="w-4 h-4 text-green-500" />;
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <XCircle className="w-4 h-4 text-red-500" />;
}

function InlineFixField({ id, field, name, onSaved }: { id: string; field: string; name: string; onSaved: () => void }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const updateData: Record<string, string> = {};
      if (field === 'phone') {
        // Normalize phone
        const digits = value.replace(/\D/g, '');
        const clean = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
        if (clean.length !== 10) {
          toast.error('Enter a valid 10-digit phone number');
          setSaving(false);
          return;
        }
        updateData.phone = clean;
        updateData.phone_e164 = `+1${clean}`;
        updateData.phone_source = 'manual_audit_fix';
      } else {
        updateData[field] = value.trim();
      }

      const { error } = await supabase
        .from('intros_booked')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      toast.success(`Updated ${field} for ${name}`);
      onSaved();
    } catch (err) {
      toast.error(`Failed to update: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground min-w-[80px] truncate">{name}</span>
      <Input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={field === 'phone' ? '(205) 555-1234' : 'SA name'}
        className="h-7 text-xs flex-1"
        onBlur={handleSave}
        onKeyDown={e => e.key === 'Enter' && handleSave()}
        disabled={saving}
      />
      {saving && <Loader2 className="w-3 h-3 animate-spin" />}
    </div>
  );
}

function CheckRow({ check, onFixComplete }: { check: AuditCheckResult; onFixComplete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{ fixed: number; error?: string } | null>(null);

  const handleFix = async () => {
    if (!check.fixAction) return;
    setFixing(true);
    setFixResult(null);
    const result = await runAutomatedFix(check.fixAction);
    setFixResult(result);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Fixed ${result.fixed} record${result.fixed !== 1 ? 's' : ''}`);
    }
    setFixing(false);
    // Re-run audit to update badge
    onFixComplete();
  };

  const hasManualFix = check.manualFixIds && check.manualFixIds.length > 0;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <div className="flex items-start gap-2 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
          <StatusIcon status={check.status} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{check.checkName}</span>
              <Badge variant="outline" className="text-[10px]">{check.category}</Badge>
              {check.count > 0 && (
                <Badge variant={check.status === 'fail' ? 'destructive' : 'secondary'} className="text-[10px]">
                  {check.count}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{check.description}</p>
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 shrink-0 mt-0.5" /> : <ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-8 pr-3 pb-3 space-y-2">
          {/* Fix button at top of detail */}
          {check.fixAction && check.status !== 'pass' && (
            <Button
              size="sm"
              onClick={handleFix}
              disabled={fixing}
              className="gap-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              {fixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
              {fixing ? 'Fixing…' : fixResult ? `Fixed ${fixResult.fixed} records` : 'Fix All'}
            </Button>
          )}

          {check.suggestedFix && (
            <p className="text-xs text-muted-foreground italic">💡 {check.suggestedFix}</p>
          )}

          {/* Affected names */}
          {check.affectedNames && check.affectedNames.length > 0 && (
            <div className="bg-muted/30 rounded p-2 max-h-32 overflow-y-auto">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium">Affected ({check.affectedNames.length}):</p>
              <div className="flex flex-wrap gap-1">
                {check.affectedNames.slice(0, 50).map((name, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">{name}</Badge>
                ))}
                {check.affectedNames.length > 50 && (
                  <Badge variant="outline" className="text-[10px]">+{check.affectedNames.length - 50} more</Badge>
                )}
              </div>
            </div>
          )}

          {/* Inline editable fields for manual-fix records */}
          {hasManualFix && (
            <div className="space-y-1.5 mt-2">
              <p className="text-[10px] text-muted-foreground font-medium">
                ✏️ These need manual entry ({check.manualFixIds!.length}):
              </p>
              {check.manualFixIds!.slice(0, 10).map(item => (
                <InlineFixField
                  key={item.id}
                  id={item.id}
                  field={item.field}
                  name={item.name}
                  onSaved={onFixComplete}
                />
              ))}
              {check.manualFixIds!.length > 10 && (
                <p className="text-[10px] text-muted-foreground">+{check.manualFixIds!.length - 10} more (fix the first batch, then re-run audit)</p>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function HealthTrend() {
  const [history, setHistory] = useState<{ created_at: string; pass_count: number; total_checks: number }[]>([]);

  useEffect(() => {
    getAuditHistory().then(h => setHistory(h.slice(0, 7)));
  }, []);

  if (history.length < 2) return null;

  const scores = history.map(h => h.total_checks > 0 ? Math.round((h.pass_count / h.total_checks) * 100) : 100);
  const latest = scores[0];
  const oldest = scores[scores.length - 1];
  const trend = latest - oldest;

  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const trendColor = trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <TrendIcon className={`w-3 h-3 ${trendColor}`} />
      <span>Health: {latest}%</span>
      {trend !== 0 && <span className={trendColor}>({trend > 0 ? '+' : ''}{trend}% over last {history.length} runs)</span>}
    </div>
  );
}

export default function DataAuditDashboard() {
  const { result, running, runAudit } = useDataAudit(true);
  const [fixingAll, setFixingAll] = useState(false);

  // Check if any results have fixable actions
  const hasFixableChecks = result?.results.some(r => r.fixAction && r.status !== 'pass') ?? false;

  const handleFixAll = async () => {
    if (!result) return;
    setFixingAll(true);
    try {
      const fixResult = await runAllFixes(result.results);
      if (fixResult.totalFixed > 0) {
        toast.success(`Fixed ${fixResult.totalFixed} total records across ${fixResult.details.filter(d => d.fixed > 0).length} checks`);
      } else {
        toast.info('No records needed fixing');
      }
      // Show individual results
      for (const d of fixResult.details) {
        if (d.error) {
          console.error(`Fix ${d.checkName} error:`, d.error);
        }
      }
    } catch (err) {
      toast.error('Fix all failed: ' + String(err));
    } finally {
      setFixingAll(false);
      // Re-run audit to refresh all badges
      runAudit();
    }
  };

  // Group results by category, failing first
  const grouped = result?.results.reduce<Record<string, AuditCheckResult[]>>((acc, r) => {
    (acc[r.category] = acc[r.category] || []).push(r);
    return acc;
  }, {}) ?? {};

  const failingFirst = Object.entries(grouped).sort(([, a], [, b]) => {
    const aFails = a.filter(c => c.status === 'fail').length;
    const bFails = b.filter(c => c.status === 'fail').length;
    return bFails - aFails;
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Data Health
          </CardTitle>
          <div className="flex items-center gap-2">
            {result && (
              <span className="text-[10px] text-muted-foreground">
                Last run: {format(new Date(result.timestamp), 'h:mm a')}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={runAudit} disabled={running} className="gap-1 h-7 text-xs">
              <RefreshCw className={`w-3 h-3 ${running ? 'animate-spin' : ''}`} />
              {running ? 'Running…' : 'Run Now'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary row */}
        {result && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
              <span className="text-xs font-medium">{result.passCount} passing</span>
            </div>
            {result.warnCount > 0 && (
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-xs font-medium">{result.warnCount} warning{result.warnCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            {result.failCount > 0 && (
              <div className="flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-xs font-medium text-red-500">{result.failCount} failing</span>
              </div>
            )}
            <div className="ml-auto">
              <HealthTrend />
            </div>
          </div>
        )}

        {/* Fix All Issues button */}
        {hasFixableChecks && (
          <Button
            size="sm"
            onClick={handleFixAll}
            disabled={fixingAll || running}
            className="gap-1 w-full bg-orange-500 hover:bg-orange-600 text-white"
          >
            {fixingAll ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {fixingAll ? 'Fixing all issues…' : 'Fix All Issues'}
          </Button>
        )}

        {/* Check results grouped by category */}
        {result && (
          <div className="divide-y divide-border">
            {failingFirst.map(([category, checks]) => (
              <div key={category} className="py-1">
                {checks.map(check => (
                  <CheckRow key={check.checkName} check={check} onFixComplete={runAudit} />
                ))}
              </div>
            ))}
          </div>
        )}

        {!result && !running && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Click "Run Now" to check your data health
          </p>
        )}
      </CardContent>
    </Card>
  );
}
