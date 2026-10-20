import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { homeFor } from "@/modules/auth/environments";

/** Sends each account to its own environment: Admin, Partner (anchor) or Provider. */
export default async function AppRouter({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const access = await requireUser("/app");
  const sp = await searchParams;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const home = homeFor(access);
  redirect(qs && home !== "/admin" ? `${home}?${qs}` : home);
}
