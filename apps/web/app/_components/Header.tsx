"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import { useSearch } from "./SearchContext";
import ClaimSearchBar from "./BroadListening/ClaimSearchBar";
import TimestampFilter from "./BroadListening/TimestampFilter";
import { ThemeToggle } from "./ThemeToggle";

export interface HeaderProps {
  cta?: React.ReactNode;
  onMenuClick?: () => void;
}

const NAV_TABS = [
  { href: "/", label: "Studio" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/analyses", label: "Analyses" },
] as const;

const Header = ({ cta, onMenuClick }: HeaderProps) => {
  const pathname = usePathname();
  const {
    setSearchQuery,
    timestampFilter,
    setTimestampFilter,
    showSearchControls,
    hasTimestampData,
  } = useSearch();

  const searchControls = showSearchControls ? (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
      {hasTimestampData && (
        <TimestampFilter
          currentFilter={timestampFilter}
          onFilterChange={setTimestampFilter}
          className="flex-shrink-0"
        />
      )}
      <ClaimSearchBar
        onSearch={setSearchQuery}
        placeholder="Search claims and quotes…"
        className="flex-shrink-0"
      />
    </div>
  ) : (
    cta
  );

  return (
    <header className="sticky top-0 z-50 bg-[var(--paper)]/95 backdrop-blur-sm border-b border-[var(--hairline)]">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex items-center justify-between h-16">
          {/* Left: editorial wordmark */}
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-serif text-xl md:text-2xl tracking-tight text-[var(--ink)] leading-none"
            >
              Broad{" "}
              <span className="italic text-[var(--brand)]">Listening</span>
            </Link>
            <span className="hidden md:inline-block w-px h-5 bg-[var(--hairline)]" />
            <div className="hidden md:flex items-center gap-5">
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

          {/* Right — Desktop */}
          <div className="hidden lg:flex items-center gap-4">
            {searchControls}
            <div className="w-px h-4 bg-[var(--hairline)]" />
            <ThemeToggle />
          </div>

          {/* Right — Mobile */}
          {onMenuClick && (
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={onMenuClick}
                aria-label="Menu"
                className="p-2 text-[var(--muted-ink)] hover:text-[var(--ink)] cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 9h16.5m-16.5 6.75h16.5" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Header;
