"use client";

import { useActionState } from "react";
import { submitReferral } from "@/modules/referrals/actions";
import type { FormState } from "@/modules/auth/actions";
import { ProjectFields } from "@/modules/referrals/project-fields";
import type { Category } from "@/modules/network/catalog";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/inputs";
import { SubmitButton } from "@/components/ui/submit-button";

export function ReferralForm({ orgId, categories, provider }: { orgId: string; categories: Category[]; provider: { id: string; name: string } | null }) {
  const [state, action] = useActionState<FormState, FormData>(submitReferral, {});
  const f = state.fields ?? {};
  return (
    <form action={action} className="grid max-w-3xl gap-5 rounded-xl border border-border bg-background p-5 sm:p-6" noValidate>
      <input type="hidden" name="orgId" value={orgId} />
      {provider ? (
        <>
          <input type="hidden" name="provider" value={provider.id} />
          <p className="rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary-deep">
            Suggested provider: <strong>{provider.name}</strong>. BookedUp still qualifies the request before sending it.
          </p>
        </>
      ) : null}
      <FormMessage>{state.error}</FormMessage>
      <ProjectFields categories={categories} f={f} who="partner" />
      <Field id="photos" label="Photos of the area (optional, up to 8)" hint="JPG, PNG, WEBP or HEIC, 8 MB each. Providers see photos before accepting.">
        <input id="photos" name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic" className="text-sm" />
      </Field>
      <Field
        id="address"
        label="Project address (optional)"
        hint="Kept private. Only BookedUp sees it until the homeowner's authorization is confirmed and a provider accepts."
      >
        <Input id="address" name="address" autoComplete="off" defaultValue={f.address ?? ""} />
      </Field>
      <Checkbox
        name="attested"
        required
        label="I confirm the homeowner asked for help with this project and authorized my business to share their contact details with BookedUp. BookedUp will confirm with the homeowner before sharing them with any provider."
      />
      <SubmitButton size="lg" pendingText="Sending…" className="justify-self-start">
        Send referral
      </SubmitButton>
    </form>
  );
}
