import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span aria-hidden className="grid size-7 place-items-center rounded-md bg-primary text-sm font-bold text-white">
        B
      </span>
      <span>
        BookedUp<span className="text-primary"> Network</span>
      </span>
    </Link>
  );
}
