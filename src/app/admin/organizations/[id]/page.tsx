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
import { deleteOrganization, restoreOrganization, reviewDocument, saveFollowup, setProviderTrack, updateOrganizationAdmin } from "@/modules/admin/actions";
import { requireAdmin } from "@/modules/auth/session";
import { ReliabilityView, type Reliability } from "@/modules/provider/reliability-view";
import { docKindLabel } from "@/modules/provider/labels";
import { DocsChecklist } from "@/modules/provider/docs-status";
import { BlockedBanner, StandingPanel, getStanding } from "@/modules/standing/standing";
import { stageLabel, stageTone } from "@/modules/standing/stage";
import { GrowthAdminControls } from "@/modules/growth/admin-controls";
import { date, dateTime, money, toneFor } from "@/modules/format";

const CONSENT_LABELS = [
  ["terms_privacy", "Terms of Service and Privacy Policy"],
  ["data_use", "Use of business data for review and matching"],
  ["referral_authorization", "Only refers customers who allowed sharing their details"],
  ["contact_email", "Contact by e-mail"],
  ["contact_sms", "Contact by SMS"],
  ["contact_whatsapp", "Contact by WhatsApp"],
] as const;

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
  const access = await requireAdmin();
  const isSuper = access.platformRole === "super_admin";
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select(
      "id, name, email, phone, website, city, state, zip, status, verification, deleted_at, referral_code, out_of_scope_last_30d, created_at, description, provider_track, organization_capabilities(capability, status), organization_followups(last_contact_at, next_followup_at, outcome, notes)",
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
  const isProvider = caps.some((c) => c.capability === "receive");
  type Doc = { id: string; kind: string; number: string | null; issuer: string | null; expires_on: string | null; status: string; file_path: string | null; review_note: string | null };
  const standing = await getStanding(id);
  const { data: consentRows } = await supabase
    .from("organization_consents")
    .select("kind, granted, version, created_at")
    .eq("org_id", id)
    .order("created_at", { ascending: false });
  const consents = new Map<string, { granted: boolean; version: string; created_at: string }>();
  for (const c of consentRows ?? []) if (!consents.has(c.kind)) consents.set(c.kind, c);
  const [{ data: capacity }, { data: docRows }, { data: rel }] = isProvider
    ? await Promise.all([
        supabase.from("provider_capacity").select("*").eq("org_id", id).maybeSingle(),
        supabase.from("professional_documents").select("id, kind, number, issuer, expires_on, status, file_path, review_note").eq("org_id", id).order("created_at", { ascending: false }),
        supabase.rpc("provider_reliability", { p_org: id }),
      ])
    : [{ data: null }, { data: [] }, { data: null }];
  const docs = (docRows ?? []) as Doc[];
  const paths = docs.map((d) => d.file_path).filter((p): p is string => Boolean(p));
  const { data: signedDocs } = paths.length ? await supabase.storage.from("provider-docs").createSignedUrls(paths, 3600) : { data: [] };
  const docUrl = new Map((signedDocs ?? []).map((x) => [x.path, x.signedUrl]));
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
        {org.deleted_at ? <Badge tone="danger">Deleted {date(org.deleted_at)}</Badge> : null}
        <Badge tone={toneFor(org.status)}>{org.status.replace("_", " ")}</Badge>
        <Badge tone={toneFor(String(activation))}>Activation: {String(activation ?? "—")}</Badge>
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
          <p className="flex flex-wrap gap-1">
            {cap("refer") ? <Badge tone="purple">Partner / anchor</Badge> : null}
            {cap("receive") ? <Badge tone="purple">Provider</Badge> : null}
          </p>
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
              <div className="grid gap-3">
                <Field id="status" label="Status">
                  <Select id="status" name="status" defaultValue={org.status}>
                    <option value="pending_review">Pending review</option>
                    <option value="approved">Approved</option>
                    <option value="suspended">Suspended</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </Field>

              </div>
              <div className="flex flex-wrap gap-4">
                <Checkbox name="refer" defaultChecked={cap("refer")?.status === "approved"} label={`Partner / anchor: can refer${cap("refer") ? ` (${cap("refer")!.status})` : ""}`} />
                <Checkbox name="receive" defaultChecked={cap("receive")?.status === "approved"} label={`Provider: can receive${cap("receive") ? ` (${cap("receive")!.status})` : ""}`} />
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
      {standing ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <StandingPanel s={standing} title="Standing" />
          <BlockedBanner s={standing} area="provider" admin />
        </div>
      ) : null}
      {standing && standing.receive !== null ? (
        <Card className="grid gap-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base">Provider commercial status</h2>
            <Badge tone={stageTone(standing.stage) === "purple" ? "purple" : stageTone(standing.stage)}>{stageLabel(standing.stage)}</Badge>
          </div>
          <p className="m-0 text-muted">
            Verified providers don&apos;t receive a continuous flow. They receive projects only through an active Growth contract, one complimentary
            opportunity, or as a contingency provider when no Growth client can serve the project.
          </p>
          <form action={setProviderTrack} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="orgId" value={org.id} />
            <Field id="track" label="Track set by BookedUp">
              <Select id="track" name="track" defaultValue={org.provider_track ?? ""} className="min-w-64">
                <option value="">None (verified, no delivery)</option>
                <option value="trial">Complimentary opportunity (one)</option>
                <option value="overflow">Contingency provider</option>
                <option value="paused">Paused</option>
                <option value="rejected">Rejected as provider</option>
              </Select>
            </Field>
            <Button size="sm">Save</Button>
          </form>
          <p className="m-0 text-xs text-muted">An active BookedUp Growth program takes priority over this track.</p>
        </Card>
      ) : null}
      {standing && standing.receive !== null ? <GrowthAdminControls orgId={org.id} returnTo={`/admin/organizations/${org.id}`} /> : null}
      <Card className="grid gap-3 text-sm">
        <h2 className="text-base font-semibold">Consents</h2>
        {consents.size ? (
          <ul className="grid gap-1.5">
            {CONSENT_LABELS.map(([k, label]) => {
              const c = consents.get(k);
              return (
                <li key={k} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-1.5 last:border-0">
                  <span>{label}</span>
                  {c ? (
                    <span className="flex items-center gap-2">
                      <Badge tone={c.granted ? "success" : "neutral"}>{c.granted ? "Granted" : "Not granted"}</Badge>
                      <span className="text-xs text-muted">
                        {dateTime(c.created_at)} · v{c.version}
                      </span>
                    </span>
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted">No consents recorded. This business signed up before consents were collected during onboarding.</p>
        )}
      </Card>
      {isProvider ? (
        <section className="grid gap-4">
          <h2 className="text-xl font-semibold">Provider: capacity, documents and reliability</h2>
          <Card className="grid gap-2 text-sm">
            <h3 className="text-base font-semibold">Operational capacity</h3>
            {capacity ? (
              <>
                <p>
                  {capacity.accepting_new_work ? "Taking new projects" : "Paused"} · {capacity.weekly_capacity ?? "—"} per week · starts in{" "}
                  {capacity.lead_time_days ?? "—"} days
                </p>
                <p>
                  Project size: {money(capacity.min_project_value)} – {money(capacity.max_project_value)}
                </p>
                {capacity.notes ? <p className="text-muted">{capacity.notes}</p> : null}
                <p className="text-muted">Last confirmed {dateTime(capacity.confirmed_at)}</p>
              </>
            ) : (
              <p className="text-muted">The provider has not informed capacity yet.</p>
            )}
          </Card>
          <Card className="grid gap-3 text-sm">
            <h3 className="text-base font-semibold">Professional documents</h3>
            <DocsChecklist docs={docs} />
            {!docs.length ? <p className="text-muted">No documents uploaded.</p> : null}
            {docs.map((d) => (
              <form key={d.id} action={reviewDocument} className="grid gap-2 rounded-lg border border-border p-3">
                <input type="hidden" name="docId" value={d.id} />
                <input type="hidden" name="orgId" value={org.id} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{docKindLabel[d.kind]}</span>
                    <span className="text-muted"> · {[d.number, d.issuer, d.expires_on ? `expires ${date(d.expires_on)}` : "no expiration"].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="flex gap-1">
                    {d.expires_on && d.expires_on < new Date().toISOString().slice(0, 10) ? <Badge tone="danger">Expired</Badge> : null}
                    <Badge tone={d.status === "verified" ? "success" : d.status === "rejected" ? "danger" : "warning"}>{d.status === "submitted" ? "to review" : d.status}</Badge>
                  </span>
                </div>
                {d.file_path && docUrl.get(d.file_path) ? (
                  <a href={docUrl.get(d.file_path)!} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Open file</a>
                ) : (
                  <span className="text-muted">No file attached — check the number with the issuer.</span>
                )}
                <div className="flex flex-wrap gap-2">
                  <Input name="note" placeholder="Review note (optional)" aria-label="Review note" maxLength={500} defaultValue={d.review_note ?? ""} className="h-9 min-w-48 flex-1" />
                  <Button size="sm" name="status" value="verified" disabled={Boolean(d.expires_on && d.expires_on < new Date().toISOString().slice(0, 10))}>
                    Verify
                  </Button>
                  <Button size="sm" variant="secondary" name="status" value="rejected">Reject</Button>
                </div>
              </form>
            ))}
          </Card>
          {rel ? <ReliabilityView r={rel as Reliability} /> : null}
        </section>
      ) : null}
      {isSuper ? (
        <Card className="grid gap-3 border-danger/40">
          <h2 className="font-semibold text-danger">{org.deleted_at ? "Restore organization" : "Delete organization"}</h2>
          {org.deleted_at ? (
            <form action={restoreOrganization} className="grid gap-3">
              <input type="hidden" name="orgId" value={org.id} />
              <p className="text-sm text-muted">Brings the business back as &quot;pending review&quot;. You will need to approve it and its access again.</p>
              <Button size="sm" variant="secondary" className="justify-self-start">Restore organization</Button>
            </form>
          ) : (
            <form action={deleteOrganization} className="grid gap-3">
              <input type="hidden" name="orgId" value={org.id} />
              <p className="text-sm text-muted">
                Removes the business from the platform, directory and matching, revokes its access and withdraws unanswered
                opportunities. Its members lose access to it. Referral history and the audit log are kept, and a super admin can restore it later.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="confirmName" placeholder={`Type "${org.name}" to confirm`} aria-label="Type the business name to confirm" required />
                <Input name="reason" placeholder="Reason (optional, internal)" aria-label="Reason" maxLength={500} />
              </div>
              <Button size="sm" variant="danger" className="justify-self-start">Delete organization</Button>
            </form>
          )}
        </Card>
      ) : null}
    </>
  );
}
