import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { createClient } from "@/lib/supabase/server";
import { requireCapability } from "@/modules/network/org";
import { getCatalog } from "@/modules/network/catalog";
import { ReferralForm } from "./referral-form";

export const metadata: Metadata = { title: "Send Referral" };

export default async function NewReferralPage({ searchParams }: { searchParams: Promise<{ provider?: string }> }) {
  const { org } = await requireCapability("refer", "/partner/referrals/new");
  const { provider } = await searchParams;
  const { categories } = await getCatalog();
  let providerName: string | null = null;
  if (provider && /^[0-9a-f-]{36}$/.test(provider)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("directory_search", { p_private: true, p_limit: 100 });
    providerName = (data as { id: string; name: string }[] | null)?.find((d) => d.id === provider)?.name ?? null;
  }
  return (
    <>
      <PageHeader
        title="Send Referral"
        description="Share a project you don't do. BookedUp confirms the homeowner's authorization, qualifies the request and sends it to a provider."
      />
      <ReferralForm orgId={org.id} categories={categories} provider={providerName ? { id: provider!, name: providerName } : null} />
    </>
  );
}
