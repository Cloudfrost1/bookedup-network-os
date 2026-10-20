import type { Category } from "@/modules/network/catalog";
import { Field, Input } from "@/components/ui/form";
import { Select, Textarea } from "@/components/ui/inputs";
import { timelineLabel } from "@/modules/format";
import { budgetLabel, propertyLabel } from "@/modules/provider/labels";

type F = Record<string, string | undefined>;

export function ProjectFields({ categories, f, who }: { categories: Category[]; f: F; who: "partner" | "homeowner" }) {
  const owner = who === "partner" ? "Homeowner's" : "Your";
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
          <Select id="timeline" name="timeline" required defaultValue={f.timeline ?? ""}>
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
        <Field id="budget" label="Estimated budget">
          <Select id="budget" name="budget" defaultValue={f.budget ?? ""}>
            <option value="">Select</option>
            {Object.entries(budgetLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="propertyType" label="Property type">
          <Select id="propertyType" name="propertyType" defaultValue={f.propertyType ?? ""}>
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
        <Field id="phone" label={`${owner} phone`}>
          <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete={who === "homeowner" ? "tel" : "off"} defaultValue={f.phone ?? ""} />
        </Field>
        <Field id="email" label={`${owner} email`} hint="Phone or email is required.">
          <Input id="email" name="email" type="email" autoComplete={who === "homeowner" ? "email" : "off"} defaultValue={f.email ?? ""} />
        </Field>
      </div>
    </>
  );
}
