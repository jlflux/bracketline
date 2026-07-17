"use client";

import { useMemo, useState } from "react";
import {
  BracketData,
  Match,
  MatchResult,
  applyResult,
  computeBracket,
  roundName,
} from "@/lib/bracket";

const CARD_W = 220;
const CARD_H = 71;
const V_GAP = 18;
const COL_GAP = 46;
const LABEL_H = 36;

type Props = {
  data: BracketData;
  editable: boolean;
  onChange?: (next: BracketData) => void;
};

export default function BracketView({ data, editable, onChange }: Props) {
  const computed = useMemo(() => computeBracket(data), [data]);
  const [editing, setEditing] = useState<Match | null>(null);

  const numRounds = computed.rounds.length;
  const firstRoundMatches = computed.rounds[0].length;
  const width = numRounds * (CARD_W + COL_GAP) - COL_GAP;
  const height = LABEL_H + firstRoundMatches * (CARD_H + V_GAP) - V_GAP;

  // Vertical center of each match, computed bottom-up from round 1.
  const centers = useMemo(() => {
    const c: number[][] = [];
    for (let r = 0; r < numRounds; r++) {
      c.push([]);
      for (let i = 0; i < computed.rounds[r].length; i++) {
        if (r === 0) {
          c[0].push(LABEL_H + i * (CARD_H + V_GAP) + CARD_H / 2);
        } else {
          c[r].push((c[r - 1][i * 2] + c[r - 1][i * 2 + 1]) / 2);
        }
      }
    }
    return c;
  }, [computed, numRounds]);

  function saveResult(match: Match, result: MatchResult) {
    onChange?.(applyResult(data, match.round, match.index, result));
    setEditing(null);
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
            const canEdit =
              editable && !!match.p1 && !!match.p2 && !match.isBye;
            return (
              <div
                key={match.key}
                className={`match-card${canEdit ? " clickable" : ""}`}
                style={{
                  left: r * (CARD_W + COL_GAP),
                  top: centers[r][i] - CARD_H / 2,
                  width: CARD_W,
                }}
                onClick={canEdit ? () => setEditing(match) : undefined}
                role={canEdit ? "button" : undefined}
              >
                <Slot match={match} side={1} />
                <Slot match={match} side={2} />
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
    </div>
  );
}

function Slot({ match, side }: { match: Match; side: 1 | 2 }) {
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
      }`}
    >
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

  function save() {
    onSave({ s1: num(s1), s2: num(s2), winner });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal card" onClick={(e) => e.stopPropagation()}>
        <h2>Report result</h2>
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
        <div className="modal-actions">
          <button
            className="btn ghost danger"
            onClick={() => onSave({ s1: null, s2: null, winner: null })}
          >
            Clear
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
