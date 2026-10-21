"use server";

import { createHash, randomUUID } from "node:crypto";
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

const keys = ["category", "city", "zip", "description", "timeline", "budget", "propertyType", "needs", "name", "phone", "email", "address", "provider"];
const budgets = ["under_5k", "5k_15k", "15k_30k", "30k_60k", "60k_plus", "unknown"] as const;
const properties = ["single_family", "townhouse", "condo", "multi_family", "commercial", "other"] as const;
const scope = {
  budget: z.enum(budgets, { error: "Choose the estimated budget (or “Not sure yet”)." }),
  propertyType: z.enum(properties, { error: "Choose the property type (or “Other”)." }),
  needs: z.string().trim().max(2000).optional(),
};
const photoTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
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
      ...scope,
    })
    .safeParse({
      ...fields,
      orgId: formData.get("orgId"),
      provider: fields.provider || undefined,
      needs: fields.needs || undefined,
      attested: formData.get("attested"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const d = parsed.data;
  if (!d.phone && !d.email) return { error: "Add the homeowner's phone or e-mail.", fields };
  if (d.timeline === "asap" && !d.phone) return { error: "Urgent projects need the homeowner's phone number.", fields };
  const photos = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (photos.length > 8) return { error: "Add up to 8 photos.", fields };
  if (photos.some((p) => !photoTypes[p.type])) return { error: "Photos must be JPG, PNG, WEBP or HEIC.", fields };
  if (photos.some((p) => p.size > 8 * 1024 * 1024)) return { error: "Each photo must be 8 MB or smaller.", fields };

  const supabase = await createClient();
  const { data: referralId, error } = await supabase.rpc("submit_referral_v2", {
    p_org: d.orgId,
    p_category: d.category,
    p_city: d.city,
    p_zip: d.zip,
    p_description: d.description,
    p_timeline: d.timeline,
    p_budget: d.budget,
    p_property_type: d.propertyType,
    p_needs: d.needs ?? null,
    p_name: d.name,
    p_phone: d.phone,
    p_email: d.email,
    p_address: d.address || null,
    p_attested: true,
    p_suggested_provider: d.provider ?? null,
  });
  if (error) return { error: friendly(error.code, error.message, "We could not send the referral. Try again."), fields };
  let failed = 0;
  for (const photo of photos) {
    const path = `${referralId}/${randomUUID()}.${photoTypes[photo.type]}`;
    const { error: up } = await supabase.storage.from("referral-photos").upload(path, photo, { contentType: photo.type });
    const { error: row } = up ? { error: up } : await supabase.from("referral_photos").insert({ referral_id: referralId, path });
    if (row) failed += 1;
  }
  revalidatePath("/", "layout");
  redirect(`/partner/referrals?sent=1${failed ? `&photos_failed=${failed}` : ""}`);
}

export async function submitPublicReferral(_: FormState, formData: FormData): Promise<FormState> {
  const fields = fieldsOf(formData);
  if (formData.get("company")) return { success: "Thank you." }; // honeypot
  const parsed = projectSchema
    .extend({
      code: z.string().regex(/^[a-z0-9]{6,16}$/),
      consentVersion: z.string().min(1).max(40),
      consent: z.literal("on", { error: "Please authorize BookedUp to contact you about this project." }),
      ...scope,
    })
    .safeParse({
      ...fields,
      needs: fields.needs || undefined,
      code: formData.get("code"),
      consentVersion: formData.get("consentVersion"),
      consent: formData.get("consent"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const d = parsed.data;
  if (!d.phone && !d.email) return { error: "Add a phone number or e-mail so we can reach you.", fields };
  if (d.timeline === "asap" && !d.phone) return { error: "For urgent projects, add a phone number so we can reach you quickly.", fields };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ipHash = createHash("sha256").update(`bookedup:${ip}`).digest("hex").slice(0, 32);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_public_referral_v2", {
    p_code: d.code,
    p_category: d.category,
    p_city: d.city,
    p_zip: d.zip,
    p_description: d.description,
    p_timeline: d.timeline,
    p_budget: d.budget,
    p_property_type: d.propertyType,
    p_needs: d.needs ?? null,
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
  if (error) redirect(`/provider/opportunities/${a}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/provider/opportunities", "layout");
  redirect(`/provider/opportunities/${a}`);
}

export async function updateOpportunity(formData: FormData) {
  const a = id.parse(formData.get("assignmentId"));
  const status = z.enum(["contacted", "estimate_scheduled", "estimate_sent", "won", "lost"]).parse(formData.get("status"));
  const raw = String(formData.get("value") ?? "").replace(/[^0-9.]/g, "");
  const value = raw ? Number(raw) : null;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 4000) || null;
  const when = String(formData.get("appointment") ?? "");
  // datetime-local is entered in Orlando time (Eastern).
  const appointment = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when) ? easternToIso(when) : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("provider_update_v2", {
    p_assignment: a,
    p_status: status,
    p_estimated_value: value,
    p_notes: notes,
    p_appointment_at: appointment,
  });
  if (error) redirect(`/provider/opportunities/${a}?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/provider/opportunities", "layout");
  redirect(`/provider/opportunities/${a}?saved=1`);
}

function easternToIso(local: string) {
  // Find the UTC offset of America/New_York at that moment (handles daylight saving).
  const guess = new Date(local + ":00Z");
  const tz = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
  const hours = Number(tz.replace("GMT", "") || "-5");
  return new Date(guess.getTime() - hours * 3600 * 1000).toISOString();
}

/* ---------------------------------------------------------------- partner feedback on the provider */

export async function sendPartnerFeedback(formData: FormData) {
  const r = id.parse(formData.get("referralId"));
  const yn = (k: string) => (formData.get(k) === "yes" ? true : formData.get(k) === "no" ? false : null);
  const rating = Number(formData.get("rating"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("partner_feedback", {
    p_referral: r,
    p_contacted: yn("contacted"),
    p_showed: yn("showed"),
    p_kept: yn("kept"),
    p_rating: rating >= 1 && rating <= 5 ? rating : null,
    p_comment: String(formData.get("comment") ?? "").slice(0, 1000) || null,
  });
  revalidatePath("/partner/referrals");
  redirect(`/partner/referrals?${error ? "error=" + encodeURIComponent(error.message) : "feedback=1"}`);
}

/* ---------------------------------------------------------------- connections and notifications */

export async function requestConnection(formData: FormData) {
  const from = id.parse(formData.get("from"));
  const to = id.parse(formData.get("to"));
  const supabase = await createClient();
  await supabase.rpc("request_connection", { p_from: from, p_to: to });
  revalidatePath("/partner/network");
}

export async function respondConnection(formData: FormData) {
  const c = id.parse(formData.get("connectionId"));
  const status = z.enum(["accepted", "declined"]).parse(formData.get("status"));
  const supabase = await createClient();
  await supabase.rpc("respond_connection", { p_connection: c, p_status: status });
  revalidatePath("/", "layout");
}

export async function markNotificationsRead() {
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}
