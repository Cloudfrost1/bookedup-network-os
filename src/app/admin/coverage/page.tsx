import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge } from "@/components/ui/card";
import { Table, Td } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Regional Coverage" };

type Row = { city: string; service: string; partners: number; productive_partners: number; providers: number; qualified_90d: number; unmatched: number };

export default async function CoveragePage({ searchParams }: { searchParams: Promise<{ gaps?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_regional_coverage");
  let rows = (data ?? []) as Row[];
  if (sp.gaps) rows = rows.filter((r) => r.providers === 0 || r.unmatched > 0);
  else rows = rows.filter((r) => r.partners || r.providers || r.qualified_90d || r.unmatched);

  return (
    <>
      <PageHeader
        title="Regional Coverage"
        description="Where the network has partners, providers and demand — and where the gaps are."
        action={
          <a href={sp.gaps ? "/admin/coverage" : "/admin/coverage?gaps=1"} className="text-sm font-medium text-primary hover:underline">
            {sp.gaps ? "Show active combinations" : "Show gaps only"}
          </a>
        }
      />
      {!rows.length ? (
        <p className="text-sm text-muted">No activity yet. Approved businesses with services and cities will appear here.</p>
      ) : (
        <Table head={["City", "Service", "Partners", "Productive partners", "Providers", "Qualified (90d)", "Waiting", "Situation"]}>
          {rows.map((r) => (
            <tr key={r.city + r.service}>
              <Td className="font-medium">{r.city}</Td>
              <Td>{r.service}</Td>
              <Td className="tabular-nums">{r.partners}</Td>
              <Td className="tabular-nums">{r.productive_partners}</Td>
              <Td className="tabular-nums">{r.providers}</Td>
              <Td className="tabular-nums">{r.qualified_90d}</Td>
              <Td className="tabular-nums">{r.unmatched}</Td>
              <Td>
                {r.providers === 0 && (r.qualified_90d > 0 || r.unmatched > 0) ? (
                  <Badge tone="danger">Demand without provider</Badge>
                ) : r.providers === 0 ? (
                  <Badge tone="warning">No provider</Badge>
                ) : r.partners === 0 ? (
                  <Badge>No partners</Badge>
                ) : (
                  <Badge tone="success">Covered</Badge>
                )}
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
