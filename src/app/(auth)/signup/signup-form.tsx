"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type FormState } from "@/modules/auth/actions";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

export function SignupForm({ intent = "partner" }: { intent?: "partner" | "provider" }) {
  const [state, action] = useActionState<FormState, FormData>(signUp, {});
  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="intent" value={intent} />
      <FormMessage>{state.error}</FormMessage>
      <Field id="fullName" label="Full name">
        <Input id="fullName" name="fullName" autoComplete="name" required defaultValue={state.fields?.fullName} />
      </Field>
      <Field id="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.fields?.email} />
      </Field>
      <Field id="password" label="Password" hint="At least 10 characters, with a letter and a number.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span className="text-muted">
          I agree to the{" "}
          <Link href="/terms" className="text-primary hover:underline" target="_blank">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-primary hover:underline" target="_blank">
            Privacy Policy
          </Link>
          .
        </span>
      </label>
      <SubmitButton size="lg" pendingText="Creating account…">
        Create account
      </SubmitButton>
    </form>
  );
}
