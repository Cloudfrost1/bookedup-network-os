import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand";
import { signOut } from "@/modules/auth/actions";
import type { NavItem } from "@/modules/navigation";
import { NavLinks, MobileNav } from "./nav-links";

type Props = {
  items: NavItem[];
  homeHref: string;
  title: string;
  userLabel: string;
  context?: React.ReactNode;
  children: React.ReactNode;
};

/** Shared shell for the business app and the admin: white sidebar on desktop, top bar + drawer on mobile. */
export function Shell({ items, homeHref, title, userLabel, context, children }: Props) {
  const links = items.map(({ href, label, icon: Icon }) => ({ href, label, icon: <Icon aria-hidden className="size-4" /> }));
  const footer = (
    <div className="grid gap-2 border-t border-border p-3">
      <p className="truncate px-2 text-xs text-muted" title={userLabel}>
        {userLabel}
      </p>
      <form action={signOut}>
        <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-ink-soft hover:bg-subtle">
          <LogOut aria-hidden className="size-4" /> Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh bg-surface lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border bg-background lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="grid gap-1 px-5 py-5">
          <Logo href={homeHref} />
          <span className="text-xs text-muted">{title}</span>
        </div>
        {context ? <div className="px-3 pb-3">{context}</div> : null}
        <NavLinks links={links} />
        {footer}
      </aside>

      <MobileNav links={links} title={title} homeHref={homeHref} footer={footer} context={context} />

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto grid max-w-5xl gap-6">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
