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
import { Badge } from "@/components/ui/card";
import { date, referralStatusLabel, toneFor } from "@/modules/format";
import { BlockedBanner, StandingPanel, getStanding } from "@/modules/standing/standing";

export const metadata: Metadata = { title: "Partner dashboard" };

export default async function PartnerDashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const access = await requireUser("/partner");
  const org = access.organizations[0]!;
  const approved = org.status === "approved" && org.can_refer;
  const supabase = await createClient();
  const [{ data: refs }, { data: rank }, { data: turnedDown }, { count: unread }, standing] = await Promise.all([
    supabase.rpc("my_referrals", { p_org: org.id }),
    supabase.rpc("my_ranking", { p_org: org.id }),
    supabase.from("organization_services").select("service_categories(name)").eq("org_id", org.id).eq("kind", "not_offered"),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null).eq("for_admins", false),
    getStanding(org.id),
  ]);
  const referrals = (refs ?? []) as { id: string; number: number; service: string; city: string; status: string; created_at: string; provider_name: string | null }[];
  const declinedNames = (turnedDown ?? [])
    .map((r) => {
      const c = r.service_categories as { name: string } | { name: string }[] | null;
      return Array.isArray(c) ? c[0]?.name : c?.name;
    })
    .filter((n): n is string => Boolean(n));
  const services = declinedNames.length;
  const inProgress = referrals.filter((r) => !["closed", "rejected"].includes(r.status)).length;
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
      {standing ? <BlockedBanner s={standing} area="partner" /> : null}
      {unread ? (
        <Card className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
          <span>You have {unread} unread {unread === 1 ? "notification" : "notifications"}.</span>
          <Link href="/partner/notifications" className="font-medium text-primary hover:underline">View</Link>
        </Card>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Referrals sent" value={referrals.length} />
        <StatCard label="Qualified" value={qualified} hint="Checked and authorized by BookedUp" />
        <StatCard label="Homeowners connected" value={withProvider} hint="Sent to a matching provider" />
        <StatCard label="In progress" value={inProgress} />
      </div>
      {approved ? <ReferralLinkCard orgId={org.id} /> : null}
      <Card className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">Your referrals</h2>
          <Link href="/partner/referrals" className="text-sm font-semibold text-primary hover:underline">
            See all
          </Link>
        </div>
        {!referrals.length ? (
          <p className="m-0 text-sm text-muted">
            No referrals yet. When a customer asks for something you don&apos;t do, send it here and follow every step.
          </p>
        ) : (
          <ul className="grid gap-0 p-0">
            {referrals.slice(0, 5).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2.5 text-sm last:border-0">
                <span className="grid">
                  <span className="font-semibold">
                    #{r.number} · {r.service}
                  </span>
                  <span className="text-xs text-muted">
                    {r.city} · {date(r.created_at)}
                    {r.provider_name ? ` · Sent to ${r.provider_name}` : ""}
                  </span>
                </span>
                <Badge tone={toneFor(r.status)}>{referralStatusLabel[r.status] ?? r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">Requests you usually turn down</h2>
          <Link href="/partner/business" className="text-sm font-semibold text-primary hover:underline">
            Edit
          </Link>
        </div>
        {declinedNames.length ? (
          <div className="flex flex-wrap gap-2">
            {declinedNames.map((n) => (
              <Badge key={n} tone="purple">
                {n}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="m-0 text-sm text-muted">List them so you remember what to refer — these are your opportunities to help customers.</p>
        )}
      </Card>
      {standing ? <StandingPanel s={standing} /> : null}
      <section className="grid gap-3">
        <h2 className="text-lg">Getting started</h2>
        <Checklist
          items={[
            { done: true, label: "Create your account and business" },
            { done: Boolean(services), label: "List the requests you usually turn down (My Business)" },
            { done: org.status === "approved", label: "Get approved by BookedUp" },
            { done: referrals.length > 0, label: "Send your first referral" },
          ]}
        />
      </section>
      <p className="m-0 text-sm text-muted">
        Partner level: <span className="font-semibold text-foreground">{partnerRank?.score != null ? `${partnerRank.level} · score ${partnerRank.score}` : "after 3 referrals"}</span> ·{" "}
        <Link href="/partner/ranking" className="text-primary hover:underline">
          Ranking
        </Link>{" "}
        ·{" "}
        <Link href="/partner/network" className="text-primary hover:underline">
          Find Partners
        </Link>
      </p>
    </>
  );
}
