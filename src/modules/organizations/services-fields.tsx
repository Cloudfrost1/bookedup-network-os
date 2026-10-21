import type { Category, Region } from "@/modules/network/catalog";
import { Field } from "@/components/ui/form";
import { Select } from "@/components/ui/inputs";

type Values = {
  category?: string | null;
  offered?: string[];
  notOffered?: string[];
  regions?: string[];
};

const chip =
  "flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft";

type Show = { notOffered?: boolean; regions?: boolean };

export function ServicesFields({
  categories,
  regions,
  values = {},
  show = {},
}: {
  categories: Category[];
  regions: Region[];
  values?: Values;
  /** Hide blocks that don't apply to the business's role (both shown by default). */
  show?: Show;
}) {
  const showNotOffered = show.notOffered !== false;
  const showRegions = show.regions !== false;
  return (
    <>
      <Field id="category" label="Main service">
        <Select
          id="category"
          name="category"
          defaultValue={values.category ?? ""}
          required
        >
          <option value="">Select your main service</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Services you offer</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <label key={c.id} className={chip}>
              <input
                type="checkbox"
                name="offered"
                value={c.id}
                defaultChecked={values.offered?.includes(c.id)}
                className="accent-[var(--primary)]"
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      {showNotOffered ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">
            Requests you usually turn down
          </legend>
          <p className="text-sm text-muted">
            These are the projects you can refer to other businesses in the
            network.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <label key={c.id} className={chip}>
                <input
                  type="checkbox"
                  name="notOffered"
                  value={c.id}
                  defaultChecked={values.notOffered?.includes(c.id)}
                  className="accent-[var(--primary)]"
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {showRegions ? (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Cities you serve</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {regions.map((r) => (
              <label key={r.id} className={chip}>
                <input
                  type="checkbox"
                  name="regions"
                  value={r.id}
                  defaultChecked={values.regions?.includes(r.id)}
                  className="accent-[var(--primary)]"
                />
                {r.city}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </>
  );
}
