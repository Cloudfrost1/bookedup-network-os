import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand";
import { createClient } from "@/lib/supabase/server";
import { getCatalog } from "@/modules/network/catalog";
import { HomeownerForm } from "./homeowner-form";

export const metadata: Metadata = { title: "Request a local professional", robots: { index: false } };

type Info = { name: string; consent_version: string; consent_text: string };

export default async function ReferralLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[a-z0-9]{6,16}$/.test(code)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("referral_link_info", { p_code: code });
  const info = data as Info | null;
  if (!info) notFound();
  const { categories } = await getCatalog();

  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-4">
          <Logo href="/" />
        </div>
      </header>
      <main className="mx-auto grid max-w-2xl gap-6 px-4 py-10">
        <div className="grid gap-2">
          <p className="text-sm font-medium text-primary">Recommended by {info.name}</p>
          <h1 className="text-3xl font-semibold">Tell us about your project</h1>
          <p className="text-muted">
            BookedUp reviews your request and connects you with one approved local professional. Free, no obligation.
          </p>
        </div>
        <HomeownerForm code={code} consentVersion={info.consent_version} consentText={info.consent_text} categories={categories} />
      </main>
    </div>
  );
}
