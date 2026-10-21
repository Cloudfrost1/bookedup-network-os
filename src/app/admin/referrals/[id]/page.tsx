import Link from "next/link";
import { BLOCKERS } from "@/modules/standing/standing";
import { MatchingNote } from "@/modules/shared/matching";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flash } from "@/components/ui/flash";
import { Input } from "@/components/ui/form";
import { Checkbox, Table, Td, Textarea } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { assignReferral, closeReferral, confirmConsent, qualifyReferral, recordFeedback, verifyFeedback } from "@/modules/admin/actions";
import { budgetLabel, propertyLabel } from "@/modules/provider/labels";
import { assignmentStatusLabel, dateTime, money, referralStatusLabel, timelineLabel, toneFor } from "@/modules/format";

export const metadata: Metadata = { title: "Referral" };

const CHECKS: [string, string][] = [
  ["owner_or_authorized", "Homeowner (or authorized person) is the one asking"],
  ["real_request", "Real project request, not just curiosity"],
  ["service_match", "Service is clear and exists in the network"],
  ["location_served", "Location is inside the network's area"],
  ["valid_contact", "Phone or email works"],
  ["authorized", "Homeowner authorized being contacted"],
  ["not_duplicate", "Not a duplicate of another recent request"],
];

type Suggestion = {
  blockers: string[];
  org_id: string;
  name: string;
  city: string | null;
  docs_verified: boolean;
  trusted: boolean;
  suggested_by_referrer: boolean;
  covers_city: boolean;
  open_assignments: number;
  accepting_new_work: boolean | null;
  capacity_confirmed_at: string | null;
  weekly_capacity: number | null;
  min_project_value: number | null;
  max_project_value: number | null;
  lead_time_days: number | null;
  provider_score: number | null;
  growth_remaining: number | null;
};

const budgetBounds: Record<string, [number, number]> = {
  under_5k: [0, 5000],
  "5k_15k": [5000, 15000],
  "15k_30k": [15000, 30000],
  "30k_60k": [30000, 60000],
  "60k_plus": [60000, Infinity],
};
function budgetFit(budget: string | null, min: number | null, max: number | null) {
  if (!budget || !budgetBounds[budget] || (min == null && max == null)) return null;
  const [lo, hi] = budgetBounds[budget];
  return (min == null || hi >= Number(min)) && (max == null || lo <= Number(max));
}

export default async function AdminReferralPage({
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
  const { data: r } = await supabase
    .from("referrals")
    .select(
      "id, number, city, zip, description, timeline, budget_range, property_type, specific_needs, status, channel, checklist, qualification_notes, created_at, qualified_at, service_categories(name), source:organizations!referrals_source_org_id_fkey(id, name), suggested:organizations!referrals_suggested_provider_org_id_fkey(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  const [{ data: contact }, { data: consents }, { data: dups }, { data: assignments }, { data: events }, { data: photoRows }] = await Promise.all([
    supabase.from("homeowner_contacts").select("name, phone, email, address").eq("referral_id", id).maybeSingle(),
    supabase.from("consent_records").select("status, source, granted_at, revoked_at, created_at, seq").eq("referral_id", id).order("seq", { ascending: false }),
    supabase.rpc("referral_duplicates", { p_referral: id }),
    supabase
      .from("referral_assignments")
      .select("id, status, assigned_at, responded_at, decline_reason, estimated_value, last_update_at, appointment_at, organizations(name), assignment_feedback(id, source, contacted_quickly, showed_up, kept_commitments, rating, comment, verified, created_at)")
      .eq("referral_id", id)
      .order("assigned_at"),
    supabase.from("referral_events").select("from_status, to_status, note, created_at").eq("referral_id", id).order("created_at"),
    supabase.from("referral_photos").select("path").eq("referral_id", id).order("created_at"),
  ]);
  const photoPaths = (photoRows ?? []).map((p) => p.path as string);
  const { data: signed } = photoPaths.length ? await supabase.storage.from("referral-photos").createSignedUrls(photoPaths, 3600) : { data: [] };
  const photoUrls = (signed ?? []).map((x) => x.signedUrl).filter((u): u is string => Boolean(u));
  const canMatch = ["qualified", "matching"].includes(r.status);
  const { data: sugg } = canMatch ? await supabase.rpc("admin_match_suggestions_v3", { p_referral: id }) : { data: [] };
  const suggestions = (sugg ?? []) as Suggestion[];
  const consent = consents?.[0];
  const checklist = (r.checklist ?? {}) as Record<string, boolean>;
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
  const source = one(r.source as { id: string; name: string } | { id: string; name: string }[] | null);
  const suggested = one(r.suggested as { name: string } | { name: string }[] | null);
  const service = one(r.service_categories as { name: string } | { name: string }[] | null);
  type Fb = { id: string; source: string; contacted_quickly: boolean | null; showed_up: boolean | null; kept_commitments: boolean | null; rating: number | null; comment: string | null; verified: boolean; created_at: string };
  type Asg = { id: string; status: string; assigned_at: string; decline_reason: string | null; estimated_value: number | null; last_update_at: string; appointment_at: string | null; organizations: { name: string } | null; assignment_feedback: Fb[] };
  const asg = (assignments ?? []) as unknown as Asg[];
  const dupRows = (dups ?? []) as { id: string; number: number; status: string; created_at: string; reason: string }[];

  return (
    <>
      <Link href="/admin/referrals" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Referrals
      </Link>
      <PageHeader title={`#${r.number} · ${service?.name ?? ""}`} description={`${r.city} ${r.zip} · received ${dateTime(r.created_at)}`} />
      <Flash sp={sp} />
      <div className="flex flex-wrap gap-2">
        <Badge tone={toneFor(r.status)}>{referralStatusLabel[r.status]}</Badge>
        <Badge>{r.channel === "link" ? "Homeowner link" : "Sent by partner"}</Badge>
        {r.timeline ? <Badge>{timelineLabel[r.timeline]}</Badge> : null}
        <Badge tone={consent?.status === "granted" ? "success" : consent?.status === "revoked" ? "danger" : "warning"}>
          Authorization: {consent?.status ?? "none"}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid content-start gap-2 text-sm">
          <h2 className="text-base font-semibold">Project</h2>
          <p className="whitespace-pre-line">{r.description}</p>
          <p>
            <span className="text-muted">Budget:</span> {r.budget_range ? budgetLabel[r.budget_range] : "—"} ·{" "}
            <span className="text-muted">Property:</span> {r.property_type ? propertyLabel[r.property_type] : "—"}
          </p>
          {r.specific_needs ? (
            <p className="whitespace-pre-line">
              <span className="text-muted">Specific needs:</span> {r.specific_needs}
            </p>
          ) : null}
          {photoUrls.length ? (
            <div className="grid grid-cols-3 gap-2">
              {photoUrls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`Photo ${i + 1}`} className="aspect-square w-full object-cover" />
                </a>
              ))}
            </div>
          ) : null}
          <p className="text-muted">From: {source ? <Link href={`/admin/organizations/${source.id}`} className="text-primary hover:underline">{source.name}</Link> : "—"}</p>
          {suggested ? <p className="text-muted">Partner suggested: {suggested.name}</p> : null}
          <h2 className="pt-2 text-base font-semibold">Homeowner</h2>
          {contact ? (
            <>
              <p className="font-medium">{contact.name}</p>
              {contact.phone ? <a href={`tel:${contact.phone}`} className="text-primary hover:underline">{contact.phone}</a> : null}
              {contact.email ? <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a> : null}
              {contact.address ? <p>{contact.address}</p> : null}
            </>
          ) : (
            <p className="text-muted">No contact on file.</p>
          )}
          {dupRows.length ? (
            <div className="mt-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p className="font-medium text-warning">Possible duplicates</p>
              {dupRows.map((d) => (
                <Link key={d.id} href={`/admin/referrals/${d.id}`} className="block text-primary hover:underline">
                  #{d.number} · {d.reason} · {referralStatusLabel[d.status]} · {dateTime(d.created_at)}
                </Link>
              ))}
            </div>
          ) : null}
        </Card>

        <div className="grid content-start gap-4">
          {r.status === "consent_pending" ? (
            <Card>
              <form action={confirmConsent} className="grid gap-3">
                <h2 className="font-semibold">Confirm authorization with the homeowner</h2>
                <p className="text-sm text-muted">
                  The partner attested the homeowner agreed. Call or message the homeowner and record the answer before qualifying.
                </p>
                <input type="hidden" name="referralId" value={r.id} />
                <Input name="note" placeholder="How you confirmed (optional)" aria-label="How you confirmed" maxLength={500} />
                <div className="flex gap-2">
                  <Button size="sm" name="granted" value="yes">Homeowner authorized</Button>
                  <Button size="sm" variant="secondary" name="granted" value="no">Did not authorize</Button>
                </div>
              </form>
            </Card>
          ) : null}

          {r.status === "under_review" ? (
            <Card>
              <form action={qualifyReferral} className="grid gap-3">
                <h2 className="font-semibold">Qualification checklist</h2>
                <input type="hidden" name="referralId" value={r.id} />
                {CHECKS.map(([k, label]) => (
                  <Checkbox key={k} name={k} defaultChecked={checklist[k]} label={label} />
                ))}
                {dupRows.length ? (
                  <select name="duplicate_of" aria-label="Duplicate of" className="h-10 rounded-lg border border-border px-3 text-sm">
                    <option value="">Not a duplicate</option>
                    {dupRows.map((d) => (
                      <option key={d.id} value={d.id}>
                        Duplicate of #{d.number}
                      </option>
                    ))}
                  </select>
                ) : null}
                <Textarea name="notes" rows={2} maxLength={2000} placeholder="Notes (optional)" aria-label="Notes" />
                <div className="flex gap-2">
                  <Button size="sm" name="decision" value="qualified">Qualify</Button>
                  <Button size="sm" variant="secondary" name="decision" value="rejected">Reject</Button>
                </div>
                <p className="text-xs text-muted">All 7 items must be checked to qualify.</p>
              </form>
            </Card>
          ) : null}

          {canMatch ? (
            <Card className="grid gap-3">
              <h2 className="font-semibold">Send to one provider</h2>
              <MatchingNote />
              {!suggestions.length ? (
                <p className="text-sm text-muted">
                  No approved provider offers this service yet. Recruit one, then come back. The referral stays in &quot;To match&quot;.
                </p>
              ) : (
                suggestions.map((s) => (
                  <form key={s.org_id} action={assignReferral} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                    <input type="hidden" name="referralId" value={r.id} />
                    <input type="hidden" name="providerId" value={s.org_id} />
                    <input type="hidden" name="suggestedBy" value={s.suggested_by_referrer ? "referrer" : "rules"} />
                    <span className="grid gap-1">
                      <span className="font-medium">{s.name}</span>
                      <span className="flex flex-wrap gap-1">
                        {s.suggested_by_referrer ? <Badge tone="purple">Partner&apos;s pick</Badge> : null}
                        {s.covers_city ? <Badge tone="success">Serves {r.city}</Badge> : <Badge>Outside listed cities</Badge>}
                        {s.accepting_new_work === false ? (
                          <Badge tone="danger">Paused</Badge>
                        ) : !s.capacity_confirmed_at || Date.now() - new Date(s.capacity_confirmed_at).getTime() > 30 * 864e5 ? (
                          <Badge tone="warning">Capacity not confirmed</Badge>
                        ) : (
                          <Badge tone="success">Capacity confirmed{s.weekly_capacity != null ? ` · ${s.weekly_capacity}/wk` : ""}</Badge>
                        )}
                        {(() => {
                          const fit = budgetFit(r.budget_range, s.min_project_value, s.max_project_value);
                          return fit === null ? null : fit ? <Badge tone="success">Budget fits</Badge> : <Badge tone="danger">Outside project size</Badge>;
                        })()}
                        {s.lead_time_days != null ? <Badge>Starts in {s.lead_time_days}d</Badge> : null}
                        {s.docs_verified ? <Badge tone="purple">Docs verified</Badge> : <Badge>Docs not verified</Badge>}
                        {s.trusted ? <Badge tone="purple">Trusted</Badge> : null}
                        <Badge>{s.open_assignments} open</Badge>
                        {s.provider_score != null ? <Badge>Score {s.provider_score}</Badge> : null}
                        {s.growth_remaining != null ? <Badge tone="warning">Growth: {s.growth_remaining} to go</Badge> : null}
                      </span>
                    </span>
                    {s.blockers.length ? (
                      <span className="grid w-full gap-1 rounded-md bg-danger/5 px-2 py-1.5 text-xs text-danger sm:w-auto sm:max-w-xs">
                        <span className="font-semibold">Not eligible to receive</span>
                        {s.blockers.map((b) => (
                          <span key={b}>· {BLOCKERS[b]?.text ?? b}</span>
                        ))}
                      </span>
                    ) : (
                      <Button size="sm">Send</Button>
                    )}
                  </form>
                ))
              )}
            </Card>
          ) : null}

          {!["closed", "rejected"].includes(r.status) ? (
            <Card>
              <form action={closeReferral} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="referralId" value={r.id} />
                <Input name="note" placeholder="Reason for closing" aria-label="Reason for closing" className="flex-1" maxLength={500} />
                <Button size="sm" variant="secondary">Close referral</Button>
              </form>
            </Card>
          ) : null}
        </div>
      </div>

      {asg.length ? (
        <section className="grid gap-2">
          <h2 className="text-lg font-semibold">Providers</h2>
          <Table head={["Provider", "Status", "Sent", "Last update", "Value", "Decline reason"]}>
            {asg.map((a) => (
              <tr key={a.id}>
                <Td className="font-medium">{a.organizations?.name}</Td>
                <Td>
                  <Badge tone={toneFor(a.status)}>{assignmentStatusLabel[a.status]}</Badge>
                </Td>
                <Td className="text-muted">{dateTime(a.assigned_at)}</Td>
                <Td className="text-muted">{dateTime(a.last_update_at)}</Td>
                <Td>{money(a.estimated_value)}</Td>
                <Td className="text-muted">{a.decline_reason?.replace(/_/g, " ") ?? "—"}</Td>
              </tr>
            ))}
          </Table>
        </section>
      ) : null}

      {asg.filter((a) => !["offered", "declined", "withdrawn"].includes(a.status)).map((a) => (
        <Card key={a.id} className="grid gap-3">
          <h2 className="font-semibold">Reliability check · {a.organizations?.name}</h2>
          {a.appointment_at ? <p className="text-sm">Appointment reported by the provider: {dateTime(a.appointment_at)}</p> : null}
          {a.assignment_feedback.length ? (
            <ul className="grid gap-2 text-sm">
              {a.assignment_feedback.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface p-2">
                  <span>
                    <Badge tone={f.verified ? "success" : "warning"}>{f.verified ? "Verified" : "To verify"}</Badge>{" "}
                    {f.source} · contacted {f.contacted_quickly == null ? "?" : f.contacted_quickly ? "yes" : "no"} · showed up{" "}
                    {f.showed_up == null ? "?" : f.showed_up ? "yes" : "no"} · kept commitments {f.kept_commitments == null ? "?" : f.kept_commitments ? "yes" : "no"}
                    {f.rating ? ` · ${f.rating}/5` : ""}
                    {f.comment ? <span className="block text-muted">“{f.comment}”</span> : null}
                  </span>
                  <form action={verifyFeedback}>
                    <input type="hidden" name="feedbackId" value={f.id} />
                    <input type="hidden" name="referralId" value={r.id} />
                    <input type="hidden" name="verified" value={f.verified ? "false" : "true"} />
                    <Button size="sm" variant="secondary">{f.verified ? "Unverify" : "Verify"}</Button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No feedback yet. Call the homeowner after the visit and record what they say.</p>
          )}
          <form action={recordFeedback} className="grid gap-2 border-t border-border pt-3 text-sm">
            <input type="hidden" name="assignmentId" value={a.id} />
            <input type="hidden" name="referralId" value={r.id} />
            <p className="font-medium">Record feedback confirmed by BookedUp</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[
                ["source", "Source", [["homeowner", "Homeowner (call)"], ["partner", "Partner"], ["admin", "BookedUp"]]],
                ["contacted", "Contacted quickly?", [["", "?"], ["yes", "Yes"], ["no", "No"]]],
                ["showed", "Showed up?", [["", "?"], ["yes", "Yes"], ["no", "No"]]],
                ["kept", "Kept commitments?", [["", "?"], ["yes", "Yes"], ["no", "No"]]],
                ["rating", "Rating", [["", "—"], ["5", "5"], ["4", "4"], ["3", "3"], ["2", "2"], ["1", "1"]]],
              ].map(([name, label, opts]) => (
                <label key={name as string} className="grid gap-1 text-xs">
                  {label as string}
                  <select name={name as string} className="h-9 rounded-lg border border-border bg-background px-2 text-sm">
                    {(opts as string[][]).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <Input name="comment" placeholder="What the homeowner said (optional)" aria-label="Comment" maxLength={1000} />
            <Button size="sm" className="justify-self-start">Save verified feedback</Button>
          </form>
        </Card>
      ))}

      <Card className="grid gap-2">
        <h2 className="font-semibold">History</h2>
        <ol className="grid gap-1 text-sm">
          {(events ?? []).map((e, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2">
              <span>
                {referralStatusLabel[e.to_status] ?? assignmentStatusLabel[e.to_status] ?? e.to_status}
                {e.note ? <span className="text-muted"> · {e.note}</span> : null}
              </span>
              <span className="text-muted">{dateTime(e.created_at)}</span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
