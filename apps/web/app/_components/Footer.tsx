import Link from "next/link";
import React from "react";

const Footer = () => {
  return (
    <footer className="border-t border-[var(--hairline)] px-6 lg:px-12 py-10 bg-[var(--paper)]">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div>
          <Link
            href="/"
            className="font-serif text-xl text-[var(--ink)] leading-none"
          >
            Broad <span className="italic text-[var(--brand)]">Listening</span>
          </Link>
          <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--muted-ink)] mt-3">
            Democratic AI for sensemaking
          </p>
        </div>
        <div className="md:col-start-2">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--faint-ink)] mb-2">
            Curated by
          </p>
          <a
            href="https://gainforest.earth"
            target="_blank"
            rel="noopener noreferrer"
            className="font-serif text-base text-[var(--ink)] hover:text-[var(--brand)] transition-colors"
          >
            GainForest
          </a>
        </div>
        <div className="md:text-right">
          <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--faint-ink)] mb-2">
            Get in touch
          </p>
          <a
            href="mailto:team@gainforest.earth"
            className="font-serif text-base text-[var(--ink)] hover:text-[var(--brand)] transition-colors"
          >
            team@gainforest.earth
          </a>
          <p className="text-xs text-[var(--muted-ink)] mt-3">
            © {new Date().getFullYear()} Broad Listening Collective
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
