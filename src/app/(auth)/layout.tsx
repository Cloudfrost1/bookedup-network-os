import { Logo } from "@/components/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-surface px-4 py-10 sm:place-items-center">
      <div className="mx-auto grid w-full max-w-md gap-8">
        <Logo className="justify-self-center text-lg" />
        <main className="rounded-2xl border border-border bg-background p-6 shadow-sm sm:p-8">{children}</main>
        <p className="text-center text-xs text-muted">BookedUp Orlando · Orlando–Kissimmee–Sanford, Florida</p>
      </div>
    </div>
  );
}
