import { useState, useEffect } from 'react';
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
import { FileText, Upload, ArrowLeft, CalendarIcon } from 'lucide-react';
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
  '2G': 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  'S50/T50': 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  '3G': 'bg-green-500/20 text-green-700 dark:text-green-300',
};

export function CoachingScripts() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [scripts, setScripts] = useState<CoachingScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingScript, setViewingScript] = useState<CoachingScript | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const fetchScripts = async () => {
    const { data } = await supabase
      .from('coaching_scripts')
      .select('*')
      .order('script_date', { ascending: false });
    setScripts((data as unknown as CoachingScript[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchScripts(); }, []);

  // ── Inline PDF viewer (full-screen overlay) ──
  if (viewingScript) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setViewingScript(null)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate">{viewingScript.title}</p>
            <div className="flex items-center gap-2">
              <Badge className={cn('text-[10px]', FORMAT_STYLES[viewingScript.format] || '')}>
                {viewingScript.format}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {format(new Date(viewingScript.script_date), 'MMM d, yyyy')}
              </span>
            </div>
          </div>
        </div>
        <iframe
          src={viewingScript.file_url}
          className="flex-1 w-full border-0"
          title={viewingScript.title}
        />
      </div>
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
          <button
            key={s.id}
            type="button"
            onClick={() => setViewingScript(s)}
            className="w-full text-left rounded-lg border border-border bg-card px-3 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors"
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
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('coaching-scripts')
        .upload(path, file, { contentType: 'application/pdf' });

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
        <Label>PDF File</Label>
        <Input type="file" accept=".pdf,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
      </div>
      <Button type="submit" disabled={uploading} className="w-full">
        {uploading ? 'Uploading...' : 'Upload'}
      </Button>
    </form>
  );
}