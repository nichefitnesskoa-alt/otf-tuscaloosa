// Own It mention parsing — single source of truth for client-side rendering and
// autocomplete. Mirrors the SQL trigger logic in process_own_it_mentions().

export interface MentionCandidate {
  /** What the user types after `@` — either a staff name or a lane name. */
  token: string;
  /** Resolved staff display_name. */
  resolvedName: string;
  /** Lane name when this is a role tag, null when it's a name tag. */
  lane: string | null;
}

export interface ResolvedMention extends MentionCandidate {
  /** 0-based index of the `@` in the source text. */
  start: number;
  /** End index (exclusive). */
  end: number;
  /** Exact substring matched, including the leading `@`. */
  raw: string;
}

/**
 * Build the autocomplete candidate list. Names first (priority over lanes),
 * then each active lane. Sorted longest-token-first so the matcher prefers
 * `@Retention Owner` over `@Retention`.
 */
export function buildMentionCandidates(
  staffNames: string[],
  owners: { display_name: string; lane_name: string | null; is_active?: boolean }[],
): MentionCandidate[] {
  const list: MentionCandidate[] = [];
  for (const name of staffNames) {
    if (!name) continue;
    list.push({ token: name, resolvedName: name, lane: null });
  }
  for (const o of owners) {
    if (o.is_active === false) continue;
    if (!o.lane_name) continue;
    list.push({ token: o.lane_name, resolvedName: o.display_name, lane: o.lane_name });
  }
  // De-dupe by (token + resolvedName), keep first.
  const seen = new Set<string>();
  const out: MentionCandidate[] = [];
  for (const c of list) {
    const k = c.token.toLowerCase() + '|' + c.resolvedName.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out.sort((a, b) => b.token.length - a.token.length);
}

/** Find every `@token` in `text` that matches a candidate (longest-first wins). */
export function parseOwnItMentions(text: string, candidates: MentionCandidate[]): ResolvedMention[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  const taken: boolean[] = new Array(text.length).fill(false);
  const out: ResolvedMention[] = [];
  for (const c of candidates) {
    const needle = '@' + c.token.toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(needle, from);
      if (idx < 0) break;
      // Skip if any char in this range was already claimed by a longer token.
      let clash = false;
      for (let i = idx; i < idx + needle.length; i++) {
        if (taken[i]) { clash = true; break; }
      }
      if (!clash) {
        for (let i = idx; i < idx + needle.length; i++) taken[i] = true;
        out.push({
          ...c,
          start: idx,
          end: idx + needle.length,
          raw: text.slice(idx, idx + needle.length),
        });
      }
      from = idx + needle.length;
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Filter candidates by what's been typed after `@` (case-insensitive prefix). */
export function filterCandidates(query: string, candidates: MentionCandidate[]): MentionCandidate[] {
  const q = query.toLowerCase().trim();
  if (!q) return candidates.slice(0, 8);
  return candidates
    .filter(c => c.token.toLowerCase().includes(q) || c.resolvedName.toLowerCase().includes(q))
    .slice(0, 8);
}
