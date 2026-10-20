"use server";

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
