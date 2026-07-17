// Browser-side storage for brackets created without an account.
import { BracketData, participantCount } from "./bracket";

const KEY = "bl_local_brackets";

export function isLocalId(id: string): boolean {
  return id.startsWith("local-");
}

function readAll(): Record<string, BracketData> {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, BracketData>) {
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function listLocal(): {
  id: string;
  name: string;
  participants: number;
  updatedAt: number;
}[] {
  const all = readAll();
  return Object.values(all)
    .map((b) => ({
      id: b.id,
      name: b.name,
      participants: participantCount(b),
      updatedAt: b.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getLocal(id: string): BracketData | null {
  return readAll()[id] ?? null;
}

export function saveLocal(data: BracketData) {
  const all = readAll();
  all[data.id] = data;
  writeAll(all);
}

export function deleteLocal(id: string) {
  const all = readAll();
  delete all[id];
  writeAll(all);
}
