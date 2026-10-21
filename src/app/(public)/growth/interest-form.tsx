"use client";

import { useActionState } from "react";
import { submitGrowthInterest } from "@/modules/growth/actions";
import type { FormState } from "@/modules/auth/actions";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { Textarea } from "@/components/ui/inputs";
import { SubmitButton } from "@/components/ui/submit-button";

export function GrowthInterestForm() {
  const [state, action] = useActionState<FormState, FormData>(submitGrowthInterest, {});
  const f = state.fields ?? {};
  if (state.success) return <FormMessage tone="success">{state.success}</FormMessage>;
  return (
    <form action={action} className="grid gap-4">
      <FormMessage>{state.error}</FormMessage>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="g-name" label="Your name">
          <Input id="g-name" name="name" autoComplete="name" required defaultValue={f.name} />
        </Field>
        <Field id="g-company" label="Company">
          <Input id="g-company" name="company" autoComplete="organization" required defaultValue={f.company} />
        </Field>
        <Field id="g-email" label="E-mail">
          <Input id="g-email" name="email" type="email" autoComplete="email" required defaultValue={f.email} />
        </Field>
        <Field id="g-phone" label="Phone (optional)">
          <Input id="g-phone" name="phone" type="tel" autoComplete="tel" defaultValue={f.phone} />
        </Field>
        <Field id="g-city" label="City (optional)">
          <Input id="g-city" name="city" autoComplete="address-level2" defaultValue={f.city} />
        </Field>
        <Field id="g-services" label="Main services (optional)">
          <Input id="g-services" name="services" placeholder="e.g. kitchens, bathrooms" defaultValue={f.services} />
        </Field>
      </div>
      <Field id="g-message" label="Anything we should know (optional)" hint="Capacity, average ticket, cities you want to grow in.">
        <Textarea id="g-message" name="message" rows={3} maxLength={2000} defaultValue={f.message} />
      </Field>
      <SubmitButton size="lg" pendingText="Sending…">
        Talk to BookedUp
      </SubmitButton>
      <p className="m-0 text-xs text-[var(--ink-mute)]">We only use these details to contact you about BookedUp Growth.</p>
    </form>
  );
}
