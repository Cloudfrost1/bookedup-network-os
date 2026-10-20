import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Table, Td } from "@/components/ui/inputs";

export const metadata: Metadata = {
  title: "Services and coverage",
  description: "Which home services the BookedUp network covers in each city.",
};

type Row = { region_id: string; city: string; category_id: string; service: string; providers: number };

export default async function ServicesPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("services_coverage", {});
  const rows = (data ?? []) as Row[];
  const cities = [...new Set(rows.map((r) => r.city))];
  const services = [...new Set(rows.map((r) => r.service))];
  const n = (city: string, service: string) => rows.find((r) => r.city === city && r.service === service)?.providers ?? 0;

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12">
      <div className="grid gap-2">
        <h1 className="text-3xl font-semibold sm:text-4xl">Services and coverage</h1>
        <p className="text-muted">Number of approved providers in the network for each service and city. Updated live.</p>
      </div>
      <Table head={["Service", ...cities]}>
        {services.map((s) => (
          <tr key={s}>
            <Td className="font-medium">{s}</Td>
            {cities.map((c) => {
              const v = n(c, s);
              return (
                <Td key={c} className={v ? "tabular-nums font-medium text-primary" : "tabular-nums text-muted"}>
                  {v || "—"}
                </Td>
              );
            })}
          </tr>
        ))}
      </Table>
    </div>
  );
}
