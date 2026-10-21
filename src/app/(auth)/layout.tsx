import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import "@fontsource-variable/manrope";
import "@fontsource/fira-code/700.css";
import "../(public)/public.css";

/** Sign in / sign up / password pages — same look as the public homepage (cream grid, ink borders, hard shadows, purple). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pub pub-auth flex min-h-dvh flex-col">
      <div className="px-4">
        <header className="pub-nav" aria-label="Main">
          <Link href="/" className="pub-nav-brand">
            <span className="mark" aria-hidden>
              <Check className="size-5" strokeWidth={3} />
            </span>
            <span>
              <b>
                BookedUp <span className="text-[var(--accent-glow)]">Network</span>
              </b>
              <small>LOCAL REFERRAL NETWORK</small>
            </span>
          </Link>
          <nav className="links" aria-label="Back">
            <Link href="/" className="link !inline-flex items-center gap-1.5">
              <ArrowLeft aria-hidden className="size-4" /> Home
            </Link>
          </nav>
        </header>
      </div>
      <div className="grid flex-1 items-start justify-items-center px-4 pt-8 pb-12 sm:items-center sm:py-16">
        <div className="grid w-full max-w-md gap-6">
          <main className="pub-auth-card pub-form">{children}</main>
          <p className="m-0 text-center font-mono text-[11px] font-bold tracking-[1.5px] text-[var(--ink-mute)]">
            FREE TO JOIN · NO EXCLUSIVITY · NO QUOTAS
          </p>
        </div>
      </div>
    </div>
  );
}
