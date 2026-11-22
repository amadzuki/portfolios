/**
 * Offline stand-in for the model: groups notes by shared meaningful words. Used when no API
 * key is set, when the budget runs out, or if a model call fails.
 */
export interface NoteText {
  id: string;
  text: string;
}
export interface Cluster {
  label: string;
  noteIds: string[];
}

const STOP = new Set(
  `a an the and or but if then so to of in on at by for with from as is are was were be been
  being it its this that these those we our us you your i me my they them their he she his her
  not no do does did done have has had can could should would will just more most less very
  too also than about into over under up down out off again all any some each every both few
  much many such only own same other get got make made need needs want wants like really lot
  lots thing things way bit still even when what which who how why where there here been 've
  're 's 'll dont don't cant can't isnt isn't wasnt wasn't`.split(/\s+/),
);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map(stem);
}

/** A deliberately tiny stemmer: enough to match "meeting"/"meetings", "deploy"/"deploys". */
export function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses'))
    return w.slice(0, -1);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss'))
    return w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ed')) return w.slice(0, -2);
  return w;
}

export function clusterByKeywords(notes: NoteText[], maxGroups = 6): Cluster[] {
  const toks = new Map(notes.map((n) => [n.id, new Set(tokens(n.text))]));
  // Document frequency: words shared by several notes are good group labels; words in
  // nearly every note are not.
  const df = new Map<string, number>();
  for (const set of toks.values())
    for (const t of set) df.set(t, (df.get(t) ?? 0) + 1);
  const useful = [...df]
    .filter(([, c]) => c >= 2 && c <= Math.max(2, notes.length * 0.6))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const assigned = new Set<string>();
  const groups: Cluster[] = [];
  for (const [word] of useful) {
    if (groups.length >= maxGroups - 1) break;
    const members = notes.filter(
      (n) => !assigned.has(n.id) && toks.get(n.id)!.has(word),
    );
    if (members.length < 2) continue;
    members.forEach((m) => assigned.add(m.id));
    groups.push({ label: titleCase(word), noteIds: members.map((m) => m.id) });
  }
  const rest = notes.filter((n) => !assigned.has(n.id));
  if (rest.length)
    groups.push({
      label: groups.length ? 'Everything else' : 'Notes',
      noteIds: rest.map((n) => n.id),
    });
  return groups;
}

const titleCase = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

/**
 * Makes any model output safe: every note appears exactly once, unknown ids are dropped,
 * empty groups removed and labels trimmed.
 */
export function normalizeClusters(
  input: Cluster[],
  noteIds: string[],
): Cluster[] {
  const valid = new Set(noteIds);
  const seen = new Set<string>();
  const out: Cluster[] = [];
  for (const g of input) {
    const ids = g.noteIds.filter((id) => valid.has(id) && !seen.has(id));
    ids.forEach((id) => seen.add(id));
    if (ids.length)
      out.push({
        label: (g.label || 'Group').trim().slice(0, 40),
        noteIds: ids,
      });
  }
  const missing = noteIds.filter((id) => !seen.has(id));
  if (missing.length) {
    const other = out.find((g) =>
      /^(other|misc|everything else)/i.test(g.label),
    );
    if (other) other.noteIds.push(...missing);
    else out.push({ label: 'Everything else', noteIds: missing });
  }
  return out;
}
