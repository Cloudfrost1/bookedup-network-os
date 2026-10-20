"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { submitPublicReferral } from "@/modules/referrals/actions";
import type { FormState } from "@/modules/auth/actions";
import { ProjectFields } from "@/modules/referrals/project-fields";
import type { Category } from "@/modules/network/catalog";
import { FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/inputs";
import { SubmitButton } from "@/components/ui/submit-button";

type Props = { code: string; consentVersion: string; consentText: string; categories: Category[] };

export function HomeownerForm({ code, consentVersion, consentText, categories }: Props) {
  const [state, action] = useActionState<FormState, FormData>(submitPublicReferral, {});
  if (state.success) {
    return (
      <div className="grid justify-items-start gap-3 rounded-xl border border-border bg-background p-6">
        <CheckCircle2 aria-hidden className="size-8 text-primary" />
        <p className="text-lg font-semibold">Request received</p>
        <p className="text-muted">{state.success}</p>
      </div>
    );
  }
  return (
    <form action={action} className="grid gap-5 rounded-xl border border-border bg-background p-5 sm:p-6" noValidate>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="consentVersion" value={consentVersion} />
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Company <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <FormMessage>{state.error}</FormMessage>
      <ProjectFields categories={categories} f={state.fields ?? {}} who="homeowner" />
      <Checkbox name="consent" required label={consentText} />
      <SubmitButton size="lg" pendingText="Sending…" className="justify-self-start">
        Send my request
      </SubmitButton>
      <p className="text-xs text-muted">
        We never sell your information. Read our <a href="/privacy" className="underline">Privacy Policy</a>.
      </p>
    </form>
  );
}
