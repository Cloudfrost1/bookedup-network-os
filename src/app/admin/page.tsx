import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Card, StatCard } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin overview" };

type Overview = Record<
  | "total_orgs" | "partners" | "providers" | "pending_orgs" | "new_referrals_7d" | "qualified_30d"
  | "consent_pending" | "under_review" | "unmatched" | "no_response" | "growth_behind",
  number
>;

export default async function AdminOverview() {
  const supabase = await createClient();
  const [{ data }, { count: followups }, { count: docs }, { count: feedback }] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.from("organization_followups").select("org_id", { count: "exact", head: true }).lte("next_followup_at", new Date().toISOString()),
    supabase.from("professional_documents").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("assignment_feedback").select("id", { count: "exact", head: true }).eq("verified", false),
  ]);
  const o = (data ?? {}) as Overview;

  const actions = [
    { n: o.pending_orgs, href: "/admin/approvals", text: "businesses waiting for approval" },
    { n: o.consent_pending, href: "/admin/referrals?status=consent_pending", text: "referrals need homeowner authorization confirmed" },
    { n: o.under_review, href: "/admin/referrals?status=under_review", text: "referrals ready to qualify" },
    { n: o.unmatched, href: "/admin/referrals?status=qualified", text: "qualified referrals without a provider" },
    { n: o.no_response, href: "/admin/referrals?status=assigned", text: "opportunities without provider response for 24h+" },
    { n: o.growth_behind, href: "/admin/growth", text: "Growth contracts behind pace" },
    { n: docs ?? 0, href: "/admin/providers", text: "provider documents to review" },
    { n: feedback ?? 0, href: "/admin/referrals?status=assigned", text: "feedbacks waiting for verification" },
    { n: followups ?? 0, href: "/admin/organizations?followup=due", text: "partner follow-ups due" },
  ].filter((a) => a.n > 0);

  return (
    <>
      <PageHeader title="Overview" description="BookedUp Orlando · live numbers" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Organizations" value={o.total_orgs ?? 0} />
        <StatCard label="Approved partners (anchors)" value={o.partners ?? 0} hint="Can refer" />
        <StatCard label="Approved providers" value={o.providers ?? 0} hint="Can receive" />
        <StatCard label="Pending approvals" value={o.pending_orgs ?? 0} />
        <StatCard label="New referrals" value={o.new_referrals_7d ?? 0} hint="Last 7 days" />
        <StatCard label="Qualified" value={o.qualified_30d ?? 0} hint="Last 30 days" />
        <StatCard label="Waiting for a provider" value={o.unmatched ?? 0} />
        <StatCard label="No provider response" value={o.no_response ?? 0} hint="24h+" />
      </div>
      <section className="grid gap-3" aria-labelledby="action">
        <h2 id="action" className="text-lg font-semibold">Action Required</h2>
        <Card className="grid gap-2 text-sm">
          {actions.length ? (
            actions.map((a) => (
              <Link key={a.href} href={a.href} className="flex items-center gap-2 font-medium text-primary hover:underline">
                <span className="grid min-w-7 place-items-center rounded-full bg-primary-soft px-2 py-0.5 text-xs tabular-nums text-primary-deep">{a.n}</span>
                {a.text}
              </Link>
            ))
          ) : (
            <span className="text-muted">Nothing needs attention right now.</span>
          )}
        </Card>
      </section>
    </>
  );
}
