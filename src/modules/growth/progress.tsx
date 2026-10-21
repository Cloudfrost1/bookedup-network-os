import { Badge, Card } from "@/components/ui/card";
import { date } from "@/modules/format";

export type GrowthProgress = {
  contract_id: string;
  start_date: string;
  deadline: string;
  target: number;
  status: string;
  delivered: number;
  remaining: number;
  days_left: number;
  pending_validation: number;
  under_dispute: number;
  replacement_required: number;
  expected_per_month: number;
  current_per_month: number;
  health: string;
  manual_adjustment?: number;
};

/** The two numbers that matter: delivered counts up, remaining counts down, until the target is reached. */
export function GrowthCounter({ p }: { p: GrowthProgress }) {
  const done = p.delivered >= p.target;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="grid gap-1 rounded-2xl border-2 border-line bg-background p-4">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted">Delivered ↑</span>
        <span className="text-5xl font-extrabold tabular-nums text-success">{p.delivered}</span>
        <span className="text-xs text-muted">of {p.target} qualified requests</span>
      </div>
      <div className="grid gap-1 rounded-2xl border-2 border-line bg-background p-4">
        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted">{done ? "Target reached" : "Remaining ↓"}</span>
        <span className={`text-5xl font-extrabold tabular-nums ${done ? "text-success" : "text-primary"}`}>{done ? "✓" : p.remaining}</span>
        <span className="text-xs text-muted">{done ? `${p.delivered} of ${p.target}` : `${p.days_left} days left`}</span>
      </div>
    </div>
  );
}

export const HEALTH: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  on_track: { label: "On track", tone: "success" },
  attention: { label: "Attention", tone: "warning" },
  at_risk: { label: "At risk", tone: "danger" },
  completed: { label: "Completed", tone: "neutral" },
  continuation_required: { label: "Extended", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const VALIDATION: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "purple" }> = {
  pending_validation: { label: "Pending validation", tone: "warning" },
  qualified: { label: "Qualified — counts toward Growth", tone: "success" },
  under_dispute: { label: "Under dispute", tone: "warning" },
  invalidated: { label: "Invalidated", tone: "danger" },
  replacement_required: { label: "Replacement required", tone: "purple" },
};

function Line({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border py-1.5 last:border-0">
      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted">{k}</span>
      <span className="font-extrabold tabular-nums">{v}</span>
    </div>
  );
}

/** The client's contracted program: only validated qualified requests count. */
export function GrowthBlock({ p }: { p: GrowthProgress }) {
  const h = HEALTH[p.health] ?? HEALTH.on_track;
  const pct = Math.min(100, Math.round((p.delivered / p.target) * 100));
  return (
    <Card className="grid gap-4 bg-[#1b1815] text-[#f7f4fe]" data-theme="dark">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[12px] font-bold uppercase tracking-[2px] text-[#a78bfa]">BookedUp Growth</span>
        <Badge tone={h.tone}>{h.label}</Badge>
      </div>
      <GrowthCounter p={p} />
      <div className="grid gap-1">
        <div className="mt-1 h-3 overflow-hidden rounded-full border-2 border-line bg-subtle" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="grid gap-x-8 sm:grid-cols-2">
        <Line k="Contract" v={`90 days · ${date(p.start_date)} – ${date(p.deadline)}`} />
        <Line k="Target" v={`${p.target} qualified requests`} />
        <Line k="Remaining" v={p.remaining} />
        <Line k="Days left" v={p.days_left} />
        <Line k="Expected pace" v={`${p.expected_per_month}/month`} />
        <Line k="Current pace" v={`${p.current_per_month}/month`} />
        <Line k="Pending validation" v={p.pending_validation} />
        <Line k="Under dispute / replacement" v={`${p.under_dispute} / ${p.replacement_required}`} />
      </div>
      <p className="m-0 text-xs text-muted">
        Each qualified request sent to you counts automatically. BookedUp may adjust the count (disputes, replacements) — every adjustment is
        recorded with a reason.
      </p>
    </Card>
  );
}
