import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full min-w-0 rounded-lg border border-border bg-background px-3 text-base text-foreground sm:text-sm focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(base, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "py-2", className)} {...props} />;
}

export function Checkbox({ label, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: React.ReactNode }) {
  return (
    <label className={cn("flex items-start gap-2 text-sm", className)}>
      <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" {...props} />
      <span>{label}</span>
    </label>
  );
}

/** Horizontally scrollable table wrapper so wide tables never break the page on phones. */
export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3 align-top", className)} {...props} />;
}
