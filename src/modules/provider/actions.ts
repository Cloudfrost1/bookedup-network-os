"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/modules/auth/session";
import type { FormState } from "@/modules/auth/actions";

const money = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[^0-9.]/g, "");
  return s ? Number(s) : null;
};
const int = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").replace(/[^0-9]/g, "");
  return s ? Number(s) : null;
};

/** Saving the form also counts as confirming capacity today. */
export async function saveCapacity(_: FormState, formData: FormData): Promise<FormState> {
  const access = await requireUser("/provider/capacity");
  const org = z.string().uuid().safeParse(formData.get("orgId"));
  if (!org.success) return { error: "Invalid business." };
  const min = money(formData.get("min"));
  const max = money(formData.get("max"));
  if (min != null && max != null && max < min) return { error: "The maximum project value must be higher than the minimum." };
  const weekly = int(formData.get("weekly"));
  const lead = int(formData.get("lead"));
  if (weekly != null && weekly > 100) return { error: "Weekly capacity must be 100 or less." };
  if (lead != null && lead > 365) return { error: "Lead time must be 365 days or less." };
  const supabase = await createClient();
  const { error } = await supabase.from("provider_capacity").upsert({
    org_id: org.data,
    accepting_new_work: formData.get("accepting") === "yes",
    weekly_capacity: weekly,
    min_project_value: min,
    max_project_value: max,
    lead_time_days: lead,
    notes: String(formData.get("notes") ?? "").trim().slice(0, 1000) || null,
    confirmed_at: new Date().toISOString(),
    confirmed_by: access.userId,
  });
  if (error) return { error: "Only owners and managers can update capacity." };
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
      number: z.string().trim().max(80).optional(),
      issuer: z.string().trim().max(120).optional(),
      expires: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })
    .safeParse({
      orgId: formData.get("orgId"),
      kind: formData.get("kind"),
      number: formData.get("number") || undefined,
      issuer: formData.get("issuer") || undefined,
      expires: formData.get("expires") || undefined,
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const file = formData.get("file");
  const supabase = await createClient();
  let path: string | null = null;
  if (file instanceof File && file.size > 0) {
    const ext = allowed[file.type];
    if (!ext) return { error: "Upload a PDF, JPG or PNG." };
    if (file.size > 10 * 1024 * 1024) return { error: "The file must be 10 MB or smaller." };
    path = `${d.orgId}/${randomUUID()}.${ext}`;
    const { error: up } = await supabase.storage.from("provider-docs").upload(path, file, { contentType: file.type });
    if (up) return { error: "Upload failed. Only owners and managers can add documents." };
  }
  if (!path && !d.number) return { error: "Add the document number or upload a copy." };
  const { error } = await supabase.from("professional_documents").insert({
    org_id: d.orgId,
    kind: d.kind,
    number: d.number ?? null,
    issuer: d.issuer ?? null,
    expires_on: d.expires ?? null,
    file_path: path,
    created_by: access.userId,
  });
  if (error) return { error: "Only owners and managers can add documents." };
  revalidatePath("/", "layout");
  return { success: "Document sent to BookedUp for review." };
}
