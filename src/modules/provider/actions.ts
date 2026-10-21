"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import type { FormState } from "@/modules/auth/actions";

const number = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? null : Number(s);
};

/** Saving the form also counts as confirming capacity today. Same rules as the provider_capacity trigger. */
export async function saveCapacity(_: FormState, formData: FormData): Promise<FormState> {
  const access = await requireUser("/provider/capacity");
  const org = z.string().uuid().safeParse(formData.get("orgId"));
  if (!org.success) return { error: "Invalid business." };
  const accepting = formData.get("accepting") === "yes";
  const weekly = number(formData.get("weekly"));
  const min = number(formData.get("min"));
  const max = number(formData.get("max"));
  const lead = number(formData.get("lead"));
  if (weekly === null || min === null || max === null || lead === null)
    return { error: "Fill weekly projects, smallest and largest project and lead time." };
  if (!Number.isInteger(weekly) || weekly < 0 || weekly > 100) return { error: "Weekly capacity must be a whole number from 0 to 100." };
  if (accepting && weekly === 0) return { error: "Weekly capacity must be at least 1 while you take new projects. Pause new projects to use 0." };
  if (![min, max].every((v) => Number.isFinite(v) && v >= 0 && v <= 10_000_000)) return { error: "Project values must be between $0 and $10,000,000." };
  if (max < min) return { error: "The largest project must be equal to or higher than the smallest." };
  if (!Number.isInteger(lead) || lead < 0 || lead > 365) return { error: "Lead time must be a whole number of days from 0 to 365." };
  const supabase = await createClient();
  const { error } = await supabase.from("provider_capacity").upsert({
    org_id: org.data,
    accepting_new_work: accepting,
    weekly_capacity: weekly,
    min_project_value: min,
    max_project_value: max,
    lead_time_days: lead,
    notes: String(formData.get("notes") ?? "").trim().slice(0, 1000) || null,
    confirmed_at: new Date().toISOString(),
    confirmed_by: access.userId,
  });
  if (error) return { error: error.code === "22023" ? error.message : "Only owners and managers can update capacity." };
  revalidatePath("/", "layout");
  return { success: "Capacity confirmed today." };
}

const kinds = ["contractor_license", "business_license", "general_liability", "workers_comp", "other"] as const;
const allowed: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

export async function addDocument(_: FormState, formData: FormData): Promise<FormState> {
  const access = await requireUser("/provider/capacity");
  const parsed = z
    .object({
      orgId: z.string().uuid(),
      kind: z.enum(kinds, { error: "Choose the document type." }),
      number: z.string().trim().min(1, "Enter the license or policy number.").max(80),
      issuer: z.string().trim().min(2, "Enter who issued the document.").max(120),
      expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the expiration date."),
    })
    .safeParse({
      orgId: formData.get("orgId"),
      kind: formData.get("kind"),
      number: String(formData.get("number") ?? ""),
      issuer: String(formData.get("issuer") ?? ""),
      expires: String(formData.get("expires") ?? ""),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.expires <= new Date().toISOString().slice(0, 10)) {
    return { error: "The expiration date must be in the future. Upload the current document (check the expiration year)." };
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Attach a copy of the document (PDF, JPG or PNG)." };
  const supabase = await createClient();
  const ext = allowed[file.type];
  if (!ext) return { error: "Upload a PDF, JPG or PNG." };
  if (file.size > 10 * 1024 * 1024) return { error: "The file must be 10 MB or smaller." };
  const path = `${d.orgId}/${randomUUID()}.${ext}`;
  const { error: up } = await supabase.storage.from("provider-docs").upload(path, file, { contentType: file.type });
  if (up) return { error: "Upload failed. Only owners and managers can add documents." };
  const { error } = await supabase.from("professional_documents").insert({
    org_id: d.orgId,
    kind: d.kind,
    number: d.number,
    issuer: d.issuer,
    expires_on: d.expires,
    file_path: path,
    created_by: access.userId,
  });
  if (error) {
    await supabase.storage.from("provider-docs").remove([path]);
    return { error: error.code === "22023" ? error.message : "Only owners and managers can add documents." };
  }
  revalidatePath("/", "layout");
  return { success: "Document sent to BookedUp for review." };
}
