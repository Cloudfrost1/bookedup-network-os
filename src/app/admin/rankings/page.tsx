import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flash } from "@/components/ui/flash";
import { Table, Td } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { recomputeScores } from "@/modules/admin/actions";
import { date, pct } from "@/modules/format";

export const metadata: Metadata = { title: "Rankings" };

type P = { org_id: string; period_end: string; submitted: number; qualified: number; qualification_rate: number | null; last_30: number; score: number | null; level: string; organizations: { name: string } | null };
type V = { org_id: string; period_end: string; received: number; acceptance_rate: number | null; avg_response_minutes: number | null; update_rate: number | null; score: number | null; level: string; organizations: { name: string } | null };

function latest<T extends { period_end: string }>(rows: T[]) {
  const max = rows.reduce((m, r) => (r.period_end > m ? r.period_end : m), "");
  return rows.filter((r) => r.period_end === max).sort((a, b) => Number((b as never as { score: number | null }).score ?? -1) - Number((a as never as { score: number | null }).score ?? -1));
}

export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const since = new Date(Date.now() - 40 * 864e5).toISOString().slice(0, 10);
  const [{ data: p }, { data: v }] = await Promise.all([
    supabase.from("partner_score_snapshots").select("*, organizations(name)").gte("period_end", since),
    supabase.from("provider_score_snapshots").select("*, organizations(name)").gte("period_end", since),
  ]);
  const partners = latest((p ?? []) as unknown as P[]);
  const providers = latest((v ?? []) as unknown as V[]);

  return (
    <>
      <PageHeader
        title="Rankings"
        description="Scores use the last 90 days of real activity. Members see only their own position."
        action={
          <form action={recomputeScores}>
            <Button size="sm">Recalculate now</Button>
          </form>
        }
      />
      <Flash sp={sp} />
      <h2 className="text-lg font-semibold">Referral partners {partners[0] ? <span className="text-sm font-normal text-muted">· {date(partners[0].period_end)}</span> : null}</h2>
      {!partners.length ? (
        <EmptyState title="No partner scores yet">Click &quot;Recalculate now&quot; after the first referrals.</EmptyState>
      ) : (
        <Table head={["#", "Partner", "Score", "Level", "Submitted", "Qualified", "Rate", "Last 30d"]}>
          {partners.map((r, i) => (
            <tr key={r.org_id}>
              <Td className="tabular-nums text-muted">{r.score === null ? "—" : i + 1}</Td>
              <Td className="font-medium">{r.organizations?.name}</Td>
              <Td className="tabular-nums">{r.score ?? "—"}</Td>
              <Td>{r.score === null ? <Badge>Not enough data</Badge> : <Badge tone="purple">{r.level}</Badge>}</Td>
              <Td className="tabular-nums">{r.submitted}</Td>
              <Td className="tabular-nums">{r.qualified}</Td>
              <Td>{pct(r.qualification_rate)}</Td>
              <Td className="tabular-nums">{r.last_30}</Td>
            </tr>
          ))}
        </Table>
      )}
      <h2 className="text-lg font-semibold">Service providers</h2>
      {!providers.length ? (
        <EmptyState title="No provider scores yet" />
      ) : (
        <Table head={["#", "Provider", "Score", "Level", "Received", "Acceptance", "Avg. response", "Updates"]}>
          {providers.map((r, i) => (
            <tr key={r.org_id}>
              <Td className="tabular-nums text-muted">{r.score === null ? "—" : i + 1}</Td>
              <Td className="font-medium">{r.organizations?.name}</Td>
              <Td className="tabular-nums">{r.score ?? "—"}</Td>
              <Td>{r.score === null ? <Badge>Not enough data</Badge> : <Badge tone="purple">{r.level}</Badge>}</Td>
              <Td className="tabular-nums">{r.received}</Td>
              <Td>{pct(r.acceptance_rate)}</Td>
              <Td>{r.avg_response_minutes != null ? `${Math.round(Number(r.avg_response_minutes) / 60)}h` : "—"}</Td>
              <Td>{pct(r.update_rate)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
