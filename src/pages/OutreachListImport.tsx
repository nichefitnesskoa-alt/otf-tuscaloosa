/**
 * Outreach List import wizard — reusable for any campaign.
 * Uses the same SheetJS pattern as NetGainScoreboard: XLSX.read +
 * sheet_to_json. Multi-sheet files become multiple lists under one
 * campaign_tag. Unmapped columns are preserved in metadata (not dropped).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { ArrowLeft, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';

const FIELDS = [
  { key: 'client_name', label: 'Client name *' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'item', label: 'Item / plan' },
  { key: 'amount', label: 'Amount' },
  { key: 'worked_out_30d', label: 'Worked out 30d (yes/no)' },
  { key: 'last_30d_count', label: 'Workouts in last 30d (count)' },
  { key: 'latest_workout_date', label: 'Latest workout date' },
  { key: 'is_churning', label: 'Is churning (yes/no)' },
  { key: 'churn_date', label: 'Churn date' },
] as const;

type FieldKey = typeof FIELDS[number]['key'];

interface SheetPlan {
  sheetName: string;
  listName: string;
  headers: string[];
  data: Record<string, any>[];
  mapping: Partial<Record<FieldKey, string>>;
  autoChurnFallback: boolean; // if true, no is_churning column → all false
  rawRows: any[][]; // full array-of-arrays for header-row override
  headerRow: number; // 1-indexed row used as header
}

/** Find the first row (0-indexed) whose cells look like real column headers.
 *  Skips title/description rows above the header. */
function detectHeaderRow(rows: any[][]): number {
  const isHeaderCell = (v: any) =>
    typeof v === 'string' && /^(client|name|member|full ?name|first ?name|last ?name)/i.test(v.trim());
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if ((rows[i] || []).some(isHeaderCell)) return i;
  }
  return 0;
}

/** Convert array-of-arrays + header row index into {headers, data} shape. */
function shapeFromHeaderRow(rows: any[][], headerIdx: number) {
  const rawHeaders = (rows[headerIdx] || []).map((h, i) =>
    (h == null || String(h).trim() === '') ? `Column ${i + 1}` : String(h).trim());
  // dedupe duplicate headers
  const seen = new Map<string, number>();
  const headers = rawHeaders.map(h => {
    const n = (seen.get(h) || 0) + 1;
    seen.set(h, n);
    return n === 1 ? h : `${h} (${n})`;
  });
  const data = rows.slice(headerIdx + 1)
    .filter(r => r && r.some(c => c !== '' && c != null))
    .map(r => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
      return obj;
    });
  return { headers, data };
}

function guessColumn(headers: string[], patterns: RegExp[]): string | undefined {
  for (const p of patterns) {
    const hit = headers.find(h => p.test(h));
    if (hit) return hit;
  }
  return undefined;
}

function autoMap(headers: string[]): Partial<Record<FieldKey, string>> {
  return {
    client_name: guessColumn(headers, [/^client( name)?$/i, /^name$/i, /^member/i, /^full/i]),
    email: guessColumn(headers, [/email/i]),
    phone: guessColumn(headers, [/phone|mobile|cell/i]),
    item: guessColumn(headers, [/item|plan|package|product/i]),
    amount: guessColumn(headers, [/amount|price|value|\$/i]),
    worked_out_30d: guessColumn(headers, [/worked ?out.*30/i, /active/i]),
    last_30d_count: guessColumn(headers, [/last.?30|30 ?day/i, /workouts?.*(count|last|30)/i, /^workouts?$/i]),
    latest_workout_date: guessColumn(headers, [/latest.*(workout|visit|class|date)/i, /last.*(visit|class)/i, /latest workout date/i]),
    is_churning: guessColumn(headers, [/churn/i, /at.?risk/i, /cancel/i]),
    churn_date: guessColumn(headers, [/churn.*date/i, /cancel.*date/i, /expire/i]),
  };
}

function coerceBool(v: any): boolean | null {
  if (v == null || v === '') return null;
  const s = String(v).trim().toLowerCase();
  if (['y', 'yes', 'true', '1', 'x', 'churn', 'churning', 'at risk', 'at-risk'].includes(s)) return true;
  if (['n', 'no', 'false', '0', '-'].includes(s)) return false;
  return null;
}

function coerceDate(v: any): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    if (!isFinite(v) || v <= 0) return null;
    const d = XLSX.SSF.parse_date_code(v);
    if (!d || !d.y || !d.m || !d.d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  if (!s || s === '-' || s === '0') return null;
  const d = new Date(s);
  if (isNaN(d.getTime()) || d.getFullYear() < 1970) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function coerceNum(v: any): number | null {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? null : n;
}

export default function OutreachListImport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaignTag, setCampaignTag] = useState('');
  const [plans, setPlans] = useState<SheetPlan[]>([]);
  const [saving, setSaving] = useState(false);

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    const built: SheetPlan[] = wb.SheetNames.map(name => {
      const ws = wb.Sheets[name];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
      const headerIdx = detectHeaderRow(rawRows);
      const { headers, data } = shapeFromHeaderRow(rawRows, headerIdx);
      const mapping = autoMap(headers);
      return {
        sheetName: name,
        listName: name,
        headers,
        data,
        mapping,
        autoChurnFallback: !mapping.is_churning,
        rawRows,
        headerRow: headerIdx + 1,
      };
    }).filter(p => p.data.length > 0);
    setPlans(built);
    if (!campaignTag) setCampaignTag(file.name.replace(/\.[^.]+$/, '').slice(0, 40));
  };

  const updateMapping = (i: number, key: FieldKey, header: string) => {
    setPlans(p => {
      const next = [...p];
      next[i] = { ...next[i], mapping: { ...next[i].mapping, [key]: header === '__none__' ? undefined : header } };
      return next;
    });
  };

  const updateHeaderRow = (i: number, oneIndexed: number) => {
    setPlans(p => {
      const next = [...p];
      const cur = next[i];
      const idx = Math.max(0, Math.min((cur.rawRows.length - 1), oneIndexed - 1));
      const { headers, data } = shapeFromHeaderRow(cur.rawRows, idx);
      const mapping = autoMap(headers);
      next[i] = { ...cur, headers, data, mapping, headerRow: idx + 1, autoChurnFallback: !mapping.is_churning };
      return next;
    });
  };

  const importAll = async () => {
    if (!user?.name) { toast.error('Login required'); return; }
    if (!campaignTag.trim()) { toast.error('Campaign tag required'); return; }
    for (const p of plans) {
      if (!p.mapping.client_name) {
        toast.error(`Sheet "${p.sheetName}": map a Client name column`);
        return;
      }
    }
    setSaving(true);
    try {
      for (const p of plans) {
        const { data: listRow, error: listErr } = await (supabase as any)
          .from('outreach_lists')
          .insert({
            name: p.listName.trim() || p.sheetName,
            campaign_tag: campaignTag.trim(),
            created_by: user.name,
          })
          .select('id')
          .single();
        if (listErr) throw listErr;
        const listId = (listRow as any).id;

        const clientNameCol = p.mapping.client_name;
        const rows = p.data.map(r => {
          const client_name = String(r[p.mapping.client_name!] ?? '').trim();
          if (!client_name) return null;
          // Skip section-header-ish rows where name is literally "Client" or repeats headers
          if (/^client$|^name$|^full name$/i.test(client_name)) return null;
          // Preserve EVERY column from the uploaded Excel in metadata so the detail
          // view can render the sheet exactly as imported — nothing is dropped
          // because it happened to be mapped to a pre-coded field.
          const metadata: Record<string, any> = {};
          for (const h of p.headers) {
            if (/^__EMPTY/i.test(h) || /^Column \d+$/.test(h)) continue;
            if (h === clientNameCol) continue; // name is already the row identifier
            if (r[h] !== '' && r[h] != null) metadata[h] = r[h];
          }
          const is_churning_val = p.mapping.is_churning ? coerceBool(r[p.mapping.is_churning]) : null;
          return {
            list_id: listId,
            client_name,
            email: p.mapping.email ? String(r[p.mapping.email] ?? '').trim() || null : null,
            phone: p.mapping.phone ? String(r[p.mapping.phone] ?? '').trim() || null : null,
            item: p.mapping.item ? String(r[p.mapping.item] ?? '').trim() || null : null,
            amount: p.mapping.amount ? coerceNum(r[p.mapping.amount]) : null,
            worked_out_30d: p.mapping.worked_out_30d ? coerceBool(r[p.mapping.worked_out_30d]) : null,
            last_30d_count: p.mapping.last_30d_count ? coerceNum(r[p.mapping.last_30d_count]) : null,
            latest_workout_date: p.mapping.latest_workout_date ? coerceDate(r[p.mapping.latest_workout_date]) : null,
            is_churning: is_churning_val === true,
            churn_date: p.mapping.churn_date ? coerceDate(r[p.mapping.churn_date]) : null,
            metadata,
            created_by: user.name,
          };
        }).filter(Boolean) as any[];

        if (rows.length > 0) {
          // Chunk inserts to avoid payload limits
          const CHUNK = 500;
          for (let i = 0; i < rows.length; i += CHUNK) {
            const { error } = await (supabase as any)
              .from('outreach_list_rows')
              .insert(rows.slice(i, i + CHUNK));
            if (error) throw error;
          }
        }
      }
      toast.success(`Imported ${plans.length} list${plans.length === 1 ? '' : 's'}`);
      navigate('/outreach-lists');
    } catch (e: any) {
      toast.error(`Import failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto pb-24 space-y-4">
      <div>
        <Button variant="ghost" size="sm" className="h-8 -ml-2" onClick={() => navigate('/outreach-lists')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h1 className="text-xl font-black uppercase tracking-wide mt-1">Create Outreach List</h1>
        <p className="text-xs text-muted-foreground">Upload a CSV or Excel file. Multi-sheet workbooks become multiple lists sharing one campaign tag.</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs">Campaign tag *</Label>
            <Input value={campaignTag} onChange={e => setCampaignTag(e.target.value)}
              placeholder="e.g. SOML, Win-back August, Event follow-up" />
            <p className="text-[10px] text-muted-foreground mt-1">Groups related lists together on the Outreach Lists page.</p>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" /> Upload file
            </Label>
            <Input type="file" accept=".csv,.xlsx,.xls"
              onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </div>
        </CardContent>
      </Card>

      {plans.map((p, i) => (
        <Card key={p.sheetName}>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs">Sheet: <span className="font-mono">{p.sheetName}</span> · {p.data.length} rows</Label>
              <Input value={p.listName} onChange={e => {
                setPlans(pl => { const n = [...pl]; n[i] = { ...n[i], listName: e.target.value }; return n; });
              }} placeholder="List name" className="mt-1" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground">
                Header row (which spreadsheet row has the column titles like "Client", "Amount")
              </Label>
              <Input type="number" min={1} max={p.rawRows.length} value={p.headerRow}
                onChange={e => updateHeaderRow(i, Number(e.target.value) || 1)}
                className="h-8 text-xs w-24" />
              <p className="text-[10px] text-muted-foreground mt-1">
                Auto-detected. Adjust if the mapping below looks wrong. Detected columns: <span className="font-mono">{p.headers.slice(0, 6).join(', ')}{p.headers.length > 6 ? '…' : ''}</span>
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {FIELDS.map(f => (
                <div key={f.key}>
                  <Label className="text-[11px] text-muted-foreground">{f.label}</Label>
                  <Select value={p.mapping[f.key] || '__none__'} onValueChange={v => updateMapping(i, f.key, v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— none —</SelectItem>
                      {p.headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Any columns you don't map are saved to the row's metadata field (not lost).
            </p>
          </CardContent>
        </Card>
      ))}

      {plans.length > 0 && (
        <div className="flex justify-end">
          <Button onClick={importAll} disabled={saving}>
            {saving ? 'Importing…' : `Import ${plans.length} list${plans.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      )}
    </div>
  );
}
