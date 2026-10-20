import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Category = { id: string; name: string; slug: string };
export type Region = { id: string; city: string; state: string; slug: string };

export const getCatalog = cache(async () => {
  const supabase = await createClient();
  const [{ data: categories }, { data: regions }] = await Promise.all([
    supabase.from("service_categories").select("id, name, slug").eq("active", true).order("sort"),
    supabase.from("regions").select("id, city, state, slug").eq("active", true).order("sort"),
  ]);
  return { categories: (categories ?? []) as Category[], regions: (regions ?? []) as Region[] };
});
