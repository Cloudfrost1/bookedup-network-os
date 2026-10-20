import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, EmptyState } from "@/components/ui/card";
import { Table, Td } from "@/components/ui/inputs";
import { createClient } from "@/lib/supabase/server";
import { date, toneFor } from "@/modules/format";

export const metadata: Metadata = { title: "Relationships" };

type Row = { org_a: string; org_b: string; status: string; connected_at: string; referrals_exchanged: number; last_activity: string | null };

export default async function RelationshipsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_relationships");
  const rows = (data ?? []) as Row[];
  return (
    <>
      <PageHeader title="Relationships" description="Connections between businesses and the referrals exchanged between them." />
      {!rows.length ? (
        <EmptyState title="No connections yet">Businesses connect from Find Partners.</EmptyState>
      ) : (
        <Table head={["Business", "Business", "Status", "Since", "Referrals exchanged", "Last activity"]}>
          {rows.map((r, i) => (
            <tr key={i}>
              <Td className="font-medium">{r.org_a}</Td>
              <Td className="font-medium">{r.org_b}</Td>
              <Td>
                <Badge tone={toneFor(r.status === "accepted" ? "active" : r.status)}>{r.status}</Badge>
              </Td>
              <Td className="text-muted">{date(r.connected_at)}</Td>
              <Td className="tabular-nums">{r.referrals_exchanged}</Td>
              <Td className="text-muted">{date(r.last_activity)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
