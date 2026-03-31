import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { FileText, Upload, ArrowLeft, CalendarIcon, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  const [loading, setLoading] = useState(!isPdf);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPdf) return;
    let cancelled = false;

    const render = async () => {
      try {
        const resp = await fetch(fileUrl);
        if (!resp.ok) throw new Error('Failed to fetch file');
        const blob = await resp.blob();

        if (cancelled || !containerRef.current) return;

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
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Failed to render document');
          setLoading(false);
        }
      }
    };

    render();
    return () => { cancelled = true; };
  }, [fileUrl, isPdf]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
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
        {isPdf ? (
          <iframe
            src={fileUrl}
            className="w-full h-full border-0"
            title={script.title}
          />
        ) : (
          <>
            {loading && !error && (
              <p className="text-muted-foreground text-center py-12 text-sm">Loading document...</p>
            )}
            {error && (
              <p className="text-destructive text-center py-12 text-sm">{error}</p>
            )}
            <div
              ref={containerRef}
              className="docx-viewer-container mx-auto"
              style={{ maxWidth: '100%' }}
            />
          </>
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
  const isAdmin = user?.role === 'Admin';
  const [scripts, setScripts] = useState<CoachingScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingScript, setViewingScript] = useState<CoachingScript | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchScripts = async () => {
    const { data } = await supabase
      .from('coaching_scripts')
      .select('*')
      .order('script_date', { ascending: false });
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
        scripts.map(s => (
          <div
            key={s.id}
            className="w-full rounded-lg border border-border bg-card px-3 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors"
          >
            <button
              type="button"
              onClick={() => setViewingScript(s)}
              className="flex items-center gap-3 min-w-0 flex-1 text-left"
            >
              <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{s.title}</p>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(s.script_date), 'MMM d, yyyy')}
                </span>
              </div>
              <Badge className={cn('text-[10px] shrink-0', FORMAT_STYLES[s.format] || '')}>
                {s.format}
              </Badge>
            </button>
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                disabled={deletingId === s.id}
                onClick={(e) => { e.stopPropagation(); handleDelete(s); }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Upload form ──
function UploadForm({ onSuccess }: { onSuccess: () => void }) {
  const [fmt, setFmt] = useState('');
  const [date, setDate] = useState<Date>();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fmt || !date || !file) {
      toast.error('Please fill in all fields');
      return;
    }

    const title = `${fmt} — ${format(date, 'MMM d, yyyy')}`;
    const dateStr = format(date, 'yyyy-MM-dd');

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'docx';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('coaching-scripts')
        .upload(path, file, {
          contentType: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('coaching-scripts')
        .getPublicUrl(path);

      const { error: insertErr } = await supabase
        .from('coaching_scripts')
        .insert({
          title,
          format: fmt,
          script_date: dateStr,
          file_url: urlData.publicUrl,
        } as any);

      if (insertErr) throw insertErr;

      toast.success('Script uploaded');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Format</Label>
        <Select value={fmt} onValueChange={setFmt}>
          <SelectTrigger><SelectValue placeholder="Select format" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1G">1G</SelectItem>
            <SelectItem value="2G">2G</SelectItem>
            <SelectItem value="S50/T50">S50/T50</SelectItem>
            <SelectItem value="3G">3G</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, 'PPP') : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div>
        <Label>Word Document</Label>
        <Input
          type="file"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={e => setFile(e.target.files?.[0] || null)}
        />
      </div>
      <Button type="submit" disabled={uploading} className="w-full">
        {uploading ? 'Uploading...' : 'Upload'}
      </Button>
    </form>
  );
}
