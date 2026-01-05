import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const CHAR_KEY_PREFIX = "stonecross:character:";

function normalizeUsername(v: string) {
  return v.trim().toLowerCase();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = normalizeUsername(String(searchParams.get("u") || ""));
  if (!username) return NextResponse.json({ error: "missing_u" }, { status: 400 });

  const key = `${CHAR_KEY_PREFIX}${username}`;
  const data = await kv.get(key);

  return NextResponse.json({ ok: true, username, data: data ?? null });
}

export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = normalizeUsername(String(searchParams.get("u") || ""));
  if (!username) return NextResponse.json({ error: "missing_u" }, { status: 400 });

  const body = await req.json();
  const key = `${CHAR_KEY_PREFIX}${username}`;

  await kv.set(key, { ...body, lastUpdatedAt: new Date().toISOString() });

  return NextResponse.json({ ok: true, username });
}
