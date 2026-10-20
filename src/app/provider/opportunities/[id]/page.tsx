import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { Select, Textarea } from "@/components/ui/inputs";
import { SubmitButton } from "@/components/ui/submit-button";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/modules/network/org";
import { respondOpportunity, updateOpportunity } from "@/modules/referrals/actions";
import { assignmentStatusLabel, dateTime, timelineLabel, toneFor } from "@/modules/format";
import { budgetLabel, propertyLabel } from "@/modules/provider/labels";

export const metadata: Metadata = { title: "Opportunity" };

type Opp = {
  assignment_id: string;
  number: number;
  service: string;
  city: string;
  zip: string;
  description: string;
  timeline: string | null;
  budget_range: string | null;
  property_type: string | null;
  specific_needs: string | null;
  appointment_at: string | null;
  photos: string[];
  status: string;
  assigned_at: string;
  responded_at: string | null;
  estimated_value: number | null;
  notes: string | null;
  events: { to: string; at: string }[];
};

type Contact = { name: string; phone: string | null; email: string | null; address: string | null };

const pipeline = ["contacted", "estimate_scheduled", "estimate_sent", "won", "lost"] as const;

export default async function OpportunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requireCapability("receive", "/provider/opportunities");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_opportunity", { p_assignment: id });
  const o = data as Opp | null;
  if (!o) notFound();

  const open = !["offered", "declined", "withdrawn"].includes(o.status);
  const { data: signed } = o.photos.length
    ? await supabase.storage.from("referral-photos").createSignedUrls(o.photos, 3600)
    : { data: [] as { signedUrl: string }[] };
  const photoUrls = (signed ?? []).map((x) => x.signedUrl).filter((u): u is string => Boolean(u));
  let contact: Contact | null = null;
  if (open) {
    const { data: c } = await supabase.rpc("get_opportunity_contact", { p_assignment: id });
    contact = (c as Contact | null) ?? null;
  }

  return (
    <>
      <Link href="/provider/opportunities" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Opportunities
      </Link>
      <PageHeader title={`${o.service} · #${o.number}`} description={`${o.city} ${o.zip} · received ${dateTime(o.assigned_at)}`} />
      {sp.error ? <FormMessage>{sp.error}</FormMessage> : null}
      {sp.saved ? <FormMessage tone="success">Status updated.</FormMessage> : null}
      <div className="flex flex-wrap gap-2">
        <Badge tone={toneFor(o.status)}>{assignmentStatusLabel[o.status]}</Badge>
        {o.timeline ? <Badge>{timelineLabel[o.timeline]}</Badge> : null}
      </div>

      <Card className="grid gap-3">
        <h2 className="font-semibold">Project scope</h2>
        <p className="whitespace-pre-line text-sm">{o.description}</p>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Estimated budget</dt>
            <dd className="font-medium">{o.budget_range ? budgetLabel[o.budget_range] : "Not informed"}</dd>
          </div>
          <div>
            <dt className="text-muted">Property</dt>
            <dd className="font-medium">{o.property_type ? propertyLabel[o.property_type] : "Not informed"}</dd>
          </div>
          <div>
            <dt className="text-muted">Start</dt>
            <dd className="font-medium">{o.timeline ? timelineLabel[o.timeline] : "Not informed"}</dd>
          </div>
        </dl>
        {o.specific_needs ? (
          <div className="text-sm">
            <p className="text-muted">Specific needs</p>
            <p className="whitespace-pre-line">{o.specific_needs}</p>
          </div>
        ) : null}
        {photoUrls.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {photoUrls.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`Project photo ${i + 1}`} className="aspect-square w-full object-cover" />
              </a>
            ))}
          </div>
        ) : null}
        {!open ? <p className="text-xs text-muted">Exact address and the homeowner&apos;s contact appear after you accept.</p> : null}
      </Card>

      {o.status === "offered" ? (
        <Card className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="font-semibold">Do you want this project?</h2>
            <p className="text-sm text-muted">The homeowner&apos;s contact details appear once you accept. Please answer within 24 hours.</p>
          </div>
          <form action={respondOpportunity} className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
            <input type="hidden" name="assignmentId" value={o.assignment_id} />
            <SubmitButton name="decision" value="accept">Accept</SubmitButton>
            <Field id="reason" label="If declining, why?">
              <Select id="reason" name="reason" defaultValue="not_a_fit">
                <option value="not_a_fit">Not a fit for my services</option>
                <option value="no_capacity">No capacity right now</option>
                <option value="outside_area">Outside my area</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Button name="decision" value="decline" variant="secondary">
              Decline
            </Button>
          </form>
        </Card>
      ) : null}

      {contact ? (
        <Card className="grid gap-3">
          <h2 className="font-semibold">Homeowner</h2>
          <p className="font-medium">{contact.name}</p>
          <div className="grid gap-2 text-sm">
            {contact.phone ? (
              <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                <Phone aria-hidden className="size-4" /> {contact.phone}
              </a>
            ) : null}
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-primary hover:underline">
                <Mail aria-hidden className="size-4" /> {contact.email}
              </a>
            ) : null}
            {contact.address ? (
              <span className="flex items-center gap-2">
                <MapPin aria-hidden className="size-4 text-muted" /> {contact.address}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted">Use these details only for this project. Every view is recorded.</p>
        </Card>
      ) : null}

      {open && !["won", "lost"].includes(o.status) ? (
        <Card className="grid gap-4">
          <h2 className="font-semibold">Update progress</h2>
          <form action={updateOpportunity} className="grid gap-4">
            <input type="hidden" name="assignmentId" value={o.assignment_id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="status" label="Status">
                <Select id="status" name="status" defaultValue={pipeline.includes(o.status as never) ? o.status : "contacted"}>
                  {pipeline.map((s) => (
                    <option key={s} value={s}>
                      {assignmentStatusLabel[s]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="value" label="Estimate value (USD, optional)">
                <Input id="value" name="value" inputMode="decimal" defaultValue={o.estimated_value ?? ""} />
              </Field>
              <Field id="appointment" label="Visit / estimate appointment (Orlando time)">
                <Input id="appointment" name="appointment" type="datetime-local" />
              </Field>
            </div>
            <Field id="notes" label="Notes (optional)">
              <Textarea id="notes" name="notes" rows={3} maxLength={4000} defaultValue={o.notes ?? ""} />
            </Field>
            <SubmitButton pendingText="Saving…" className="justify-self-start">
              Save update
            </SubmitButton>
          </form>
        </Card>
      ) : null}

      {o.appointment_at ? (
        <Card className="text-sm">
          Appointment scheduled for <strong>{dateTime(o.appointment_at)}</strong>. BookedUp may confirm with the homeowner that the visit happened.
        </Card>
      ) : null}

      {o.events.length ? (
        <Card className="grid gap-2">
          <h2 className="font-semibold">History</h2>
          <ol className="grid gap-1 text-sm">
            {o.events.map((e, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>{assignmentStatusLabel[e.to] ?? e.to}</span>
                <span className="text-muted">{dateTime(e.at)}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </>
  );
}
