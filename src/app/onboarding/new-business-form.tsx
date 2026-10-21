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
    <section className="pub-auth-card pub-step">
      <h2 className="flex items-center gap-3">
        <span className="pub-step-n">{n}</span>
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
      <div className="pub-page-head grid gap-2">
        <h1>
          Add your <span className="hl">business</span>
        </h1>
        <p className="m-0">BookedUp reviews every business before it can send or receive projects.</p>
      </div>
      <form action={action} className="pub-form grid gap-6" noValidate>
        <FormMessage>{state.error}</FormMessage>
        <Step n={1} title="Your business">
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">What would you like to do?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {modes.map((m) => (
                <label
                  key={m.value}
                  className="grid cursor-pointer gap-1 rounded-xl border-2 border-[var(--ink)] bg-white p-3 has-[:checked]:bg-[var(--accent-tint)] has-[:checked]:shadow-[3px_4px_0_var(--ink)]"
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
        <SubmitButton size="lg" pendingText="Submitting…" className="w-full sm:w-auto sm:justify-self-start sm:px-10">
          Submit for review
        </SubmitButton>
      </form>
    </div>
  );
}
