"use client";

import { useActionState } from "react";
import { addTeamMember, saveServices } from "@/modules/organizations/actions";
import type { FormState } from "@/modules/auth/actions";
import { ServicesFields } from "@/modules/organizations/services-fields";
import type { Category, Region } from "@/modules/network/catalog";
import { Field, FormMessage, Input } from "@/components/ui/form";
import { Checkbox, Select } from "@/components/ui/inputs";
import { SubmitButton } from "@/components/ui/submit-button";

type Values = {
  category: string | null;
  offered: string[];
  notOffered: string[];
  regions: string[];
  publicProfile: boolean;
  available: boolean;
};

export function ServicesForm({ orgId, categories, regions, values }: { orgId: string; categories: Category[]; regions: Region[]; values: Values }) {
  const [state, action] = useActionState<FormState, FormData>(saveServices, {});
  return (
    <form action={action} className="grid gap-5 rounded-xl border border-border bg-background p-5 sm:p-6">
      <h2 className="text-lg font-semibold">Services and service areas</h2>
      <input type="hidden" name="orgId" value={orgId} />
      <FormMessage>{state.error}</FormMessage>
      <FormMessage tone="success">{state.success}</FormMessage>
      <ServicesFields categories={categories} regions={regions} values={values} />
      <div className="grid gap-2">
        <Checkbox name="publicProfile" defaultChecked={values.publicProfile} label="Show my business in the public directory" />
        <Checkbox name="available" defaultChecked={values.available} label="I'm available to receive new projects" />
      </div>
      <SubmitButton pendingText="Saving…" className="justify-self-start">
        Save services
      </SubmitButton>
    </form>
  );
}

export function TeamForm({ orgId }: { orgId: string }) {
  const [state, action] = useActionState<FormState, FormData>(addTeamMember, {});
  return (
    <form action={action} className="grid gap-3 border-t border-border pt-4">
      <input type="hidden" name="orgId" value={orgId} />
      <FormMessage>{state.error}</FormMessage>
      <FormMessage tone="success">{state.success}</FormMessage>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
        <Field id="member-email" label="Add a team member by email" hint="They need to create a BookedUp account first.">
          <Input id="member-email" name="email" type="email" required />
        </Field>
        <Field id="member-role" label="Role">
          <Select id="member-role" name="role" defaultValue="member">
            <option value="member">Member</option>
            <option value="manager">Manager</option>
          </Select>
        </Field>
        <SubmitButton pendingText="Adding…" variant="secondary" className="sm:mb-0">
          Add member
        </SubmitButton>
      </div>
    </form>
  );
}
