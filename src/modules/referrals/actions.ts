"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/modules/auth/actions";

const phone = z
  .string()
  .trim()
  .regex(/^[0-9()+\-\s.]{7,32}$/, "Enter a valid phone number.")
  .or(z.literal(""))
  .transform((v) => v || null);
const projectSchema = z.object({
  category: z.string().uuid({ error: "Choose the service needed." }),
  city: z.string().trim().min(2, "Enter the city.").max(80),
  zip: z.string().trim().regex(/^[0-9]{5}$/, "Enter a 5-digit ZIP code."),
  description: z.string().trim().min(10, "Describe the project in at least 10 characters.").max(3000),
  timeline: z.enum(["asap", "1-3_months", "3-6_months", "flexible"], { error: "Choose a timeline." }),
  name: z.string().trim().min(2, "Enter the homeowner's name.").max(120),
  phone,
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(254).or(z.literal("")).transform((v) => v || null),
});

const keys = ["category", "city", "zip", "description", "timeline", "name", "phone", "email", "address", "provider"];
const fieldsOf = (fd: FormData) => Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));

const friendly = (code: string | undefined, message: string, fallback: string) =>
  code && ["42501", "22023", "54000", "P0002"].includes(code) ? message : fallback;

export async function submitReferral(_: FormState, formData: FormData): Promise<FormState> {
  const fields = fieldsOf(formData);
  const parsed = projectSchema
    .extend({
      orgId: z.string().uuid(),
      address: z.string().trim().max(300).optional(),
      provider: z.string().uuid().optional(),
      attested: z.literal("on", { error: "Confirm the homeowner authorized you to share their details." }),
    })
    .safeParse({
      ...fields,
      orgId: formData.get("orgId"),
      provider: fields.provider || undefined,
      attested: formData.get("attested"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const d = parsed.data;
  if (!d.phone && !d.email) return { error: "Add the homeowner's phone or email.", fields };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_referral", {
    p_org: d.orgId,
    p_category: d.category,
    p_city: d.city,
    p_zip: d.zip,
    p_description: d.description,
    p_timeline: d.timeline,
    p_name: d.name,
    p_phone: d.phone,
    p_email: d.email,
    p_address: d.address || null,
    p_attested: true,
    p_suggested_provider: d.provider ?? null,
  });
  if (error) return { error: friendly(error.code, error.message, "We could not send the referral. Try again."), fields };
  revalidatePath("/app", "layout");
  redirect("/app/referrals?sent=1");
}

export async function submitPublicReferral(_: FormState, formData: FormData): Promise<FormState> {
  const fields = fieldsOf(formData);
  if (formData.get("company")) return { success: "Thank you." }; // honeypot
  const parsed = projectSchema
    .extend({
      code: z.string().regex(/^[a-z0-9]{6,16}$/),
      consentVersion: z.string().min(1).max(40),
      consent: z.literal("on", { error: "Please authorize BookedUp to contact you about this project." }),
    })
    .safeParse({ ...fields, code: formData.get("code"), consentVersion: formData.get("consentVersion"), consent: formData.get("consent") });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const d = parsed.data;
  if (!d.phone && !d.email) return { error: "Add a phone number or email so we can reach you.", fields };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = createHash("sha256").update(`bookedup:${ip}`).digest("hex").slice(0, 32);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_public_referral", {
    p_code: d.code,
    p_category: d.category,
    p_city: d.city,
    p_zip: d.zip,
    p_description: d.description,
    p_timeline: d.timeline,
    p_name: d.name,
    p_phone: d.phone,
    p_email: d.email,
    p_consent: true,
    p_consent_version: d.consentVersion,
    p_ip_hash: ipHash,
    p_user_agent: (h.get("user-agent") ?? "").slice(0, 300),
  });
  if (error) return { error: friendly(error.code, error.message, "We could not send your request. Please try again."), fields };
  return { success: `Request #${data} received. BookedUp will review it and connect you with a local professional.` };
}

/* ---------------------------------------------------------------- providers */

const id = z.string().uuid();

export async function respondOpportunity(formData: FormData) {
  const a = id.parse(formData.get("assignmentId"));
  const accept = formData.get("decision") === "accept";
  const reason = z.enum(["not_a_fit", "no_capacity", "outside_area", "other"]).catch("other").parse(formData.get("reason"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("provider_respond", { p_assignment: a, p_accept: accept, p_reason: accept ? null : reason });
  if (error) redirect(`/app/opportunities/${a}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/app/opportunities", "layout");
  redirect(`/app/opportunities/${a}`);
}

export async function updateOpportunity(formData: FormData) {
  const a = id.parse(formData.get("assignmentId"));
  const status = z.enum(["contacted", "estimate_scheduled", "estimate_sent", "won", "lost"]).parse(formData.get("status"));
  const raw = String(formData.get("value") ?? "").replace(/[^0-9.]/g, "");
  const value = raw ? Number(raw) : null;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 4000) || null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("provider_update", { p_assignment: a, p_status: status, p_estimated_value: value, p_notes: notes });
  if (error) redirect(`/app/opportunities/${a}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/app/opportunities", "layout");
  redirect(`/app/opportunities/${a}?saved=1`);
}

/* ---------------------------------------------------------------- connections and notifications */

export async function requestConnection(formData: FormData) {
  const from = id.parse(formData.get("from"));
  const to = id.parse(formData.get("to"));
  const supabase = await createClient();
  await supabase.rpc("request_connection", { p_from: from, p_to: to });
  revalidatePath("/app/partners");
}

export async function respondConnection(formData: FormData) {
  const c = id.parse(formData.get("connectionId"));
  const status = z.enum(["accepted", "declined"]).parse(formData.get("status"));
  const supabase = await createClient();
  await supabase.rpc("respond_connection", { p_connection: c, p_status: status });
  revalidatePath("/app/partners");
}

export async function markNotificationsRead() {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/app", "layout");
  revalidatePath("/admin", "layout");
}
