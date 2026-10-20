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
            <Link href="/how-it-works" className="link">How it works</Link>
            <Link href="/directory" className="link">Directory</Link>
            <Link href="/services" className="link">Services</Link>
            <Link href="/login" className="link !inline-block">Sign in</Link>
            <Link href="/signup" className="pub-btn sm">Join the Network</Link>
          </nav>
        </header>
      </div>
      <main className="flex-1">{children}</main>
      <footer className="pub-footer mt-16">
        <div className="wrap flex flex-col gap-3 py-10 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} BookedUp · Orlando, Florida</span>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
            <Link href="/directory">Directory</Link>
            <Link href="/services">Services</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
