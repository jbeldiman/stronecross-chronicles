import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const DM_USERNAME = "jbeldiman";

type CharacterSheet = unknown;

function keyForUser(username: string) {
  return `sc:char:${username}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const username = (url.searchParams.get("username") || "").trim().toLowerCase();

  if (!username) {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }

  const sheet = await kv.get<CharacterSheet>(keyForUser(username));
  return NextResponse.json({ username, sheet: sheet ?? null });
}

export async function PUT(req: Request) {
  const actor = (req.headers.get("x-sc-user") || "").trim().toLowerCase();
  if (!actor) return NextResponse.json({ error: "Missing actor" }, { status: 401 });

  const body = (await req.json()) as { username?: string; sheet?: CharacterSheet };
  const username = (body.username || "").trim().toLowerCase();

  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });
  if (actor !== username && actor !== DM_USERNAME) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await kv.set(keyForUser(username), body.sheet ?? null);
  await kv.sadd("sc:users", username);

  return NextResponse.json({ ok: true });
}