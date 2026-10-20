"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/modules/auth/actions";

const optional = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);

const businessSchema = z.object({
  name: z.string().trim().min(2, "Enter the business name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid business email.").max(254),
  phone: z.string().trim().regex(/^[0-9()+\-\s.]{7,32}$/, "Enter a valid business phone.").or(z.literal("")).transform((v) => v || null),
  website: optional(300),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use the 2-letter state code, like FL."),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  zip: z.string().trim().regex(/^[0-9]{5}$/, "Enter a 5-digit ZIP code."),
});

const fieldsOf = (fd: FormData) =>
  Object.fromEntries(["name", "email", "phone", "website", "state", "city", "zip", "mode", "outOfScope"].map((k) => [k, String(fd.get(k) ?? "")]));

export async function createOrganization(_: FormState, formData: FormData): Promise<FormState> {
  const fields = fieldsOf(formData);
  const parsed = businessSchema
    .extend({
      mode: z.enum(["refer", "receive", "both"], { error: "Choose what you would like to do." }),
      outOfScope: z.enum(["0", "1-2", "3-5", "6+"]).optional(),
    })
    .safeParse({ ...fields, outOfScope: fields.outOfScope || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization", {
    p_name: d.name,
    p_email: d.email,
    p_phone: d.phone,
    p_website: d.website,
    p_state: d.state,
    p_city: d.city,
    p_zip: d.zip,
    p_wants_refer: d.mode !== "receive",
    p_wants_receive: d.mode !== "refer",
    p_out_of_scope: d.outOfScope ?? null,
  });
  if (error) {
    if (error.code === "54000") return { error: "This account already owns the maximum number of businesses.", fields };
    return { error: "We could not save the business. Check the details and try again.", fields };
  }
  revalidatePath("/app", "layout");
  redirect("/app?created=1");
}

export async function updateOrganization(_: FormState, formData: FormData): Promise<FormState> {
  const fields = fieldsOf(formData);
  const orgId = z.string().uuid().safeParse(formData.get("orgId"));
  const parsed = businessSchema.extend({ description: optional(2000) }).safeParse({ ...fields, description: formData.get("description") ?? "" });
  if (!orgId.success || !parsed.success) return { error: parsed.success ? "Invalid business." : parsed.error.issues[0].message, fields };

  const supabase = await createClient();
  // RLS limits this to owners and managers of the organization; status fields are not updatable by members at all.
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      website: parsed.data.website,
      state: parsed.data.state,
      city: parsed.data.city,
      zip: parsed.data.zip,
      description: parsed.data.description,
    })
    .eq("id", orgId.data)
    .select("id");
  if (error || !data?.length) return { error: "You don't have permission to edit this business, or it no longer exists.", fields };
  revalidatePath("/app", "layout");
  return { success: "Business profile saved." };
}
