// Core single-elimination bracket model shared by client and server.

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
};

export type BracketData = {
  id: string;
  name: string;
  /** Slot layout for round 1, length = bracket size (power of two). null = bye. */
  slots: (Participant | null)[];
  /** Results keyed by "round-index" (0-based). */
  results: Record<string, MatchResult>;
  createdAt: number;
  updatedAt: number;
};

export type Placement = "seeded" | "linear" | "random";

export const MIN_PARTICIPANTS = 3;
export const MAX_PARTICIPANTS = 128;

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

export type Match = {
  round: number;
  index: number;
  key: string;
  p1: Participant | null;
  p2: Participant | null;
  /** Whether each side's feeder subtree contains any participant at all.
   *  A null entrant with alive=true is "TBD"; with alive=false it's a bye. */
  p1Alive: boolean;
  p2Alive: boolean;
  result: MatchResult;
  /** True when the match resolves itself (bye) and needs no input. */
  isBye: boolean;
  winner: Participant | null;
};

export type ComputedBracket = {
  rounds: Match[][];
  size: number;
  champion: Participant | null;
};

const EMPTY: MatchResult = { s1: null, s2: null, winner: null };

/**
 * Expand slots + results into full rounds with entrants propagated forward.
 * Byes auto-advance.
 */
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
      const p1 = entrants[i * 2];
      const p2 = entrants[i * 2 + 1];
      const p1Alive = alive[i * 2];
      const p2Alive = alive[i * 2 + 1];
      const key = `${r}-${i}`;
      const result = data.results[key] ?? EMPTY;
      let winner: Participant | null = null;
      let isBye = false;
      if (p1 && !p2Alive) {
        // Opponent's side of the draw is empty — walkover.
        winner = p1;
        isBye = true;
      } else if (p2 && !p1Alive) {
        winner = p2;
        isBye = true;
      } else if (p1 && p2 && result.winner) {
        winner = result.winner === 1 ? p1 : p2;
      }
      matches.push({
        round: r,
        index: i,
        key,
        p1,
        p2,
        p1Alive,
        p2Alive,
        result,
        isBye,
        winner,
      });
      nextEntrants.push(winner);
      nextAlive.push(p1Alive || p2Alive);
    }
    rounds.push(matches);
    entrants = nextEntrants;
    alive = nextAlive;
  }

  return { rounds, size, champion: entrants[0] ?? null };
}

/**
 * Set a match result, clearing any downstream results that depended on the
 * previous winner of this match.
 */
export function applyResult(
  data: BracketData,
  round: number,
  index: number,
  result: MatchResult
): BracketData {
  const results = { ...data.results };
  const prev = results[`${round}-${index}`];
  results[`${round}-${index}`] = result;
  if (prev && prev.winner && prev.winner !== result.winner) {
    // Winner changed: wipe the path forward.
    let r = round + 1;
    let i = Math.floor(index / 2);
    const numRounds = Math.log2(data.slots.length);
    while (r < numRounds) {
      delete results[`${r}-${i}`];
      i = Math.floor(i / 2);
      r++;
    }
  }
  return { ...data, results, updatedAt: Date.now() };
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
