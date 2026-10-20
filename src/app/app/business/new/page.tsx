"use client";

import { useActionState } from "react";
import { createOrganization } from "@/modules/organizations/actions";
import type { FormState } from "@/modules/auth/actions";
import { BusinessFields } from "@/modules/organizations/business-fields";
import { Field, FormMessage } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

const modes = [
  { value: "refer", label: "Refer Projects", hint: "Send customers to trusted partners" },
  { value: "receive", label: "Receive Projects", hint: "Get projects that match your services" },
  { value: "both", label: "Both", hint: "Refer and receive" },
];

const buckets = ["0", "1-2", "3-5", "6+"];

export default function NewBusinessPage() {
  const [state, action] = useActionState<FormState, FormData>(createOrganization, {});
  const f = state.fields ?? {};
  return (
    <div className="grid max-w-2xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold sm:text-3xl">Add your business</h1>
        <p className="text-sm text-muted">BookedUp reviews every business before it can send or receive projects.</p>
      </div>
      <form action={action} className="grid gap-6 rounded-xl border border-border bg-background p-5 sm:p-6" noValidate>
        <FormMessage>{state.error}</FormMessage>
        <fieldset className="grid gap-3">
          <legend className="mb-2 text-sm font-medium">What would you like to do?</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {modes.map((m) => (
              <label
                key={m.value}
                className={cn(
                  "grid cursor-pointer gap-1 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <input type="radio" name="mode" value={m.value} defaultChecked={(f.mode || "both") === m.value} className="accent-[var(--primary)]" />
                  {m.label}
                </span>
                <span className="text-xs text-muted">{m.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <BusinessFields values={f} />
        <Field id="outOfScope" label="How many requests for services outside your scope did you receive in the last 30 days?">
          <select
            id="outOfScope"
            name="outOfScope"
            defaultValue={f.outOfScope ?? ""}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base sm:text-sm"
          >
            <option value="">Select</option>
            {buckets.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
        <SubmitButton size="lg" pendingText="Submitting…" className="justify-self-start">
          Submit for review
        </SubmitButton>
      </form>
    </div>
  );
}
