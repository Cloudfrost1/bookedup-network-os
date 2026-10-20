import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/modules/network/org";
import { date } from "@/modules/format";
import { docKindLabel } from "@/modules/provider/labels";
import { CapacityForm, DocumentForm } from "./forms";

export const metadata: Metadata = { title: "Capacity & Documents" };

type Doc = { id: string; kind: string; number: string | null; issuer: string | null; expires_on: string | null; status: string; review_note: string | null; created_at: string };

export default async function CapacityPage() {
  const { org } = await requireOrg("/provider/capacity");
  const supabase = await createClient();
  const [{ data: cap }, { data: docs }] = await Promise.all([
    supabase.from("provider_capacity").select("*").eq("org_id", org.id).maybeSingle(),
    supabase.from("professional_documents").select("id, kind, number, issuer, expires_on, status, review_note, created_at").eq("org_id", org.id).order("created_at", { ascending: false }),
  ]);
  const confirmed = cap?.confirmed_at as string | undefined;
  const stale = !confirmed || Date.now() - new Date(confirmed).getTime() > 30 * 864e5;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Capacity & Documents"
        description="BookedUp sends a project only when it fits your capacity, project size and documents. Keep this current."
      />
      <Card className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Operational capacity</h2>
          {confirmed ? (
            <Badge tone={stale ? "warning" : "success"}>{stale ? "Confirmation expired" : "Confirmed"} · {date(confirmed)}</Badge>
          ) : (
            <Badge tone="warning">Not confirmed yet</Badge>
          )}
        </div>
        <p className="text-sm text-muted">Confirm at least every 30 days. Projects are not sent to providers with an expired confirmation.</p>
        <CapacityForm orgId={org.id} cap={cap ?? null} />
      </Card>
      <Card className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">Professional documents</h2>
          <p className="text-sm text-muted">
            The &quot;Verified documents&quot; mark appears only after BookedUp checks a valid license <em>and</em> a valid insurance. Signing up alone never gives a badge.
          </p>
        </div>
        {(docs ?? []).length ? (
          <ul className="divide-y divide-border text-sm">
            {(docs as Doc[]).map((d) => {
              const expired = d.expires_on && d.expires_on < today;
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="grid">
                    <span className="font-medium">{docKindLabel[d.kind]}</span>
                    <span className="text-muted">
                      {[d.number, d.issuer, d.expires_on ? `expires ${date(d.expires_on)}` : null].filter(Boolean).join(" · ")}
                    </span>
                    {d.review_note ? <span className="text-xs text-muted">BookedUp: {d.review_note}</span> : null}
                  </span>
                  <Badge tone={expired ? "danger" : d.status === "verified" ? "success" : d.status === "rejected" ? "danger" : "warning"}>
                    {expired ? "Expired" : d.status === "submitted" ? "In review" : d.status}
                  </Badge>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted">No documents yet.</p>
        )}
        <DocumentForm orgId={org.id} />
      </Card>
    </>
  );
}
