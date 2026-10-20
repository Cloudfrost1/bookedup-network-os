import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { decideOrganization } from "@/modules/admin/actions";

export const metadata: Metadata = { title: "Pending approvals" };

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  out_of_scope_last_30d: string | null;
  created_at: string;
  organization_capabilities: { capability: "refer" | "receive"; status: string }[];
};

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, name, email, phone, city, state, zip, out_of_scope_last_30d, created_at, organization_capabilities(capability, status)")
    .eq("status", "pending_review")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .returns<Row[]>();

  return (
    <>
      <PageHeader title="Pending Approvals" description="Approve the business and choose what it can do in the network." />
      {!data?.length ? (
        <EmptyState title="No businesses waiting">New sign-ups will appear here.</EmptyState>
      ) : (
        <div className="grid gap-3">
          {data.map((o) => {
            const requested = new Set(o.organization_capabilities.map((c) => c.capability));
            return (
              <Card key={o.id} className="grid gap-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="grid gap-0.5">
                    <a href={`/admin/organizations/${o.id}`} className="font-semibold text-primary hover:underline">{o.name}</a>
                    <p className="text-sm text-muted">
                      {[o.city, o.state, o.zip].filter(Boolean).join(", ")} · {o.email}
                      {o.phone ? ` · ${o.phone}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[...requested].map((c) => (
                      <Badge key={c} tone="purple">{c === "refer" ? "Partner / anchor (refers)" : "Provider (receives)"}</Badge>
                    ))}
                    {o.out_of_scope_last_30d ? <Badge>Out-of-scope requests: {o.out_of_scope_last_30d}</Badge> : null}
                  </div>
                </div>
                <form action={decideOrganization} className="grid gap-3">
                  <input type="hidden" name="orgId" value={o.id} />
                  <div className="flex flex-wrap gap-4 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="refer" defaultChecked={requested.has("refer")} className="size-4 accent-[var(--primary)]" />
                      Approve as partner / anchor (refers)
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" name="receive" defaultChecked={requested.has("receive")} className="size-4 accent-[var(--primary)]" />
                      Approve as provider (receives)
                    </label>
                  </div>
                  <input
                    name="note"
                    maxLength={500}
                    placeholder="Internal note (optional)"
                    aria-label="Internal note"
                    className="h-10 rounded-lg border border-border px-3 text-sm"
                  />
                  <div className="flex gap-2">
                    <Button name="decision" value="approve" size="sm">Approve</Button>
                    <Button name="decision" value="reject" size="sm" variant="secondary">Reject</Button>
                  </div>
                </form>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
