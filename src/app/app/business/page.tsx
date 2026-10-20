import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import { BusinessForm } from "./business-form";

export const metadata: Metadata = { title: "My Business" };

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
  const [{ data: org }, { data: members }] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, email, phone, website, state, city, zip, description, status, verification, referral_code")
      .eq("id", current.id)
      .single(),
    supabase.from("organization_members").select("user_id, role, created_at").eq("org_id", current.id).order("created_at"),
  ]);
  if (!org) return <EmptyState title="Business not found" />;

  const canEdit = current.role === "owner" || current.role === "manager";

  return (
    <>
      <PageHeader title="My Business" description="Your public profile and account details." />
      <div className="flex flex-wrap gap-2">
        <Badge tone={org.status === "approved" ? "success" : "warning"}>{org.status === "pending_review" ? "Pending Review" : org.status}</Badge>
        <Badge tone={org.verification === "verified" ? "purple" : "neutral"}>
          {org.verification === "verified" ? "Verified" : "Not verified"}
        </Badge>
        <Badge>Your role: {current.role}</Badge>
      </div>
      {canEdit ? (
        <BusinessForm org={org} />
      ) : (
        <Card className="text-sm text-muted">Only owners and managers can edit the business profile.</Card>
      )}
      <Card className="grid gap-2">
        <h2 className="font-semibold">Team</h2>
        <p className="text-sm text-muted">
          {members?.length ?? 0} {members?.length === 1 ? "member" : "members"}. Inviting team members arrives with the next release.
        </p>
      </Card>
    </>
  );
}
