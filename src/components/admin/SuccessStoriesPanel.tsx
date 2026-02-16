import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Copy, Trash2, ChevronDown, ChevronUp, Star, StarOff, BarChart3, Link as LinkIcon, Image } from 'lucide-react';
import { format } from 'date-fns';

interface SuccessStory {
  id: string;
  slug: string | null;
  member_first_name: string;
  member_last_name: string;
  studio_location: string | null;
  membership_duration: string | null;
  motivation: string | null;
  overall_experience: string | null;
  specific_changes: string | null;
  proud_moment: string | null;
  fitness_health_improvement: string | null;
  favorite_aspect: string | null;
  other_comments: string | null;
  social_media_permission: boolean | null;
  photo_url: string | null;
  featured: boolean | null;
  status: string;
  submitted_at: string | null;
  created_at: string;
}

const PUBLISHED_URL = 'https://otf-tuscaloosa.lovable.app';

function generateStorySlug(firstName: string, lastName: string): string {
  const base = `${firstName}-${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `story-${Date.now()}`;
}

export default function SuccessStoriesPanel() {
  const [stories, setStories] = useState<SuccessStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [bulkNames, setBulkNames] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  const fetchStories = async () => {
    const { data } = await supabase
      .from('success_stories')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setStories(data as SuccessStory[]);
    setLoading(false);
  };

  useEffect(() => { fetchStories(); }, []);

  const pendingStories = useMemo(() => stories.filter(s => s.status !== 'submitted'), [stories]);
  const submittedStories = useMemo(() => stories.filter(s => s.status === 'submitted').sort((a, b) =>
    new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
  ), [stories]);

  // Stats
  const totalSubmitted = submittedStories.length;
  const thisMonth = submittedStories.filter(s => {
    if (!s.submitted_at) return false;
    const d = new Date(s.submitted_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const socialApproved = submittedStories.filter(s => s.social_media_permission).length;

  const durationMap: Record<string, number> = {
    'Less than 3 months': 1.5, '3-6 months': 4.5, '6-12 months': 9, '1-2 years': 18, '2+ years': 30,
  };
  const avgDuration = useMemo(() => {
    const durations = submittedStories
      .filter(s => s.membership_duration && durationMap[s.membership_duration])
      .map(s => durationMap[s.membership_duration!]);
    if (durations.length === 0) return 'N/A';
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    return avg >= 12 ? `${(avg / 12).toFixed(1)} years` : `${avg.toFixed(0)} months`;
  }, [submittedStories]);

  const createStoryLink = async (first: string, last: string) => {
    const slug = generateStorySlug(first || 'member', last || `${Date.now()}`);
    // Check uniqueness
    const { data: existing } = await supabase.from('success_stories').select('slug').like('slug', `${slug}%`);
    const taken = new Set((existing || []).map((r: any) => r.slug));
    let finalSlug = slug;
    if (taken.has(slug)) {
      let c = 2;
      while (taken.has(`${slug}-${c}`)) c++;
      finalSlug = `${slug}-${c}`;
    }

    const { error } = await supabase.from('success_stories').insert({
      slug: finalSlug,
      member_first_name: first.trim(),
      member_last_name: last.trim(),
      status: 'not_sent',
    });
    if (error) { toast.error('Failed to create link'); return null; }
    await fetchStories();
    return `${PUBLISHED_URL}/story/${finalSlug}`;
  };

  const handleCreate = async () => {
    const link = await createStoryLink(newFirstName, newLastName);
    if (link) {
      await navigator.clipboard.writeText(link);
      toast.success('Link created and copied!');
    }
    setNewFirstName('');
    setNewLastName('');
    setCreateOpen(false);
  };

  const handleBulkCreate = async () => {
    const names = bulkNames.split('\n').filter(n => n.trim());
    if (names.length === 0) return;
    const links: string[] = [];
    for (const name of names) {
      const parts = name.trim().split(/\s+/);
      const first = parts[0] || '';
      const last = parts.slice(1).join(' ') || '';
      const link = await createStoryLink(first, last);
      if (link) links.push(`${first} ${last}: ${link}`);
    }
    await navigator.clipboard.writeText(links.join('\n'));
    toast.success(`${links.length} links created and copied!`);
    setBulkNames('');
    setBulkOpen(false);
  };

  const copyLink = async (story: SuccessStory) => {
    const link = `${PUBLISHED_URL}/story/${story.slug}`;
    await navigator.clipboard.writeText(link);
    if (story.status === 'not_sent') {
      await supabase.from('success_stories').update({ status: 'sent' }).eq('id', story.id);
      await fetchStories();
    }
    toast.success('Link copied!');
  };

  const deleteStory = async (id: string) => {
    if (!confirm('Delete this story link?')) return;
    await supabase.from('success_stories').delete().eq('id', id);
    await fetchStories();
    toast.success('Deleted');
  };

  const toggleFeatured = async (story: SuccessStory) => {
    await supabase.from('success_stories').update({ featured: !story.featured }).eq('id', story.id);
    await fetchStories();
    toast.success(story.featured ? 'Unfeatured' : 'Featured!');
  };

  const copySocialPost = (story: SuccessStory) => {
    const name = `${story.member_first_name} ${story.member_last_name}`.trim();
    const parts: string[] = [];
    parts.push(`${name} — OTF ${story.studio_location || 'Tuscaloosa'} Member (${story.membership_duration || 'Member'})`);
    if (story.motivation) parts.push(`\nWhat motivated you: ${story.motivation}`);
    if (story.overall_experience) parts.push(`\nYour experience: ${story.overall_experience}`);
    if (story.specific_changes) parts.push(`\nChanges you've seen: ${story.specific_changes}`);
    if (story.proud_moment) parts.push(`\nProudest moment: ${story.proud_moment}`);
    if (story.favorite_aspect) parts.push(`\nFavorite thing about OTF: ${story.favorite_aspect}`);
    navigator.clipboard.writeText(parts.join('\n'));
    toast.success('Copied for social media!');
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading stories...</div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{totalSubmitted}</p>
          <p className="text-xs text-muted-foreground">Total Submitted</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{thisMonth}</p>
          <p className="text-xs text-muted-foreground">This Month</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{socialApproved}</p>
          <p className="text-xs text-muted-foreground">Social Approved</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{avgDuration}</p>
          <p className="text-xs text-muted-foreground">Avg Duration</p>
        </CardContent></Card>
      </div>

      {/* Generate Links */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><LinkIcon className="w-4 h-4" /> Generate Story Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1"><Plus className="w-4 h-4" /> New Link</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Story Link</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input placeholder="First Name (optional)" value={newFirstName} onChange={e => setNewFirstName(e.target.value)} />
                  <Input placeholder="Last Name (optional)" value={newLastName} onChange={e => setNewLastName(e.target.value)} />
                  <Button onClick={handleCreate} className="w-full">Create & Copy Link</Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">Bulk Send</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Bulk Create Story Links</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Paste member names, one per line (First Last)</p>
                  <Textarea
                    value={bulkNames}
                    onChange={e => setBulkNames(e.target.value)}
                    placeholder={"John Smith\nJane Doe\nMike Johnson"}
                    className="min-h-[150px]"
                  />
                  <Button onClick={handleBulkCreate} className="w-full">Create All & Copy Links</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Pending Links */}
          {pendingStories.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Pending Links ({pendingStories.length})</p>
              {pendingStories.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">
                      {s.member_first_name || s.member_last_name
                        ? `${s.member_first_name} ${s.member_last_name}`.trim()
                        : 'Anonymous'}
                    </span>
                    <Badge variant={s.status === 'sent' ? 'default' : 'secondary'} className="ml-2 text-xs">
                      {s.status === 'sent' ? 'Sent' : 'Not Sent'}
                    </Badge>
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {format(new Date(s.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copyLink(s)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteStory(s.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submitted Stories */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Submitted Stories ({submittedStories.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {submittedStories.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No stories submitted yet.</p>
          )}
          {submittedStories.map(s => {
            const name = `${s.member_first_name} ${s.member_last_name}`.trim();
            const isOpen = expandedIds.has(s.id);
            return (
              <div key={s.id} className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleExpand(s.id)}
                  className="w-full flex items-center justify-between p-3 text-sm hover:bg-muted/50 transition"
                >
                  <div className="flex items-center gap-2 flex-wrap text-left">
                    <span className="font-semibold">{name || 'Anonymous'}</span>
                    {s.membership_duration && <Badge variant="outline" className="text-xs">{s.membership_duration}</Badge>}
                    {s.social_media_permission ? (
                      <Badge className="bg-green-100 text-green-800 text-xs">Approved</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">No Permission</Badge>
                    )}
                    {s.featured && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
                    <span className="text-xs text-muted-foreground">
                      {s.submitted_at && format(new Date(s.submitted_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 flex-shrink-0" />}
                </button>
                {isOpen && (
                  <div className="p-4 border-t space-y-4 bg-muted/20">
                    {[
                      ['Motivation', s.motivation],
                      ['Overall Experience', s.overall_experience],
                      ['Specific Changes', s.specific_changes],
                      ['Proud Moment', s.proud_moment],
                      ['Fitness & Health Improvement', s.fitness_health_improvement],
                      ['Favorite Aspect', s.favorite_aspect],
                      ['Other Comments', s.other_comments],
                    ].filter(([, val]) => val).map(([label, val]) => (
                      <div key={label as string}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase">{label}</p>
                        <p className="text-sm mt-1">{val}</p>
                      </div>
                    ))}

                    {s.photo_url && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Photo</p>
                        <img
                          src={s.photo_url}
                          alt="Success story"
                          className="w-24 h-24 object-cover rounded-lg cursor-pointer border"
                          onClick={() => setPhotoModal(s.photo_url)}
                        />
                      </div>
                    )}

                    <div className="flex gap-2 pt-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => copySocialPost(s)}>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copy for Social Media
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => toggleFeatured(s)}>
                        {s.featured ? <StarOff className="w-3.5 h-3.5 mr-1" /> : <Star className="w-3.5 h-3.5 mr-1" />}
                        {s.featured ? 'Unfeature' : 'Feature'}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteStory(s.id)}>
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Photo Modal */}
      {photoModal && (
        <Dialog open={!!photoModal} onOpenChange={() => setPhotoModal(null)}>
          <DialogContent className="max-w-lg">
            <img src={photoModal} alt="Success story photo" className="w-full rounded-lg" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
