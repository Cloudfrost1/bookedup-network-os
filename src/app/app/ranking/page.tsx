import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, EmptyState, StatCard } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/modules/network/org";
import { date, pct } from "@/modules/format";

export const metadata: Metadata = { title: "My Ranking" };

type Side = {
  score: number | null;
  level: string;
  position: number | null;
  ranked: number;
  period_end: string;
  qualified?: number;
  last_30?: number;
  rate?: number | null;
  received?: number;
  acceptance?: number | null;
  response_minutes?: number | null;
};

function Level({ s }: { s: Side }) {
  if (s.score === null) return <Badge>Not enough data yet</Badge>;
  return <Badge tone="purple">{s.level}</Badge>;
}

export default async function RankingPage() {
  const { org } = await requireOrg("/app/ranking");
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_ranking", { p_org: org.id });
  const r = (data ?? {}) as { partner: Side | null; provider: Side | null };

  return (
    <>
      <PageHeader title="My Ranking" description="Calculated from real activity in the last 90 days. Updated by BookedUp." />
      {!r.partner && !r.provider ? (
        <EmptyState title="No ranking yet">
          Rankings start after your business has activity in the network. A score appears after at least 3 referrals or 3 opportunities.
        </EmptyState>
      ) : null}
      {r.partner ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">As a referral partner</h2>
            <Level s={r.partner} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Score" value={r.partner.score ?? "—"} hint="0–100" />
            <StatCard label="Position" value={r.partner.position ? `#${r.partner.position}` : "—"} hint={`of ${r.partner.ranked} ranked`} />
            <StatCard label="Qualified (90 days)" value={r.partner.qualified ?? 0} />
            <StatCard label="Qualification rate" value={pct(r.partner.rate)} />
          </div>
        </section>
      ) : null}
      {r.provider ? (
        <section className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">As a service provider</h2>
            <Level s={r.provider} />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Score" value={r.provider.score ?? "—"} hint="0–100" />
            <StatCard label="Position" value={r.provider.position ? `#${r.provider.position}` : "—"} hint={`of ${r.provider.ranked} ranked`} />
            <StatCard label="Opportunities (90 days)" value={r.provider.received ?? 0} />
            <StatCard
              label="Avg. response"
              value={r.provider.response_minutes != null ? `${Math.round(Number(r.provider.response_minutes) / 60)}h` : "—"}
              hint={`Acceptance ${pct(r.provider.acceptance)}`}
            />
          </div>
        </section>
      ) : null}
      <Card className="grid gap-1 text-sm text-muted">
        <p>Partner score: qualified volume, qualification rate, consistency and duplicate-free referrals.</p>
        <p>Provider score: response time, acceptance, progress updates, outcome feedback and reliability.</p>
        {r.partner?.period_end || r.provider?.period_end ? <p>Last update: {date(r.partner?.period_end ?? r.provider?.period_end)}</p> : null}
      </Card>
    </>
  );
}
