import { Logo } from "@/components/brand";
import { signOut } from "@/modules/auth/actions";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Logo href="/" />
          <form action={signOut}>
            <button className="text-sm text-muted hover:text-foreground">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
