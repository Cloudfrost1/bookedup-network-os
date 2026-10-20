"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/modules/auth/actions";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-muted">Enter the email you use to sign in.</p>
      </div>
      <form action={action} className="grid gap-4" noValidate>
        <FormMessage>{state.error}</FormMessage>
        <FormMessage tone="success">{state.success}</FormMessage>
        <Field id="email" label="Email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <SubmitButton size="lg" pendingText="Sending…">
          Send reset link
        </SubmitButton>
      </form>
      <Link href="/login" className="text-center text-sm text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}
