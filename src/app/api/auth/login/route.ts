import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

type StoredUser = {
  username: string;
  passwordHash: string;
  createdAt: string;
};

const USER_KEY_PREFIX = "stonecross:user:";

function normalizeUsername(v: string) {
  return v.trim().toLowerCase();
}

export async function POST(req: Request) {
  const body = (await req.json()) as { username?: string; passwordHash?: string };
  const username = normalizeUsername(String(body.username || ""));
  const passwordHash = String(body.passwordHash || "");

  if (!username) return NextResponse.json({ error: "missing_username" }, { status: 400 });
  if (!passwordHash) return NextResponse.json({ error: "missing_password_hash" }, { status: 400 });

  const key = `${USER_KEY_PREFIX}${username}`;
  const user = await kv.get<StoredUser>(key);

  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (user.passwordHash !== passwordHash) return NextResponse.json({ error: "bad_password" }, { status: 401 });

  return NextResponse.json({ ok: true, username: user.username });
}
