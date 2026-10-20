"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/modules/auth/session";

const decision = z.object({
  orgId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  refer: z.enum(["on"]).optional(),
  receive: z.enum(["on"]).optional(),
  note: z.string().trim().max(500).optional(),
});

/** Approves or rejects a business. The database re-checks the admin role inside each RPC. */
export async function decideOrganization(formData: FormData) {
  await requireAdmin();
  const parsed = decision.safeParse({
    orgId: formData.get("orgId"),
    decision: formData.get("decision"),
    refer: formData.get("refer") ?? undefined,
    receive: formData.get("receive") ?? undefined,
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) throw new Error("Invalid request.");
  const { orgId, note } = parsed.data;
  const supabase = await createClient();

  if (parsed.data.decision === "reject") {
    const { error } = await supabase.rpc("admin_set_org_status", { p_org: orgId, p_status: "rejected", p_note: note ?? null });
    if (error) throw new Error("Could not reject the business.");
  } else {
    const { error } = await supabase.rpc("admin_set_org_status", { p_org: orgId, p_status: "approved", p_note: note ?? null });
    if (error) throw new Error("Could not approve the business.");
    for (const cap of ["refer", "receive"] as const) {
      const { error: e } = await supabase.rpc("admin_set_capability", {
        p_org: orgId,
        p_cap: cap,
        p_status: parsed.data[cap] ? "approved" : "revoked",
      });
      if (e) throw new Error("Business approved, but a capability could not be saved.");
    }
  }
  revalidatePath("/admin", "layout");
}

/* ---------------------------------------------------------------- organizations */

const uuid = z.string().uuid();
const back = (path: string, msg?: string, ok = false) => {
  const sep = path.includes("?") ? "&" : "?";
  return msg ? `${path}${sep}${ok ? "ok" : "error"}=${encodeURIComponent(msg)}` : path;
};

async function call(fn: string, args: Record<string, unknown>) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(fn, args);
  return { data, error };
}

export async function updateOrganizationAdmin(formData: FormData) {
  await requireAdmin();
  const org = uuid.parse(formData.get("orgId"));
  const path = `/admin/organizations/${org}`;
  const status = z.enum(["pending_review", "approved", "suspended", "rejected"]).parse(formData.get("status"));
  const verification = z.enum(["not_verified", "pending", "verified", "expired"]).parse(formData.get("verification"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  const steps = [
    await call("admin_set_org_status", { p_org: org, p_status: status, p_note: note }),
    await call("admin_set_verification", { p_org: org, p_status: verification }),
    await call("admin_set_capability", { p_org: org, p_cap: "refer", p_status: formData.get("refer") === "on" ? "approved" : "revoked" }),
    await call("admin_set_capability", { p_org: org, p_cap: "receive", p_status: formData.get("receive") === "on" ? "approved" : "revoked" }),
  ];
  revalidatePath("/admin", "layout");
  redirect(back(path, steps.some((s) => s.error) ? "Some changes could not be saved." : "Saved.", !steps.some((s) => s.error)));
}

export async function saveFollowup(formData: FormData) {
  const access = await requireAdmin();
  const org = uuid.parse(formData.get("orgId"));
  const next = String(formData.get("next") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("organization_followups").upsert({
    org_id: org,
    relationship_owner: access.userId,
    last_contact_at: formData.get("contacted") === "on" ? new Date().toISOString() : undefined,
    next_followup_at: /^\d{4}-\d{2}-\d{2}$/.test(next) ? new Date(next + "T13:00:00Z").toISOString() : null,
    outcome: String(formData.get("outcome") ?? "").trim().slice(0, 200) || null,
    notes: String(formData.get("notes") ?? "").trim().slice(0, 4000) || null,
  });
  revalidatePath("/admin", "layout");
  redirect(back(`/admin/organizations/${org}`, error ? "Follow-up not saved." : "Follow-up saved.", !error));
}

export async function createOrganizationAdmin(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) redirect(back("/admin/organizations", "Enter the business name."));
  const zip = String(formData.get("zip") ?? "").trim();
  const { data, error } = await call("admin_create_organization", {
    p_name: name,
    p_email: String(formData.get("email") ?? ""),
    p_phone: String(formData.get("phone") ?? ""),
    p_city: String(formData.get("city") ?? ""),
    p_state: String(formData.get("state") ?? "FL"),
    p_zip: /^\d{5}$/.test(zip) ? zip : "",
    p_refer: formData.get("refer") === "on",
    p_receive: formData.get("receive") === "on",
  });
  if (error) redirect(back("/admin/organizations", "Could not create the business."));
  revalidatePath("/admin", "layout");
  redirect(`/admin/organizations/${data}`);
}

/* ---------------------------------------------------------------- referrals */

const CHECKS = ["owner_or_authorized", "real_request", "service_match", "location_served", "valid_contact", "authorized", "not_duplicate"] as const;

export async function confirmConsent(formData: FormData) {
  await requireAdmin();
  const r = uuid.parse(formData.get("referralId"));
  const { error } = await call("admin_confirm_consent", {
    p_referral: r,
    p_granted: formData.get("granted") === "yes",
    p_note: String(formData.get("note") ?? "").trim().slice(0, 500) || null,
  });
  revalidatePath("/admin", "layout");
  redirect(back(`/admin/referrals/${r}`, error?.message ?? "Authorization recorded.", !error));
}

export async function qualifyReferral(formData: FormData) {
  await requireAdmin();
  const r = uuid.parse(formData.get("referralId"));
  const checklist = Object.fromEntries(CHECKS.map((k) => [k, formData.get(k) === "on"]));
  const dup = formData.get("duplicate_of");
  if (dup && uuid.safeParse(dup).success) Object.assign(checklist, { duplicate_of: dup });
  const decision = z.enum(["qualified", "rejected"]).parse(formData.get("decision"));
  const { error } = await call("admin_qualify_referral", {
    p_referral: r,
    p_checklist: checklist,
    p_decision: decision,
    p_notes: String(formData.get("notes") ?? "").trim().slice(0, 2000) || null,
  });
  revalidatePath("/admin", "layout");
  redirect(back(`/admin/referrals/${r}`, error?.message ?? (decision === "qualified" ? "Referral qualified." : "Referral rejected."), !error));
}

export async function assignReferral(formData: FormData) {
  await requireAdmin();
  const r = uuid.parse(formData.get("referralId"));
  const provider = uuid.parse(formData.get("providerId"));
  const by = z.enum(["rules", "referrer", "admin"]).catch("admin").parse(formData.get("suggestedBy"));
  const { error } = await call("admin_assign_referral", { p_referral: r, p_provider: provider, p_suggested_by: by });
  revalidatePath("/admin", "layout");
  redirect(back(`/admin/referrals/${r}`, error?.message ?? "Sent to provider.", !error));
}

export async function closeReferral(formData: FormData) {
  await requireAdmin();
  const r = uuid.parse(formData.get("referralId"));
  const { error } = await call("admin_close_referral", { p_referral: r, p_note: String(formData.get("note") ?? "").slice(0, 500) || null });
  revalidatePath("/admin", "layout");
  redirect(back(`/admin/referrals/${r}`, error?.message ?? "Referral closed.", !error));
}

/* ---------------------------------------------------------------- scores, growth, settings */

export async function recomputeScores() {
  await requireAdmin();
  const { error } = await call("compute_scores", {});
  revalidatePath("/admin/rankings");
  redirect(back("/admin/rankings", error ? "Could not recalculate." : "Scores recalculated.", !error));
}

export async function createGrowthContract(formData: FormData) {
  const access = await requireAdmin();
  const provider = uuid.safeParse(formData.get("providerId"));
  const start = String(formData.get("start") ?? "");
  const target = Number(formData.get("target") ?? 24);
  if (!provider.success || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !(target > 0 && target <= 500))
    redirect(back("/admin/growth", "Choose a provider, a start date and a target."));
  const supabase = await createClient();
  const { data: settings } = await supabase.from("network_settings").select("growth_offer_text").limit(1).single();
  const { error } = await supabase.from("growth_contracts").insert({
    provider_org_id: provider.data,
    start_date: start,
    target,
    offer_text: settings?.growth_offer_text ?? "Growth",
    notes: String(formData.get("notes") ?? "").trim().slice(0, 2000) || null,
    created_by: access.userId,
  });
  revalidatePath("/admin", "layout");
  redirect(back("/admin/growth", error ? "Could not create the contract." : "Contract created.", !error));
}

export async function setGrowthStatus(formData: FormData) {
  await requireAdmin();
  const id = uuid.parse(formData.get("contractId"));
  const status = z.enum(["active", "completed", "continuation_required", "cancelled"]).parse(formData.get("status"));
  const supabase = await createClient();
  const { error } = await supabase.from("growth_contracts").update({ status }).eq("id", id);
  revalidatePath("/admin/growth");
  redirect(back(`/admin/growth/${id}`, error ? "Could not update." : "Status updated.", !error));
}

export async function toggleDelivery(formData: FormData) {
  await requireAdmin();
  const id = uuid.parse(formData.get("deliveryId"));
  const contract = uuid.parse(formData.get("contractId"));
  const supabase = await createClient();
  const { error } = await supabase
    .from("growth_deliveries")
    .update({ excluded: formData.get("excluded") === "true", audit_note: String(formData.get("note") ?? "").trim().slice(0, 1000) || null })
    .eq("id", id);
  revalidatePath("/admin/growth", "layout");
  redirect(back(`/admin/growth/${contract}`, error ? "Could not update the delivery." : "Delivery updated.", !error));
}

export async function saveSettings(formData: FormData) {
  await requireAdmin();
  const n = (k: string, d: number) => {
    const v = Number(formData.get(k));
    return Number.isFinite(v) && v >= 0 && v <= 1000 ? Math.round(v) : d;
  };
  const supabase = await createClient();
  const { data: current } = await supabase.from("network_settings").select("network_id").limit(1).single();
  if (!current) redirect(back("/admin/settings", "Settings not found."));
  const { error } = await supabase
    .from("network_settings")
    .update({
      partner_weights: { volume: n("pw_volume", 40), rate: n("pw_rate", 30), consistency: n("pw_consistency", 20), reliability: n("pw_reliability", 10) },
      provider_weights: {
        response: n("vw_response", 30),
        acceptance: n("vw_acceptance", 25),
        updates: n("vw_updates", 20),
        feedback: n("vw_feedback", 15),
        reliability: n("vw_reliability", 10),
      },
      partner_min_volume: n("partner_min_volume", 3),
      provider_min_volume: n("provider_min_volume", 3),
      volume_target: Math.max(1, n("volume_target", 6)),
      inactive_after_days: Math.max(1, n("inactive_after_days", 60)),
      growth_offer_text: String(formData.get("growth_offer_text") ?? "").trim().slice(0, 300) || "Growth",
      growth_offer_approved: formData.get("growth_offer_approved") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("network_id", current!.network_id);
  revalidatePath("/admin", "layout");
  redirect(back("/admin/settings", error ? "Could not save settings." : "Settings saved.", !error));
}
