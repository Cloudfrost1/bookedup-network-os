import Link from "next/link";
import type { Metadata } from "next";
import { Send } from "lucide-react";
import { PageHeader } from "@/components/layout/shell";
import { Card, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { firstName, requireUser } from "@/modules/auth/session";
import { Checklist, ReviewNotice } from "@/modules/shared/checklist";
import { ReferralLinkCard } from "./referrals/referral-link";

export const metadata: Metadata = { title: "Partner dashboard" };

export default async function PartnerDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const access = await requireUser("/partner");
  const org = access.organizations[0]!;
  const approved = org.status === "approved" && org.can_refer;
  const supabase = await createClient();
  const [{ data: refs }, { data: rank }, { count: services }, { count: unread }] = await Promise.all([
    supabase.rpc("my_referrals", { p_org: org.id }),
    supabase.rpc("my_ranking", { p_org: org.id }),
    supabase.from("organization_services").select("org_id", { count: "exact", head: true }).eq("org_id", org.id).eq("kind", "not_offered"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null).eq("for_admins", false),
  ]);
  const referrals = (refs ?? []) as { status: string; provider_name: string | null }[];
  const qualified = referrals.filter((r) => ["qualified", "matching", "assigned", "closed"].includes(r.status)).length;
  const withProvider = referrals.filter((r) => r.provider_name).length;
  const partnerRank = (rank as { partner?: { level: string; score: number | null } | null } | null)?.partner;

  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName(access.fullName, access.email)}`}
        description={`${org.name} · Referral partner`}
        action={
          approved ? (
            <Button asChild>
              <Link href="/partner/referrals/new">
                <Send aria-hidden /> Send Referral
              </Link>
            </Button>
          ) : null
        }
      />
      {sp.created ? <FormMessage tone="success">Business submitted. BookedUp will review it and let you know.</FormMessage> : null}
      {sp.password ? <FormMessage tone="success">Password updated.</FormMessage> : null}
      {sp.blocked ? <FormMessage>That area opens after BookedUp approves your business.</FormMessage> : null}
      <ReviewNotice status={org.status} />
      {unread ? (
        <Card className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
          <span>You have {unread} unread {unread === 1 ? "notification" : "notifications"}.</span>
          <Link href="/partner/notifications" className="font-medium text-primary hover:underline">View</Link>
        </Card>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Referrals sent" value={referrals.length} />
        <StatCard label="Qualified" value={qualified} />
        <StatCard label="Sent to a provider" value={withProvider} />
        <StatCard label="Partner level" value={partnerRank?.score != null ? partnerRank.level : "—"} hint={partnerRank?.score != null ? `Score ${partnerRank.score}` : "After 3 referrals"} />
      </div>
      {approved ? <ReferralLinkCard orgId={org.id} /> : null}
      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Getting started</h2>
        <Checklist
          items={[
            { done: true, label: "Create your account and business" },
            { done: Boolean(services), label: "List the requests you usually turn down (My Business)" },
            { done: org.status === "approved", label: "Get approved by BookedUp" },
            { done: referrals.length > 0, label: "Send your first referral" },
          ]}
        />
      </section>
    </>
  );
}
