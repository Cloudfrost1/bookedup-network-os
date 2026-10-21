import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[20px] border-2 border-line bg-background p-5 shadow-hard", className)} {...props} />;
}

export function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="grid gap-1 p-4">
      <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted">{label}</span>
      <span className="text-3xl font-extrabold tracking-tight tabular-nums">{value}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </Card>
  );
}

const badgeTones = {
  neutral: "border-border bg-subtle text-ink-soft",
  purple: "border-primary/40 bg-primary-soft text-primary-deep",
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-danger/40 bg-danger/10 text-danger",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold", badgeTones[tone], className)}
      {...props}
    />
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="grid justify-items-start gap-2 rounded-[20px] border-2 border-dashed border-line bg-background/70 p-6">
      <p className="font-extrabold">{title}</p>
      {children ? <div className="text-sm text-muted">{children}</div> : null}
      {action}
    </div>
  );
}
