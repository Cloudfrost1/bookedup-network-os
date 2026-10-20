import { FormMessage } from "@/components/ui/form";

export function Flash({ sp }: { sp: { ok?: string; error?: string } }) {
  if (sp.error) return <FormMessage>{sp.error}</FormMessage>;
  if (sp.ok) return <FormMessage tone="success">{sp.ok}</FormMessage>;
  return null;
}
