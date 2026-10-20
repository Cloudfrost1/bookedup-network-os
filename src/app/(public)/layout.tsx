import Link from "next/link";
import "@fontsource-variable/manrope";
import "@fontsource/fira-code/700.css";
import "./public.css";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pub flex min-h-dvh flex-col">
      <div className="px-4">
        <header className="pub-nav" aria-label="Main">
          <Link href="/" className="pub-logo">
            <i aria-hidden>B</i>
            <span>
              BookedUp<em> Network</em>
            </span>
          </Link>
          <nav className="links">
            <Link href="/#how-it-works" className="link">How it works</Link>
            <Link href="/directory" className="link">Directory</Link>
            <Link href="/services" className="link">Services</Link>
            <Link href="/login" className="link !inline-block">Sign in</Link>
            <Link href="/signup" className="pub-btn sm">Join the Network</Link>
          </nav>
        </header>
      </div>
      <main className="flex-1">{children}</main>
      <footer className="pub-footer mt-16">
        <div className="wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="grid content-start gap-3">
            <span className="flex items-center gap-2 font-extrabold tracking-wide">
              <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-[var(--accent)] font-mono text-sm text-white">B</span>
              BOOKEDUP PARTNER CIRCLE
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
