import { Field, Input } from "@/components/ui/form";

type Values = Partial<Record<"name" | "email" | "phone" | "website" | "state" | "city" | "zip", string | null>>;

export function BusinessFields({ values = {} }: { values?: Values }) {
  const v = (k: keyof Values) => values[k] ?? "";
  return (
    <>
      <Field id="name" label="Business name">
        <Input id="name" name="name" autoComplete="organization" required defaultValue={v("name")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="email" label="Business email">
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={v("email")} />
        </Field>
        <Field id="phone" label="Business phone">
          <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" required defaultValue={v("phone")} />
        </Field>
      </div>
      <Field id="website" label="Website (optional)">
        <Input id="website" name="website" type="url" inputMode="url" placeholder="https://" defaultValue={v("website")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_96px_128px]">
        <Field id="city" label="City">
          <Input id="city" name="city" autoComplete="address-level2" required defaultValue={v("city")} />
        </Field>
        <Field id="state" label="State">
          <Input id="state" name="state" autoComplete="address-level1" maxLength={2} required defaultValue={v("state") || "FL"} />
        </Field>
        <Field id="zip" label="ZIP code">
          <Input id="zip" name="zip" autoComplete="postal-code" inputMode="numeric" maxLength={5} required defaultValue={v("zip")} />
        </Field>
      </div>
    </>
  );
}
