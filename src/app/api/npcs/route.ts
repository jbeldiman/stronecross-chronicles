import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

type TownId =
  | "stonecross"
  | "stormwatch"
  | "westhaven"
  | "eldergate"
  | "sunspire"
  | "ashenmoor"
  | "shatteredisles"
  | "greenshadow";

export type NPC = {
  id: string;
  name: string;
  title: string;
  townId: TownId;
  comments?: string;
  createdAt: string;
  updatedAt: string;
};

type NPCState = {
  npcs: NPC[];
  lastUpdatedAt: string;
};

const KEY_PREFIX = "stonecross.npcs.v1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function ok<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function getRoom(req: NextRequest) {
  const room = (req.nextUrl.searchParams.get("room") || "default").trim() || "default";
  const safe = room.slice(0, 64).replace(/[^\w\-:.]/g, "_");
  return safe || "default";
}

function keyFor(room: string) {
  return `${KEY_PREFIX}:${room}`;
}

function nowIso() {
  return new Date().toISOString();
}

function ensureTownId(v: any): v is TownId {
  return (
    v === "stonecross" ||
    v === "stormwatch" ||
    v === "westhaven" ||
    v === "eldergate" ||
    v === "sunspire" ||
    v === "ashenmoor" ||
    v === "shatteredisles" ||
    v === "greenshadow"
  );
}

function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeNPC(input: any, existing?: NPC): NPC | null {
  const name = String(input?.name ?? "").trim();
  const title = String(input?.title ?? "").trim();
  const townId = input?.townId;

  if (!name || !title || !ensureTownId(townId)) return null;

  const createdAt = existing?.createdAt ?? nowIso();
  const updatedAt = nowIso();
  const id =
    typeof input?.id === "string" && input.id.trim()
      ? input.id.trim()
      : existing?.id ?? newId();

  const commentsRaw = input?.comments;
  const comments = commentsRaw == null ? existing?.comments : String(commentsRaw).trim();

  return {
    id,
    name,
    title,
    townId,
    comments: comments || undefined,
    createdAt,
    updatedAt,
  };
}

async function readState(room: string): Promise<NPCState> {
  const k = keyFor(room);

  const stored = (await kv.get<NPCState>(k)) ?? null;
  if (stored && Array.isArray(stored.npcs)) return stored;

  const seed: NPCState = { npcs: [], lastUpdatedAt: nowIso() };
  await kv.set(k, seed);
  return seed;
}

async function writeState(room: string, state: NPCState): Promise<void> {
  const k = keyFor(room);
  await kv.set(k, state);
}

export async function GET(req: NextRequest) {
  const room = getRoom(req);
  const state = await readState(room);
  return ok(state);
}


export async function PUT(req: NextRequest) {
  const room = getRoom(req);

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return bad("Invalid JSON body.");
  }

  const state = await readState(room);

  if (Array.isArray(body?.npcs)) {
    const next: NPC[] = [];
    for (const raw of body.npcs) {
      const normalized = normalizeNPC(raw);
      if (!normalized) continue;
      next.push(normalized);
    }

    const updated: NPCState = { npcs: next, lastUpdatedAt: nowIso() };
    await writeState(room, updated);
    return ok(updated);
  }

  const op = String(body?.op ?? "").toLowerCase();

  if (op === "upsert") {
    const rawNpc = body?.npc;
    const existingIdx = state.npcs.findIndex((n) => n.id === String(rawNpc?.id ?? ""));
    const existing = existingIdx >= 0 ? state.npcs[existingIdx] : undefined;

    const normalized = normalizeNPC(rawNpc, existing);
    if (!normalized) {
      return bad('Upsert requires: npc { name, title, townId } (and valid townId).');
    }

    const next = [...state.npcs];
    if (existingIdx >= 0) next[existingIdx] = normalized;
    else next.push(normalized);

    next.sort((a, b) => (a.townId + a.name).localeCompare(b.townId + b.name));

    const updated: NPCState = { npcs: next, lastUpdatedAt: nowIso() };
    await writeState(room, updated);
    return ok(updated);
  }

  if (op === "delete") {
    const id = String(body?.id ?? "").trim();
    if (!id) return bad('Delete requires: { op: "delete", id: "..." }');

    const next = state.npcs.filter((n) => n.id !== id);
    const updated: NPCState = { npcs: next, lastUpdatedAt: nowIso() };
    await writeState(room, updated);
    return ok(updated);
  }

  return bad('Unsupported operation. Use {npcs: [...]}, or {op:"upsert", npc:{...}}, or {op:"delete", id:"..."}');
}