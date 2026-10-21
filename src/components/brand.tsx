import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 font-extrabold tracking-tight", className)}>
      <span aria-hidden className="grid size-8 place-items-center rounded-lg border-2 border-[#17120d] bg-[#7c3aed] text-white shadow-[2px_2px_0_#17120d]">
        <Check className="size-4" strokeWidth={3} />
      </span>
      <span>
        BookedUp<span className="text-primary"> Network</span>
      </span>
    </Link>
  );
}
