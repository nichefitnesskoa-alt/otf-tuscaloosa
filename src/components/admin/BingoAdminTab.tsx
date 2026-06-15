import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, Grid3x3 } from 'lucide-react';
import { toast } from 'sonner';
import { BingoAdminBoard } from '@/features/bingo/BingoAdminPage';

export function BingoAdminTab() {
  const PUBLIC_ORIGIN = 'https://otf-tuscaloosa.lovable.app';
  const playLink = `${PUBLIC_ORIGIN}/bingo`;
  const adminLink = `${PUBLIC_ORIGIN}/bingo-admin`;

  const copy = async (url: string, label: string) => {
    try { await navigator.clipboard.writeText(url); toast.success(`${label} link copied`); }
    catch { toast.error('Could not copy'); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Grid3x3 className="w-4 h-4" style={{ color: '#FF6F0D' }} />
            Summer Bingo links
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Share the player link with members. The admin link is staff-only.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <LinkRow label="Player link (share this)" url={playLink} onCopy={() => copy(playLink, 'Player')} />
          <LinkRow label="Admin board (this view)" url={adminLink} onCopy={() => copy(adminLink, 'Admin')} />
        </CardContent>
      </Card>

      <BingoAdminBoard />
    </div>
  );
}

function LinkRow({ label, url, onCopy }: { label: string; url: string; onCopy: () => void }) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate">{url}</code>
        <Button size="sm" variant="outline" onClick={onCopy}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Copy
        </Button>
        <Button size="sm" variant="outline" asChild>
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open
          </a>
        </Button>
      </div>
    </div>
  );
}
