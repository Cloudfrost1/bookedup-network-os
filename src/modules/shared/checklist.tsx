import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";

export function Checklist({ items, children }: { items: { done: boolean; label: string }[]; children?: React.ReactNode }) {
  return (
    <Card className="grid gap-3 p-4">
      {items.map((s) => (
        <div key={s.label} className="flex items-center gap-3 text-sm">
          {s.done ? <CheckCircle2 aria-hidden className="size-5 shrink-0 text-primary" /> : <Circle aria-hidden className="size-5 shrink-0 text-muted" />}
          <span className={s.done ? "text-muted line-through" : ""}>{s.label}</span>
        </div>
      ))}
      {children}
    </Card>
  );
}

export function ReviewNotice({ status }: { status: string }) {
  if (status === "approved") return null;
  if (status === "pending_review")
    return (
      <Card className="border-warning/30 bg-warning/5 text-sm">
        <p className="font-medium">Your business is under review</p>
        <p className="text-muted">BookedUp reviews every business before it can send or receive projects. Complete your profile meanwhile.</p>
      </Card>
    );
  return <Card className="border-danger/30 bg-danger/5 text-sm">This business can&apos;t use the network right now. Contact BookedUp through Support.</Card>;
}
