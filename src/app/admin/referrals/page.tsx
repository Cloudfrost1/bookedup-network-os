import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, EmptyState } from "@/components/ui/card";
import { Table, Td } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { dateTime, referralStatusLabel, toneFor } from "@/modules/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Referrals" };

const tabs = [
  { key: "open", label: "Needs action", statuses: ["consent_pending", "under_review", "qualified", "matching"] },
  { key: "consent_pending", label: "Authorization", statuses: ["consent_pending"] },
  { key: "under_review", label: "To qualify", statuses: ["under_review"] },
  { key: "qualified", label: "To match", statuses: ["qualified", "matching"] },
  { key: "assigned", label: "With provider", statuses: ["assigned"] },
  { key: "closed", label: "Closed", statuses: ["closed", "rejected"] },
  { key: "all", label: "All", statuses: [] as string[] },
];

type Row = {
  id: string;
  number: number;
  city: string;
  zip: string;
  status: string;
  channel: string;
  created_at: string;
  service_categories: { name: string } | null;
  organizations: { name: string } | null;
};

export default async function AdminReferralsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const tab = tabs.find((t) => t.key === sp.status) ?? tabs[0];
  const supabase = await createClient();
  let q = supabase
    .from("referrals")
    .select("id, number, city, zip, status, channel, created_at, service_categories(name), organizations!referrals_source_org_id_fkey(name)")
    .order("created_at", { ascending: tab.key === "closed" || tab.key === "all" ? false : true })
    .limit(300);
  if (tab.statuses.length) q = q.in("status", tab.statuses);
  const { data, error } = await q;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title="Referrals" description="Confirm authorization, qualify with the 7-point checklist and send to one provider." />
      <nav className="flex flex-wrap gap-1" aria-label="Filter">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/referrals?status=${t.key}`}
            className={cn("rounded-full px-3 py-1.5 text-sm", t.key === tab.key ? "bg-primary text-white" : "bg-subtle text-ink-soft hover:bg-primary-soft")}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {error ? <p className="text-sm text-danger">Could not load referrals.</p> : null}
      {!rows.length ? (
        <EmptyState title="Nothing here">Referrals in this stage will appear here.</EmptyState>
      ) : (
        <Table head={["#", "Service", "Location", "From", "Source", "Status", "Received"]}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-surface">
              <Td>
                <Link href={`/admin/referrals/${r.id}`} className="font-medium tabular-nums text-primary hover:underline">
                  #{r.number}
                </Link>
              </Td>
              <Td className="font-medium">{r.service_categories?.name}</Td>
              <Td>
                {r.city} {r.zip}
              </Td>
              <Td>{r.organizations?.name ?? "—"}</Td>
              <Td className="text-muted">{r.channel === "link" ? "Homeowner link" : r.channel === "partner_direct" ? "Partner (suggested provider)" : "Partner"}</Td>
              <Td>
                <Badge tone={toneFor(r.status)}>{referralStatusLabel[r.status]}</Badge>
              </Td>
              <Td className="text-muted">{dateTime(r.created_at)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
