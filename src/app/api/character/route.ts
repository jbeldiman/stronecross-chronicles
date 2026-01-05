import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const DM_USERNAME = "jbeldiman";

function norm(v: string) {
  return (v || "").trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const actor = norm(req.headers.get("x-sc-user") || "");
  const { searchParams } = new URL(req.url);
  const username = norm(searchParams.get("username") || "");

  if (!username) {
    return NextResponse.json({ sheet: null }, { status: 400 });
  }

  const isDm = actor === DM_USERNAME;
  const isSelf = actor && actor === username;

  if (!isDm && !isSelf) {
    return NextResponse.json({ sheet: null }, { status: 403 });
  }

  const sheet = await kv.get(`sc:character:${username}`);
  return NextResponse.json({ sheet: sheet ?? null });
}

export async function POST(req: NextRequest) {
  const actor = norm(req.headers.get("x-sc-user") || "");
  if (!actor) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { sheet?: unknown } | null;
  const sheet = body?.sheet ?? null;

  await kv.set(`sc:character:${actor}`, sheet);

  if (actor !== DM_USERNAME) {
    await kv.sadd("sc:users", actor);
  }

  return NextResponse.json({ ok: true });
}
