import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, EmptyState, StatCard } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { firstName, requireUser } from "@/modules/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const access = await requireUser("/app");
  const org = access.organizations[0];
  const hello = `Welcome back, ${firstName(access.fullName, access.email)}!`;

  if (!org) {
    return (
      <>
        <PageHeader title={hello} description="Add your business to request access to the network." />
        <EmptyState
          title="Your business isn't set up yet"
          action={
            <Button asChild>
              <Link href="/app/business/new">Add your business</Link>
            </Button>
          }
        >
          It takes about two minutes. BookedUp reviews every business before it can send or receive projects.
        </EmptyState>
      </>
    );
  }

  const pending = org.status === "pending_review";
  const supabase = await createClient();
  const [{ data: refs }, { data: opps }, { count: services }, { count: areas }, { count: unread }] = await Promise.all([
    org.can_refer ? supabase.rpc("my_referrals", { p_org: org.id }) : Promise.resolve({ data: [] }),
    org.can_receive ? supabase.rpc("list_my_opportunities", { p_org: org.id }) : Promise.resolve({ data: [] }),
    supabase.from("organization_services").select("org_id", { count: "exact", head: true }).eq("org_id", org.id),
    supabase.from("organization_service_areas").select("org_id", { count: "exact", head: true }).eq("org_id", org.id),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null).eq("for_admins", false),
  ]);
  const referrals = (refs ?? []) as { status: string }[];
  const opportunities = (opps ?? []) as { status: string }[];
  const qualified = referrals.filter((r) => ["qualified", "matching", "assigned", "closed"].includes(r.status)).length;
  const openOpps = opportunities.filter((o) => ["offered", "accepted", "contacted", "estimate_scheduled", "estimate_sent"].includes(o.status)).length;
  const newOpps = opportunities.filter((o) => o.status === "offered").length;
  const caps: { key: "refer" | "receive"; label: string; on: boolean }[] = [
    { key: "refer", label: "Refer projects", on: org.can_refer },
    { key: "receive", label: "Receive projects", on: org.can_receive },
  ];

  return (
    <>
      <PageHeader title={hello} description={org.name} />
      {sp.created ? <FormMessage tone="success">Business submitted. We&apos;ll review it and let you know.</FormMessage> : null}
      {sp.password ? <FormMessage tone="success">Password updated.</FormMessage> : null}
      {sp.blocked ? <FormMessage>That area needs BookedUp approval for your business first.</FormMessage> : null}
      {unread ? (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-primary/30 bg-primary-soft/40 p-4 text-sm">
          <span>
            You have {unread} unread {unread === 1 ? "notification" : "notifications"}.
          </span>
          <Link href="/app/notifications" className="font-medium text-primary hover:underline">View</Link>
        </Card>
      ) : null}
      {newOpps ? (
        <Card className="flex flex-wrap items-center justify-between gap-2 border-warning/30 bg-warning/5 p-4 text-sm">
          <span>
            {newOpps} new {newOpps === 1 ? "opportunity is" : "opportunities are"} waiting for your answer.
          </span>
          <Link href="/app/opportunities" className="font-medium text-primary hover:underline">Answer now</Link>
        </Card>
      ) : null}
      {org.status === "approved" ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Referrals sent" value={org.can_refer ? referrals.length : "—"} />
          <StatCard label="Qualified referrals" value={org.can_refer ? qualified : "—"} />
          <StatCard label="Opportunities received" value={org.can_receive ? opportunities.length : "—"} />
          <StatCard label="Open opportunities" value={org.can_receive ? openOpps : "—"} />
        </div>
      ) : null}

      {pending ? (
        <Card className="flex items-start gap-3 border-warning/30 bg-warning/5">
          <Clock aria-hidden className="mt-0.5 size-5 text-warning" />
          <div className="grid gap-1">
            <p className="font-medium">Your business is under review</p>
            <p className="text-sm text-muted">
              BookedUp reviews every business before it can send or receive projects. You can keep your profile up to date meanwhile.
            </p>
          </div>
        </Card>
      ) : null}
      {org.status === "suspended" || org.status === "rejected" ? (
        <Card className="border-danger/30 bg-danger/5 text-sm">
          This business can&apos;t send or receive projects right now. Contact BookedUp through Support.
        </Card>
      ) : null}

      <section className="grid gap-3" aria-labelledby="access">
        <h2 id="access" className="text-lg font-semibold">Network access</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {caps.map((c) => {
            const requested = org.requested.includes(c.key);
            return (
              <Card key={c.key} className="flex items-center justify-between gap-3 p-4">
                <span className="text-sm font-medium">{c.label}</span>
                {c.on ? (
                  <Badge tone="success">Approved</Badge>
                ) : requested ? (
                  <Badge tone="warning">Requested</Badge>
                ) : (
                  <Badge>Not requested</Badge>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3" aria-labelledby="next">
        <h2 id="next" className="text-lg font-semibold">Getting started</h2>
        <Card className="grid gap-3 p-4">
          {[
            { done: true, label: "Create your account" },
            { done: true, label: "Add your business" },
            { done: Boolean(services) && Boolean(areas), label: "Add your services and the cities you serve" },
            { done: !pending, label: "Get approved by BookedUp" },
            ...(org.can_refer ? [{ done: referrals.length > 0, label: "Send your first referral" }] : []),
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 text-sm">
              {s.done ? <CheckCircle2 aria-hidden className="size-5 text-primary" /> : <Circle aria-hidden className="size-5 text-muted" />}
              <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/app/business">Review business profile</Link>
            </Button>
            {org.can_refer && org.status === "approved" ? (
              <Button asChild size="sm">
                <Link href="/app/referrals/new">Send a referral</Link>
              </Button>
            ) : null}
          </div>
        </Card>
      </section>
    </>
  );
}
