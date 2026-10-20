import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Card, StatCard } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminOverview() {
  const supabase = await createClient();
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const orgs = () => supabase.from("organizations").select("id", { count: "exact", head: true }).is("deleted_at", null);
  const caps = (cap: "refer" | "receive") =>
    supabase.from("organization_capabilities").select("id", { count: "exact", head: true }).eq("capability", cap).eq("status", "approved");

  const [total, pending, partners, providers] = await Promise.all([
    count(orgs()),
    count(orgs().eq("status", "pending_review")),
    count(caps("refer")),
    count(caps("receive")),
  ]);

  return (
    <>
      <PageHeader title="Overview" description="BookedUp Orlando" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Organizations" value={total} />
        <StatCard label="Pending Approvals" value={pending} />
        <StatCard label="Approved Referral Partners" value={partners} />
        <StatCard label="Approved Service Providers" value={providers} />
      </div>
      <section className="grid gap-3" aria-labelledby="action">
        <h2 id="action" className="text-lg font-semibold">Action Required</h2>
        <Card className="text-sm">
          {pending > 0 ? (
            <Link href="/admin/approvals" className="font-medium text-primary hover:underline">
              {pending} {pending === 1 ? "business is" : "businesses are"} waiting for review
            </Link>
          ) : (
            <span className="text-muted">Nothing to review right now.</span>
          )}
        </Card>
      </section>
    </>
  );
}
