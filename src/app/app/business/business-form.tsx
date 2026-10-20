"use client";

import { useActionState } from "react";
import { updateOrganization } from "@/modules/organizations/actions";
import type { FormState } from "@/modules/auth/actions";
import { BusinessFields } from "@/modules/organizations/business-fields";
import { Field, FormMessage } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

type Org = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  state: string | null;
  city: string | null;
  zip: string | null;
  description: string | null;
};

export function BusinessForm({ org }: { org: Org }) {
  const [state, action] = useActionState<FormState, FormData>(updateOrganization, {});
  return (
    <form action={action} className="grid gap-5 rounded-xl border border-border bg-background p-5 sm:p-6" noValidate>
      <input type="hidden" name="orgId" value={org.id} />
      <FormMessage>{state.error}</FormMessage>
      <FormMessage tone="success">{state.success}</FormMessage>
      <BusinessFields values={state.fields ?? org} />
      <Field id="description" label="Description" hint="Shown on your profile once approved. Up to 2,000 characters.">
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={state.fields?.description ?? org.description ?? ""}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base sm:text-sm"
        />
      </Field>
      <SubmitButton pendingText="Saving…" className="justify-self-start">
        Save changes
      </SubmitButton>
    </form>
  );
}
