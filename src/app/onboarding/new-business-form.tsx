"use client";

import { useActionState } from "react";
import { createOrganization } from "@/modules/organizations/actions";
import type { FormState } from "@/modules/auth/actions";
import { BusinessFields } from "@/modules/organizations/business-fields";
import { ServicesFields } from "@/modules/organizations/services-fields";
import type { Category, Region } from "@/modules/network/catalog";
import { Field, FormMessage } from "@/components/ui/form";
import { Select } from "@/components/ui/inputs";
import { SubmitButton } from "@/components/ui/submit-button";

const modes = [
  { value: "refer", label: "Refer projects", hint: "Partner / anchor: send customers you can't serve to trusted providers" },
  { value: "receive", label: "Receive projects", hint: "Provider: get qualified projects that fit your capacity" },
  { value: "both", label: "Both", hint: "Refer and receive — you get both areas" },
];

const list = (v?: string) => (v ? v.split(",").filter(Boolean) : []);

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 rounded-xl border border-border bg-background p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <span className="grid size-7 place-items-center rounded-full bg-primary text-sm text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function NewBusinessForm({ categories, regions }: { categories: Category[]; regions: Region[] }) {
  const [state, action] = useActionState<FormState, FormData>(createOrganization, {});
  const f = state.fields ?? {};
  return (
    <div className="grid max-w-3xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold sm:text-3xl">Add your business</h1>
        <p className="text-sm text-muted">BookedUp reviews every business before it can send or receive projects.</p>
      </div>
      <form action={action} className="grid gap-5" noValidate>
        <FormMessage>{state.error}</FormMessage>
        <Step n={1} title="Your business">
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">What would you like to do?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {modes.map((m) => (
                <label
                  key={m.value}
                  className="grid cursor-pointer gap-1 rounded-lg border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
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
        </Step>
        <Step n={2} title="Services and location">
          <ServicesFields
            categories={categories}
            regions={regions}
            values={{ category: f.category, offered: list(f.offered), notOffered: list(f.notOffered), regions: list(f.regions) }}
          />
          <Field id="outOfScope" label="How many requests outside your scope did you receive in the last 30 days?">
            <Select id="outOfScope" name="outOfScope" defaultValue={f.outOfScope ?? ""}>
              <option value="">Select</option>
              {["0", "1-2", "3-5", "6+"].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
        </Step>
        <SubmitButton size="lg" pendingText="Submitting…" className="justify-self-start">
          Submit for review
        </SubmitButton>
      </form>
    </div>
  );
}
