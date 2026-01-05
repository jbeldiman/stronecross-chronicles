import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const DM_USERNAME = "jbeldiman";

export async function GET(req: Request) {
  const actor = (req.headers.get("x-sc-user") || "").trim().toLowerCase();
  if (actor !== DM_USERNAME) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const users = (await kv.smembers<string>("sc:users")) || [];
  users.sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const actor = (req.headers.get("x-sc-user") || "").trim().toLowerCase();
  if (!actor) return NextResponse.json({ error: "Missing actor" }, { status: 401 });

  const body = (await req.json()) as { username?: string };
  const username = (body.username || "").trim().toLowerCase();
  if (!username) return NextResponse.json({ error: "Missing username" }, { status: 400 });

  await kv.sadd("sc:users", username);

  return NextResponse.json({ ok: true });
}
