import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Card, StatCard } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { firstName, requireUser } from "@/modules/auth/session";
import { Checklist, ReviewNotice } from "@/modules/shared/checklist";
import { BlockedBanner, StandingPanel, getStanding } from "@/modules/standing/standing";
import { MatchingNote } from "@/modules/shared/matching";
import { ConnectionRequests } from "@/modules/network/connection-requests";
import { ProviderJourney, type Stage } from "@/modules/standing/stage";
import { GrowthBlock, type GrowthProgress } from "@/modules/growth/progress";

export const metadata: Metadata = { title: "Provider dashboard" };

type Rel = { received: number; accepted: number; median_response_hours: number | null; docs_verified: boolean; trusted: boolean; capacity_confirmed_at: string | null; accepting_new_work: boolean | null };

export default async function ProviderDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const access = await requireUser("/provider");
  const org = access.organizations[0]!;
  const supabase = await createClient();
  const [{ data: opps }, { data: rel }, { count: docs }, { count: areas }, standing, { data: programs }] = await Promise.all([
    supabase.rpc("list_my_opportunities_v2", { p_org: org.id }),
    supabase.rpc("provider_reliability", { p_org: org.id }),
    supabase.from("professional_documents").select("id", { count: "exact", head: true }).eq("org_id", org.id),
    supabase.from("organization_service_areas").select("org_id", { count: "exact", head: true }).eq("org_id", org.id),
    getStanding(org.id),
    supabase.rpc("my_growth_program", { p_org: org.id }),
  ]);
  const program = ((programs ?? []) as GrowthProgress[]).find((p) => ["active", "continuation_required"].includes(p.status));
  const list = (opps ?? []) as { status: string }[];
  const r = (rel ?? {}) as Rel;
  const fresh = list.filter((o) => o.status === "offered").length;
  const open = list.filter((o) => ["accepted", "contacted", "estimate_scheduled", "estimate_sent"].includes(o.status)).length;
  const capacityStale = !r.capacity_confirmed_at || Date.now() - new Date(r.capacity_confirmed_at).getTime() > 30 * 864e5;

  return (
    <>
      <PageHeader title={`Welcome, ${firstName(access.fullName, access.email)}`} description={`${org.name} · Service provider`} />
      {sp.created ? <FormMessage tone="success">Business submitted. BookedUp will review it and let you know.</FormMessage> : null}
      {sp.blocked ? <FormMessage>Opportunities open after BookedUp approves your business.</FormMessage> : null}
      <ReviewNotice status={org.status} />
      {fresh ? (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-warning/30 bg-warning/5 p-4 text-sm">
          <span>{fresh} new {fresh === 1 ? "opportunity is" : "opportunities are"} waiting for your answer.</span>
          <Link href="/provider/opportunities" className="font-medium text-primary hover:underline">Answer now</Link>
        </Card>
      ) : null}
      {standing ? <BlockedBanner s={standing} area="provider" /> : null}
      {program ? <GrowthBlock p={program} /> : standing?.stage ? <ProviderJourney stage={standing.stage as Stage} /> : null}
      {standing ? <StandingPanel s={standing} /> : null}
      <ConnectionRequests orgId={org.id} canManage={org.role !== "member"} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="New opportunities" value={fresh} />
        <StatCard label="In progress" value={open} />
        <StatCard label="Median response" value={r.median_response_hours != null ? `${r.median_response_hours}h` : "—"} />
        <StatCard
          label="Documents"
          value={r.docs_verified ? "Verified" : standing && [standing.license, standing.insurance].includes("expired") ? "Expired" : docs ? "Incomplete" : "Missing"}
          hint={r.docs_verified ? undefined : "License and insurance both verified"}
        />
      </div>
      <MatchingNote />
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Getting started</h2>
        <Checklist
          items={[
            { done: true, label: "Create your account and business" },
            { done: Boolean(areas), label: "Add your services and the cities you serve (My Business)" },
            { done: !capacityStale, label: "Confirm your capacity (availability, project size, lead time)" },
            { done: Boolean(r.docs_verified), label: "Get your license and insurance verified" },
            { done: org.status === "approved", label: "Get approved by BookedUp" },
          ]}
        />
      </section>
    </>
  );
}
