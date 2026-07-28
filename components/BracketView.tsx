"use client";

import { useMemo, useState } from "react";
import {
  BracketData,
  Match,
  MatchResult,
  Participant,
  bracketFormat,
  computeBracket,
  computeDouble,
  roundName,
  setResult,
} from "@/lib/bracket";

const CARD_W = 220;
const CARD_H = 71;
const INFO_H = 24;
const V_GAP = 18;
const COL_GAP = 46;
const LABEL_H = 36;
const SECTION_GAP = 64;

type Props = {
  data: BracketData;
  editable: boolean;
  onChange?: (next: BracketData) => void;
  /** When true, round-1 players can be dragged (or tapped in pairs) to swap
   *  bracket positions; result editing is disabled. */
  seedEdit?: boolean;
  onSwap?: (slotA: number, slotB: number) => void;
  /** When true (customize mode), clicking a matchup edits the teams in it
   *  (seed + name) instead of the result. */
  teamEdit?: boolean;
};

type Item = { match: Match; x: number; top: number; h: number };
type Label = { text: string; x: number; y: number };
type Edge = { x1: number; y1: number; x2: number; y2: number };
type Layout = {
  items: Item[];
  labels: Label[];
  edges: Edge[];
  width: number;
  height: number;
};

function hasSchedule(r: MatchResult): boolean {
  return !!(r.location || r.date || r.time);
}

function cardH(m: Match): number {
  return CARD_H + (hasSchedule(m.result) ? INFO_H : 0);
}

function colX(c: number): number {
  return c * (CARD_W + COL_GAP);
}

/** Stack round 0 downward, center later rounds between their feeders. */
function stackCenters(rounds: Match[][], topY: number): {
  centers: number[][];
  bottom: number;
} {
  const centers: number[][] = [];
  let y = topY;
  centers.push([]);
  for (const m of rounds[0]) {
    centers[0].push(y + cardH(m) / 2);
    y += cardH(m) + V_GAP;
  }
  let bottom = y - V_GAP;
  for (let r = 1; r < rounds.length; r++) {
    centers.push([]);
    for (let i = 0; i < rounds[r].length; i++) {
      const c = (centers[r - 1][i * 2] + centers[r - 1][i * 2 + 1]) / 2;
      centers[r].push(c);
      bottom = Math.max(bottom, c + cardH(rounds[r][i]) / 2);
    }
  }
  return { centers, bottom };
}

function layoutSingle(data: BracketData): Layout {
  const { rounds } = computeBracket(data);
  const numRounds = rounds.length;
  const { centers, bottom } = stackCenters(rounds, LABEL_H);

  const items: Item[] = [];
  const labels: Label[] = [];
  const edges: Edge[] = [];

  for (let r = 0; r < numRounds; r++) {
    labels.push({ text: roundName(r, numRounds), x: colX(r), y: 0 });
    for (let i = 0; i < rounds[r].length; i++) {
      const m = rounds[r][i];
      items.push({ match: m, x: colX(r), top: centers[r][i] - cardH(m) / 2, h: cardH(m) });
      if (r > 0) {
        for (const child of [i * 2, i * 2 + 1]) {
          edges.push({
            x1: colX(r - 1) + CARD_W,
            y1: centers[r - 1][child],
            x2: colX(r),
            y2: centers[r][i],
          });
        }
      }
    }
  }

  return {
    items,
    labels,
    edges,
    width: colX(numRounds - 1) + CARD_W,
    height: bottom + 4,
  };
}

function layoutDouble(data: BracketData): Layout {
  const { wb, lb, gf, gf2 } = computeDouble(data);
  const k = wb.length;
  const wCol = (r: number) => (r === 0 ? 0 : 2 * r - 1);

  const items: Item[] = [];
  const labels: Label[] = [];
  const edges: Edge[] = [];

  // Winners bracket
  labels.push({ text: "Winners bracket", x: 0, y: 0 });
  const w = stackCenters(wb, LABEL_H + 26);
  for (let r = 0; r < k; r++) {
    labels.push({
      text: k > 1 && r === k - 1 ? "Winners final" : `Round ${r + 1}`,
      x: colX(wCol(r)),
      y: 26,
    });
    for (let i = 0; i < wb[r].length; i++) {
      const m = wb[r][i];
      items.push({
        match: m,
        x: colX(wCol(r)),
        top: w.centers[r][i] - cardH(m) / 2,
        h: cardH(m),
      });
      if (r > 0) {
        for (const child of [i * 2, i * 2 + 1]) {
          edges.push({
            x1: colX(wCol(r - 1)) + CARD_W,
            y1: w.centers[r - 1][child],
            x2: colX(wCol(r)),
            y2: w.centers[r][i],
          });
        }
      }
    }
  }

  // Losers bracket, below
  const lbLabelY = w.bottom + SECTION_GAP - 26;
  labels.push({ text: "Losers bracket", x: 0, y: lbLabelY - 26 });
  const lbRounds = lb.length;
  const l = stackCenters(
    // stackCenters expects feeder pairing; losers rounds alternate 1:1 and
    // 2:1, so compute centers manually below instead.
    [lb[0]],
    lbLabelY + 26
  );
  const lCenters: number[][] = [l.centers[0]];
  let lBottom = l.bottom;
  for (let t = 1; t < lbRounds; t++) {
    lCenters.push([]);
    for (let i = 0; i < lb[t].length; i++) {
      const c =
        t % 2 === 1
          ? lCenters[t - 1][i] // drop-down round: aligned with its feeder
          : (lCenters[t - 1][i * 2] + lCenters[t - 1][i * 2 + 1]) / 2;
      lCenters[t].push(c);
      lBottom = Math.max(lBottom, c + cardH(lb[t][i]) / 2);
    }
  }
  for (let t = 0; t < lbRounds; t++) {
    labels.push({
      text: t === lbRounds - 1 ? "Losers final" : `Losers rd ${t + 1}`,
      x: colX(t),
      y: lbLabelY,
    });
    for (let i = 0; i < lb[t].length; i++) {
      const m = lb[t][i];
      items.push({
        match: m,
        x: colX(t),
        top: lCenters[t][i] - cardH(m) / 2,
        h: cardH(m),
      });
      if (t % 2 === 1) {
        edges.push({
          x1: colX(t - 1) + CARD_W,
          y1: lCenters[t - 1][i],
          x2: colX(t),
          y2: lCenters[t][i],
        });
      } else if (t > 0) {
        for (const child of [i * 2, i * 2 + 1]) {
          edges.push({
            x1: colX(t - 1) + CARD_W,
            y1: lCenters[t - 1][child],
            x2: colX(t),
            y2: lCenters[t][i],
          });
        }
      }
    }
  }

  // Grand final column(s)
  const wbFinalCenter = w.centers[k - 1][0];
  const lbFinalCenter = lCenters[lbRounds - 1][0];
  const gfCol = Math.max(wCol(k - 1), lbRounds - 1) + 1;
  const gfCenter = (wbFinalCenter + lbFinalCenter) / 2;
  labels.push({ text: "Grand final", x: colX(gfCol), y: gfCenter - cardH(gf) / 2 - 26 });
  items.push({
    match: gf,
    x: colX(gfCol),
    top: gfCenter - cardH(gf) / 2,
    h: cardH(gf),
  });
  edges.push({
    x1: colX(wCol(k - 1)) + CARD_W,
    y1: wbFinalCenter,
    x2: colX(gfCol),
    y2: gfCenter,
  });
  edges.push({
    x1: colX(lbRounds - 1) + CARD_W,
    y1: lbFinalCenter,
    x2: colX(gfCol),
    y2: gfCenter,
  });

  let lastCol = gfCol;
  if (gf2) {
    lastCol = gfCol + 1;
    labels.push({
      text: "Reset — winner takes all",
      x: colX(lastCol),
      y: gfCenter - cardH(gf2) / 2 - 26,
    });
    items.push({
      match: gf2,
      x: colX(lastCol),
      top: gfCenter - cardH(gf2) / 2,
      h: cardH(gf2),
    });
    edges.push({
      x1: colX(gfCol) + CARD_W,
      y1: gfCenter,
      x2: colX(lastCol),
      y2: gfCenter,
    });
  }

  return {
    items,
    labels,
    edges,
    width: colX(lastCol) + CARD_W,
    height: Math.max(lBottom, gfCenter + cardH(gf) / 2) + 4,
  };
}

export default function BracketView({
  data,
  editable,
  onChange,
  seedEdit = false,
  onSwap,
  teamEdit = false,
}: Props) {
  const [editing, setEditing] = useState<Match | null>(null);
  const [teamEditing, setTeamEditing] = useState<Match | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [dragSlot, setDragSlot] = useState<number | null>(null);

  const layout = useMemo(
    () =>
      bracketFormat(data) === "double"
        ? layoutDouble(data)
        : layoutSingle(data),
    [data]
  );

  function saveResult(match: Match, result: MatchResult) {
    onChange?.(setResult(data, match, result));
    setEditing(null);
  }

  function saveTeams(edited: Participant[]) {
    const byId = new Map(edited.map((p) => [p.id, p]));
    const slots = data.slots.map((s) => (s && byId.get(s.id)) || s);
    onChange?.({ ...data, slots, updatedAt: Date.now() });
    setTeamEditing(null);
  }

  function trySwap(a: number, b: number) {
    setSelectedSlot(null);
    setDragSlot(null);
    if (a !== b) onSwap?.(a, b);
  }

  function slotTap(index: number) {
    if (selectedSlot === null) setSelectedSlot(index);
    else trySwap(selectedSlot, index);
  }

  return (
    <div className="bracket-scroller">
      <div
        className="bracket-canvas"
        style={{ width: layout.width, height: layout.height }}
      >
        <svg
          width={layout.width}
          height={layout.height}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          {layout.edges.map((e, i) => {
            const mx = (e.x1 + e.x2) / 2;
            return (
              <path
                key={i}
                d={`M ${e.x1} ${e.y1} L ${mx} ${e.y1} L ${mx} ${e.y2} L ${e.x2} ${e.y2}`}
                className="connector-path"
              />
            );
          })}
        </svg>

        {layout.labels.map((lab, i) => (
          <div
            key={i}
            className="round-label"
            style={{ left: lab.x, top: lab.y, width: CARD_W + COL_GAP }}
          >
            {lab.text}
          </div>
        ))}

        {layout.items.map(({ match, x, top }) => {
          const canEditTeams =
            editable && teamEdit && !seedEdit && !!(match.p1 || match.p2);
          const canEditResult =
            editable &&
            !seedEdit &&
            !teamEdit &&
            !!match.p1 &&
            !!match.p2 &&
            !match.isBye;
          const swappable =
            seedEdit && match.section === "w" && match.round === 0;
          const onClick = canEditTeams
            ? () => setTeamEditing(match)
            : canEditResult
              ? () => setEditing(match)
              : undefined;
          return (
            <div
              key={match.key}
              className={`match-card${canEditResult ? " clickable" : ""}${
                canEditTeams ? " team-editable" : ""
              }${swappable ? " swappable" : ""}`}
              style={{ left: x, top, width: CARD_W }}
              onClick={onClick}
              role={onClick ? "button" : undefined}
            >
              {match.num && bracketFormat(data) === "double" && (
                <span className="match-num">{match.num}</span>
              )}
              {([1, 2] as const).map((side) => {
                const slotIndex = match.index * 2 + side - 1;
                return (
                  <Slot
                    key={side}
                    match={match}
                    side={side}
                    swappable={swappable}
                    selected={swappable && selectedSlot === slotIndex}
                    dragging={swappable && dragSlot === slotIndex}
                    onTap={swappable ? () => slotTap(slotIndex) : undefined}
                    onDragStart={
                      swappable ? () => setDragSlot(slotIndex) : undefined
                    }
                    onDrop={
                      swappable
                        ? () =>
                            dragSlot !== null && trySwap(dragSlot, slotIndex)
                        : undefined
                    }
                  />
                );
              })}
              {hasSchedule(match.result) && (
                <div className="match-info">{formatSchedule(match.result)}</div>
              )}
            </div>
          );
        })}
      </div>

      {editing && (
        <MatchEditor
          match={editing}
          onSave={(res) => saveResult(editing, res)}
          onClose={() => setEditing(null)}
        />
      )}
      {teamEditing && (
        <TeamEditor
          match={teamEditing}
          onSave={saveTeams}
          onClose={() => setTeamEditing(null)}
        />
      )}
    </div>
  );
}

function formatSchedule(r: MatchResult): string {
  const parts: string[] = [];
  if (r.date) {
    const d = new Date(r.date + "T00:00");
    if (!isNaN(d.getTime()))
      parts.push(
        d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      );
  }
  if (r.time) {
    const d = new Date("2000-01-01T" + r.time);
    parts.push(
      isNaN(d.getTime())
        ? r.time
        : d.toLocaleTimeString(undefined, {
            hour: "numeric",
            minute: "2-digit",
          })
    );
  }
  if (r.location) parts.push(r.location);
  return parts.join(" · ");
}

function Slot({
  match,
  side,
  swappable,
  selected,
  dragging,
  onTap,
  onDragStart,
  onDrop,
}: {
  match: Match;
  side: 1 | 2;
  swappable?: boolean;
  selected?: boolean;
  dragging?: boolean;
  onTap?: () => void;
  onDragStart?: () => void;
  onDrop?: () => void;
}) {
  const p = side === 1 ? match.p1 : match.p2;
  const score = side === 1 ? match.result.s1 : match.result.s2;
  const decided =
    match.winner !== null && match.p1 !== null && match.p2 !== null;
  const isWinner = decided && match.result.winner === side;
  const isLoser = decided && match.result.winner !== null && !isWinner;
  const sideAlive = side === 1 ? match.p1Alive : match.p2Alive;
  const from = side === 1 ? match.p1From : match.p2From;
  const isByeSlot = !p && !sideAlive;

  return (
    <div
      className={`match-slot${isWinner ? " winner" : ""}${
        isLoser ? " loser" : ""
      }${swappable ? " swap-target" : ""}${selected ? " swap-selected" : ""}${
        dragging ? " swap-dragging" : ""
      }`}
      draggable={swappable || undefined}
      onClick={
        onTap
          ? (e) => {
              e.stopPropagation();
              onTap();
            }
          : undefined
      }
      onDragStart={
        onDragStart
          ? (e) => {
              e.dataTransfer.effectAllowed = "move";
              onDragStart();
            }
          : undefined
      }
      onDragOver={onDrop ? (e) => e.preventDefault() : undefined}
      onDrop={
        onDrop
          ? (e) => {
              e.preventDefault();
              onDrop();
            }
          : undefined
      }
    >
      {swappable && (
        <span className="drag-grip" aria-hidden>
          ⋮⋮
        </span>
      )}
      {p?.seed ? <span className="seed-tag">{p.seed}</span> : null}
      <span className={`p-name${p ? "" : " tbd"}`}>
        {p ? p.name : isByeSlot ? "Bye" : (from ?? "TBD")}
      </span>
      {score !== null && score !== undefined && (
        <span className="score">{score}</span>
      )}
    </div>
  );
}

function MatchEditor({
  match,
  onSave,
  onClose,
}: {
  match: Match;
  onSave: (result: MatchResult) => void;
  onClose: () => void;
}) {
  const [s1, setS1] = useState(match.result.s1?.toString() ?? "");
  const [s2, setS2] = useState(match.result.s2?.toString() ?? "");
  const [winner, setWinner] = useState<1 | 2 | null>(match.result.winner);
  const [location, setLocation] = useState(match.result.location ?? "");
  const [date, setDate] = useState(match.result.date ?? "");
  const [time, setTime] = useState(match.result.time ?? "");

  function num(v: string): number | null {
    if (v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function updateScore(side: 1 | 2, v: string) {
    const a = side === 1 ? num(v) : num(s1);
    const b = side === 2 ? num(v) : num(s2);
    if (side === 1) setS1(v);
    else setS2(v);
    if (a !== null && b !== null && a !== b) setWinner(a > b ? 1 : 2);
  }

  function schedule() {
    return {
      location: location.trim() || undefined,
      date: date || undefined,
      time: time || undefined,
    };
  }

  function save() {
    onSave({ s1: num(s1), s2: num(s2), winner, ...schedule() });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h2>Match details{match.num ? ` — ${match.num}` : ""}</h2>
        <p className="sub">Tap a player to mark the winner, or enter scores.</p>
        {([1, 2] as const).map((side) => {
          const p = side === 1 ? match.p1 : match.p2;
          return (
            <div
              key={side}
              className={`score-edit-row${winner === side ? " winner" : ""}`}
              onClick={() => setWinner(winner === side ? null : side)}
            >
              {p?.seed ? <span className="seed-tag">{p.seed}</span> : null}
              <span className="p-name">{p?.name}</span>
              <span className="win-mark">WIN</span>
              <input
                className="input score-input"
                type="number"
                inputMode="numeric"
                placeholder="—"
                value={side === 1 ? s1 : s2}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateScore(side, e.target.value)}
              />
            </div>
          );
        })}

        <div className="schedule-fields">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="m-loc">Location</label>
            <input
              id="m-loc"
              className="input"
              placeholder="Court 4, Main Arena…"
              maxLength={80}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="schedule-when">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="m-date">Date</label>
              <input
                id="m-date"
                className="input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="m-time">Time</label>
              <input
                id="m-time"
                className="input"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="btn ghost danger"
            onClick={() =>
              onSave({ s1: null, s2: null, winner: null, ...schedule() })
            }
          >
            Clear result
          </button>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamEditor({
  match,
  onSave,
  onClose,
}: {
  match: Match;
  onSave: (edited: Participant[]) => void;
  onClose: () => void;
}) {
  const present = [match.p1, match.p2].filter(
    (p): p is Participant => p !== null
  );
  const [teams, setTeams] = useState<Participant[]>(
    present.map((p) => ({ ...p }))
  );

  function update(idx: number, patch: Partial<Participant>) {
    setTeams((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, ...patch } : t))
    );
  }

  function save() {
    onSave(
      teams.map((t, i) => ({
        ...t,
        name: t.name.trim() || present[i].name,
        seed: t.seed.trim(),
      }))
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h2>Edit teams</h2>
        <p className="sub">
          Change each team&apos;s seed and name. This applies everywhere they
          appear in the bracket.
        </p>
        {teams.map((t, i) => (
          <div key={t.id} className="participant-row">
            <input
              className="input seed"
              value={t.seed}
              maxLength={20}
              placeholder="Seed"
              aria-label={`Seed for ${present[i].name}`}
              onChange={(e) => update(i, { seed: e.target.value })}
            />
            <input
              className="input"
              value={t.name}
              maxLength={80}
              placeholder={present[i].name}
              aria-label={`Name for team ${i + 1}`}
              onChange={(e) => update(i, { name: e.target.value })}
            />
          </div>
        ))}
        <div className="modal-actions">
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
