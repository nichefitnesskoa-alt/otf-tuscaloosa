import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Video, FileText, User, ArrowRight, Loader2, Trash2, RefreshCw, Link2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STAGES = ['applied', 'three_step_complete', 'interview', 'decision'] as const;
const STAGE_LABELS: Record<string, string> = {
  applied: 'Applied',
  three_step_complete: '3-Step Complete',
  interview: 'Interview',
  decision: 'Decision',
};
const STAGE_COLORS: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  three_step_complete: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  interview: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  decision: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};
const DECISION_OPTIONS = [
  { value: 'approved', label: 'Approved — Offer Extended' },
  { value: 'denied_not_fit', label: 'Denied — Not a Fit' },
  { value: 'denied_reapply', label: 'Denied — Reapply Later' },
];

const ALL_ROLES = ['Sales Associate (SA)', 'Assistant Studio Leader (ASL)', 'Coach', 'Head Coach'] as const;

/** Normalize role — could be text[] or legacy single string */
function displayRoles(val: unknown): string {
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'string' && val) return val;
  return '—';
}

function normalizeRolesToArray(val: unknown): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string' && val) return [val];
  return [];
}

type Candidate = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string | string[];
  stage: string;
  decision: string | null;
  decision_date: string | null;
  video_url: string | null;
  belonging_essay: string | null;
  future_resume: string | null;
  application_notes: string | null;
  three_step_complete: boolean;
  created_at: string;
  application_token?: string | null;
  application_slug?: string | null;
  application_submitted_at?: string | null;
  availability_schedule?: Record<string, string[]> | null;
  employment_type?: string | null;
  hours_per_week?: number | null;
};

type Interview = {
  id: string;
  candidate_id: string;
  question_set_type: string;
  q1_answer: string | null; q1_score: number | null;
  q2_answer: string | null; q2_score: number | null;
  q3_answer: string | null; q3_score: number | null;
  q4_answer: string | null; q4_score: number | null;
  overall_score: number | null;
  overall_notes: string | null;
  interviewed_by: string | null;
  interviewed_at: string | null;
};

type HistoryEntry = {
  id: string;
  action: string;
  performed_by: string;
  created_at: string;
};

// Availability grid config
const DAYS_CONFIG: { day: string; slots: string[] }[] = [
  { day: 'Monday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Tuesday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Wednesday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Thursday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Friday', slots: Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`) },
  { day: 'Saturday', slots: ['07:00', '08:00', '09:00', '10:00'] },
  { day: 'Sunday', slots: ['10:00', '11:00', '12:00', '13:00'] },
];
const ALL_SLOTS = Array.from({ length: 14 }, (_, i) => `${String(5 + i).padStart(2, '0')}:00`);
function formatSlot(s: string) {
  const h = parseInt(s);
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

/** Generate a slug like "koa-vincent" from a full name */
function generateSlugBase(fullName: string): string {
  return fullName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function HiringPipeline() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [decisionDialog, setDecisionDialog] = useState<Candidate | null>(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false });
    setCandidates((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const moveCandidate = async (candidate: Candidate, newStage: string) => {
    if (newStage === 'decision') {
      setDecisionDialog(candidate);
      return;
    }
    const { error } = await supabase.from('candidates').update({ stage: newStage } as any).eq('id', candidate.id);
    if (error) { toast.error('Failed to move candidate'); return; }
    await supabase.from('candidate_history').insert({
      candidate_id: candidate.id,
      action: `Moved to ${STAGE_LABELS[newStage]}`,
      performed_by: user?.name || 'Admin',
    } as any);
    toast.success(`Moved to ${STAGE_LABELS[newStage]}`);
    fetchCandidates();
  };

  const saveDecision = async (candidate: Candidate, decision: string) => {
    const label = DECISION_OPTIONS.find(d => d.value === decision)?.label || decision;
    await supabase.from('candidates').update({
      stage: 'decision',
      decision,
      decision_date: new Date().toISOString(),
    } as any).eq('id', candidate.id);
    await supabase.from('candidate_history').insert({
      candidate_id: candidate.id,
      action: `Decision: ${label}`,
      performed_by: user?.name || 'Admin',
    } as any);
    toast.success(`Decision saved: ${label}`);
    setDecisionDialog(null);
    fetchCandidates();
  };

  const sendApplicationLink = async (candidate: Candidate) => {
    // Generate token if not present
    let token = candidate.application_token;
    if (!token) {
      token = crypto.randomUUID();
    }

    // Generate unique slug
    const slugBase = generateSlugBase(candidate.full_name);
    // Check for slug collisions
    const { data: existing } = await supabase
      .from('candidates')
      .select('application_slug')
      .like('application_slug' as any, `${slugBase}%`)
      .neq('id', candidate.id);

    const existingSlugs = ((existing as any[]) || []).map((c: any) => c.application_slug).filter(Boolean);
    let slug = slugBase;
    if (existingSlugs.includes(slug)) {
      let counter = 2;
      while (existingSlugs.includes(`${slugBase}-${counter}`)) counter++;
      slug = `${slugBase}-${counter}`;
    }

    const { error } = await supabase.from('candidates').update({
      application_token: token,
      application_slug: slug,
    } as any).eq('id', candidate.id);
    if (error) { toast.error('Failed to generate link'); return; }

    const url = `${window.location.origin}/apply/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copied — ready to send');
    fetchCandidates();
  };

  const getNextStage = (current: string) => {
    const idx = STAGES.indexOf(current as any);
    return idx < STAGES.length - 1 ? STAGES[idx + 1] : null;
  };

  const grouped = STAGES.reduce((acc, stage) => {
    acc[stage] = candidates.filter(c => c.stage === stage);
    return acc;
  }, {} as Record<string, Candidate[]>);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <User className="w-5 h-5" /> Hiring Pipeline
          </h2>
          <p className="text-xs text-muted-foreground">{candidates.length} candidate{candidates.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchCandidates} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open('/apply', '_blank')}>
            <Eye className="w-4 h-4 mr-1" /> Preview Application
          </Button>
          <Button size="sm" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Candidate
          </Button>
        </div>
      </div>

      {/* Pipeline columns */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {STAGES.map(stage => (
          <div key={stage} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{STAGE_LABELS[stage]}</h3>
              <Badge variant="secondary" className="text-xs">{grouped[stage]?.length || 0}</Badge>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {grouped[stage]?.map(c => (
                <CandidateCard
                  key={c.id}
                  candidate={c}
                  onSelect={() => setSelectedCandidate(c)}
                  onMove={() => {
                    const next = getNextStage(c.stage);
                    if (next) moveCandidate(c, next);
                  }}
                  onSendLink={() => sendApplicationLink(c)}
                  nextStage={getNextStage(c.stage)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Decision dialog */}
      {decisionDialog && (
        <DecisionDialog
          candidate={decisionDialog}
          onClose={() => setDecisionDialog(null)}
          onSave={saveDecision}
        />
      )}

      {/* Add candidate dialog */}
      <AddCandidateDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSaved={() => { setAddDialogOpen(false); fetchCandidates(); }}
        userName={user?.name || 'Admin'}
      />

      {/* Candidate detail sheet */}
      {selectedCandidate && (
        <CandidateDetailSheet
          candidate={selectedCandidate}
          onClose={() => { setSelectedCandidate(null); fetchCandidates(); }}
          onDeleted={() => { setSelectedCandidate(null); fetchCandidates(); }}
          userName={user?.name || 'Admin'}
        />
      )}
    </div>
  );
}

/* ─── Candidate Card ─── */
function CandidateCard({ candidate, onSelect, onMove, onSendLink, nextStage }: {
  candidate: Candidate; onSelect: () => void; onMove: () => void; onSendLink: () => void; nextStage: string | null;
}) {
  return (
    <Card className="cursor-pointer hover:bg-muted/50 transition" onClick={onSelect}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium text-sm">{candidate.full_name}</p>
            <p className="text-xs text-muted-foreground">{displayRoles(candidate.role)}</p>
          </div>
          <div className="flex items-center gap-1">
            {candidate.video_url && <Video className="w-3 h-3 text-green-500" />}
            {candidate.three_step_complete && <FileText className="w-3 h-3 text-blue-500" />}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(candidate.created_at), 'MMM d, yyyy')}
          </span>
          {candidate.decision && (
            <Badge variant={candidate.decision === 'approved' ? 'default' : 'destructive'} className="text-[10px]">
              {DECISION_OPTIONS.find(d => d.value === candidate.decision)?.label.split(' — ')[1] || candidate.decision}
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          {nextStage && (
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-xs h-7"
              onClick={(e) => { e.stopPropagation(); onMove(); }}
            >
              Move to {STAGE_LABELS[nextStage]} <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2"
            onClick={(e) => { e.stopPropagation(); onSendLink(); }}
            title="Send Application Link"
          >
            <Link2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Decision Dialog ─── */
function DecisionDialog({ candidate, onClose, onSave }: {
  candidate: Candidate; onClose: () => void; onSave: (c: Candidate, d: string) => void;
}) {
  const [decision, setDecision] = useState('');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Decision for {candidate.full_name}</DialogTitle>
        </DialogHeader>
        <RadioGroup value={decision} onValueChange={setDecision} className="space-y-2">
          {DECISION_OPTIONS.map(opt => (
            <div key={opt.value} className="flex items-center space-x-2">
              <RadioGroupItem value={opt.value} id={opt.value} />
              <Label htmlFor={opt.value}>{opt.label}</Label>
            </div>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!decision} onClick={() => onSave(candidate, decision)}>Save Decision</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Add Candidate Dialog ─── */
function AddCandidateDialog({ open, onClose, onSaved, userName }: {
  open: boolean; onClose: () => void; onSaved: () => void; userName: string;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [threeStep, setThreeStep] = useState('no');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleSave = async () => {
    if (!fullName.trim() || !email.trim() || selectedRoles.length === 0) return;
    setSaving(true);
    const { data, error } = await supabase.from('candidates').insert({
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role: selectedRoles,
      three_step_complete: threeStep === 'yes',
      application_notes: notes.trim() || null,
      stage: 'applied',
    } as any).select('id').single();

    if (error) {
      toast.error(error.message?.includes('candidates_email_unique') ? 'A candidate with this email already exists.' : error.message);
      setSaving(false);
      return;
    }

    if (data) {
      await supabase.from('candidate_history').insert({
        candidate_id: (data as any).id,
        action: 'Manually added',
        performed_by: userName,
      } as any);
    }

    toast.success('Candidate added');
    setSaving(false);
    setFullName(''); setEmail(''); setPhone(''); setSelectedRoles([]); setThreeStep('no'); setNotes('');
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Candidate</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Full Name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div>
            <Label>Role(s) <span className="text-xs text-muted-foreground">(select all that apply)</span></Label>
            <div className="space-y-1 mt-1">
              {ALL_ROLES.map(r => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedRoles.includes(r)}
                    onCheckedChange={() => toggleRole(r)}
                  />
                  <span className="text-sm">{r}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Applied through 3-step process?</Label>
            <RadioGroup value={threeStep} onValueChange={setThreeStep} className="flex gap-4 mt-1">
              <div className="flex items-center gap-1"><RadioGroupItem value="yes" id="3s-y" /><Label htmlFor="3s-y">Yes</Label></div>
              <div className="flex items-center gap-1"><RadioGroupItem value="no" id="3s-n" /><Label htmlFor="3s-n">No</Label></div>
            </RadioGroup>
          </div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!fullName.trim() || !email.trim() || selectedRoles.length === 0 || saving} onClick={handleSave}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Candidate Detail Sheet ─── */
function CandidateDetailSheet({ candidate, onClose, onDeleted, userName }: {
  candidate: Candidate; onClose: () => void; onDeleted: () => void; userName: string;
}) {
  const [tab, setTab] = useState('application');
  const [interview, setInterview] = useState<Interview | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [notes, setNotes] = useState(candidate.application_notes || '');
  const [loadingInterview, setLoadingInterview] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchInterview = async () => {
      setLoadingInterview(true);
      const { data } = await supabase
        .from('candidate_interviews')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setInterview(data as any);
      setLoadingInterview(false);
    };
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('candidate_history')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: true });
      setHistory((data as any[]) || []);
    };
    fetchInterview();
    fetchHistory();
  }, [candidate.id]);

  const saveNotes = async () => {
    await supabase.from('candidates').update({ application_notes: notes } as any).eq('id', candidate.id);
    toast.success('Notes saved');
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      if (candidate.video_url) {
        const parts = candidate.video_url.split('/');
        const fileName = parts[parts.length - 1];
        if (fileName) {
          await supabase.storage.from('candidate-videos').remove([fileName]);
        }
      }
      await supabase.from('candidate_interviews').delete().eq('candidate_id', candidate.id);
      await supabase.from('candidate_history').delete().eq('candidate_id', candidate.id);
      await supabase.from('candidates').delete().eq('id', candidate.id);
      toast.success(`${candidate.full_name} deleted`);
      onDeleted();
    } catch {
      toast.error('Failed to delete candidate');
    }
    setDeleting(false);
  };

  const avail = candidate.availability_schedule as Record<string, string[]> | null;

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{candidate.full_name}</SheetTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge className={STAGE_COLORS[candidate.stage]}>{STAGE_LABELS[candidate.stage]}</Badge>
            <span>{displayRoles(candidate.role)}</span>
            <span>•</span>
            <span>{format(new Date(candidate.created_at), 'MMM d, yyyy')}</span>
          </div>
        </SheetHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="application">Application</TabsTrigger>
            <TabsTrigger value="interview">Interview</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="application" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Email:</span> {candidate.email}</div>
              <div><span className="text-muted-foreground">Phone:</span> {candidate.phone}</div>
              <div><span className="text-muted-foreground">Role(s):</span> {displayRoles(candidate.role)}</div>
              <div><span className="text-muted-foreground">3-Step:</span> {candidate.three_step_complete ? 'Yes' : 'No'}</div>
            </div>

            {/* Availability, Employment Type, Hours — only if data exists */}
            {(avail || candidate.employment_type || candidate.hours_per_week) && (
              <>
                <Separator />
                {avail && Object.values(avail).some(v => v && v.length > 0) && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm uppercase tracking-wide">Availability</h3>
                    <div className="overflow-x-auto -mx-2 px-2">
                      <table className="border-collapse text-xs">
                        <thead>
                          <tr>
                            <th className="p-1 text-left w-14"></th>
                            {DAYS_CONFIG.map(d => (
                              <th key={d.day} className="p-1 text-center font-medium" style={{ minWidth: 36 }}>
                                {d.day.slice(0, 3)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {ALL_SLOTS.map(slot => (
                            <tr key={slot}>
                              <td className="p-0.5 text-muted-foreground whitespace-nowrap text-[10px]">{formatSlot(slot)}</td>
                              {DAYS_CONFIG.map(d => {
                                const dayAvailable = d.slots.includes(slot);
                                if (!dayAvailable) return <td key={d.day} className="p-0.5"><div className="w-8 h-5" /></td>;
                                const selected = (avail[d.day] || []).includes(slot);
                                return (
                                  <td key={d.day} className="p-0.5">
                                    <div className={`w-8 h-5 rounded ${selected ? 'bg-orange-500' : 'bg-muted'}`} />
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {candidate.employment_type && (
                  <div className="text-sm">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wide text-xs">Employment Type</span>
                    <p className="mt-1">{candidate.employment_type}</p>
                  </div>
                )}
                {candidate.hours_per_week && (
                  <div className="text-sm">
                    <span className="text-muted-foreground font-semibold uppercase tracking-wide text-xs">Hours Per Week</span>
                    <p className="mt-1">{candidate.hours_per_week} hours/week</p>
                  </div>
                )}
              </>
            )}

            <Separator />

            {/* Video */}
            {candidate.video_url ? (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-1"><Video className="w-4 h-4" /> Video Introduction</h3>
                <video controls className="w-full rounded-lg max-h-[300px]" src={candidate.video_url} />
                <a href={candidate.video_url} target="_blank" rel="noopener" className="text-xs text-primary underline">
                  Download video
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No video submitted</p>
            )}

            <Separator />

            {/* Belonging Essay */}
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">Belonging Essay</h3>
              {candidate.belonging_essay ? (
                <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded">{candidate.belonging_essay}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not submitted</p>
              )}
            </div>

            <Separator />

            {/* Future Resume */}
            <div className="space-y-1">
              <h3 className="font-semibold text-sm">Future Resume</h3>
              {candidate.future_resume ? (
                <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded">{candidate.future_resume}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not submitted</p>
              )}
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Application Notes</h3>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} onBlur={saveNotes} className="min-h-[80px]" />
            </div>

            <Separator />

            {/* Delete */}
            <Button variant="destructive" size="sm" className="w-full" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="w-4 h-4 mr-1" /> Delete Candidate
            </Button>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Permanently delete {candidate.full_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove their application, interview notes, and all history. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          <TabsContent value="interview" className="mt-4">
            <InterviewTab
              candidate={candidate}
              interview={interview}
              loading={loadingInterview}
              userName={userName}
              onSaved={(i) => setInterview(i)}
              onHistoryUpdate={async () => {
                const { data } = await supabase
                  .from('candidate_history')
                  .select('*')
                  .eq('candidate_id', candidate.id)
                  .order('created_at', { ascending: true });
                setHistory((data as any[]) || []);
              }}
            />
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-2">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No history yet</p>
            ) : (
              history.map(h => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <span className="text-muted-foreground shrink-0 text-xs w-24">
                    {format(new Date(h.created_at), 'MMM d, yyyy')}
                  </span>
                  <span>{h.action}</span>
                  <span className="text-muted-foreground ml-auto text-xs">by {h.performed_by}</span>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Interview Tab ─── */
const THREE_STEP_QUESTIONS = [
  { key: 'q1', prompt: 'In your video, you came across as [specific observation]. Tell me about a moment when you had to bring that same energy on a day when you had nothing left.' },
  { key: 'q2', prompt: 'You wrote about [specific moment from their essay]. What did that person feel that you couldn\'t see? What do you think actually happened for them?' },
  { key: 'q3', prompt: 'Your future resume says you want [specific dream they wrote]. What have you actually done in the last 90 days that moves toward that?' },
  { key: 'q4', prompt: 'We don\'t sell here. We create belonging. What\'s the difference — in your own words, from your own life?' },
];

const STANDARD_QUESTIONS = [
  { key: 'q1', prompt: 'Tell me who you are — not what you\'ve done. What lights you up, and why does this place feel like your kind of place?' },
  { key: 'q2', prompt: 'Describe a moment — inside or outside of fitness — where you created an extraordinary experience for someone. Not a good experience. An extraordinary one. Walk me through exactly what you did.' },
  { key: 'q3', prompt: 'Forget your resume. What do you want to build, become, and be known for — in your career and your life? Tell me like it already happened.' },
  { key: 'q4', prompt: 'What\'s something broken you noticed at your last job that wasn\'t your job to fix — and what did you do about it?' },
];

function InterviewTab({ candidate, interview, loading, userName, onSaved, onHistoryUpdate }: {
  candidate: Candidate;
  interview: Interview | null;
  loading: boolean;
  userName: string;
  onSaved: (i: Interview) => void;
  onHistoryUpdate: () => void;
}) {
  const questions = candidate.three_step_complete ? THREE_STEP_QUESTIONS : STANDARD_QUESTIONS;
  const questionSetType = candidate.three_step_complete ? 'three_step' : 'standard';

  const [answers, setAnswers] = useState({
    q1_answer: '', q1_score: 0,
    q2_answer: '', q2_score: 0,
    q3_answer: '', q3_score: 0,
    q4_answer: '', q4_score: 0,
    overall_notes: '',
  });
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (interview) {
      setInterviewId(interview.id);
      setAnswers({
        q1_answer: interview.q1_answer || '', q1_score: interview.q1_score || 0,
        q2_answer: interview.q2_answer || '', q2_score: interview.q2_score || 0,
        q3_answer: interview.q3_answer || '', q3_score: interview.q3_score || 0,
        q4_answer: interview.q4_answer || '', q4_score: interview.q4_score || 0,
        overall_notes: interview.overall_notes || '',
      });
    }
  }, [interview]);

  const calcAvg = () => {
    const scores = [answers.q1_score, answers.q2_score, answers.q3_score, answers.q4_score].filter(s => s > 0);
    return scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '—';
  };

  const autoSaveField = async (field: string, value: any) => {
    const updated = { ...answers, [field]: value };
    setAnswers(updated);

    const payload: any = {
      ...updated,
      candidate_id: candidate.id,
      question_set_type: questionSetType,
      interviewed_by: userName,
    };
    const scores = [updated.q1_score, updated.q2_score, updated.q3_score, updated.q4_score].filter(s => s > 0);
    payload.overall_score = scores.length > 0 ? parseFloat((scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1)) : null;

    if (interviewId) {
      await supabase.from('candidate_interviews').update(payload as any).eq('id', interviewId);
    } else {
      const { data } = await supabase.from('candidate_interviews').insert(payload as any).select('id').single();
      if (data) setInterviewId((data as any).id);
    }
  };

  const handleSaveInterview = async () => {
    setSaving(true);
    const scores = [answers.q1_score, answers.q2_score, answers.q3_score, answers.q4_score].filter(s => s > 0);
    const overallScore = scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null;

    const payload: any = {
      ...answers,
      candidate_id: candidate.id,
      question_set_type: questionSetType,
      interviewed_by: userName,
      interviewed_at: new Date().toISOString(),
      overall_score: overallScore,
    };

    let savedInterview: any;
    if (interviewId) {
      const { data } = await supabase.from('candidate_interviews').update(payload as any).eq('id', interviewId).select('*').single();
      savedInterview = data;
    } else {
      const { data } = await supabase.from('candidate_interviews').insert(payload as any).select('*').single();
      savedInterview = data;
      if (data) setInterviewId((data as any).id);
    }

    await supabase.from('candidate_history').insert({
      candidate_id: candidate.id,
      action: `Interview conducted by ${userName} — Score: ${overallScore ?? '—'}/5`,
      performed_by: userName,
    } as any);

    if (savedInterview) onSaved(savedInterview as Interview);
    onHistoryUpdate();
    toast.success('Interview saved');
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Question set: <strong>{candidate.three_step_complete ? '3-Step Process' : 'Standard'}</strong>
      </p>

      {questions.map((q, i) => {
        const aKey = `q${i + 1}_answer` as keyof typeof answers;
        const sKey = `q${i + 1}_score` as keyof typeof answers;
        return (
          <div key={q.key} className="space-y-2 p-3 rounded-lg border bg-muted/20">
            <p className="text-sm font-medium">Q{i + 1}</p>
            <p className="text-sm text-muted-foreground italic">"{q.prompt}"</p>
            <Textarea
              value={answers[aKey] as string}
              onChange={e => setAnswers(prev => ({ ...prev, [aKey]: e.target.value }))}
              onBlur={() => autoSaveField(aKey, answers[aKey])}
              placeholder="Type candidate's answer..."
              className="min-h-[80px]"
            />
            <div className="flex items-center gap-2">
              <Label className="text-xs">Score:</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(s => (
                  <Button
                    key={s}
                    size="sm"
                    variant={(answers[sKey] as number) === s ? 'default' : 'outline'}
                    className="w-8 h-8 p-0"
                    onClick={() => autoSaveField(sKey, s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      <Separator />

      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-semibold">Overall Interview Score: </span>
          <span className="text-lg font-bold">{calcAvg()}</span>
          <span className="text-sm text-muted-foreground"> / 5</span>
        </div>
      </div>

      <Textarea
        value={answers.overall_notes}
        onChange={e => setAnswers(prev => ({ ...prev, overall_notes: e.target.value }))}
        onBlur={() => autoSaveField('overall_notes', answers.overall_notes)}
        placeholder="Overall interview notes..."
        className="min-h-[80px]"
      />

      <Button onClick={handleSaveInterview} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Save Interview
      </Button>
    </div>
  );
}
