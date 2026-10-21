"use client";

import { useState } from "react";
import type { Category } from "@/modules/network/catalog";
import { Field, Input } from "@/components/ui/form";
import { Select, Textarea } from "@/components/ui/inputs";
import { timelineLabel } from "@/modules/format";
import { budgetLabel, propertyLabel } from "@/modules/provider/labels";

type F = Record<string, string | undefined>;

export function ProjectFields({ categories, f, who }: { categories: Category[]; f: F; who: "partner" | "homeowner" }) {
  const owner = who === "partner" ? "Homeowner's" : "Your";
  const [timeline, setTimeline] = useState(f.timeline ?? "");
  const [phone, setPhone] = useState(f.phone ?? "");
  const [email, setEmail] = useState(f.email ?? "");
  const urgent = timeline === "asap";
  const contactMissing = !phone.trim() && !email.trim();
  const contactRule = urgent
    ? "Urgent project: a phone number is required."
    : "Phone or e-mail is required (at least one).";
  const contactProblem = urgent && !phone.trim() ? "Add a phone number — urgent projects are handled by phone." : null;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="category" label="Service needed">
          <Select id="category" name="category" required defaultValue={f.category ?? ""}>
            <option value="">Select a service</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="timeline" label={who === "partner" ? "When do they want to start?" : "When do you want to start?"}>
          <Select id="timeline" name="timeline" required value={timeline} onChange={(e) => setTimeline(e.target.value)}>
            <option value="">Select</option>
            {Object.entries(timelineLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id="description" label="Project description" hint="What needs to be done? Rooms, size, materials.">
        <Textarea id="description" name="description" rows={4} minLength={10} maxLength={3000} required defaultValue={f.description ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="budget" label="Estimated budget" hint={`Required. Choose “Not sure yet” if ${who === "partner" ? "the customer doesn't" : "you don't"} know.`}>
          <Select id="budget" name="budget" required defaultValue={f.budget ?? ""}>
            <option value="">Select</option>
            {Object.entries(budgetLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="propertyType" label="Property type" hint="Required. Choose “Other” if none fits.">
          <Select id="propertyType" name="propertyType" required defaultValue={f.propertyType ?? ""}>
            <option value="">Select</option>
            {Object.entries(propertyLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id="needs" label="Specific needs (optional)" hint="Accessibility, HOA rules, permits, materials already bought, best time to visit.">
        <Textarea id="needs" name="needs" rows={2} maxLength={2000} defaultValue={f.needs ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field id="city" label="Project city">
          <Input id="city" name="city" required defaultValue={f.city ?? ""} />
        </Field>
        <Field id="zip" label="ZIP code">
          <Input id="zip" name="zip" inputMode="numeric" maxLength={5} required defaultValue={f.zip ?? ""} />
        </Field>
      </div>
      <Field id="name" label={`${owner} name`}>
        <Input id="name" name="name" autoComplete={who === "homeowner" ? "name" : "off"} required defaultValue={f.name ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="phone" label={`${owner} phone${urgent ? "" : " (or e-mail)"}`} error={contactProblem ?? undefined}>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            required={urgent || !email.trim()}
            autoComplete={who === "homeowner" ? "tel" : "off"}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            aria-invalid={Boolean(contactProblem)}
          />
        </Field>
        <Field id="email" label={`${owner} e-mail${urgent ? " (optional)" : " (or phone)"}`}>
          <Input
            id="email"
            name="email"
            type="email"
            required={!urgent && !phone.trim()}
            autoComplete={who === "homeowner" ? "email" : "off"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
      </div>
      <p className={`m-0 rounded-lg border px-3 py-2 text-sm ${contactMissing || contactProblem ? "border-warning/40 bg-warning/5" : "border-border bg-surface text-muted"}`}>
        {contactRule}
      </p>
    </>
  );
}
