import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCatalog } from "@/modules/network/catalog";
import { DirectoryCard, DirectoryFilters, isUuid, type DirectoryRow } from "@/modules/network/directory-card";

export const metadata: Metadata = {
  title: "Business Directory",
  description: "Approved home-service businesses in the BookedUp network in the Orlando area.",
};

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string; service?: string; city?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const catalog = await getCatalog();
  const { data } = await supabase.rpc("directory_search", {
    p_query: sp.q?.trim().slice(0, 80) || null,
    p_category: isUuid(sp.service),
    p_region: isUuid(sp.city),
    p_limit: 60,
  });
  const rows = (data ?? []) as DirectoryRow[];
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold sm:text-4xl">Business Directory</h1>
        <p className="text-muted">Home-service businesses approved by BookedUp in Orlando, Kissimmee, Sanford and nearby cities.</p>
      </div>
      <DirectoryFilters action="/directory" categories={catalog.categories} regions={catalog.regions} values={sp} />
      {!rows.length ? (
        <EmptyState title="No businesses listed yet" action={<Link href="/signup" className="text-sm font-medium text-primary hover:underline">Join the network</Link>}>
          The directory only shows businesses BookedUp has approved.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => (
            <DirectoryCard key={d.id} d={d} href={`/directory/${d.slug}`} />
          ))}
        </div>
      )}
    </div>
  );
}
