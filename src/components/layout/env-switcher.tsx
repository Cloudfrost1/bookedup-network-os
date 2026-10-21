import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Environment } from "@/modules/auth/environments";

const labels: Record<Environment, { label: string; href: string }> = {
  partner: { label: "Partner", href: "/partner" },
  provider: { label: "Provider", href: "/provider" },
  admin: { label: "Admin", href: "/admin" },
};

/** Switch between the environments this account can use. Hidden when there is only one. */
export function EnvSwitcher({ current, available }: { current: Environment; available: Environment[] }) {
  if (available.length < 2) return null;
  return (
    <nav aria-label="Environment" className="grid gap-1">
      <span className="px-1 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-muted">Switch view</span>
      <div className="flex gap-1 rounded-full border-2 border-line bg-subtle p-1">
        {available.map((e) => (
          <Link
            key={e}
            href={labels[e].href}
            aria-current={e === current ? "page" : undefined}
            className={cn(
              "flex-1 rounded-full px-2 py-1.5 text-center text-xs font-bold",
              e === current ? "bg-primary text-white" : "text-ink-soft hover:text-foreground",
            )}
          >
            {labels[e].label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
