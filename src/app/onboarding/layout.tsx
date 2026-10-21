import Link from "next/link";
import { Check, LogOut } from "lucide-react";
import { signOut } from "@/modules/auth/actions";
import "@fontsource-variable/manrope";
import "@fontsource/fira-code/700.css";
import "../(public)/public.css";

/** First-run onboarding (after sign up) — same look as the homepage and auth pages. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
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
          <form action={signOut} className="links">
            <button className="link pub-signout !inline-flex items-center gap-1.5">
              <LogOut aria-hidden className="size-4" /> Sign out
            </button>
          </form>
        </header>
      </div>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-10 pb-16">{children}</main>
    </div>
  );
}
