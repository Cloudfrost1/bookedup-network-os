import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flash } from "@/components/ui/flash";
import { Field, Input } from "@/components/ui/form";
import { Checkbox, Select, Textarea } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { saveFollowup, updateOrganizationAdmin } from "@/modules/admin/actions";
import { date, dateTime, toneFor } from "@/modules/format";

export const metadata: Metadata = { title: "Organization" };

type Team = { user_id: string; full_name: string | null; email: string; role: string };

export default async function OrganizationAdminPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select(
      "id, name, email, phone, website, city, state, zip, status, verification, referral_code, out_of_scope_last_30d, created_at, description, organization_capabilities(capability, status), organization_followups(last_contact_at, next_followup_at, outcome, notes)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!org) notFound();

  const [{ data: services }, { data: areas }, { data: team }, { data: activation }, { data: ranking }, { count: sent }, { count: qualified }, { count: received }] =
    await Promise.all([
      supabase.from("organization_services").select("kind, service_categories(name)").eq("org_id", id),
      supabase.from("organization_service_areas").select("regions(city)").eq("org_id", id),
      supabase.rpc("org_team", { p_org: id }),
      supabase.rpc("organization_activation", { p_org: id }),
      supabase.rpc("my_ranking", { p_org: id }),
      supabase.from("referrals").select("id", { count: "exact", head: true }).eq("source_org_id", id),
      supabase.from("referrals").select("id", { count: "exact", head: true }).eq("source_org_id", id).not("qualified_at", "is", null),
      supabase.from("referral_assignments").select("id", { count: "exact", head: true }).eq("provider_org_id", id),
    ]);

  const caps = (org.organization_capabilities ?? []) as { capability: string; status: string }[];
  const cap = (c: string) => caps.find((x) => x.capability === c);
  const fu = (Array.isArray(org.organization_followups) ? org.organization_followups[0] : org.organization_followups) as {
    last_contact_at: string | null;
    next_followup_at: string | null;
    outcome: string | null;
    notes: string | null;
  } | null;
  type Svc = { kind: string; service_categories: { name: string } | null };
  const svc = (services ?? []) as unknown as Svc[];
  const r = (ranking ?? {}) as { partner?: { score: number | null; level: string } | null; provider?: { score: number | null; level: string } | null };

  return (
    <>
      <Link href="/admin/organizations" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Organizations
      </Link>
      <PageHeader title={org.name} description={[org.city, org.state, org.zip].filter(Boolean).join(", ") + ` · joined ${date(org.created_at)}`} />
      <Flash sp={sp} />
      <div className="flex flex-wrap gap-2">
        <Badge tone={toneFor(org.status)}>{org.status.replace("_", " ")}</Badge>
        <Badge tone={toneFor(String(activation))}>Activation: {String(activation ?? "—")}</Badge>
        {org.verification === "verified" ? <Badge tone="purple">Verified</Badge> : null}
        {r.partner ? <Badge>{r.partner.score === null ? "Partner: not enough data" : `${r.partner.level} · ${r.partner.score}`}</Badge> : null}
        {r.provider ? <Badge>{r.provider.score === null ? "Provider: not enough data" : `${r.provider.level} · ${r.provider.score}`}</Badge> : null}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Referrals sent" value={sent ?? 0} />
        <StatCard label="Qualified" value={qualified ?? 0} />
        <StatCard label="Opportunities received" value={received ?? 0} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid content-start gap-3 text-sm">
          <h2 className="text-base font-semibold">Contact</h2>
          <p>{org.email ?? "—"}</p>
          <p>{org.phone ?? "—"}</p>
          {org.website ? <p className="truncate">{org.website}</p> : null}
          <p className="text-muted">Out-of-scope requests (30 days): {org.out_of_scope_last_30d ?? "—"}</p>
          <p className="text-muted">Referral code: {org.referral_code}</p>
          <h2 className="pt-2 text-base font-semibold">Services</h2>
          <div className="flex flex-wrap gap-1">
            {svc.filter((s) => s.kind === "offered").map((s) => (
              <Badge key={s.service_categories?.name} tone="purple">{s.service_categories?.name}</Badge>
            ))}
          </div>
          <p className="text-muted">
            Turns down: {svc.filter((s) => s.kind === "not_offered").map((s) => s.service_categories?.name).join(", ") || "—"}
          </p>
          <p className="text-muted">
            Serves: {((areas ?? []) as unknown as { regions: { city: string } | null }[]).map((a) => a.regions?.city).join(", ") || "—"}
          </p>
          <h2 className="pt-2 text-base font-semibold">Team</h2>
          <ul className="grid gap-1">
            {((team ?? []) as Team[]).map((m) => (
              <li key={m.user_id}>
                {m.full_name || m.email} <span className="text-muted">· {m.email} · {m.role}</span>
              </li>
            ))}
            {!(team as Team[] | null)?.length ? <li className="text-muted">No members yet (created by admin).</li> : null}
          </ul>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <form action={updateOrganizationAdmin} className="grid gap-3">
              <h2 className="font-semibold">Access</h2>
              <input type="hidden" name="orgId" value={org.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="status" label="Status">
                  <Select id="status" name="status" defaultValue={org.status}>
                    <option value="pending_review">Pending review</option>
                    <option value="approved">Approved</option>
                    <option value="suspended">Suspended</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </Field>
                <Field id="verification" label="Verification">
                  <Select id="verification" name="verification" defaultValue={org.verification}>
                    <option value="not_verified">Not verified</option>
                    <option value="pending">Pending</option>
                    <option value="verified">Verified</option>
                    <option value="expired">Expired</option>
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap gap-4">
                <Checkbox name="refer" defaultChecked={cap("refer")?.status === "approved"} label={`Can refer${cap("refer") ? ` (${cap("refer")!.status})` : ""}`} />
                <Checkbox name="receive" defaultChecked={cap("receive")?.status === "approved"} label={`Can receive${cap("receive") ? ` (${cap("receive")!.status})` : ""}`} />
              </div>
              <Input name="note" maxLength={500} placeholder="Internal note (optional)" aria-label="Internal note" />
              <Button size="sm" className="justify-self-start">Save access</Button>
            </form>
          </Card>
          <Card>
            <form action={saveFollowup} className="grid gap-3">
              <h2 className="font-semibold">Relationship follow-up</h2>
              <p className="text-sm text-muted">Last contact: {dateTime(fu?.last_contact_at)}</p>
              <input type="hidden" name="orgId" value={org.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="next" label="Next follow-up">
                  <Input id="next" name="next" type="date" defaultValue={fu?.next_followup_at?.slice(0, 10) ?? ""} />
                </Field>
                <Field id="outcome" label="Outcome">
                  <Input id="outcome" name="outcome" maxLength={200} defaultValue={fu?.outcome ?? ""} />
                </Field>
              </div>
              <Field id="notes" label="Notes">
                <Textarea id="notes" name="notes" rows={3} maxLength={4000} defaultValue={fu?.notes ?? ""} />
              </Field>
              <Checkbox name="contacted" label="I contacted them today" />
              <Button size="sm" variant="secondary" className="justify-self-start">Save follow-up</Button>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
