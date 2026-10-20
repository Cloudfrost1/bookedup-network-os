import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OrgAccess = {
  id: string;
  name: string;
  status: "pending_review" | "approved" | "suspended" | "rejected";
  role: "owner" | "manager" | "member";
  can_refer: boolean;
  can_receive: boolean;
  requested: ("refer" | "receive")[];
};

export type Access = {
  userId: string;
  email: string;
  fullName: string;
  platformRole: "super_admin" | "admin" | null;
  organizations: OrgAccess[];
};

/** One validated lookup per request: user from Supabase Auth + memberships from the database. */
export const getAccess = cache(async (): Promise<Access | null> => {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const [{ data: access, error }, { data: profile }] = await Promise.all([
    supabase.rpc("my_access"),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  if (error) throw new Error("Could not load your access. Please try again.");

  const a = (access ?? {}) as { platform_role: Access["platformRole"]; organizations: OrgAccess[] };
  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? "",
    platformRole: a.platform_role ?? null,
    organizations: a.organizations ?? [],
  };
});

export async function requireUser(next = "/app") {
  const access = await getAccess();
  if (!access) redirect(`/login?next=${encodeURIComponent(next)}`);
  return access;
}

export async function requireAdmin() {
  const access = await requireUser("/admin");
  if (!access.platformRole) redirect("/app");
  return access;
}

export function firstName(fullName: string, email: string) {
  return fullName.trim().split(/\s+/)[0] || email.split("@")[0];
}
