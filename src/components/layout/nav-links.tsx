"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/utils";

type LinkItem = { href: string; label: string; icon: React.ReactNode };

function matches(path: string, href: string) {
  return ["/partner", "/provider", "/admin"].includes(href) ? path === href : path === href || path.startsWith(href + "/");
}

/** Only one item is active: the most specific match (e.g. /partner/referrals/new → "Send Referral", not also "My Referrals"). */
function activeHref(path: string, links: LinkItem[]) {
  return links
    .filter((l) => matches(path, l.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function NavLinks({ links, onNavigate }: { links: LinkItem[]; onNavigate?: () => void }) {
  const path = usePathname();
  const current = activeHref(path, links);
  return (
    <nav className="grid flex-1 content-start gap-1 overflow-y-auto px-3 py-1" aria-label="Sections">
      {links.map((l) => {
        const active = l.href === current;
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-full border-2 px-3 py-2 text-sm font-semibold transition-colors",
              active
                ? "border-[#17120d] bg-primary text-white shadow-[2px_3px_0_#000]"
                : "border-transparent text-ink-soft hover:bg-subtle hover:text-foreground",
            )}
          >
            {l.icon}
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({
  links,
  title,
  homeHref,
  footer,
  context,
}: {
  links: LinkItem[];
  title: string;
  homeHref: string;
  footer: React.ReactNode;
  context?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden" data-theme="dark">
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b-2 border-[#17120d] bg-[#1b1815] px-4 text-foreground">
        <Logo href={homeHref} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid size-10 place-items-center rounded-full hover:bg-subtle"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Menu aria-hidden className="size-5" />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
          <button className="absolute inset-0 bg-black/50" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(85vw,300px)] flex-col border-r-2 border-[#17120d] bg-[#1b1815] text-foreground shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[1.5px] text-[#a78bfa]">{title}</span>
              <button className="grid size-10 place-items-center rounded-lg hover:bg-subtle" aria-label="Close menu" onClick={() => setOpen(false)}>
                <X aria-hidden className="size-5" />
              </button>
            </div>
            {context ? <div className="px-3 pb-3">{context}</div> : null}
            <NavLinks links={links} onNavigate={() => setOpen(false)} />
            {footer}
          </div>
        </div>
      ) : null}
    </div>
  );
}
