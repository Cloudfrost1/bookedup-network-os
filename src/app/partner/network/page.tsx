import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/shell";
import { Badge, Card, EmptyState } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/modules/network/org";
import { getCatalog } from "@/modules/network/catalog";
import { DirectoryCard, DirectoryFilters, isUuid, type DirectoryRow } from "@/modules/network/directory-card";
import { requestConnection, respondConnection } from "@/modules/referrals/actions";

export const metadata: Metadata = { title: "Find Partners" };

type Conn = { id: string; requester_org: string; addressee_org: string; status: string };

export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ q?: string; service?: string; city?: string }> }) {
  const { org } = await requireOrg("/partner/network");
  const sp = await searchParams;
  const supabase = await createClient();
  const catalog = await getCatalog();
  const [{ data }, { data: conns }] = await Promise.all([
    supabase.rpc("directory_search", {
      p_private: true,
      p_query: sp.q?.trim().slice(0, 80) || null,
      p_category: isUuid(sp.service),
      p_region: isUuid(sp.city),
      p_limit: 60,
    }),
    supabase.from("organization_connections").select("id, requester_org, addressee_org, status"),
  ]);
  const rows = ((data ?? []) as DirectoryRow[]).filter((d) => d.id !== org.id);
  const connections = (conns ?? []) as Conn[];
  const names = new Map(rows.map((r) => [r.id, r.name]));
  const incoming = connections.filter((c) => c.addressee_org === org.id && c.status === "requested");
  const approved = org.status === "approved";
  const canManage = org.role !== "member";

  const connectionWith = (other: string) =>
    connections.find((c) => (c.requester_org === org.id && c.addressee_org === other) || (c.addressee_org === org.id && c.requester_org === other));

  return (
    <>
      <PageHeader title="Find Partners" description="Approved home-service businesses in the BookedUp network." />
      {!approved ? <Card className="text-sm text-muted">Contact details and connections unlock once BookedUp approves your business.</Card> : null}

      {incoming.length ? (
        <Card className="grid gap-3">
          <h2 className="font-semibold">Connection requests</h2>
          {incoming.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-medium">{names.get(c.requester_org) ?? "A business in the network"}</span>
              {canManage ? (
                <form action={respondConnection} className="flex gap-2">
                  <input type="hidden" name="connectionId" value={c.id} />
                  <Button size="sm" name="status" value="accepted">Accept</Button>
                  <Button size="sm" variant="secondary" name="status" value="declined">Decline</Button>
                </form>
              ) : (
                <Badge tone="warning">Waiting for an owner or manager</Badge>
              )}
            </div>
          ))}
        </Card>
      ) : null}

      <DirectoryFilters action="/partner/network" categories={catalog.categories} regions={catalog.regions} values={sp} />

      {!rows.length ? (
        <EmptyState title="No businesses match these filters">Try another service or city.</EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((d) => {
            const c = connectionWith(d.id);
            return (
              <DirectoryCard key={d.id} d={d}>
                {approved ? (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    {c ? (
                      <Badge tone={c.status === "accepted" ? "success" : c.status === "requested" ? "warning" : "neutral"}>
                        {c.status === "accepted" ? "Connected" : c.status === "requested" ? "Request pending" : "Not connected"}
                      </Badge>
                    ) : (
                      <form action={requestConnection}>
                        <input type="hidden" name="from" value={org.id} />
                        <input type="hidden" name="to" value={d.id} />
                        <Button size="sm" variant="secondary">Connect</Button>
                      </form>
                    )}
                    {org.can_refer && d.can_receive ? (
                      <Button asChild size="sm">
                        <Link href={`/partner/referrals/new?provider=${d.id}`}>Refer a project</Link>
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </DirectoryCard>
            );
          })}
        </div>
      )}
    </>
  );
}
