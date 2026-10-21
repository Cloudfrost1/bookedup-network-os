import Link from "next/link";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { getCatalog } from "@/modules/network/catalog";
import { DocsChecklist, type DocRow } from "@/modules/provider/docs-status";
import { StandingPanel, getStanding } from "@/modules/standing/standing";
import { date, money } from "@/modules/format";
import { BusinessForm } from "./business-form";
import { ServicesForm, TeamForm } from "./more-forms";


type Team = { user_id: string; full_name: string | null; email: string; role: string; joined_at: string };

export default async function BusinessPage() {
  const access = await requireUser("/app");
  const current = access.organizations[0];
  if (!current) {
    return (
      <EmptyState title="No business yet" action={<Button asChild><Link href="/onboarding">Add your business</Link></Button>}>
        Add your business to request access to the network.
      </EmptyState>
    );
  }

  const supabase = await createClient();
  const refers = current.can_refer || current.requested.includes("refer");
  const receives = current.can_receive || current.requested.includes("receive");
  const [{ data: org }, { data: services }, { data: areas }, { data: team }, catalog, { data: docRows }, { data: cap }, standing] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, email, phone, website, state, city, zip, description, status, verification, referral_code, category_id, public_profile, available_for_referrals")
      .eq("id", current.id)
      .single(),
    supabase.from("organization_services").select("category_id, kind").eq("org_id", current.id),
    supabase.from("organization_service_areas").select("region_id").eq("org_id", current.id),
    supabase.rpc("org_team", { p_org: current.id }),
    getCatalog(),
    supabase.from("professional_documents").select("kind, status, expires_on").eq("org_id", current.id),
    supabase.from("provider_capacity").select("accepting_new_work, weekly_capacity, min_project_value, max_project_value, lead_time_days, confirmed_at").eq("org_id", current.id).maybeSingle(),
    getStanding(current.id),
  ]);
  if (!org) return <EmptyState title="Business not found" />;

  const canEdit = current.role === "owner" || current.role === "manager";
  const offered = (services ?? []).filter((s) => s.kind === "offered").map((s) => s.category_id as string);
  const notOffered = (services ?? []).filter((s) => s.kind === "not_offered").map((s) => s.category_id as string);

  return (
    <>
      <PageHeader
        title="My Business"
        description={
          refers && receives
            ? "You refer and receive projects: all settings apply to you."
            : refers
              ? "You refer projects: services, requests you turn down and directory visibility."
              : "You receive projects: services, cities, availability, capacity and documents."
        }
      />
      <div className="flex flex-wrap gap-2">
        <Badge>Your role: {current.role}</Badge>
        <Badge tone="purple">{refers && receives ? "Refers and receives" : refers ? "Refers projects" : "Receives projects"}</Badge>
      </div>
      {standing ? <StandingPanel s={standing} title="Status" /> : null}
      {canEdit ? (
        <>
          <BusinessForm org={org} />
          <ServicesForm
            orgId={org.id}
            categories={catalog.categories}
            regions={catalog.regions}
            values={{
              category: org.category_id,
              offered,
              notOffered,
              regions: (areas ?? []).map((a) => a.region_id as string),
              publicProfile: org.public_profile,
              available: org.available_for_referrals,
            }}
            refers={refers}
            receives={receives}
          />
          {refers ? (
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <span className="grid gap-0.5">
                <span className="font-semibold">Send referrals</span>
                <span className="text-sm text-muted">Refer a customer you can&apos;t serve, or share your referral link.</span>
              </span>
              <Button asChild size="sm">
                <Link href="/partner/referrals/new">Send a referral</Link>
              </Button>
            </Card>
          ) : null}
          {receives ? (
            <Card className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Capacity and documents</h2>
                <Button asChild size="sm" variant="secondary">
                  <Link href="/provider/capacity">Update</Link>
                </Button>
              </div>
              <p className="text-sm">
                {cap
                  ? `${cap.accepting_new_work ? "Taking new projects" : "Paused"} · ${cap.weekly_capacity ?? "—"} per week · ${money(cap.min_project_value)} – ${money(cap.max_project_value)} · starts in ${cap.lead_time_days ?? "—"} days · confirmed ${date(cap.confirmed_at)}`
                  : "Capacity not set yet."}
              </p>
              <DocsChecklist docs={(docRows ?? []) as DocRow[]} />
            </Card>
          ) : null}
        </>
      ) : (
        <Card className="text-sm text-muted">Only owners and managers can edit the business profile.</Card>
      )}
      <Card className="grid gap-4">
        <h2 className="text-lg font-semibold">Team</h2>
        <ul className="divide-y divide-border text-sm">
          {((team ?? []) as Team[]).map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="font-medium">{m.full_name || m.email}</span>
                <span className="block truncate text-muted">{m.email}</span>
              </span>
              <Badge>{m.role}</Badge>
            </li>
          ))}
        </ul>
        {canEdit ? <TeamForm orgId={org.id} /> : null}
      </Card>
    </>
  );
}
