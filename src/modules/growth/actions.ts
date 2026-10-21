"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/modules/auth/actions";

/** Logged-in provider asks for a consultative Growth Review (never "buy now"). */
export async function requestGrowthReview(_: FormState, formData: FormData): Promise<FormState> {
  const org = z.string().uuid().safeParse(formData.get("orgId"));
  if (!org.success) return { error: "Invalid business." };
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 32);
  if (phone && !/^[0-9()+\-\s.]{7,32}$/.test(phone)) return { error: "Enter a valid phone number." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_growth_review", {
    p_org: org.data,
    p_phone: phone || null,
    p_best_time: String(formData.get("bestTime") ?? "").trim().slice(0, 120) || null,
    p_message: String(formData.get("message") ?? "").trim().slice(0, 2000) || null,
  });
  if (error) return { error: ["22023", "42501"].includes(error.code) ? error.message : "We could not send your request. Try again." };
  revalidatePath("/provider", "layout");
  return { success: "Request sent. BookedUp will contact you to schedule your Growth Review." };
}

const publicSchema = z.object({
  name: z.string().trim().min(2, "Enter your name.").max(120),
  company: z.string().trim().min(2, "Enter your company name.").max(160),
  email: z.string().trim().toLowerCase().email("Enter a valid e-mail.").max(254),
  phone: z.string().trim().regex(/^[0-9()+\-\s.]{7,32}$/, "Enter a valid phone number.").or(z.literal("")),
  city: z.string().trim().max(80),
  services: z.string().trim().max(300),
  message: z.string().trim().max(2000),
});

/** Public "Learn about BookedUp Growth" form. */
export async function submitGrowthInterest(_: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("website")) return { success: "Thank you." }; // honeypot
  const fields = Object.fromEntries(["name", "company", "email", "phone", "city", "services", "message"].map((k) => [k, String(formData.get(k) ?? "")]));
  const parsed = publicSchema.safeParse(fields);
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const d = parsed.data;
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_growth_interest", {
    p_name: d.name,
    p_company: d.company,
    p_email: d.email,
    p_phone: d.phone || null,
    p_city: d.city || null,
    p_services: d.services || null,
    p_message: d.message || null,
    p_ip_hash: createHash("sha256").update(`bookedup:${ip}`).digest("hex").slice(0, 32),
  });
  if (error) return { error: error.code === "54000" ? "Too many requests. Try again in an hour." : "We could not send your request. Try again.", fields };
  return { success: "Thanks! BookedUp will contact you to see if Growth fits your business." };
}
