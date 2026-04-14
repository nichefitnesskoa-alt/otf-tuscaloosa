import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';

interface Winner {
  drawNumber: number;
  name: string;
  prize: string;
}

export default function RafflePage() {
  const [namesText, setNamesText] = useState('');
  const [prize, setPrize] = useState('');
  const [remaining, setRemaining] = useState<string[]>([]);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [currentWinner, setCurrentWinner] = useState<Winner | null>(null);
  const [showDrum, setShowDrum] = useState(true);
  const drumRef = useRef<HTMLDivElement>(null);
  const spinItemsRef = useRef<string[]>([]);

  const parsedNames = useMemo(() => {
    return namesText.split('\n').map(n => n.trim()).filter(Boolean);
  }, [namesText]);

  // Reset remaining/winners when names change
  useEffect(() => {
    setRemaining([...parsedNames]);
    setWinners([]);
    setCurrentWinner(null);
    setShowDrum(true);
  }, [namesText]);

  const handleSpin = useCallback(() => {
    if (remaining.length === 0 || spinning) return;

    setSpinning(true);
    setShowDrum(true);
    setCurrentWinner(null);

    // Pick winner
    const winnerIndex = Math.floor(Math.random() * remaining.length);
    const winnerName = remaining[winnerIndex];

    // Build 40 items, last one is winner
    const items: string[] = [];
    for (let i = 0; i < 39; i++) {
      items.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }
    items.push(winnerName);
    spinItemsRef.current = items;

    // Force re-render drum
    if (drumRef.current) {
      const strip = drumRef.current.querySelector('[data-strip]') as HTMLElement;
      if (strip) {
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';
        // Force reflow
        void strip.offsetHeight;
        strip.style.transition = 'transform 3.5s cubic-bezier(0.25, 0.1, 0.1, 1)';
        strip.style.transform = `translateY(-${39 * 80}px)`;
      }
    }

    setTimeout(() => {
      const newWinner: Winner = {
        drawNumber: winners.length + 1,
        name: winnerName,
        prize: prize || '(no prize specified)',
      };
      setCurrentWinner(newWinner);
      setWinners(prev => [newWinner, ...prev]);
      setRemaining(prev => prev.filter((_, i) => i !== prev.indexOf(winnerName)));
      setShowDrum(false);
      setSpinning(false);
    }, 3600);
  }, [remaining, spinning, winners.length, prize]);

  const handleSpinAgain = () => {
    setCurrentWinner(null);
    setShowDrum(true);
  };

  const allDrawn = parsedNames.length > 0 && remaining.length === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">OTF Tuscaloosa Raffle</h1>
        <p className="text-sm text-muted-foreground">Paste names, enter the prize, spin to pick a winner.</p>
        <div className="mx-auto w-12 h-[3px] bg-primary rounded-full" />
      </div>

      {/* Section 1 — Names */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Names — one per line</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={namesText}
            onChange={e => setNamesText(e.target.value)}
            placeholder={"Jane Smith\nJohn Doe\nSarah Johnson\n..."}
            className="min-h-[160px] resize-y"
          />
          <p className="text-xs text-muted-foreground">{parsedNames.length} names loaded</p>
        </CardContent>
      </Card>

      {/* Section 2 — Prize */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Prize for this draw</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={prize}
            onChange={e => setPrize(e.target.value)}
            placeholder="e.g. Free month of membership"
          />
        </CardContent>
      </Card>

      {/* Section 3 — Spin Area */}
      <Card>
        <CardContent className="pt-6 min-h-[220px] flex flex-col items-center justify-center">
          {parsedNames.length === 0 ? (
            <p className="text-muted-foreground text-sm">Add names above to get started</p>
          ) : allDrawn && !currentWinner ? (
            <p className="text-muted-foreground text-sm">All names have been drawn!</p>
          ) : (
            <>
              {/* Drum */}
              {showDrum && (
                <div className="space-y-4 flex flex-col items-center">
                  <div
                    ref={drumRef}
                    className="relative w-[420px] max-w-full h-[80px] border-2 border-primary rounded-lg overflow-hidden"
                  >
                    {/* Fade overlays */}
                    <div className="absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-card to-transparent z-10 pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card to-transparent z-10 pointer-events-none" />
                    {/* Center line */}
                    <div className="absolute inset-x-0 top-1/2 -translate-y-px h-[2px] bg-primary/40 z-10 pointer-events-none" />

                    {/* Strip */}
                    <div data-strip className="will-change-transform">
                      {(spinning ? spinItemsRef.current : remaining.slice(0, 5)).map((name, i) => (
                        <div
                          key={`${i}-${name}`}
                          className="h-[80px] flex items-center justify-center text-lg font-semibold text-foreground"
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleSpin}
                    disabled={parsedNames.length === 0 || spinning || allDrawn}
                    className="h-11 min-w-[120px] bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {spinning ? 'Spinning...' : 'Spin'}
                  </Button>
                </div>
              )}

              {/* Winner display */}
              {!showDrum && currentWinner && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <Badge className="bg-primary text-primary-foreground text-xs px-3 py-1">
                    <Trophy className="w-3 h-3 mr-1" />
                    WINNER
                  </Badge>
                  <p className="text-3xl font-bold text-primary">{currentWinner.name}</p>
                  <p className="text-sm text-muted-foreground">{currentWinner.prize}</p>
                  {remaining.length > 0 && (
                    <Button variant="outline" onClick={handleSpinAgain} className="mt-2 h-11 min-w-[120px]">
                      Spin again
                    </Button>
                  )}
                  {remaining.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">All names have been drawn!</p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Winners Log */}
      {winners.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Winners this session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0">
            {winners.map((w, i) => (
              <div
                key={w.drawNumber}
                className={`flex items-center gap-3 py-3 ${i < winners.length - 1 ? 'border-b border-border' : ''}`}
              >
                <span className="text-xs text-muted-foreground w-6 text-right">{w.drawNumber}.</span>
                <span className="font-semibold text-foreground">{w.name}</span>
                <span className="text-sm text-muted-foreground ml-auto">{w.prize}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-3">
              {remaining.length} of {parsedNames.length} names remaining
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
