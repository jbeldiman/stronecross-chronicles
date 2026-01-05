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
  const body = (await req.json()) as Partial<StoredUser>;
  const username = normalizeUsername(String(body.username || ""));
  const passwordHash = String(body.passwordHash || "");

  if (!username) return NextResponse.json({ error: "missing_username" }, { status: 400 });
  if (!passwordHash) return NextResponse.json({ error: "missing_password_hash" }, { status: 400 });

  const key = `${USER_KEY_PREFIX}${username}`;
  const existing = await kv.get<StoredUser>(key);
  if (existing) return NextResponse.json({ error: "user_exists" }, { status: 409 });

  const user: StoredUser = {
    username,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await kv.set(key, user);

  return NextResponse.json({ ok: true, username });
}
