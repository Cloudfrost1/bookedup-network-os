import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Card, StatCard } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { pct } from "@/modules/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

type A = Record<string, number | null>;

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const days = sp.days === "90" ? 90 : 30;
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_analytics", { p_days: days });
  const a = (data ?? {}) as A;
  const n = (k: string) => a[k] ?? 0;
  const rate = n("submitted") ? Number(n("qualified")) / Number(n("submitted")) : null;

  return (
    <>
      <PageHeader
        title="Reports"
        description="Real numbers only. Nothing here is estimated."
        action={
          <div className="flex gap-1">
            {[30, 90].map((d) => (
              <Link
                key={d}
                href={`/admin/reports?days=${d}`}
                className={cn("rounded-full px-3 py-1.5 text-sm", d === days ? "bg-primary text-white" : "bg-subtle hover:bg-primary-soft")}
              >
                {d} days
              </Link>
            ))}
          </div>
        }
      />
      <h2 className="text-lg font-semibold">Network</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="New sign-ups" value={n("registered")} hint={`Last ${days} days`} />
        <StatCard label="Approved businesses" value={n("approved")} hint="Total" />
        <StatCard label="Activated" value={n("activated")} hint="Services + cities set" />
        <StatCard label="Productive partners" value={n("productive_partners")} hint="1+ qualified referral" />
      </div>
      <h2 className="text-lg font-semibold">Referrals</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Submitted" value={n("submitted")} />
        <StatCard label="Qualified" value={n("qualified")} hint={`Qualification rate ${pct(rate)}`} />
        <StatCard label="Rejected" value={n("rejected")} />
        <StatCard label="Qualified / productive partner / month" value={a.qualified_per_productive_partner_per_month ?? "—"} />
      </div>
      <h2 className="text-lg font-semibold">Distribution</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Waiting for a provider" value={n("unmatched")} hint="Now" />
        <StatCard label="Hours to assignment" value={a.avg_hours_to_assignment ?? "—"} hint="Average" />
        <StatCard label="Provider acceptance" value={pct(a.provider_acceptance_rate)} />
        <StatCard label="Growth deliveries" value={n("growth_delivered")} hint="Active contracts" />
      </div>
      <Card className="text-sm text-muted">
        The key health number is qualified referrals per productive partner per month. Recruiting more partners only helps if this number holds.
      </Card>
    </>
  );
}
