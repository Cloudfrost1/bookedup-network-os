import Link from "next/link";
import { Check } from "lucide-react";
import "@fontsource-variable/manrope";
import "@fontsource/fira-code/700.css";
import "./public.css";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pub flex min-h-dvh flex-col">
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
          <nav className="center" aria-label="Sections">
            <Link href="/#how-it-works" className="link bold">How it works</Link>
            <Link href="/#benefits" className="link bold">Benefits</Link>
            <Link href="/#who-its-for" className="link bold">Who it&apos;s for</Link>
            <Link href="/#faq" className="link bold">FAQ</Link>
          </nav>
          <nav className="links" aria-label="Account">
            <Link href="/login" className="link !inline-block">Sign in</Link>
            <Link href="/signup" className="pub-btn sm">Become a Free Partner →</Link>
          </nav>
        </header>
      </div>
      <main className="flex-1">{children}</main>
      <footer className="pub-footer mt-16">
        <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="grid content-start gap-3">
            <span className="flex items-center gap-2 font-extrabold tracking-wide">
              <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-[var(--accent)] font-mono text-sm text-white">B</span>
              BOOKEDUP NETWORK
            </span>
            <p className="m-0 font-bold">Better connections. Better service. Stronger local businesses.</p>
            <p className="m-0 text-sm text-[rgba(247,244,254,.65)]">A local referral initiative by BookedUp.</p>
          </div>
          <nav className="grid content-start gap-2 text-sm" aria-label="Navigation">
            <span className="pub-flow-label">Navigation</span>
            <Link href="/">Home</Link>
            <Link href="/#how-it-works">How It Works</Link>
            <Link href="/services">Services &amp; Coverage</Link>
            <Link href="/directory">Partner Directory</Link>
            <Link href="/signup">Join the Network</Link>
          </nav>
          <nav className="grid content-start gap-2 text-sm" aria-label="Legal">
            <span className="pub-flow-label">Legal</span>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/terms">Terms of Service</Link>
          </nav>
          <div className="grid content-start gap-2 text-sm">
            <span className="pub-flow-label">Service Area</span>
            <span>Orlando, Florida · Central Florida</span>
          </div>
        </div>
        <div className="border-t border-[rgba(247,244,254,.12)]">
          <p className="wrap m-0 py-5 text-xs text-[rgba(247,244,254,.6)]">© 2026 BookedUp. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
