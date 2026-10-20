"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand";
import { cn } from "@/lib/utils";

type LinkItem = { href: string; label: string; icon: React.ReactNode };

function isActive(path: string, href: string) {
  return href === "/app" || href === "/admin" ? path === href : path === href || path.startsWith(href + "/");
}

export function NavLinks({ links, onNavigate }: { links: LinkItem[]; onNavigate?: () => void }) {
  const path = usePathname();
  return (
    <nav className="grid flex-1 content-start gap-0.5 overflow-y-auto px-3" aria-label="Sections">
      {links.map((l) => {
        const active = isActive(path, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm",
              active ? "bg-primary-soft font-medium text-primary-deep" : "text-ink-soft hover:bg-subtle",
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
    <div className="lg:hidden">
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4">
        <Logo href={homeHref} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid size-10 place-items-center rounded-lg hover:bg-subtle"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Menu aria-hidden className="size-5" />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={title}>
          <button className="absolute inset-0 bg-ink/40" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[min(85vw,300px)] flex-col bg-background shadow-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm font-medium">{title}</span>
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
