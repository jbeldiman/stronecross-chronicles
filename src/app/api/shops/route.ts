import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";

const KEY_PREFIX = "stonecross:shops:";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const room = (searchParams.get("room") || "default").trim() || "default";
  const key = `${KEY_PREFIX}${room}`;

  const data = await kv.get(key);
  return NextResponse.json({ room, data: data ?? null });
}

export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const room = (searchParams.get("room") || "default").trim() || "default";
  const key = `${KEY_PREFIX}${room}`;

  const body = await req.json();
  await kv.set(key, body);

  return NextResponse.json({ ok: true, room });
}