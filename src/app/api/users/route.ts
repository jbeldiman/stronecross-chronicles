import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";

const DM_USERNAME = "jbeldiman";

export async function GET(req: NextRequest) {
  const actor = (req.headers.get("x-sc-user") || "").trim().toLowerCase();

  if (actor !== DM_USERNAME) {
    return NextResponse.json({ users: [] }, { status: 403 });
  }

  const raw = (await kv.smembers("sc:users")) as unknown;
  const users = (Array.isArray(raw) ? raw : []).filter((u): u is string => typeof u === "string");

  const filtered = users
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean)
    .filter((u) => u !== DM_USERNAME)
    .sort((a, b) => a.localeCompare(b));

  return NextResponse.json({ users: filtered });
}