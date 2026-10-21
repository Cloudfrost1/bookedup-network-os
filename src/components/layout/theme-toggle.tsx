"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function apply(theme: Theme) {
  document.querySelectorAll<HTMLElement>("[data-theme-root]").forEach((el) => el.setAttribute("data-theme", theme));
  document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent("bookedup-theme", { detail: theme }));
}

/** Switches the platform between light and dark. Saved in a cookie so the server renders the right theme next time. */
export function ThemeToggle({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);

  // Keep every toggle (sidebar and mobile menu) in sync.
  useEffect(() => {
    const current = document.querySelector<HTMLElement>("[data-theme-root]")?.getAttribute("data-theme");
    if (current === "dark" || current === "light") setTheme(current);
    const onChange = (e: Event) => setTheme((e as CustomEvent<Theme>).detail);
    window.addEventListener("bookedup-theme", onChange);
    return () => window.removeEventListener("bookedup-theme", onChange);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => apply(next)}
      className="flex w-full items-center gap-3 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-subtle"
      aria-label={`Switch to ${next} mode`}
    >
      {theme === "dark" ? <Sun aria-hidden className="size-4" /> : <Moon aria-hidden className="size-4" />}
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
