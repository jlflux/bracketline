// Core bracket model shared by client and server.
// Supports single elimination and double elimination (winners/losers
// brackets + grand final with reset).

export type Participant = {
  id: string;
  name: string;
  /** Custom seed label — free text like "1", "E4", "R3-2". */
  seed: string;
};

export type MatchResult = {
  s1: number | null;
  s2: number | null;
  /** 1 = top slot won, 2 = bottom slot won */
  winner: 1 | 2 | null;
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

export type BracketFormat = "single" | "double";

export type BracketData = {
  id: string;
  name: string;
  format?: BracketFormat; // absent = "single" (pre-format brackets)
  /** Slot layout for round 1, length = bracket size (power of two). null = bye. */
  slots: (Participant | null)[];
  /** Results keyed by match key ("r-i" winners, "Lr-i" losers, "GF", "GF2"). */
  results: Record<string, MatchResult>;
  createdAt: number;
  updatedAt: number;
};

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
      return { ...stored, s1: null, s2: null, winner: null };
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
  const size = data.slots.length;
  const numRounds = Math.log2(size);
  const rounds: Match[][] = [];
  let entrants: (Participant | null)[] = data.slots;
  let alive: boolean[] = data.slots.map((s) => s !== null);

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
        data.results
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
  const size = data.slots.length;
  const k = Math.log2(size);

  // --- Winners bracket, also tracking each match's loser ---
  const wb: Match[][] = [];
  const wLoser: (Participant | null)[][] = [];
  const wLoserAlive: boolean[][] = [];
  const wNums: number[][] = [];
  let entrants: (Participant | null)[] = data.slots;
  let alive: boolean[] = data.slots.map((s) => s !== null);
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
        data.results
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
      const m = makeMatch("l", t, i, `L${t}-${i}`, p1, p2, a1, a2, data.results);
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
    data.results
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
      data.results
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
  const results = { ...data.results };
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
    const numRounds = Math.log2(data.slots.length);
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
function clearScores(
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
  const slots = [...data.slots];
  [slots[a], slots[b]] = [slots[b], slots[a]];
  return {
    ...data,
    slots,
    results: clearScores(data.results),
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
  const participants = data.slots.filter(
    (s): s is Participant => s !== null
  );
  if (mode === "seeded")
    participants.sort((a, b) => compareSeeds(a.seed, b.seed));
  return {
    ...data,
    slots: buildSlots(participants, mode),
    results: clearScores(data.results),
    updatedAt: Date.now(),
  };
}

/** True if any match has a score or winner recorded (schedule info ignored). */
export function hasProgress(data: BracketData): boolean {
  return Object.values(data.results).some(
    (r) => r.winner !== null || r.s1 !== null || r.s2 !== null
  );
}

export function roundName(round: number, numRounds: number): string {
  const fromEnd = numRounds - round;
  if (fromEnd === 1) return "Final";
  if (fromEnd === 2) return "Semifinals";
  if (fromEnd === 3) return "Quarterfinals";
  return `Round ${round + 1}`;
}

export function participantCount(data: BracketData): number {
  return data.slots.filter(Boolean).length;
}

export function newId(prefix = ""): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 10; i++)
    s += chars[Math.floor(Math.random() * chars.length)];
  return prefix + s;
}
