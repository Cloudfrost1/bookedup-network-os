import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, EmptyState } from "@/components/ui/card";
import { Table, Td } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { date, money, toneFor } from "@/modules/format";
import type { Reliability } from "@/modules/provider/reliability-view";
import { docsStatus } from "@/modules/provider/docs-status";

export const metadata: Metadata = { title: "Providers" };

type Org = {
  id: string;
  name: string;
  city: string | null;
  status: string;
  available_for_referrals: boolean;
  organization_capabilities: { capability: string; status: string }[];
  provider_capacity: {
    accepting_new_work: boolean;
    weekly_capacity: number | null;
    min_project_value: number | null;
    max_project_value: number | null;
    lead_time_days: number | null;
    confirmed_at: string;
  } | null;
  professional_documents: { kind: string; status: string; expires_on: string | null }[];
};

export default async function AdminProvidersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select(
      "id, name, city, status, available_for_referrals, organization_capabilities!inner(capability, status), provider_capacity(accepting_new_work, weekly_capacity, min_project_value, max_project_value, lead_time_days, confirmed_at), professional_documents(kind, status, expires_on)",
    )
    .eq("organization_capabilities.capability", "receive")
    .is("deleted_at", null)
    .order("name");
  const list = (data ?? []) as unknown as Org[];
  const rel = await Promise.all(list.map((o) => supabase.rpc("provider_reliability", { p_org: o.id }).then((r) => r.data as Reliability | null)));
  const stale = (d?: string) => !d || Date.now() - new Date(d).getTime() > 30 * 864e5;

  return (
    <>
      <PageHeader
        title="Providers"
        description="Capacity, documents and reliability of every business that receives projects. Badges are earned, never granted at sign-up."
      />
      {!list.length ? (
        <EmptyState title="No providers yet">Businesses that choose &quot;Receive projects&quot; at sign-up appear here.</EmptyState>
      ) : (
        <Table head={["Provider", "Status", "Capacity", "Project size", "Documents", "Response", "Verified feedback", "Badge"]}>
          {list.map((o, i) => {
            const cap = o.provider_capacity;
            const r = rel[i];
            const docs = o.professional_documents;
            const capStatus = o.organization_capabilities[0]?.status ?? "requested";
            return (
              <tr key={o.id} className="hover:bg-surface">
                <Td>
                  <Link href={`/admin/organizations/${o.id}`} className="font-medium text-primary hover:underline">{o.name}</Link>
                  <span className="block text-xs text-muted">{o.city ?? ""} · receive {capStatus}</span>
                </Td>
                <Td><Badge tone={toneFor(o.status)}>{o.status.replace("_", " ")}</Badge></Td>
                <Td>
                  {!cap ? (
                    <Badge tone="warning">Not informed</Badge>
                  ) : (
                    <span className="grid gap-1">
                      <Badge tone={!cap.accepting_new_work || !o.available_for_referrals ? "danger" : stale(cap.confirmed_at) ? "warning" : "success"}>
                        {!cap.accepting_new_work || !o.available_for_referrals ? "Paused" : stale(cap.confirmed_at) ? "Confirmation expired" : "Available"}
                      </Badge>
                      <span className="text-xs text-muted">
                        {cap.weekly_capacity != null ? `${cap.weekly_capacity}/week · ` : ""}
                        {cap.lead_time_days != null ? `starts in ${cap.lead_time_days}d · ` : ""}confirmed {date(cap.confirmed_at)}
                      </span>
                    </span>
                  )}
                </Td>
                <Td className="text-sm">{cap ? `${money(cap.min_project_value)} – ${money(cap.max_project_value)}` : "—"}</Td>
                <Td>
                  {r?.docs_verified ? (
                    <Badge tone="success">Verified</Badge>
                  ) : docs.some((d) => d.status === "submitted") ? (
                    <Badge tone="warning">To review ({docs.filter((d) => d.status === "submitted").length})</Badge>
                  ) : docs.length ? (
                    <Badge tone="warning">
                      Incomplete: {(() => {
                        const s = docsStatus(docs);
                        return [s.license !== "valid" ? `license ${s.license.replace("_", " ")}` : null, s.insurance !== "valid" ? `insurance ${s.insurance.replace("_", " ")}` : null]
                          .filter(Boolean)
                          .join(", ");
                      })()}
                    </Badge>
                  ) : (
                    <Badge>Missing</Badge>
                  )}
                </Td>
                <Td className="text-sm">
                  {r?.median_response_hours != null ? `${r.median_response_hours}h median` : "—"}
                  <span className="block text-xs text-muted">{r?.received ?? 0} received · {r?.stale_offers ?? 0} unanswered</span>
                </Td>
                <Td className="text-sm">
                  {r?.verified_feedback ?? 0}
                  {r?.avg_rating != null ? <span className="text-muted"> · avg {r.avg_rating}</span> : null}
                </Td>
                <Td>{r?.trusted ? <Badge tone="purple">Trusted</Badge> : <span className="text-muted">—</span>}</Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
