import { kv } from "@vercel/kv";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

const DM_USERNAME = "jbeldiman";
const USER_KEY_PREFIX = "stonecross:user:";
const RESET_KEY_PREFIX = "stonecross:pwreset:";

function norm(v: string) {
  return (v || "").trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const actor = norm(req.headers.get("x-sc-user") || "");
  if (actor !== DM_USERNAME) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { username?: string } | null;
  const username = norm(body?.username || "");
  if (!username) return NextResponse.json({ error: "missing_username" }, { status: 400 });

  const userKey = `${USER_KEY_PREFIX}${username}`;
  const user = await kv.get(userKey);
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const token = randomUUID();
  const resetKey = `${RESET_KEY_PREFIX}${token}`;

  await kv.set(resetKey, { username, createdAt: new Date().toISOString() }, { ex: 60 * 60 });

  return NextResponse.json({ ok: true, token, username, expiresInSeconds: 3600 });
}