import Link from "next/link";
import { Rocket } from "lucide-react";
import { Badge, Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { createClient } from "@/lib/supabase/server";
import { adjustGrowthCount, createGrowthContract, setGrowthTarget } from "@/modules/admin/actions";
import { dateTime } from "@/modules/format";
import { GrowthCounter, HEALTH, type GrowthProgress } from "./progress";

type Adjustment = { id: string; delta: number; reason: string; created_at: string };

/** Admin: activate BookedUp Growth for a provider, or run its counter (target + manual adjustments). */
export async function GrowthAdminControls({ orgId, returnTo, showLink = true }: { orgId: string; returnTo: string; showLink?: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("growth_contract_progress")
    .select("*")
    .eq("provider_org_id", orgId)
    .in("status", ["active", "continuation_required"])
    .maybeSingle();
  const p = data as GrowthProgress | null;
  const today = new Date().toISOString().slice(0, 10);

  if (!p) {
    return (
      <Card className="grid gap-3 text-sm">
        <h2 className="flex items-center gap-2 text-base">
          <Rocket aria-hidden className="size-4 text-primary" /> BookedUp Growth
        </h2>
        <p className="m-0 text-muted">
          Activate after the Growth contract is signed. The provider starts receiving projects through the program and sees a counter on the
          dashboard.
        </p>
        <form action={createGrowthContract} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="providerId" value={orgId} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <Field id={`g-start-${orgId}`} label="Start date">
            <Input id={`g-start-${orgId}`} name="start" type="date" defaultValue={today} required />
          </Field>
          <Field id={`g-target-${orgId}`} label="Target (qualified requests)">
            <Input id={`g-target-${orgId}`} name="target" type="number" min={1} max={500} step={1} defaultValue={24} required className="w-40" />
          </Field>
          <Button>
            <Rocket aria-hidden /> Activate BookedUp Growth
          </Button>
        </form>
        <p className="m-0 text-xs text-muted">90-day window from the start date. One running program per provider.</p>
      </Card>
    );
  }

  const { data: adj } = await supabase
    .from("growth_adjustments")
    .select("id, delta, reason, created_at")
    .eq("contract_id", p.contract_id)
    .order("created_at", { ascending: false })
    .limit(10);
  const adjustments = (adj ?? []) as Adjustment[];
  const h = HEALTH[p.health] ?? HEALTH.on_track;
  const manual = p.manual_adjustment ?? 0;

  return (
    <Card className="grid gap-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base">
          <Rocket aria-hidden className="size-4 text-primary" /> BookedUp Growth · {p.status === "active" ? "Active" : "Extended"}
        </h2>
        <span className="flex items-center gap-2">
          <Badge tone={h.tone}>{h.label}</Badge>
          {showLink ? (
            <Link href={`/admin/growth/${p.contract_id}`} className="font-semibold text-primary hover:underline">
              Open contract
            </Link>
          ) : null}
        </span>
      </div>
      <GrowthCounter p={p} />
      <p className="m-0 text-xs text-muted">
        Automatic: every qualified request sent to this provider counts. Manual adjustments: {manual > 0 ? `+${manual}` : manual}.
      </p>
      <div className="grid gap-4 border-t-2 border-dashed border-border pt-4 md:grid-cols-2">
        <form action={setGrowthTarget} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="contractId" value={p.contract_id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <Field id={`t-${p.contract_id}`} label="Target">
            <Input id={`t-${p.contract_id}`} name="target" type="number" min={1} max={500} step={1} defaultValue={p.target} required className="w-28" />
          </Field>
          <Button size="sm" variant="secondary">
            Update target
          </Button>
        </form>
        <form action={adjustGrowthCount} className="grid gap-2">
          <input type="hidden" name="contractId" value={p.contract_id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="flex flex-wrap items-end gap-2">
            <Field id={`d-${p.contract_id}`} label="Adjust count (+/-)">
              <Input id={`d-${p.contract_id}`} name="delta" type="number" min={-100} max={100} step={1} defaultValue={1} required className="w-24" />
            </Field>
            <Field id={`r-${p.contract_id}`} label="Reason">
              <Input id={`r-${p.contract_id}`} name="reason" required minLength={3} maxLength={500} placeholder="e.g. request delivered by phone" />
            </Field>
            <Button size="sm" variant="secondary">
              Apply
            </Button>
          </div>
        </form>
      </div>
      {adjustments.length ? (
        <ul className="grid gap-1 p-0 text-xs">
          {adjustments.map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-1 last:border-0">
              <span>
                <span className={`font-bold ${a.delta > 0 ? "text-success" : "text-danger"}`}>{a.delta > 0 ? `+${a.delta}` : a.delta}</span> · {a.reason}
              </span>
              <span className="text-muted">{dateTime(a.created_at)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
