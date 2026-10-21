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
  phone: z.string().trim().regex(/^[0-9()+\-\s.]{7,32}$/, "Enter a valid business phone."),
  website: optional(300),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use the 2-letter state code, like FL."),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  zip: z.string().trim().regex(/^[0-9]{5}$/, "Enter a 5-digit ZIP code."),
});

const fieldsOf = (fd: FormData) =>
  Object.fromEntries(["name", "email", "phone", "website", "state", "city", "zip", "mode", "outOfScope"].map((k) => [k, String(fd.get(k) ?? "")]));

const uuidList = (fd: FormData, key: string) =>
  fd.getAll(key).map(String).filter((v) => z.string().uuid().safeParse(v).success);

const CONSENTS = ["terms_privacy", "data_use", "referral_authorization", "contact_email", "contact_sms", "contact_whatsapp"] as const;

export async function createOrganization(_: FormState, formData: FormData): Promise<FormState> {
  const consents = Object.fromEntries(CONSENTS.map((k) => [k, formData.get(k) === "on"])) as Record<(typeof CONSENTS)[number], boolean>;
  const fields: Record<string, string> = {
    ...fieldsOf(formData),
    category: String(formData.get("category") ?? ""),
    offered: uuidList(formData, "offered").join(","),
    notOffered: uuidList(formData, "notOffered").join(","),
    regions: uuidList(formData, "regions").join(","),
    ...Object.fromEntries(CONSENTS.map((k) => [k, consents[k] ? "on" : ""])),
  };
  const parsed = businessSchema
    .extend({
      mode: z.enum(["refer", "receive", "both"], { error: "Choose what you would like to do: refer, receive or both." }),
      outOfScope: z.enum(["0", "1-2", "3-5", "6+"], { error: "Tell us how many out-of-scope requests you received in the last 30 days." }),
      category: z.string().uuid({ error: "Choose your main service." }),
    })
    .safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const d = parsed.data;
  const refers = d.mode !== "receive";

  const offered = uuidList(formData, "offered");
  const notOffered = uuidList(formData, "notOffered").filter((id) => !offered.includes(id));
  const regions = uuidList(formData, "regions");
  if (!offered.length) return { error: "Choose at least one service you offer.", fields };
  if (refers && !notOffered.length) return { error: "Choose at least one request you usually turn down — these are the projects you can refer.", fields };
  if (!regions.length) return { error: "Choose at least one city you serve.", fields };
  if (!offered.includes(d.category)) offered.unshift(d.category);

  if (!consents.terms_privacy) return { error: "Accept the Terms of Service and Privacy Policy to continue.", fields };
  if (!consents.data_use) return { error: "Authorize BookedUp to use your business information to continue.", fields };
  if (refers && !consents.referral_authorization) return { error: "Confirm you will only refer customers who allowed you to share their details.", fields };
  if (!consents.contact_email) return { error: "Allow e-mail contact — it is how BookedUp sends project and account updates.", fields };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization_v3", {
    p_name: d.name,
    p_category: d.category,
    p_email: d.email,
    p_phone: d.phone,
    p_website: d.website,
    p_state: d.state,
    p_city: d.city,
    p_zip: d.zip,
    p_wants_refer: refers,
    p_wants_receive: d.mode !== "refer",
    p_out_of_scope: d.outOfScope,
    p_offered: offered,
    p_not_offered: notOffered,
    p_regions: regions,
    p_consents: { ...consents, referral_authorization: refers && consents.referral_authorization },
  });
  if (error) {
    if (error.code === "54000") return { error: "This account already owns the maximum number of businesses.", fields };
    return { error: "We could not save the business. Check the details and try again.", fields };
  }
  revalidatePath("/", "layout");
  redirect("/app?created=1");
}

/** Replaces the services and service areas of a business (RLS: owners and managers only).
 *  Only the blocks that apply to the business's role are changed: a business that only refers keeps its service areas
 *  and availability as they are; a business that only receives keeps its turned-down list and directory setting. */
export async function saveServices(_: FormState, formData: FormData): Promise<FormState> {
  const orgId = z.string().uuid().safeParse(formData.get("orgId"));
  if (!orgId.success) return { error: "Invalid business." };
  const org = orgId.data;
  const supabase = await createClient();

  const [{ data: caps }, { data: current }, { data: currentAreas }, { data: orgRow }] = await Promise.all([
    supabase.from("organization_capabilities").select("capability, status").eq("org_id", org),
    supabase.from("organization_services").select("category_id, kind").eq("org_id", org),
    supabase.from("organization_service_areas").select("region_id").eq("org_id", org),
    supabase.from("organizations").select("public_profile, available_for_referrals").eq("id", org).maybeSingle(),
  ]);
  if (!orgRow) return { error: "You don't have permission to change this business." };
  const refers = (caps ?? []).some((c) => c.capability === "refer" && c.status !== "revoked");
  const receives = (caps ?? []).some((c) => c.capability === "receive" && c.status !== "revoked");

  const offered = uuidList(formData, "offered");
  const notOffered = refers
    ? uuidList(formData, "notOffered").filter((id) => !offered.includes(id))
    : (current ?? []).filter((r) => r.kind === "not_offered").map((r) => r.category_id as string).filter((id) => !offered.includes(id));
  const regions = receives ? uuidList(formData, "regions") : (currentAreas ?? []).map((a) => a.region_id as string);
  if (!offered.length) return { error: "Choose at least one service you offer." };
  if (refers && !notOffered.length) return { error: "Choose at least one request you usually turn down — these are the projects you can refer." };
  if (receives && !regions.length) return { error: "Choose at least one city you serve." };
  const category = z.string().uuid().safeParse(formData.get("category"));

  const steps = [
    await supabase.from("organization_services").delete().eq("org_id", org),
    await supabase.from("organization_services").insert([
      ...offered.map((c) => ({ org_id: org, category_id: c, kind: "offered" })),
      ...notOffered.map((c) => ({ org_id: org, category_id: c, kind: "not_offered" })),
    ]),
    await supabase.from("organization_service_areas").delete().eq("org_id", org),
    regions.length
      ? await supabase.from("organization_service_areas").insert(regions.map((r) => ({ org_id: org, region_id: r })))
      : { error: null },
    await supabase
      .from("organizations")
      .update({
        category_id: category.success && offered.includes(category.data) ? category.data : offered[0],
        public_profile: refers ? formData.get("publicProfile") === "on" : orgRow.public_profile,
        available_for_referrals: receives ? formData.get("available") === "on" : orgRow.available_for_referrals,
      })
      .eq("id", org),
  ];
  if (steps.some((s) => s.error)) return { error: "You don't have permission to change this business." };
  revalidatePath("/", "layout");
  return { success: "Services saved." };
}

export async function addTeamMember(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({
      orgId: z.string().uuid(),
      email: z.string().trim().toLowerCase().email("Enter a valid email."),
      role: z.enum(["member", "manager"]),
    })
    .safeParse({ orgId: formData.get("orgId"), email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_member_by_email", { p_org: parsed.data.orgId, p_email: parsed.data.email, p_role: parsed.data.role });
  if (error) return { error: error.code === "P0002" ? error.message : "Only owners and managers can add team members." };
  revalidatePath("/", "layout");
  return { success: "Team member added." };
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
  revalidatePath("/", "layout");
  return { success: "Business profile saved." };
}
