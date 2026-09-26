// Core bracket model shared by client and server.
// Supports single elimination and double elimination (winners/losers
// brackets + grand final with reset).

export type Participant = {
  id: string;
  name: string;
  /** Custom seed label — free text like "1", "E4", "R3-2". */
  seed: string;
};

/** One set/game inside a series (volleyball set, baseball game…). */
export type GameScore = { a: number | null; b: number | null };

export type MatchResult = {
  /** Headline score shown on the bracket card. For series sports this is
   *  sets/games won (2–1); for single-score sports it's the score itself. */
  s1: number | null;
  s2: number | null;
  /** 1 = top slot won, 2 = bottom slot won */
  winner: 1 | 2 | null;
  /** Per-set/per-game detail for series sports. */
  games?: GameScore[];
  /** Which side is the home team: 1 = top slot, 2 = bottom slot. */
  home?: 1 | 2;
  /** Optional schedule info. date is "YYYY-MM-DD", time is "HH:MM". */
  location?: string;
  date?: string;
  time?: string;
  /** Participant ids the scores refer to. If the match's entrants change
   *  (upstream upset, seed swap), a result whose ids no longer match is
   *  voided automatically — the schedule info is kept. */
  p1Id?: string;
  p2Id?: string;
};

/* ---------------- Sports & scoring ---------------- */

export type SportId =
  | "other"
  | "volleyball"
  | "basketball"
  | "football"
  | "soccer"
  | "baseball"
  | "tennis";

export type SportDef = {
  label: string;
  /** "single" = one score per side. "series" = best-of N sets/games. */
  scoring: "single" | "series";
  /** What one leg of a series is called. */
  unit: string;
  /** Allowed best-of lengths for series sports. */
  bestOfOptions: number[];
  defaultBestOf: number;
  /** What the raw numbers are called. */
  pointsLabel: string;
};

export const SPORTS: Record<SportId, SportDef> = {
  other: {
    label: "Other / generic",
    scoring: "single",
    unit: "Game",
    bestOfOptions: [1, 3, 5, 7],
    defaultBestOf: 1,
    pointsLabel: "Score",
  },
  volleyball: {
    label: "Volleyball",
    scoring: "series",
    unit: "Set",
    bestOfOptions: [1, 3, 5],
    defaultBestOf: 3,
    pointsLabel: "Points",
  },
  basketball: {
    label: "Basketball",
    scoring: "single",
    unit: "Game",
    bestOfOptions: [1, 3, 5, 7],
    defaultBestOf: 1,
    pointsLabel: "Points",
  },
  football: {
    label: "Football",
    scoring: "single",
    unit: "Game",
    bestOfOptions: [1],
    defaultBestOf: 1,
    pointsLabel: "Points",
  },
  soccer: {
    label: "Soccer",
    scoring: "single",
    unit: "Game",
    bestOfOptions: [1],
    defaultBestOf: 1,
    pointsLabel: "Goals",
  },
  baseball: {
    label: "Baseball / softball",
    scoring: "series",
    unit: "Game",
    bestOfOptions: [1, 3, 5, 7],
    defaultBestOf: 3,
    pointsLabel: "Runs",
  },
  tennis: {
    label: "Tennis / pickleball",
    scoring: "series",
    unit: "Set",
    bestOfOptions: [1, 3, 5],
    defaultBestOf: 3,
    pointsLabel: "Points",
  },
};

export function sportOf(data: BracketData): SportDef {
  return SPORTS[data.sport ?? "other"] ?? SPORTS.other;
}

/** How many sets/games a side needs to take the match. */
export function bestOfOf(data: BracketData): number {
  const def = sportOf(data);
  const n = data.bestOf ?? def.defaultBestOf;
  return def.bestOfOptions.includes(n) ? n : def.defaultBestOf;
}

export function isSeries(data: BracketData): boolean {
  return sportOf(data).scoring === "series" && bestOfOf(data) > 1;
}

export type GameSummary = {
  won1: number;
  won2: number;
  pf1: number;
  pf2: number;
  winner: 1 | 2 | null;
};

/** Tally a list of set/game scores into sets won and total points. */
export function summarizeGames(
  games: GameScore[] | undefined,
  bestOf: number
): GameSummary {
  let won1 = 0,
    won2 = 0,
    pf1 = 0,
    pf2 = 0;
  for (const g of games ?? []) {
    if (g.a === null || g.b === null) continue;
    pf1 += g.a;
    pf2 += g.b;
    if (g.a > g.b) won1++;
    else if (g.b > g.a) won2++;
  }
  const need = Math.floor(bestOf / 2) + 1;
  const winner = won1 >= need ? 1 : won2 >= need ? 2 : null;
  return { won1, won2, pf1, pf2, winner };
}

export type BracketFormat = "single" | "double";

/** Optional round-robin phase played before the knockout bracket. */
export type GroupStage = {
  /** How many advance from each group (1-8). Legacy default when a bracket
   *  doesn't declare which places it takes. */
  advance: number;
  /** Participants per group, in listed order. */
  groups: Participant[][];
  /** Round-robin results keyed "g{group}-{i}-{j}" with i < j (member indexes). */
  results: Record<string, MatchResult>;
  /** Manual finishing order per group: group index -> ordered participant ids.
   *  Used instead of computed standings (e.g. complicated tiebreakers). Any
   *  teams left out fall in behind, in standings order. */
  overrides: Record<string, string[]>;
};

/**
 * One knockout bracket. A tournament can run several side by side — e.g.
 * places 1-2 from each group into "Gold", places 3-4 into "Silver".
 */
export type Knockout = {
  id: string;
  name: string;
  /** Which group finishing places feed this bracket (1-based). Empty/absent
   *  for brackets not fed by a group stage. */
  takeRanks?: number[];
  /** Slot layout for round 1, length = bracket size (power of two). null = bye. */
  slots: (Participant | null)[];
  /** Results keyed by match key ("r-i" winners, "Lr-i" losers, "GF", "GF2"). */
  results: Record<string, MatchResult>;
};

export type BracketData = {
  id: string;
  name: string;
  sport?: SportId; // absent = "other"
  /** Series length for series sports (best of 3, 5…). */
  bestOf?: number;
  format?: BracketFormat; // absent = "single" (pre-format brackets)
  groupStage?: GroupStage;
  /** All knockout brackets. Absent on pre-multi-bracket data — use
   *  normalize() to upgrade before reading. */
  knockouts?: Knockout[];
  /** Legacy single-bracket fields, kept so old saves still load. */
  slots?: (Participant | null)[];
  results?: Record<string, MatchResult>;
  createdAt: number;
  updatedAt: number;
};

/** Upgrade older saves (single `slots`/`results`) to the knockouts array.
 *  Safe to call repeatedly; call it wherever bracket data enters the app. */
export function normalize(data: BracketData): BracketData {
  if (data.knockouts?.length) return data;
  return {
    ...data,
    knockouts: [
      {
        id: "main",
        name: data.groupStage ? "Championship" : "Bracket",
        takeRanks: data.groupStage
          ? Array.from({ length: data.groupStage.advance }, (_, i) => i + 1)
          : undefined,
        slots: data.slots ?? [],
        results: data.results ?? {},
      },
    ],
  };
}

export function knockoutsOf(data: BracketData): Knockout[] {
  return normalize(data).knockouts!;
}

/** Replace one knockout by id, returning new bracket data. */
export function updateKnockout(
  data: BracketData,
  id: string,
  patch: Partial<Knockout>
): BracketData {
  const knockouts = knockoutsOf(data).map((k) =>
    k.id === id ? { ...k, ...patch } : k
  );
  return { ...data, knockouts, updatedAt: Date.now() };
}

/** A single knockout viewed as standalone bracket data, for the renderer. */
export function knockoutView(data: BracketData, k: Knockout): BracketData {
  return { ...data, slots: k.slots, results: k.results, knockouts: undefined };
}

export type Placement = "seeded" | "linear" | "random";

export const MIN_PARTICIPANTS = 3;
export const MAX_PARTICIPANTS = 128;

export function bracketFormat(data: BracketData): BracketFormat {
  return data.format === "double" ? "double" : "single";
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard bracket seeding order for a given size (power of two).
 * seedOrder(8) = [1, 8, 4, 5, 2, 7, 3, 6] — position i of the bracket
 * holds seed number seedOrder(size)[i].
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const m = order.length * 2 + 1;
    const next: number[] = [];
    for (const s of order) next.push(s, m - s);
    order = next;
  }
  return order;
}

/**
 * Arrange participants (in entry order) into round-1 slots.
 * - "seeded": entry #1 is the top seed, gets the classic 1-vs-lowest layout,
 *   byes go to the best entries.
 * - "linear": pairs are taken in entry order top to bottom; byes at the end.
 * - "random": shuffle, then seeded layout (so byes still spread out).
 */
export function buildSlots(
  participants: Participant[],
  placement: Placement
): (Participant | null)[] {
  const list = [...participants];
  if (placement === "random") {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  const size = nextPow2(Math.max(2, list.length));
  const slots: (Participant | null)[] = new Array(size).fill(null);
  if (placement === "linear") {
    for (let i = 0; i < list.length; i++) slots[i] = list[i];
  } else {
    const order = seedOrder(size);
    for (let i = 0; i < size; i++) {
      const seedNum = order[i];
      slots[i] = seedNum <= list.length ? list[seedNum - 1] : null;
    }
  }
  return slots;
}

export type Section = "w" | "l" | "gf";

export type Match = {
  section: Section;
  round: number;
  index: number;
  key: string;
  /** Display number like "W3", "L2", "GF" (double elimination only). */
  num?: string;
  p1: Participant | null;
  p2: Participant | null;
  /** Whether each side's feeder subtree contains any participant at all.
   *  A null entrant with alive=true is pending ("TBD"); dead is a bye. */
  p1Alive: boolean;
  p2Alive: boolean;
  /** Placeholder for a pending entrant, e.g. "Loser of W3". */
  p1From?: string;
  p2From?: string;
  result: MatchResult;
  /** True when the match resolves itself (walkover) and needs no input. */
  isBye: boolean;
  winner: Participant | null;
};

const EMPTY: MatchResult = { s1: null, s2: null, winner: null };

/** Return the stored result if it still applies to these entrants, else a
 *  voided copy that keeps only schedule info. */
function validResult(
  stored: MatchResult | undefined,
  p1: Participant | null,
  p2: Participant | null
): MatchResult {
  if (!stored) return EMPTY;
  if (stored.p1Id !== undefined || stored.p2Id !== undefined) {
    if (stored.p1Id !== p1?.id || stored.p2Id !== p2?.id)
      return {
        ...stored,
        s1: null,
        s2: null,
        winner: null,
        games: undefined,
        home: undefined,
      };
  }
  return stored;
}

function makeMatch(
  section: Section,
  round: number,
  index: number,
  key: string,
  p1: Participant | null,
  p2: Participant | null,
  p1Alive: boolean,
  p2Alive: boolean,
  results: Record<string, MatchResult>
): Match {
  const result = validResult(results[key], p1, p2);
  let winner: Participant | null = null;
  let isBye = false;
  if (p1 && !p2Alive) {
    winner = p1;
    isBye = true;
  } else if (p2 && !p1Alive) {
    winner = p2;
    isBye = true;
  } else if (p1 && p2 && result.winner) {
    winner = result.winner === 1 ? p1 : p2;
  }
  return {
    section,
    round,
    index,
    key,
    p1,
    p2,
    p1Alive,
    p2Alive,
    result,
    isBye,
    winner,
  };
}

export type ComputedBracket = {
  rounds: Match[][];
  size: number;
  champion: Participant | null;
};

/** Single elimination: expand slots + results into rounds. */
export function computeBracket(data: BracketData): ComputedBracket {
  const slots = data.slots ?? [];
  const size = slots.length;
  const numRounds = Math.log2(size);
  const rounds: Match[][] = [];
  let entrants: (Participant | null)[] = slots;
  let alive: boolean[] = slots.map((s) => s !== null);

  for (let r = 0; r < numRounds; r++) {
    const matches: Match[] = [];
    const nextEntrants: (Participant | null)[] = [];
    const nextAlive: boolean[] = [];
    for (let i = 0; i < entrants.length / 2; i++) {
      const m = makeMatch(
        "w",
        r,
        i,
        `${r}-${i}`,
        entrants[i * 2],
        entrants[i * 2 + 1],
        alive[i * 2],
        alive[i * 2 + 1],
        data.results ?? {}
      );
      matches.push(m);
      nextEntrants.push(m.winner);
      nextAlive.push(m.p1Alive || m.p2Alive);
    }
    rounds.push(matches);
    entrants = nextEntrants;
    alive = nextAlive;
  }

  return { rounds, size, champion: entrants[0] ?? null };
}

export type DoubleBracket = {
  wb: Match[][];
  lb: Match[][];
  gf: Match;
  /** Bracket reset match — present only once the losers champ wins the GF. */
  gf2: Match | null;
  size: number;
  champion: Participant | null;
};

/**
 * Double elimination. Winners bracket reuses single-elim keys ("r-i") so a
 * bracket can switch formats without losing recorded results. Losers rounds
 * alternate: even rounds pair losers-bracket survivors, odd ("drop-down")
 * rounds pit survivors against fresh losers from the winners bracket, with
 * alternating order to delay rematches.
 */
export function computeDouble(data: BracketData): DoubleBracket {
  const slots = data.slots ?? [];
  const size = slots.length;
  const k = Math.log2(size);

  // --- Winners bracket, also tracking each match's loser ---
  const wb: Match[][] = [];
  const wLoser: (Participant | null)[][] = [];
  const wLoserAlive: boolean[][] = [];
  const wNums: number[][] = [];
  let entrants: (Participant | null)[] = slots;
  let alive: boolean[] = slots.map((s) => s !== null);
  let num = 0;

  for (let r = 0; r < k; r++) {
    const matches: Match[] = [];
    const nE: (Participant | null)[] = [];
    const nA: boolean[] = [];
    const lE: (Participant | null)[] = [];
    const lA: boolean[] = [];
    const nums: number[] = [];
    for (let i = 0; i < entrants.length / 2; i++) {
      const m = makeMatch(
        "w",
        r,
        i,
        `${r}-${i}`,
        entrants[i * 2],
        entrants[i * 2 + 1],
        alive[i * 2],
        alive[i * 2 + 1],
        data.results ?? {}
      );
      m.num = `W${++num}`;
      nums.push(num);
      matches.push(m);
      nE.push(m.winner);
      nA.push(m.p1Alive || m.p2Alive);
      // A real loser only exists if both sides of the match are populated.
      lE.push(
        m.p1 && m.p2 && m.result.winner
          ? m.result.winner === 1
            ? m.p2
            : m.p1
          : null
      );
      lA.push(m.p1Alive && m.p2Alive);
    }
    wb.push(matches);
    wNums.push(nums);
    wLoser.push(lE);
    wLoserAlive.push(lA);
    entrants = nE;
    alive = nA;
  }
  const wbChamp = entrants[0] ?? null;
  const wbChampAlive = alive[0];

  // --- Losers bracket ---
  const lb: Match[][] = [];
  let prevW: (Participant | null)[] = [];
  let prevA: boolean[] = [];
  let lNum = 0;
  const lbRounds = 2 * (k - 1);

  for (let t = 0; t < lbRounds; t++) {
    const j = Math.floor(t / 2);
    const count = size / Math.pow(2, j + 2);
    const matches: Match[] = [];
    const nW: (Participant | null)[] = [];
    const nA2: boolean[] = [];
    for (let i = 0; i < count; i++) {
      let p1: Participant | null, p2: Participant | null;
      let a1: boolean, a2: boolean;
      let p1From: string | undefined, p2From: string | undefined;
      if (t === 0) {
        p1 = wLoser[0][i * 2];
        a1 = wLoserAlive[0][i * 2];
        p2 = wLoser[0][i * 2 + 1];
        a2 = wLoserAlive[0][i * 2 + 1];
        p1From = `Loser of W${wNums[0][i * 2]}`;
        p2From = `Loser of W${wNums[0][i * 2 + 1]}`;
      } else if (t % 2 === 1) {
        // Drop-down round: survivor vs loser of winners round j+1.
        const src = j % 2 === 0 ? count - 1 - i : i;
        p1 = prevW[i];
        a1 = prevA[i];
        p2 = wLoser[j + 1][src];
        a2 = wLoserAlive[j + 1][src];
        p2From = `Loser of W${wNums[j + 1][src]}`;
      } else {
        p1 = prevW[i * 2];
        a1 = prevA[i * 2];
        p2 = prevW[i * 2 + 1];
        a2 = prevA[i * 2 + 1];
      }
      const m = makeMatch("l", t, i, `L${t}-${i}`, p1, p2, a1, a2, data.results ?? {});
      m.num = `L${++lNum}`;
      m.p1From = p1From;
      m.p2From = p2From;
      matches.push(m);
      nW.push(m.winner);
      nA2.push(m.p1Alive || m.p2Alive);
    }
    lb.push(matches);
    prevW = nW;
    prevA = nA2;
  }
  const lbChamp = prevW[0] ?? null;
  const lbChampAlive = prevA[0] ?? false;

  // --- Grand final (+ reset if the losers champ takes it) ---
  const gf = makeMatch(
    "gf",
    0,
    0,
    "GF",
    wbChamp,
    lbChamp,
    wbChampAlive,
    lbChampAlive,
    data.results ?? {}
  );
  gf.num = "GF";

  let gf2: Match | null = null;
  let champion: Participant | null = null;
  if (gf.isBye) {
    champion = gf.winner;
  } else if (gf.result.winner === 1) {
    champion = gf.p1;
  } else if (gf.result.winner === 2) {
    gf2 = makeMatch(
      "gf",
      1,
      0,
      "GF2",
      gf.p1,
      gf.p2,
      true,
      true,
      data.results ?? {}
    );
    gf2.num = "GF2";
    champion = gf2.result.winner
      ? gf2.result.winner === 1
        ? gf2.p1
        : gf2.p2
      : null;
  }

  return { wb, lb, gf, gf2, size, champion };
}

export function bracketChampion(data: BracketData): Participant | null {
  return bracketFormat(data) === "double"
    ? computeDouble(data).champion
    : computeBracket(data).champion;
}

/**
 * Record a match result. Stores the entrant ids so the result voids itself
 * automatically if the matchup later changes. For legacy single-elim results
 * saved without ids, also clears scores along the winners path.
 */
export function setResult(
  data: BracketData,
  match: Match,
  result: MatchResult
): BracketData {
  const results = { ...(data.results ?? {}) };
  const prev = results[match.key];
  results[match.key] = {
    ...result,
    p1Id: match.p1?.id,
    p2Id: match.p2?.id,
  };
  if (
    bracketFormat(data) === "single" &&
    match.section === "w" &&
    prev &&
    prev.winner &&
    prev.winner !== result.winner
  ) {
    let r = match.round + 1;
    let i = Math.floor(match.index / 2);
    const numRounds = Math.log2((data.slots ?? []).length);
    while (r < numRounds) {
      const key = `${r}-${i}`;
      const old = results[key];
      if (old && old.p1Id === undefined && old.p2Id === undefined)
        results[key] = { ...old, s1: null, s2: null, winner: null };
      i = Math.floor(i / 2);
      r++;
    }
  }
  return { ...data, results, updatedAt: Date.now() };
}

/** Strip scores/winners but keep schedule info (location/date/time), which
 *  belongs to the match slot rather than to who plays in it. */
export function clearScoresKeepSchedules(
  results: Record<string, MatchResult>
): Record<string, MatchResult> {
  const out: Record<string, MatchResult> = {};
  for (const [key, r] of Object.entries(results)) {
    if (r.location || r.date || r.time)
      out[key] = {
        ...r,
        s1: null,
        s2: null,
        winner: null,
        games: undefined,
        home: undefined,
        p1Id: undefined,
        p2Id: undefined,
      };
  }
  return out;
}

/** Swap two round-1 slots (either may be a bye). Clears scores, since
 *  matchups change. */
export function swapSlots(
  data: BracketData,
  a: number,
  b: number
): BracketData {
  const slots = [...(data.slots ?? [])];
  [slots[a], slots[b]] = [slots[b], slots[a]];
  return {
    ...data,
    slots,
    results: clearScoresKeepSchedules(data.results ?? {}),
    updatedAt: Date.now(),
  };
}

/** Natural comparison of seed labels: "2" < "10", "E4" < "E12", ties stable. */
export function compareSeeds(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Re-arrange the existing participants into fresh slots.
 * - "seeded": order participants by their seed label (natural sort), then
 *   classic 1-vs-lowest placement with byes at the top seeds.
 * - "random": random draw into the seeded layout.
 * Clears scores, since matchups change.
 */
export function rearrange(
  data: BracketData,
  mode: "seeded" | "random"
): BracketData {
  const participants = (data.slots ?? []).filter(
    (s): s is Participant => s !== null
  );
  if (mode === "seeded")
    participants.sort((a, b) => compareSeeds(a.seed, b.seed));
  return {
    ...data,
    slots: buildSlots(participants, mode),
    results: clearScoresKeepSchedules(data.results ?? {}),
    updatedAt: Date.now(),
  };
}

function anyRecorded(results: Record<string, MatchResult>): boolean {
  return Object.values(results).some(
    (r) => r.winner !== null || r.s1 !== null || r.s2 !== null
  );
}

/** True if any knockout match has a score or winner recorded (schedule info
 *  and group results ignored). */
export function hasProgress(data: BracketData): boolean {
  if (data.results && anyRecorded(data.results)) return true;
  return (data.knockouts ?? []).some((k) => anyRecorded(k.results));
}

export function roundName(round: number, numRounds: number): string {
  const fromEnd = numRounds - round;
  if (fromEnd === 1) return "Final";
  if (fromEnd === 2) return "Semifinals";
  if (fromEnd === 3) return "Quarterfinals";
  return `Round ${round + 1}`;
}

export function participantCount(data: BracketData): number {
  if (data.groupStage)
    return data.groupStage.groups.reduce((n, g) => n + g.length, 0);
  const slots = data.slots?.length
    ? data.slots
    : (data.knockouts?.[0]?.slots ?? []);
  return slots.filter(Boolean).length;
}

/* ---------------- Group stage ---------------- */

export const MAX_GROUP_SIZE = 8;
export const MAX_GROUPS = 16;

export function groupLetter(i: number): string {
  return String.fromCharCode(65 + i);
}

/** Snake-distribute participants (in entry order) across groups so strength
 *  spreads evenly: A,B,C,C,B,A,... */
export function distributeGroups(
  participants: Participant[],
  count: number
): Participant[][] {
  const groups: Participant[][] = Array.from({ length: count }, () => []);
  participants.forEach((p, i) => {
    const lap = Math.floor(i / count);
    const pos = i % count;
    groups[lap % 2 === 0 ? pos : count - 1 - pos].push(p);
  });
  return groups;
}

/** Round-robin schedule (circle method): rounds of [i, j] member-index pairs,
 *  i < j. */
export function roundRobinRounds(n: number): [number, number][][] {
  if (n < 2) return [];
  const teams = [...Array(n).keys()];
  if (n % 2 === 1) teams.push(-1);
  const m = teams.length;
  const rounds: [number, number][][] = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < m / 2; i++) {
      const a = teams[i];
      const b = teams[m - 1 - i];
      if (a !== -1 && b !== -1) pairs.push(a < b ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    teams.splice(1, 0, teams.pop()!);
  }
  return rounds;
}

export function groupMatchKey(gi: number, i: number, j: number): string {
  return `g${gi}-${i}-${j}`;
}

export type StandingRow = {
  p: Participant;
  index: number;
  played: number;
  /** Matches won / lost. */
  w: number;
  l: number;
  /** Sets (or games) won / lost within those matches. */
  setsW: number;
  setsL: number;
  /** Points for / against, totalled across every set played. */
  pf: number;
  pa: number;
};

/**
 * Standings for one group. Ranked by matches won, then set differential,
 * then point differential, then points scored, then listed order. Deeper
 * tiebreakers are what the manual finishing order is for.
 */
export function groupStandings(stage: GroupStage, gi: number): StandingRow[] {
  const group = stage.groups[gi];
  const rows: StandingRow[] = group.map((p, index) => ({
    p,
    index,
    played: 0,
    w: 0,
    l: 0,
    setsW: 0,
    setsL: 0,
    pf: 0,
    pa: 0,
  }));
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const r = stage.results[groupMatchKey(gi, i, j)];
      if (!r || !r.winner) continue;
      rows[i].played++;
      rows[j].played++;

      if (r.games && r.games.length) {
        // Series: s1/s2 are sets won; points come from the set scores.
        for (const g of r.games) {
          if (g.a === null || g.b === null) continue;
          rows[i].pf += g.a;
          rows[i].pa += g.b;
          rows[j].pf += g.b;
          rows[j].pa += g.a;
          if (g.a > g.b) {
            rows[i].setsW++;
            rows[j].setsL++;
          } else if (g.b > g.a) {
            rows[j].setsW++;
            rows[i].setsL++;
          }
        }
      } else if (r.s1 !== null && r.s2 !== null) {
        // Single score: the match itself counts as one "set".
        rows[i].pf += r.s1;
        rows[i].pa += r.s2;
        rows[j].pf += r.s2;
        rows[j].pa += r.s1;
        if (r.winner === 1) {
          rows[i].setsW++;
          rows[j].setsL++;
        } else {
          rows[j].setsW++;
          rows[i].setsL++;
        }
      }

      if (r.winner === 1) {
        rows[i].w++;
        rows[j].l++;
      } else {
        rows[j].w++;
        rows[i].l++;
      }
    }
  }
  return [...rows].sort(
    (a, b) =>
      b.w - a.w ||
      b.setsW - b.setsL - (a.setsW - a.setsL) ||
      b.pf - b.pa - (a.pf - a.pa) ||
      b.pf - a.pf ||
      a.index - b.index
  );
}

/**
 * Full finishing order of a group: any manually pinned teams first (in the
 * order they were picked), then everyone else in standings order.
 */
export function groupRanking(stage: GroupStage, gi: number): Participant[] {
  const standings = groupStandings(stage, gi).map((r) => r.p);
  const override = stage.overrides[String(gi)];
  if (!override || override.length === 0) return standings;
  const byId = new Map(stage.groups[gi].map((p) => [p.id, p]));
  const picked = override
    .map((id) => byId.get(id))
    .filter((p): p is Participant => !!p);
  const rest = standings.filter((p) => !picked.some((q) => q.id === p.id));
  return [...picked, ...rest];
}

/** Who advances from a group into the default (first) bracket. */
export function groupQualifiers(stage: GroupStage, gi: number): Participant[] {
  return groupRanking(stage, gi).slice(0, stage.advance);
}

/* ---- Moving teams between groups ---- */

/** Mirror a result so it reads from the other team's point of view. */
function flipResult(r: MatchResult): MatchResult {
  return {
    ...r,
    s1: r.s2,
    s2: r.s1,
    winner: r.winner === 1 ? 2 : r.winner === 2 ? 1 : null,
    games: r.games?.map((g) => ({ a: g.b, b: g.a })),
    p1Id: r.p2Id,
    p2Id: r.p1Id,
  };
}

/**
 * Results are keyed by position within a group, so any change to group
 * membership has to re-key them. We snapshot every played match by the pair
 * of teams in it, then rebuild the keys from the new line-ups — flipping a
 * result if the pair's order changed. Matches whose pairing no longer exists
 * (the two teams are no longer in a group together) are dropped.
 */
function resultsByPair(
  stage: GroupStage
): Map<string, { aId: string; r: MatchResult }> {
  const map = new Map<string, { aId: string; r: MatchResult }>();
  stage.groups.forEach((g, gi) => {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        const r = stage.results[groupMatchKey(gi, i, j)];
        if (!r) continue;
        const key = [g[i].id, g[j].id].sort().join("|");
        map.set(key, { aId: g[i].id, r });
      }
    }
  });
  return map;
}

function rebuildResults(
  groups: Participant[][],
  map: Map<string, { aId: string; r: MatchResult }>
): Record<string, MatchResult> {
  const out: Record<string, MatchResult> = {};
  groups.forEach((g, gi) => {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        const hit = map.get([g[i].id, g[j].id].sort().join("|"));
        if (!hit) continue;
        out[groupMatchKey(gi, i, j)] =
          hit.aId === g[i].id ? hit.r : flipResult(hit.r);
      }
    }
  });
  return out;
}

/** How many recorded matches a team would lose by leaving its group. */
export function playedAgainstGroup(
  stage: GroupStage,
  teamId: string
): number {
  let n = 0;
  stage.groups.forEach((g, gi) => {
    const idx = g.findIndex((p) => p.id === teamId);
    if (idx < 0) return;
    for (let k = 0; k < g.length; k++) {
      if (k === idx) continue;
      const [i, j] = idx < k ? [idx, k] : [k, idx];
      const r = stage.results[groupMatchKey(gi, i, j)];
      if (r?.winner) n++;
    }
  });
  return n;
}

/**
 * Move a team into another group (optionally at a given position).
 * Results between teams still grouped together are preserved; games against
 * the old group-mates are dropped, since those matches no longer exist.
 * Returns null if the move would leave a group with fewer than two teams.
 */
export function moveTeamToGroup(
  stage: GroupStage,
  teamId: string,
  toGroup: number,
  toIndex?: number
): GroupStage | null {
  const fromGroup = stage.groups.findIndex((g) =>
    g.some((p) => p.id === teamId)
  );
  if (fromGroup < 0 || !stage.groups[toGroup]) return null;
  if (fromGroup === toGroup) return stage;
  if (stage.groups[fromGroup].length <= 2) return null;
  if (stage.groups[toGroup].length >= MAX_GROUP_SIZE) return null;

  const snapshot = resultsByPair(stage);
  const team = stage.groups[fromGroup].find((p) => p.id === teamId)!;
  const groups = stage.groups.map((g, gi) =>
    gi === fromGroup ? g.filter((p) => p.id !== teamId) : [...g]
  );
  const at =
    toIndex === undefined
      ? groups[toGroup].length
      : Math.max(0, Math.min(toIndex, groups[toGroup].length));
  groups[toGroup].splice(at, 0, team);

  // Drop the moved team from any manual finishing order it no longer belongs to.
  const overrides: Record<string, string[]> = {};
  for (const [key, ids] of Object.entries(stage.overrides)) {
    const gi = Number(key);
    const members = new Set((groups[gi] ?? []).map((p) => p.id));
    const kept = ids.filter((id) => members.has(id));
    if (kept.length) overrides[key] = kept;
  }

  return {
    ...stage,
    groups,
    results: rebuildResults(groups, snapshot),
    overrides,
  };
}

/** A qualifier slot that's still a placeholder (A1, B2…) rather than a team. */
export function isPlaceholder(p: Participant): boolean {
  return /^q\d+-\d+$/.test(p.id);
}

/** True once a bracket holds real teams rather than group placeholders. */
export function bracketFilled(k: Knockout): boolean {
  return k.slots.some((s) => s && !isPlaceholder(s));
}

/** Order qualifiers rank-major (all winners, then all runners-up, …) so the
 *  seeded 1-vs-lowest placement pairs group winners with runners-up from
 *  other groups (A1 vs B2, B1 vs A2). Odd group counts rotate later ranks to
 *  avoid same-group first-round rematches. */
function orderQualifiers<T>(perGroup: T[][], advance: number): T[] {
  const G = perGroup.length;
  const out: T[] = [];
  for (let r = 0; r < advance; r++) {
    const rot = G % 2 === 1 ? r % G : 0;
    for (let g = 0; g < G; g++) out.push(perGroup[(g + rot) % G][r]);
  }
  return out;
}

/** Placeholder entries (A1, B2, …) for a bracket that hasn't been filled
 *  from the group standings yet. `ranks` are 1-based finishing places. */
export function qualifierPlaceholders(
  groupCount: number,
  ranks: number[]
): Participant[] {
  const perGroup = Array.from({ length: groupCount }, (_, g) =>
    ranks.map((r) => ({
      id: `q${g}-${r}`,
      name: `${groupLetter(g)}${r}`,
      seed: `${groupLetter(g)}${r}`,
    }))
  );
  return orderQualifiers(perGroup, ranks.length);
}

/** The places a bracket takes from each group, defaulting to the group
 *  stage's top N for brackets that don't say. */
export function ranksOf(k: Knockout, stage?: GroupStage): number[] {
  if (k.takeRanks?.length) return k.takeRanks;
  if (!stage) return [];
  return Array.from({ length: stage.advance }, (_, i) => i + 1);
}

/** Which bracket (if any) a given finishing place feeds into. */
export function bracketForRank(
  data: BracketData,
  rank: number
): Knockout | null {
  const stage = data.groupStage;
  if (!stage) return null;
  for (const k of knockoutsOf(data)) {
    if (ranksOf(k, stage).includes(rank)) return k;
  }
  return null;
}

/**
 * Rebuild every knockout's slots from the current group finishing orders.
 * Knockout scores are cleared (schedules kept); group results untouched.
 */
export function fillBrackets(data: BracketData): BracketData {
  const stage = data.groupStage;
  if (!stage) return data;
  const rankings = stage.groups.map((_, gi) => groupRanking(stage, gi));

  const knockouts = knockoutsOf(data).map((k) => {
    const ranks = ranksOf(k, stage);
    const perGroup = rankings.map((ranked) =>
      ranks.map((r) => ranked[r - 1]).filter((p): p is Participant => !!p)
    );
    // Groups can differ in size, so a place may not exist everywhere.
    const depth = Math.max(0, ...perGroup.map((g) => g.length));
    const ordered = orderQualifiers(
      perGroup.map((g) => g.concat(Array(depth - g.length).fill(undefined))),
      depth
    ).filter((p): p is Participant => !!p);
    if (ordered.length < 2) return k;
    return {
      ...k,
      slots: buildSlots(
        ordered.map((p, i) => ({ ...p, seed: p.seed || String(i + 1) })),
        "seeded"
      ),
      results: clearScoresKeepSchedules(k.results),
    };
  });

  return { ...data, knockouts, updatedAt: Date.now() };
}

export function newId(prefix = ""): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 10; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return prefix + s;
}

/* ---------------- Following a team ---------------- */

/** Every real team in the tournament, de-duplicated (placeholders excluded). */
export function allParticipants(data: BracketData): Participant[] {
  const seen = new Map<string, Participant>();
  for (const g of data.groupStage?.groups ?? [])
    for (const p of g) seen.set(p.id, p);
  for (const k of knockoutsOf(data))
    for (const s of k.slots)
      if (s && !isPlaceholder(s)) seen.set(s.id, s);
  return [...seen.values()];
}

export function findParticipant(
  data: BracketData,
  teamId: string
): Participant | null {
  return allParticipants(data).find((p) => p.id === teamId) ?? null;
}

/** Every match in one knockout, whatever the format. */
function knockoutMatches(view: BracketData): Match[] {
  if (bracketFormat(view) === "double") {
    const d = computeDouble(view);
    return [...d.wb.flat(), ...d.lb.flat(), d.gf, ...(d.gf2 ? [d.gf2] : [])];
  }
  return computeBracket(view).rounds.flat();
}

function matchLabel(m: Match, totalRounds: number): string {
  if (m.section === "gf") return m.round === 1 ? "Bracket reset" : "Grand final";
  if (m.section === "l") return `Losers round ${m.round + 1}`;
  return roundName(m.round, totalRounds);
}

export type FollowState =
  | "group"
  | "playing"
  | "waiting"
  | "eliminated"
  | "champion";

export type FollowStatus = {
  state: FollowState;
  /** One short line: "Gold · Semifinals", "Group A · 2nd". */
  label: string;
};

/**
 * Where a team currently stands — the group position before the brackets
 * are filled, then their live round, and finally how they finished.
 */
export function followStatus(
  data: BracketData,
  teamId: string
): FollowStatus | null {
  const team = findParticipant(data, teamId);
  if (!team) return null;

  const knockouts = knockoutsOf(data);
  // With a single unnamed bracket its name adds nothing ("Bracket · Final").
  const named = knockouts.length > 1;
  for (const k of knockouts) {
    const view = knockoutView(data, k);
    const matches = knockoutMatches(view);
    const appearances = matches.filter(
      (m) => m.p1?.id === teamId || m.p2?.id === teamId
    );
    if (appearances.length === 0) continue;

    const totalRounds = Math.max(
      1,
      Math.log2(Math.max(2, (view.slots ?? []).length))
    );
    const champion = bracketChampion(view);
    if (champion?.id === teamId)
      return {
        state: "champion",
        label: named ? `Won ${k.name}` : "Champion",
      };

    const live = appearances.find((m) => !m.winner);
    if (live) {
      const round = matchLabel(live, totalRounds);
      return {
        state: "playing",
        label: named ? `${k.name} · ${round}` : round,
      };
    }

    const lost = appearances
      .filter((m) => m.winner && m.winner.id !== teamId)
      .sort((a, b) => b.round - a.round)[0];
    if (lost) {
      const round = matchLabel(lost, totalRounds);
      return {
        state: "eliminated",
        label: named ? `Out · ${k.name}, ${round}` : `Out · ${round}`,
      };
    }

    return {
      state: "waiting",
      label: named ? `${k.name} · advancing` : "Advancing",
    };
  }

  const stage = data.groupStage;
  if (stage) {
    const gi = stage.groups.findIndex((g) => g.some((p) => p.id === teamId));
    if (gi >= 0) {
      const rank = groupRanking(stage, gi).findIndex((p) => p.id === teamId) + 1;
      return {
        state: "group",
        label: `Group ${groupLetter(gi)} · ${ordinal(rank)}`,
      };
    }
  }
  return null;
}

export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/* ---------------- Schedules ---------------- */

/** True once a match has any schedule detail recorded. */
export function hasSchedule(r: MatchResult): boolean {
  return !!(r.location || r.date || r.time);
}

/**
 * A match's schedule in one short line: "Fri, 10/2 @ 4:30 pm · Court 4".
 * Only the parts that were actually entered appear.
 */
export function formatSchedule(r: MatchResult): string {
  let day = "";
  if (r.date) {
    // Parse as local time — "2026-10-02" alone is treated as UTC and can
    // slip to the previous day in western time zones.
    const d = new Date(r.date + "T00:00");
    if (!isNaN(d.getTime())) {
      const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
      const md = d.toLocaleDateString(undefined, {
        month: "numeric",
        day: "numeric",
      });
      day = `${weekday}, ${md}`;
    }
  }

  let time = "";
  if (r.time) {
    const t = new Date("2000-01-01T" + r.time);
    time = isNaN(t.getTime())
      ? r.time
      : t
          .toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
          // "4:30 PM" reads better lowercase next to the date.
          .replace(/\s*([AP]M)$/i, (_, m) => ` ${m.toLowerCase()}`);
  }

  const when = day && time ? `${day} @ ${time}` : day || time;
  return [when, r.location].filter(Boolean).join(" · ");
}
