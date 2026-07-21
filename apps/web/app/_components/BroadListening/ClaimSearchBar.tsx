"use client";

import { Search, X } from "lucide-react";
import { useState, useEffect } from "react";

interface ClaimSearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

const ClaimSearchBar = ({ 
  onSearch, 
  placeholder = "Search claims...", 
  className = "" 
}: ClaimSearchBarProps) => {
  const [query, setQuery] = useState("");

  useEffect(() => {
    // Debounce the search to avoid too many calls
    const timeoutId = setTimeout(() => {
      onSearch(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, onSearch]);

  const handleClear = () => {
    setQuery("");
  };

  return (
    <div className={`relative max-w-md ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--faint-ink)] size-3.5" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full h-9 pl-9 pr-9 bg-transparent border border-[var(--hairline)] text-[13px] text-[var(--ink)] placeholder:text-[var(--faint-ink)] focus:outline-none focus:border-[var(--brand)] transition-colors"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--muted-ink)] hover:text-[var(--brand)] transition-colors"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ClaimSearchBar;