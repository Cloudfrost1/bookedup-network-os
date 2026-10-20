import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser } from "@/modules/auth/session";
import { getCatalog } from "@/modules/network/catalog";
import { NewBusinessForm } from "./new-business-form";

export const metadata: Metadata = { title: "Add your business" };

export default async function NewBusinessPage() {
  const access = await requireUser("/onboarding");
  if (access.organizations.length) redirect("/app");
  const { categories, regions } = await getCatalog();
  return <NewBusinessForm categories={categories} regions={regions} />;
}
