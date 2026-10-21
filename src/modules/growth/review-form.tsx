"use client";

import { useActionState } from "react";
import { requestGrowthReview } from "./actions";
import type { FormState } from "@/modules/auth/actions";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { Textarea } from "@/components/ui/inputs";
import { SubmitButton } from "@/components/ui/submit-button";

export function GrowthReviewForm({ orgId }: { orgId: string }) {
  const [state, action] = useActionState<FormState, FormData>(requestGrowthReview, {});
  if (state.success) return <FormMessage tone="success">{state.success}</FormMessage>;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="orgId" value={orgId} />
      <FormMessage>{state.error}</FormMessage>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="gr-phone" label="Best phone to reach you">
          <Input id="gr-phone" name="phone" type="tel" inputMode="tel" autoComplete="off" required placeholder="(407) 555-0123" />
        </Field>
        <Field id="gr-time" label="Best time to talk (optional)">
          <Input id="gr-time" name="bestTime" placeholder="e.g. weekday mornings" maxLength={120} />
        </Field>
      </div>
      <Field id="gr-msg" label="Anything we should know (optional)" hint="Average ticket, close rate, crew size, cities you want to grow in.">
        <Textarea id="gr-msg" name="message" rows={3} maxLength={2000} />
      </Field>
      <SubmitButton pendingText="Sending…" className="justify-self-start">
        Schedule a Growth Review
      </SubmitButton>
    </form>
  );
}
