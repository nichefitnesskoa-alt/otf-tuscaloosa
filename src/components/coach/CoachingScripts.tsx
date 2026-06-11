import { isAdmin as isAdminCheck } from '@/lib/auth/roles';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FileText, Upload, ArrowLeft, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Parse filenames like "May09_2G", "May 9 2G", "2G-May-9", "5.9.25 3G", etc.
const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

export function parseScriptFilename(filename: string): { format: '2G' | '3G'; date: Date; title: string } | null {
  const base = filename.replace(/\.(docx|pdf)$/i, '');
  const lower = base.toLowerCase();

  // Format
  let fmt: '2G' | '3G' | null = null;
  if (/(^|[^a-z0-9])3g([^a-z0-9]|$)/i.test(base)) fmt = '3G';
  else if (/(^|[^a-z0-9])2g([^a-z0-9]|$)/i.test(base)) fmt = '2G';
  if (!fmt) return null;

  // Date — try MonthName + Day first
  let month: number | null = null;
  let day: number | null = null;
  let year: number = new Date().getFullYear();

  const monthMatch = lower.match(/(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s._-]*(\d{1,2})/);
  if (monthMatch) {
    month = MONTHS[monthMatch[1]];
    day = parseInt(monthMatch[2], 10);
  } else {
    // Numeric M.D or M.D.YY
    const numMatch = base.match(/(\d{1,2})[.\-_/](\d{1,2})(?:[.\-_/](\d{2,4}))?/);
    if (numMatch) {
      month = parseInt(numMatch[1], 10) - 1;
      day = parseInt(numMatch[2], 10);
      if (numMatch[3]) {
        const y = parseInt(numMatch[3], 10);
        year = y < 100 ? 2000 + y : y;
      }
    }
  }

  if (month === null || day === null || month < 0 || month > 11 || day < 1 || day > 31) return null;

  const date = new Date(year, month, day);
  const title = `${fmt} — ${format(date, 'MMM d')}`;
  return { format: fmt, date, title };
}

interface CoachingScript {
  id: string;
  title: string;
  format: string;
  script_date: string;
  file_url: string;
  created_at: string;
}

const FORMAT_STYLES: Record<string, string> = {
  '1G': 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
  '2G': 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  'S50/T50': 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  '3G': 'bg-green-500/20 text-green-700 dark:text-green-300',
};

// ── Inline .docx renderer ──
function ScriptViewer({ fileUrl, onClose, script }: { fileUrl: string; onClose: () => void; script: CoachingScript }) {
  const isPdf = script.file_url.toLowerCase().endsWith('.pdf') || script.file_url.toLowerCase().includes('.pdf');
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      try {
        const resp = await fetch(fileUrl);
        if (!resp.ok) throw new Error('Failed to fetch file');
        const blob = await resp.blob();

        if (cancelled) return;

        if (isPdf) {
          const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
          setBlobUrl(url);
          setLoading(false);
        } else {
          if (!containerRef.current) return;
          const { renderAsync } = await import('docx-preview');
          containerRef.current.innerHTML = '';
          await renderAsync(blob, containerRef.current, undefined, {
            className: 'docx-preview-wrapper',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: true,
            experimental: false,
            trimXmlDeclaration: true,
            useBase64URL: true,
          });
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to render document');
          setLoading(false);
        }
      }
    };

    render();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [fileUrl, isPdf]);

  return (
    <div className="fixed inset-x-0 top-0 bottom-16 z-40 bg-background flex flex-col pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{script.title}</p>
          <div className="flex items-center gap-2">
            <Badge className={cn('text-[10px]', FORMAT_STYLES[script.format] || '')}>
              {script.format}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(script.script_date), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/30">
        {loading && !error && (
          <p className="text-muted-foreground text-center py-12 text-sm">Loading document...</p>
        )}
        {error && (
          <p className="text-destructive text-center py-12 text-sm">{error}</p>
        )}
        {isPdf && blobUrl && !loading && (
          <iframe
            src={blobUrl}
            className="w-full h-full border-0"
            title={script.title}
          />
        )}
        {!isPdf && (
          <div
            ref={containerRef}
            className="docx-viewer-container mx-auto"
            style={{ maxWidth: '100%' }}
          />
        )}
      </div>

      <style>{`
        .docx-viewer-container .docx-wrapper {
          background: transparent !important;
          padding: 16px !important;
        }
        .docx-viewer-container .docx-wrapper > section.docx {
          background: white !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important;
          margin: 0 auto 24px auto !important;
          padding: 48px !important;
          min-height: auto !important;
        }
        @media (max-width: 640px) {
          .docx-viewer-container .docx-wrapper > section.docx {
            padding: 20px !important;
            margin: 0 8px 16px 8px !important;
          }
        }
      `}</style>
    </div>
  );
}

export function CoachingScripts() {
  const { user } = useAuth();
  const isAdmin = isAdminCheck(user);
  const [scripts, setScripts] = useState<CoachingScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingScript, setViewingScript] = useState<CoachingScript | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchScripts = async () => {
    const { data } = await supabase
      .from('coaching_scripts')
      .select('*')
      .order('script_date', { ascending: true });
    setScripts((data as unknown as CoachingScript[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchScripts(); }, []);

  const handleDelete = async (script: CoachingScript) => {
    if (!confirm(`Delete "${script.title}"?`)) return;
    setDeletingId(script.id);
    try {
      // Extract storage path from public URL
      const urlParts = script.file_url.split('/coaching-scripts/');
      if (urlParts[1]) {
        await supabase.storage.from('coaching-scripts').remove([decodeURIComponent(urlParts[1])]);
      }
      const { error } = await supabase.from('coaching_scripts').delete().eq('id', script.id);
      if (error) throw error;
      toast.success('Script deleted');
      fetchScripts();
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  if (viewingScript) {
    return (
      <ScriptViewer
        fileUrl={viewingScript.file_url}
        script={viewingScript}
        onClose={() => setViewingScript(null)}
      />
    );
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full gap-2">
              <Upload className="w-4 h-4" /> Upload Script
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Coaching Script</DialogTitle>
            </DialogHeader>
            <UploadForm
              onSuccess={() => {
                setUploadOpen(false);
                fetchScripts();
              }}
            />
          </DialogContent>
        </Dialog>
      )}

      {loading ? (
        <p className="text-muted-foreground text-center py-6 text-sm">Loading scripts...</p>
      ) : scripts.length === 0 ? (
        <p className="text-muted-foreground text-center py-6 text-sm">No scripts uploaded yet</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {scripts.map(s => (
            <div
              key={s.id}
              className="relative w-[140px] rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
            >
              <button
                type="button"
                onClick={() => setViewingScript(s)}
                className="w-full text-left px-2.5 py-2 min-h-[44px] flex flex-col gap-1.5 cursor-pointer"
              >
                <div className="flex items-center justify-between gap-1">
                  <Badge className={cn('text-[10px] px-1.5 py-0 h-4', FORMAT_STYLES[s.format] || '')}>
                    {s.format}
                  </Badge>
                  {isAdmin && <span className="w-6 h-6 shrink-0" aria-hidden />}
                </div>
                <p className="text-xs font-medium truncate flex items-center gap-1">
                  <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                  {s.title}
                </p>
              </button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive"
                  disabled={deletingId === s.id}
                  onClick={(e) => { e.stopPropagation(); handleDelete(s); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// ── Batch upload form ──
type ParsedFile = {
  file: File;
  parsed: ReturnType<typeof parseScriptFilename>;
};

function UploadForm({ onSuccess }: { onSuccess: () => void }) {
  const [items, setItems] = useState<ParsedFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const [extracting, setExtracting] = useState(false);

  const expandZips = async (files: File[]): Promise<File[]> => {
    const out: File[] = [];
    const { default: JSZip } = await import('jszip');
    for (const f of files) {
      const isZip = /\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed';
      if (!isZip) { out.push(f); continue; }
      try {
        const zip = await JSZip.loadAsync(f);
        const entries = Object.values(zip.files).filter(
          (e: any) => !e.dir && /\.(docx|pdf)$/i.test(e.name) && !e.name.startsWith('__MACOSX/'),
        );
        for (const entry of entries) {
          const blob = await (entry as any).async('blob');
          const base = (entry as any).name.split('/').pop() || (entry as any).name;
          const ext = base.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          out.push(new File([blob], base, { type: ext }));
        }
      } catch (err: any) {
        toast.error(`Couldn't read ${f.name}: ${err.message || 'invalid zip'}`);
      }
    }
    return out;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setExtracting(true);
    try {
      const expanded = await expandZips(Array.from(files));
      const next: ParsedFile[] = expanded.map((file) => ({
        file,
        parsed: parseScriptFilename(file.name),
      }));
      setItems(next);
    } finally {
      setExtracting(false);
    }
  };

  // Today in America/Chicago as YYYY-MM-DD
  const todayCentral = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const isPastDate = (d: Date) => format(d, 'yyyy-MM-dd') < todayCentral;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parseable = items.filter((i) => i.parsed);
    const valid = parseable.filter((i) => !isPastDate(i.parsed!.date));
    const pastCount = parseable.length - valid.length;
    if (valid.length === 0) {
      toast.error(
        pastCount > 0
          ? `All ${pastCount} file${pastCount === 1 ? '' : 's'} are dated before today — skipped.`
          : 'No valid filenames. Use names like "May09_2G".',
      );
      return;
    }

    setUploading(true);
    let uploaded = 0;
    let failed = 0;

    await Promise.all(
      valid.map(async ({ file, parsed }) => {
        try {
          const ext = file.name.split('.').pop() || 'docx';
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('coaching-scripts')
            .upload(path, file, {
              contentType:
                file.type ||
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            });
          if (uploadErr) throw uploadErr;
          const { data: urlData } = supabase.storage
            .from('coaching-scripts')
            .getPublicUrl(path);
          const { error: insertErr } = await supabase
            .from('coaching_scripts')
            .insert({
              title: parsed!.title,
              format: parsed!.format,
              script_date: format(parsed!.date, 'yyyy-MM-dd'),
              file_url: urlData.publicUrl,
            } as any);
          if (insertErr) throw insertErr;
          uploaded++;
        } catch {
          failed++;
        }
      })
    );

    // Sweep any past-dated rows (existing or just-inserted edge cases)
    try {
      await supabase.functions.invoke('cleanup-coaching-scripts');
    } catch { /* non-fatal */ }

    const unparseable = items.length - parseable.length;
    setUploading(false);
    if (uploaded > 0) {
      toast.success(
        `Uploaded ${uploaded} script${uploaded === 1 ? '' : 's'}` +
          (pastCount > 0 ? ` · skipped ${pastCount} past-dated` : '') +
          (unparseable > 0 ? ` · skipped ${unparseable} unparseable` : '') +
          (failed > 0 ? ` · ${failed} failed` : '')
      );
      onSuccess();
    } else {
      toast.error('No scripts uploaded');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Documents (PDF, Word, or ZIP)</Label>
        <Input
          type="file"
          multiple
          accept=".docx,.pdf,.zip,application/zip,application/x-zip-compressed"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          Drop a ZIP and we'll pull every .docx/.pdf inside. Filename auto-detects format and date. Example: <code>May09_2G.docx</code>
        </p>
        {extracting && <p className="text-xs text-muted-foreground mt-1">Extracting ZIP…</p>}
      </div>

      {items.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-auto border border-border rounded-md p-2">
          {items.map(({ file, parsed }, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-xs py-1 px-1.5 rounded"
            >
              {parsed ? (
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-destructive shrink-0" />
              )}
              <span className="truncate flex-1 text-muted-foreground">
                {file.name}
              </span>
              {parsed ? (
                <span className="font-medium shrink-0">{parsed.title}</span>
              ) : (
                <span className="text-destructive shrink-0">can't parse</span>
              )}
            </div>
          ))}
        </div>
      )}

      <Button
        type="submit"
        disabled={uploading || items.length === 0}
        className="w-full"
      >
        {uploading
          ? 'Uploading...'
          : `Upload ${items.filter((i) => i.parsed).length || ''}`.trim()}
      </Button>
    </form>
  );
}

