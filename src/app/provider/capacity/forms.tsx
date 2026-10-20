"use client";

import { useActionState } from "react";
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

export function CapacityForm({ orgId, cap }: { orgId: string; cap: Cap }) {
  const [state, action] = useActionState<FormState, FormData>(saveCapacity, {});
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="orgId" value={orgId} />
      <FormMessage>{state.error}</FormMessage>
      <FormMessage tone="success">{state.success}</FormMessage>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="accepting" label="Are you taking new projects?">
          <Select id="accepting" name="accepting" defaultValue={cap?.accepting_new_work === false ? "no" : "yes"}>
            <option value="yes">Yes, send me projects</option>
            <option value="no">No, pause new projects</option>
          </Select>
        </Field>
        <Field id="weekly" label="New projects you can take per week">
          <Input id="weekly" name="weekly" inputMode="numeric" defaultValue={cap?.weekly_capacity ?? ""} />
        </Field>
        <Field id="min" label="Smallest project you accept (USD)">
          <Input id="min" name="min" inputMode="decimal" placeholder="e.g. 3000" defaultValue={cap?.min_project_value ?? ""} />
        </Field>
        <Field id="max" label="Largest project you accept (USD)">
          <Input id="max" name="max" inputMode="decimal" placeholder="e.g. 60000" defaultValue={cap?.max_project_value ?? ""} />
        </Field>
        <Field id="lead" label="Days until you can start a new project">
          <Input id="lead" name="lead" inputMode="numeric" defaultValue={cap?.lead_time_days ?? ""} />
        </Field>
      </div>
      <Field id="notes" label="Anything BookedUp should know (optional)" hint="Crew size, projects you don't take, seasonal limits.">
        <Textarea id="notes" name="notes" rows={2} maxLength={1000} defaultValue={cap?.notes ?? ""} />
      </Field>
      <SubmitButton pendingText="Saving…" className="justify-self-start">
        Save and confirm capacity
      </SubmitButton>
    </form>
  );
}

export function DocumentForm({ orgId }: { orgId: string }) {
  const [state, action] = useActionState<FormState, FormData>(addDocument, {});
  return (
    <form action={action} className="grid gap-4 border-t border-border pt-4">
      <input type="hidden" name="orgId" value={orgId} />
      <FormMessage>{state.error}</FormMessage>
      <FormMessage tone="success">{state.success}</FormMessage>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="kind" label="Document type">
          <Select id="kind" name="kind" defaultValue="">
            <option value="">Select</option>
            <option value="contractor_license">Contractor license</option>
            <option value="business_license">Business license</option>
            <option value="general_liability">General liability insurance</option>
            <option value="workers_comp">Workers&apos; compensation</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field id="number" label="License or policy number">
          <Input id="number" name="number" maxLength={80} />
        </Field>
        <Field id="issuer" label="Issued by (optional)" hint="e.g. Florida DBPR, insurance company">
          <Input id="issuer" name="issuer" maxLength={120} />
        </Field>
        <Field id="expires" label="Expiration date">
          <Input id="expires" name="expires" type="date" />
        </Field>
      </div>
      <Field id="file" label="Copy of the document (PDF, JPG or PNG, up to 10 MB)">
        <input id="file" name="file" type="file" accept="application/pdf,image/jpeg,image/png" className="text-sm" />
      </Field>
      <SubmitButton pendingText="Uploading…" variant="secondary" className="justify-self-start">
        Send for review
      </SubmitButton>
    </form>
  );
}
