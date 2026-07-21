"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { ThemeToggle } from "./ThemeToggle";

export interface HeaderProps {
  cta?: React.ReactNode;
}

const NAV_TABS = [
  { href: "/", label: "Studio" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/analyses", label: "Analyses" },
] as const;

const Header = ({ cta }: HeaderProps) => {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-[var(--paper)]/95 backdrop-blur-sm border-b border-[var(--hairline)]">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex items-center justify-between h-16">
          {/* Left: editorial wordmark + tabs */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-serif text-xl md:text-2xl tracking-tight text-[var(--ink)] leading-none"
            >
              Broad{" "}
              <span className="italic text-[var(--brand)]">Listening</span>
            </Link>
            <span className="hidden md:inline-block w-px h-5 bg-[var(--hairline)]" />
            <div className="flex items-center gap-4 md:gap-5">
              {NAV_TABS.map((tab) => {
                const active =
                  tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`text-[11px] tracking-[0.2em] uppercase transition-colors ${
                      active
                        ? "text-[var(--brand)]"
                        : "text-[var(--muted-ink)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-4">
            {cta}
            <ThemeToggle />
          </div>
        </div>
      </nav>
    </header>
  );
};

export default Header;
