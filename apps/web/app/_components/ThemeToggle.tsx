"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useTheme } from "next-themes";
import { AnimatePresence, motion } from "framer-motion";

/**
 * ThemeToggle — circular view-transition reveal ported from
 * gainforest/bumicerts-monorepo (apps/bumicerts/components/ui/theme-toggle.tsx).
 *
 * On click we wrap the next-themes `setTheme` call in
 * `document.startViewTransition(...)`. The View Transitions API captures
 * a snapshot of the current root and the next root; we then animate a
 * `clip-path: circle()` on `::view-transition-new(root)` from the click
 * origin so the new theme "wipes in" radially from where the user
 * tapped. The companion CSS in `globals.css` sets up z-index ordering
 * and the initial collapsed clip-path.
 *
 * Falls back to an instant `setTheme` when the browser lacks the API
 * (Safari < 18, old Firefox) OR the user prefers reduced motion.
 *
 * Icons stay as the existing inline SVGs (no need to add Lucide here)
 * but the icon swap itself is wrapped in framer-motion's
 * `AnimatePresence` for a subtle rotate+scale crossfade, matching the
 * bumicerts feel.
 */

const RIPPLE_DURATION_MS = 1200;

type ThemeName = "dark" | "light";

function getRippleGeometry(originX: number, originY: number) {
  // Radius needed to cover the whole viewport from the click origin.
  const farthestX = Math.max(originX, window.innerWidth - originX);
  const farthestY = Math.max(originY, window.innerHeight - originY);
  const radius = Math.ceil(Math.hypot(farthestX, farthestY));
  return { originX, originY, radius };
}

function getEventOrigin(event: MouseEvent<HTMLButtonElement>) {
  // Real mouse click → use clientX/clientY. Keyboard / synthetic
  // activations have detail === 0 — fall back to the button's centre.
  if (event.detail > 0) {
    return { originX: event.clientX, originY: event.clientY };
  }
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    originX: rect.left + rect.width / 2,
    originY: rect.top + rect.height / 2,
  };
}

function shouldReduceMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function runThemeTransition(
  origin: { originX: number; originY: number },
  updateTheme: () => void,
) {
  // Bail out cleanly when the API is unsupported or the user opts out.
  if (
    shouldReduceMotion() ||
    typeof document.startViewTransition !== "function"
  ) {
    updateTheme();
    return;
  }

  const { originX, originY, radius } = getRippleGeometry(
    origin.originX,
    origin.originY,
  );

  document.documentElement.style.setProperty("--theme-ripple-x", `${originX}px`);
  document.documentElement.style.setProperty("--theme-ripple-y", `${originY}px`);

  const transition = document.startViewTransition(updateTheme);

  transition.ready.then(() => {
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${originX}px ${originY}px)`,
          `circle(0px at ${originX}px ${originY}px)`,
          `circle(${radius}px at ${originX}px ${originY}px)`,
        ],
        offset: [0, 0.06, 1],
      },
      {
        duration: RIPPLE_DURATION_MS,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards",
        pseudoElement: "::view-transition-new(root)",
      },
    );
  });
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: render a same-sized placeholder until the
  // theme is resolved on the client.
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return <div className="w-9 h-9" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  function handleToggleTheme(event: MouseEvent<HTMLButtonElement>) {
    const targetTheme: ThemeName = isDark ? "light" : "dark";
    runThemeTransition(getEventOrigin(event), () => setTheme(targetTheme));
  }

  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={handleToggleTheme}
      className="p-2 w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      suppressHydrationWarning
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.span
            key="moon"
            initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="inline-flex"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
              />
            </svg>
          </motion.span>
        ) : (
          <motion.span
            key="sun"
            initial={{ opacity: 0, rotate: 90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: -90, scale: 0.5 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="inline-flex"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
              />
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
