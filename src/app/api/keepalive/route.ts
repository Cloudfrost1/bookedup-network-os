import { NextResponse } from "next/server";
import { env } from "@/lib/env";

/**
 * Daily keep-alive (Vercel Cron, see vercel.json): one tiny read of public data so the
 * Supabase free-plan project isn't paused for inactivity. Read-only and harmless to call.
 * Remove it after upgrading Supabase to Pro (Pro projects are never paused).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const res = await fetch(`${env.supabaseUrl}/rest/v1/service_categories?select=id&limit=1`, {
    headers: { apikey: env.supabaseKey, Authorization: `Bearer ${env.supabaseKey}` },
    cache: "no-store",
  });
  return NextResponse.json(
    { ok: res.ok, status: res.status, ms: Date.now() - started, at: new Date().toISOString() },
    { status: res.ok ? 200 : 502, headers: { "cache-control": "no-store" } },
  );
}
