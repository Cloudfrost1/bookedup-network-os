"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createOrganization } from "@/modules/organizations/actions";
import type { FormState } from "@/modules/auth/actions";
import { BusinessFields } from "@/modules/organizations/business-fields";
import { ServicesFields } from "@/modules/organizations/services-fields";
import type { Category, Region } from "@/modules/network/catalog";
import { Field, FormMessage } from "@/components/ui/form";
import { Select } from "@/components/ui/inputs";
import { SubmitButton } from "@/components/ui/submit-button";

const modes = [
  {
    value: "refer",
    label: "Refer projects",
    hint: "Join the network for free. Refer projects outside your scope and track every introduction.",
  },
  {
    value: "receive",
    label: "Receive projects",
    hint: "Apply as a service provider. Complete verification and capacity information to be considered for compatible opportunities. Approval does not guarantee project volume.",
  },
  {
    value: "both",
    label: "Both",
    hint: "Use the network for free to refer, and complete a separate provider qualification to be considered for projects.",
  },
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

function Consent({ name, checked, required, children }: { name: string; checked?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-[var(--ink)] bg-white p-3 text-sm leading-relaxed has-[:checked]:bg-[var(--accent-tint)]">
      <input type="checkbox" name={name} defaultChecked={checked === "on"} required={required} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </label>
  );
}

export function NewBusinessForm({ categories, regions, defaultMode = "" }: { categories: Category[]; regions: Region[]; defaultMode?: string }) {
  const [state, action] = useActionState<FormState, FormData>(createOrganization, {});
  const f = state.fields ?? {};
  const [mode, setMode] = useState(f.mode ?? defaultMode);
  const refers = mode === "refer" || mode === "both";
  return (
    <div className="grid max-w-3xl gap-6">
      <div className="pub-page-head grid gap-2">
        <h1>
          Add your <span className="hl">business</span>
        </h1>
        <p className="m-0">BookedUp reviews every business before it can send or receive projects. All fields are required unless marked optional.</p>
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
                    <input
                      type="radio"
                      name="mode"
                      value={m.value}
                      required
                      checked={mode === m.value}
                      onChange={() => setMode(m.value)}
                      className="accent-[var(--primary)]"
                    />
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
          {refers ? (
            <p className="m-0 rounded-xl border-2 border-dashed border-[var(--ink)] bg-[var(--accent-tint)] px-4 py-3 text-sm font-semibold">
              Because you will refer projects, choose at least one request you usually turn down.
            </p>
          ) : null}
          <Field id="outOfScope" label="How many requests outside your scope did you receive in the last 30 days?">
            <Select id="outOfScope" name="outOfScope" required defaultValue={f.outOfScope ?? ""}>
              <option value="">Select</option>
              {["0", "1-2", "3-5", "6+"].map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>
          </Field>
        </Step>
        <Step n={3} title="Consent and communication">
          <p className="m-0 text-sm text-[var(--ink-soft)]">
            We record the date and version of each item you accept. You can ask us to change your contact preferences at any time.
          </p>
          <div className="grid gap-3">
            <Consent name="terms_privacy" checked={f.terms_privacy} required>
              I agree to the{" "}
              <Link href="/terms" target="_blank" className="text-[var(--accent)] underline">
                Terms of Service
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" target="_blank" className="text-[var(--accent)] underline">
                Privacy Policy
              </Link>
              .
            </Consent>
            <Consent name="data_use" checked={f.data_use} required>
              I authorize BookedUp to use this business information to review my application, match projects with my business and
              show my profile to network partners.
            </Consent>
            {refers ? (
              <Consent name="referral_authorization" checked={f.referral_authorization} required>
                I will only refer customers who agreed that I may share their name, contact details and project information with
                BookedUp and the business that receives the referral.
              </Consent>
            ) : null}
          </div>
          <fieldset className="grid gap-3">
            <legend className="mb-1 text-sm font-medium">How may BookedUp contact you about projects and your account?</legend>
            <Consent name="contact_email" checked={f.contact_email ?? "on"} required>
              E-mail <span className="font-normal text-[var(--ink-mute)]">— required for project and account updates</span>
            </Consent>
            <Consent name="contact_sms" checked={f.contact_sms}>
              SMS / text messages <span className="font-normal text-[var(--ink-mute)]">(optional)</span>
            </Consent>
            <Consent name="contact_whatsapp" checked={f.contact_whatsapp}>
              WhatsApp <span className="font-normal text-[var(--ink-mute)]">(optional)</span>
            </Consent>
            <p className="m-0 text-xs text-[var(--ink-mute)]">
              Messages are about your projects and account only. Message and data rates may apply. Reply STOP to opt out of texts at any
              time. Text and WhatsApp consent is not required to join.
            </p>
          </fieldset>
        </Step>
        <SubmitButton size="lg" pendingText="Submitting…" className="w-full sm:w-auto sm:justify-self-start sm:px-10">
          Submit for review
        </SubmitButton>
      </form>
    </div>
  );
}
