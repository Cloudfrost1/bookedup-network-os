"use client";

import { useActionState, useMemo, useState } from "react";
import { addDocument, saveCapacity } from "@/modules/provider/actions";
import type { FormState } from "@/modules/auth/actions";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { Select, Textarea } from "@/components/ui/inputs";
import { SubmitButton } from "@/components/ui/submit-button";

type Cap = {
  accepting_new_work: boolean;
  weekly_capacity: number | null;
  min_project_value: number | null;
  max_project_value: number | null;
  lead_time_days: number | null;
  notes: string | null;
} | null;

const MAX_VALUE = 10_000_000;
const str = (v: number | null | undefined) => (v == null ? "" : String(v));
const num = (v: string) => (v.trim() === "" ? null : Number(v));

/** Same rules as the server action and the provider_capacity trigger. */
export function capacityErrors(v: { accepting: boolean; weekly: string; min: string; max: string; lead: string }) {
  const e: Record<string, string> = {};
  const weekly = num(v.weekly);
  const min = num(v.min);
  const max = num(v.max);
  const lead = num(v.lead);
  if (weekly === null) e.weekly = "Required.";
  else if (!Number.isInteger(weekly) || weekly < 0 || weekly > 100) e.weekly = "Whole number from 0 to 100.";
  else if (v.accepting && weekly === 0) e.weekly = "Must be at least 1 while you take new projects.";
  if (min === null) e.min = "Required.";
  else if (!Number.isFinite(min) || min < 0 || min > MAX_VALUE) e.min = "From $0 to $10,000,000.";
  if (max === null) e.max = "Required.";
  else if (!Number.isFinite(max) || max < 0 || max > MAX_VALUE) e.max = "From $0 to $10,000,000.";
  else if (min !== null && Number.isFinite(min) && max < min) e.max = "Must be equal to or higher than the smallest project.";
  if (lead === null) e.lead = "Required.";
  else if (!Number.isInteger(lead) || lead < 0 || lead > 365) e.lead = "Whole number of days, 0 to 365.";
  return e;
}

function Money({ id, value, onChange, invalid }: { id: string; value: string; onChange: (v: string) => void; invalid: boolean }) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 grid place-items-center text-sm text-muted">
        $
      </span>
      <Input
        id={id}
        name={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={MAX_VALUE}
        step={100}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        className="pl-7 tabular-nums"
      />
    </div>
  );
}

export function CapacityForm({ orgId, cap }: { orgId: string; cap: Cap }) {
  const [state, action] = useActionState<FormState, FormData>(saveCapacity, {});
  const [accepting, setAccepting] = useState(cap?.accepting_new_work !== false);
  const [weekly, setWeekly] = useState(str(cap?.weekly_capacity));
  const [min, setMin] = useState(str(cap?.min_project_value));
  const [max, setMax] = useState(str(cap?.max_project_value));
  const [lead, setLead] = useState(str(cap?.lead_time_days));
  const errors = useMemo(() => capacityErrors({ accepting, weekly, min, max, lead }), [accepting, weekly, min, max, lead]);
  const valid = Object.keys(errors).length === 0;
  // Only show "Required." once the provider has started typing somewhere, so a blank form isn't a wall of red.
  const touched = Boolean(weekly || min || max || lead);
  const err = (k: string) => (touched && errors[k] ? errors[k] : undefined);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="orgId" value={orgId} />
      <FormMessage>{state.error}</FormMessage>
      <FormMessage tone="success">{state.success}</FormMessage>
      <p className="m-0 text-xs text-muted">All fields are required. Saving also confirms your capacity for the next 30 days.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="accepting" label="Are you taking new projects?">
          <Select id="accepting" name="accepting" value={accepting ? "yes" : "no"} onChange={(e) => setAccepting(e.target.value === "yes")}>
            <option value="yes">Yes, send me projects</option>
            <option value="no">No, pause new projects</option>
          </Select>
        </Field>
        <Field id="weekly" label="New projects you can take per week" error={err("weekly")} hint="0 to 100. Use 0 only while paused.">
          <Input
            id="weekly"
            name="weekly"
            type="number"
            inputMode="numeric"
            min={accepting ? 1 : 0}
            max={100}
            step={1}
            required
            value={weekly}
            onChange={(e) => setWeekly(e.target.value)}
            aria-invalid={Boolean(err("weekly"))}
          />
        </Field>
        <Field id="min" label="Smallest project you accept (USD)" error={err("min")} hint="e.g. 3,000">
          <Money id="min" value={min} onChange={setMin} invalid={Boolean(err("min"))} />
        </Field>
        <Field id="max" label="Largest project you accept (USD)" error={err("max")} hint="e.g. 60,000">
          <Money id="max" value={max} onChange={setMax} invalid={Boolean(err("max"))} />
        </Field>
        <Field id="lead" label="Days until you can start a new project" error={err("lead")} hint="0 to 365 days.">
          <Input
            id="lead"
            name="lead"
            type="number"
            inputMode="numeric"
            min={0}
            max={365}
            step={1}
            required
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            aria-invalid={Boolean(err("lead"))}
          />
        </Field>
      </div>
      <Field id="notes" label="Anything BookedUp should know (optional)" hint="Crew size, projects you don't take, seasonal limits.">
        <Textarea id="notes" name="notes" rows={2} maxLength={1000} defaultValue={cap?.notes ?? ""} />
      </Field>
      <SubmitButton pendingText="Saving…" className="justify-self-start" disabled={!valid}>
        Save and confirm capacity
      </SubmitButton>
      {!valid && touched ? <p className="m-0 text-xs text-danger">Fix the highlighted fields to save.</p> : null}
    </form>
  );
}

const ACCEPTED = "application/pdf,image/jpeg,image/png";
const TYPES = new Set(ACCEPTED.split(","));

export function DocumentForm({ orgId, services }: { orgId: string; services: string[] }) {
  const [state, action] = useActionState<FormState, FormData>(addDocument, {});
  const [kind, setKind] = useState("");
  const [number, setNumber] = useState("");
  const [issuer, setIssuer] = useState("");
  const [expires, setExpires] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [hasFile, setHasFile] = useState(false);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);
  const expiryError = expires && expires < tomorrow ? "Must be a future date. Expired documents can't be verified." : undefined;
  const ready = Boolean(kind && number.trim() && issuer.trim() && expires && !expiryError && hasFile && !fileError);

  return (
    <form action={action} className="grid gap-4 border-t border-border pt-4">
      <input type="hidden" name="orgId" value={orgId} />
      <h3 className="text-base font-semibold">Send a document for review</h3>
      <DocumentGuide services={services} />
      <FormMessage>{state.error}</FormMessage>
      <FormMessage tone="success">{state.success}</FormMessage>
      <p className="m-0 text-xs text-muted">All fields are required.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="kind" label="Document type">
          <Select id="kind" name="kind" required value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Select</option>
            <option value="contractor_license">Contractor license (state)</option>
            <option value="business_license">Business license / Business Tax Receipt</option>
            <option value="general_liability">General liability insurance</option>
            <option value="workers_comp">Workers&apos; compensation</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field id="number" label="License or policy number">
          <Input id="number" name="number" required maxLength={80} value={number} onChange={(e) => setNumber(e.target.value)} />
        </Field>
        <Field id="issuer" label="Issued by" hint="e.g. Florida DBPR, Orange County, insurance company">
          <Input id="issuer" name="issuer" required maxLength={120} value={issuer} onChange={(e) => setIssuer(e.target.value)} />
        </Field>
        <Field id="expires" label="Expiration date" error={expiryError}>
          <Input
            id="expires"
            name="expires"
            type="date"
            required
            min={tomorrow}
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
            aria-invalid={Boolean(expiryError)}
          />
        </Field>
      </div>
      <Field id="file" label="Copy of the document" hint="PDF, JPG or PNG, up to 10 MB." error={fileError ?? undefined}>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept={ACCEPTED}
          className="text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            setHasFile(Boolean(f));
            setFileError(!f ? null : !TYPES.has(f.type) ? "Upload a PDF, JPG or PNG." : f.size > 10 * 1024 * 1024 ? "The file must be 10 MB or smaller." : null);
          }}
        />
      </Field>
      <SubmitButton pendingText="Uploading…" className="justify-self-start" disabled={!ready}>
        Send for review
      </SubmitButton>
      {!ready ? <p className="m-0 text-xs text-muted">Fill every field and attach the file to send.</p> : null}
    </form>
  );
}

/** Which documents BookedUp accepts, by the services this business offers. */
const STATE_LICENSED = ["General Remodeling", "Kitchen Remodeling", "Bathroom Remodeling", "Roofing", "Plumbing", "Electrical", "HVAC", "Siding"];

function DocumentGuide({ services }: { services: string[] }) {
  const licensed = services.filter((s) => STATE_LICENSED.includes(s));
  const local = services.filter((s) => !STATE_LICENSED.includes(s));
  return (
    <div className="grid gap-2 rounded-lg border border-border bg-surface p-3 text-sm">
      <p className="m-0 font-semibold">Documents accepted for your services</p>
      <ul className="grid gap-1.5 p-0 pl-4">
        {licensed.length ? (
          <li>
            <span className="font-medium">{licensed.join(", ")}:</span> state contractor license (Florida DBPR — certified or registered).
          </li>
        ) : null}
        {local.length ? (
          <li>
            <span className="font-medium">{local.join(", ")}:</span> local business license / Business Tax Receipt from your city or county. If you
            hold a state contractor license, send that instead.
          </li>
        ) : null}
        {!services.length ? <li>Add your services in My Business to see which license applies.</li> : null}
        <li>
          <span className="font-medium">Every provider:</span> general liability insurance. Workers&apos; compensation is also accepted, and is
          expected if you have employees.
        </li>
      </ul>
      <p className="m-0 text-xs text-muted">BookedUp checks each document during review and may ask for another one.</p>
    </div>
  );
}
