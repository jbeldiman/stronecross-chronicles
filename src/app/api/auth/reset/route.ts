import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

type StoredUser = {
  username: string;
  passwordHash: string;
  createdAt: string;
};

const USER_KEY_PREFIX = "stonecross:user:";
const RESET_KEY_PREFIX = "stonecross:pwreset:";

function norm(v: string) {
  return (v || "").trim().toLowerCase();
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: string; passwordHash?: string } | null;

  const token = String(body?.token || "").trim();
  const passwordHash = String(body?.passwordHash || "");

  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });
  if (!passwordHash) return NextResponse.json({ error: "missing_password_hash" }, { status: 400 });

  const resetKey = `${RESET_KEY_PREFIX}${token}`;
  const reset = (await kv.get(resetKey)) as { username?: string } | null;

  const username = norm(reset?.username || "");
  if (!username) return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });

  const userKey = `${USER_KEY_PREFIX}${username}`;
  const user = await kv.get<StoredUser>(userKey);
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await kv.set(userKey, { ...user, passwordHash });
  await kv.del(resetKey);

  return NextResponse.json({ ok: true, username });
}
