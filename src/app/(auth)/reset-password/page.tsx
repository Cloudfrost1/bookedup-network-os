"use client";

import { useActionState } from "react";
import { updatePassword, type FormState } from "@/modules/auth/actions";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

export default function ResetPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="text-sm text-muted">At least 10 characters, with a letter and a number.</p>
      </div>
      <form action={action} className="grid gap-4" noValidate>
        <FormMessage>{state.error}</FormMessage>
        <Field id="password" label="New password">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
        </Field>
        <Field id="confirm" label="Confirm new password">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton size="lg" pendingText="Saving…">
          Save password
        </SubmitButton>
      </form>
    </div>
  );
}
