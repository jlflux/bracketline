"use client";

import { useMemo, useState } from "react";
import {
  BracketData,
  Match,
  MatchResult,
  Participant,
  applyResult,
  computeBracket,
  roundName,
} from "@/lib/bracket";

const CARD_W = 220;
const CARD_H = 71;
const INFO_H = 24;
const V_GAP = 18;
const COL_GAP = 46;
const LABEL_H = 36;

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

function hasSchedule(r: MatchResult): boolean {
  return !!(r.location || r.date || r.time);
}

function formatSchedule(r: MatchResult): string {
  const parts: string[] = [];
  if (r.date) {
    const d = new Date(r.date + "T00:00");
    if (!isNaN(d.getTime()))
      parts.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  }
  if (r.time) {
    const d = new Date("2000-01-01T" + r.time);
    parts.push(
      isNaN(d.getTime())
        ? r.time
        : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    );
  }
  if (r.location) parts.push(r.location);
  return parts.join(" · ");
}

export default function BracketView({
  data,
  editable,
  onChange,
  seedEdit = false,
  onSwap,
  teamEdit = false,
}: Props) {
  const computed = useMemo(() => computeBracket(data), [data]);
  const [editing, setEditing] = useState<Match | null>(null);
  const [teamEditing, setTeamEditing] = useState<Match | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [dragSlot, setDragSlot] = useState<number | null>(null);

  const numRounds = computed.rounds.length;

  // Card heights vary: matches with schedule info get a footer row.
  const { centers, heights, width, height } = useMemo(() => {
    const heights: number[][] = computed.rounds.map((round) =>
      round.map(
        (m) => CARD_H + (hasSchedule(m.result) ? INFO_H : 0)
      )
    );
    const centers: number[][] = [];
    let y = LABEL_H;
    centers.push([]);
    for (let i = 0; i < computed.rounds[0].length; i++) {
      centers[0].push(y + heights[0][i] / 2);
      y += heights[0][i] + V_GAP;
    }
    let maxBottom = y - V_GAP;
    for (let r = 1; r < numRounds; r++) {
      centers.push([]);
      for (let i = 0; i < computed.rounds[r].length; i++) {
        const c = (centers[r - 1][i * 2] + centers[r - 1][i * 2 + 1]) / 2;
        centers[r].push(c);
        maxBottom = Math.max(maxBottom, c + heights[r][i] / 2);
      }
    }
    return {
      centers,
      heights,
      width: numRounds * (CARD_W + COL_GAP) - COL_GAP,
      height: maxBottom + 4,
    };
  }, [computed, numRounds]);

  function saveResult(match: Match, result: MatchResult) {
    onChange?.(applyResult(data, match.round, match.index, result));
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

  const paths: string[] = [];
  for (let r = 1; r < numRounds; r++) {
    for (let i = 0; i < computed.rounds[r].length; i++) {
      const x2 = r * (CARD_W + COL_GAP);
      const y2 = centers[r][i];
      const x1 = x2 - COL_GAP;
      const mx = x1 + COL_GAP / 2;
      for (const child of [i * 2, i * 2 + 1]) {
        const y1 = centers[r - 1][child];
        paths.push(`M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`);
      }
    }
  }

  return (
    <div className="bracket-scroller">
      <div className="bracket-canvas" style={{ width, height }}>
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
        >
          {paths.map((d, i) => (
            <path key={i} d={d} className="connector-path" />
          ))}
        </svg>

        {computed.rounds.map((round, r) => (
          <div
            key={`label-${r}`}
            className="round-label"
            style={{ left: r * (CARD_W + COL_GAP), width: CARD_W }}
          >
            {roundName(r, numRounds)}
          </div>
        ))}

        {computed.rounds.map((round, r) =>
          round.map((match, i) => {
            const canEditTeams =
              editable && teamEdit && !seedEdit && !!(match.p1 || match.p2);
            const canEditResult =
              editable &&
              !seedEdit &&
              !teamEdit &&
              !!match.p1 &&
              !!match.p2 &&
              !match.isBye;
            const swappable = seedEdit && r === 0;
            const onClick = canEditTeams
              ? () => setTeamEditing(match)
              : canEditResult
                ? () => setEditing(match)
                : undefined;
            return (
              <div
                key={match.key}
                className={`match-card${
                  canEditResult ? " clickable" : ""
                }${canEditTeams ? " team-editable" : ""}${
                  swappable ? " swappable" : ""
                }`}
                style={{
                  left: r * (CARD_W + COL_GAP),
                  top: centers[r][i] - heights[r][i] / 2,
                  width: CARD_W,
                }}
                onClick={onClick}
                role={onClick ? "button" : undefined}
              >
                {([1, 2] as const).map((side) => {
                  const slotIndex = i * 2 + side - 1;
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
                  <div className="match-info">
                    {formatSchedule(match.result)}
                  </div>
                )}
              </div>
            );
          })
        )}
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
  const decided = match.winner !== null && match.p1 !== null && match.p2 !== null;
  const isWinner = decided && match.result.winner === side;
  const isLoser = decided && match.result.winner !== null && !isWinner;
  const sideAlive = side === 1 ? match.p1Alive : match.p2Alive;
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
        {p ? p.name : isByeSlot ? "Bye" : "TBD"}
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
        <h2>Match details</h2>
        <p className="sub">
          Tap a player to mark the winner, or enter scores.
        </p>
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
