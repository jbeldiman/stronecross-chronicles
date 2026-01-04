import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasKVUrl: Boolean(process.env.KV_URL),
    hasRestUrl: Boolean(process.env.KV_REST_API_URL),
    hasToken: Boolean(process.env.KV_REST_API_TOKEN),
    hasReadOnlyToken: Boolean(process.env.KV_REST_API_READ_ONLY_TOKEN),
  });
}
