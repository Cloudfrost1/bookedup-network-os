import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { getCatalog } from "@/modules/network/catalog";
import { BusinessForm } from "./business-form";
import { ServicesForm, TeamForm } from "./more-forms";

export const metadata: Metadata = { title: "My Business" };

type Team = { user_id: string; full_name: string | null; email: string; role: string; joined_at: string };

export default async function BusinessPage() {
  const access = await requireUser("/app/business");
  const current = access.organizations[0];
  if (!current) {
    return (
      <EmptyState title="No business yet" action={<Button asChild><Link href="/app/business/new">Add your business</Link></Button>}>
        Add your business to request access to the network.
      </EmptyState>
    );
  }

  const supabase = await createClient();
  const [{ data: org }, { data: services }, { data: areas }, { data: team }, catalog] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, email, phone, website, state, city, zip, description, status, verification, referral_code, category_id, public_profile, available_for_referrals")
      .eq("id", current.id)
      .single(),
    supabase.from("organization_services").select("category_id, kind").eq("org_id", current.id),
    supabase.from("organization_service_areas").select("region_id").eq("org_id", current.id),
    supabase.rpc("org_team", { p_org: current.id }),
    getCatalog(),
  ]);
  if (!org) return <EmptyState title="Business not found" />;

  const canEdit = current.role === "owner" || current.role === "manager";
  const offered = (services ?? []).filter((s) => s.kind === "offered").map((s) => s.category_id as string);
  const notOffered = (services ?? []).filter((s) => s.kind === "not_offered").map((s) => s.category_id as string);

  return (
    <>
      <PageHeader title="My Business" description="Your profile, services, service areas and team." />
      <div className="flex flex-wrap gap-2">
        <Badge tone={org.status === "approved" ? "success" : "warning"}>{org.status === "pending_review" ? "Pending Review" : org.status}</Badge>
        <Badge tone={org.verification === "verified" ? "purple" : "neutral"}>
          {org.verification === "verified" ? "Verified" : "Not verified"}
        </Badge>
        <Badge>Your role: {current.role}</Badge>
      </div>
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
          />
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
