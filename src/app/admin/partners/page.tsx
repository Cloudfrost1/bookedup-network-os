import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, EmptyState } from "@/components/ui/card";
import { Table, Td } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { date, toneFor } from "@/modules/format";

export const metadata: Metadata = { title: "Partners (Anchors)" };

type Org = {
  id: string;
  name: string;
  city: string | null;
  status: string;
  created_at: string;
  organization_capabilities: { capability: string; status: string }[];
  organization_followups: { next_followup_at: string | null } | null;
};
type Ref = { source_org_id: string; created_at: string; qualified_at: string | null };
type Snap = { org_id: string; score: number | null; level: string; period_end: string };

export default async function AdminPartnersPage() {
  const supabase = await createClient();
  const [{ data: orgs }, { data: refs }, { data: snaps }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, city, status, created_at, organization_capabilities!inner(capability, status), organization_followups(next_followup_at)")
      .eq("organization_capabilities.capability", "refer")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("referrals").select("source_org_id, created_at, qualified_at").not("source_org_id", "is", null),
    supabase.from("partner_score_snapshots").select("org_id, score, level, period_end").order("period_end", { ascending: false }),
  ]);
  const list = (orgs ?? []) as unknown as Org[];
  const r = (refs ?? []) as Ref[];
  const latest = new Map<string, Snap>();
  for (const s of (snaps ?? []) as Snap[]) if (!latest.has(s.org_id)) latest.set(s.org_id, s);
  const since = Date.now() - 30 * 864e5;

  return (
    <>
      <PageHeader title="Partners (Anchors)" description="Businesses that refer projects into the network." />
      {!list.length ? (
        <EmptyState title="No partners yet">Businesses that choose &quot;Refer projects&quot; at sign-up appear here.</EmptyState>
      ) : (
        <Table head={["Partner", "Status", "Refer access", "Referrals", "Qualified", "Qualified 30d", "Last referral", "Level", "Follow-up"]}>
          {list.map((o) => {
            const mine = r.filter((x) => x.source_org_id === o.id);
            const q = mine.filter((x) => x.qualified_at);
            const last = mine.reduce<string | null>((m, x) => (!m || x.created_at > m ? x.created_at : m), null);
            const cap = o.organization_capabilities[0]?.status ?? "requested";
            const s = latest.get(o.id);
            return (
              <tr key={o.id} className="hover:bg-surface">
                <Td>
                  <Link href={`/admin/organizations/${o.id}`} className="font-medium text-primary hover:underline">{o.name}</Link>
                  <span className="block text-xs text-muted">{o.city ?? ""}</span>
                </Td>
                <Td><Badge tone={toneFor(o.status)}>{o.status.replace("_", " ")}</Badge></Td>
                <Td><Badge tone={toneFor(cap)}>{cap}</Badge></Td>
                <Td className="tabular-nums">{mine.length}</Td>
                <Td className="tabular-nums">{q.length}</Td>
                <Td className="tabular-nums">{q.filter((x) => new Date(x.qualified_at!).getTime() >= since).length}</Td>
                <Td className="text-muted">{date(last)}</Td>
                <Td>{s?.score != null ? <Badge tone="purple">{s.level}</Badge> : <span className="text-muted">—</span>}</Td>
                <Td className="text-muted">{date(o.organization_followups?.next_followup_at)}</Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
