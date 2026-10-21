import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { respondConnection } from "@/modules/referrals/actions";

/** Incoming connection requests for a business. Accepting one shares phone and e-mail between the two businesses. */
export async function ConnectionRequests({ orgId, canManage }: { orgId: string; canManage: boolean }) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("organization_connections")
    .select("id, requester_org")
    .eq("addressee_org", orgId)
    .eq("status", "requested");
  if (!rows?.length) return null;
  const { data: dir } = await supabase.rpc("directory_search", { p_private: true, p_limit: 100 });
  const names = new Map(((dir ?? []) as { id: string; name: string; primary_category: string | null; city: string | null }[]).map((d) => [d.id, d]));
  return (
    <Card className="grid gap-3">
      <div className="grid gap-0.5">
        <h2 className="font-semibold">Connection requests</h2>
        <p className="m-0 text-sm text-muted">Accepting shares your phone and e-mail with that business, and theirs with you.</p>
      </div>
      {rows.map((c) => {
        const o = names.get(c.requester_org as string);
        return (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
            <span className="grid">
              <span className="font-medium">{o?.name ?? "A business in the network"}</span>
              {o ? <span className="text-xs text-muted">{[o.primary_category, o.city].filter(Boolean).join(" · ")}</span> : null}
            </span>
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
        );
      })}
    </Card>
  );
}
