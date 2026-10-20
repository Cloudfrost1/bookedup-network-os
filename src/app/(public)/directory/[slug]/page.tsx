import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DirectoryCard, type DirectoryRow } from "@/modules/network/directory-card";

async function load(slug: string) {
  if (!/^[a-z0-9-]{3,140}$/.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("directory_profile", { p_slug: slug });
  return data as DirectoryRow | null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await load((await params).slug);
  return { title: d?.name ?? "Business" };
}

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const d = await load((await params).slug);
  if (!d) notFound();
  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-12">
      <Link href="/directory" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Directory
      </Link>
      <h1 className="text-3xl font-semibold">{d.name}</h1>
      <DirectoryCard d={d} />
      {d.description ? <p className="whitespace-pre-line text-muted">{d.description}</p> : null}
    </div>
  );
}
