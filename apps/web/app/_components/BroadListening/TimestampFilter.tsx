"use client";

import { useState, useRef, useEffect } from "react";
import { Clock, ChevronDown, Calendar } from "lucide-react";

export type TimestampFilterType = "all" | "1week" | "1month" | "6months" | "1year" | { start: Date; end: Date };

interface TimestampFilterProps {
  currentFilter: TimestampFilterType;
  onFilterChange: (filter: TimestampFilterType) => void;
  className?: string;
}

const TimestampFilter = ({ 
  currentFilter, 
  onFilterChange, 
  className = "" 
}: TimestampFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filterOptions: { value: "all" | "1week" | "1month" | "6months" | "1year"; label: string }[] = [
    { value: "all", label: "All time" },
    { value: "1week", label: "Last week" },
    { value: "1month", label: "Last month" },
    { value: "6months", label: "Last 6 months" },
    { value: "1year", label: "Last year" }
  ];

  // Get display label for current filter
  const getCurrentLabel = () => {
    if (currentFilter === "all") return "All time";
    if (currentFilter === "1week") return "Last week";
    if (currentFilter === "1month") return "Last month";
    if (currentFilter === "6months") return "Last 6 months";
    if (currentFilter === "1year") return "Last year";
    if (typeof currentFilter === "object" && "start" in currentFilter && "end" in currentFilter) {
      const start = new Date(currentFilter.start);
      const end = new Date(currentFilter.end);
      return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return "All time";
  };

  // Handle quick option selection
  const handleQuickOption = (value: "all" | "1week" | "1month" | "6months" | "1year") => {
    onFilterChange(value);
    setIsOpen(false);
  };

  // Handle custom date range
  const handleCustomRange = () => {
    if (customStart && customEnd) {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999); // End of day
      
      if (start <= end) {
        onFilterChange({ start, end });
        setIsOpen(false);
        setCustomStart("");
        setCustomEnd("");
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Initialize custom dates if current filter is a date range
  useEffect(() => {
    if (typeof currentFilter === "object" && "start" in currentFilter && "end" in currentFilter) {
      const start = new Date(currentFilter.start);
      const end = new Date(currentFilter.end);
      setCustomStart(start.toISOString().split('T')[0]);
      setCustomEnd(end.toISOString().split('T')[0]);
    }
  }, [currentFilter]);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn-editorial"
      >
        <Clock className="size-3.5" />
        <span>{getCurrentLabel()}</span>
        <ChevronDown className="size-3 opacity-60" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-[var(--card)] border border-[var(--hairline)] shadow-lg z-50 min-w-[280px]">
          <div className="p-3">
            <div className="space-y-1 mb-3">
              <p className="kicker-muted px-1 mb-2">Quick options</p>
              {filterOptions.map((option) => {
                const isSelected =
                  typeof currentFilter === "string" && currentFilter === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => handleQuickOption(option.value)}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? "bg-[var(--ink)] text-[var(--paper)]"
                        : "text-[var(--ink)] hover:bg-[var(--paper-alt)]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-[var(--hairline)] my-3" />

            <div className="space-y-2">
              <p className="kicker-muted px-1 flex items-center gap-2">
                <Calendar className="size-3" />
                Custom range
              </p>
              <div className="space-y-2 px-1">
                <div>
                  <label className="block text-[10px] tracking-[0.18em] uppercase text-[var(--muted-ink)] mb-1">
                    Start date
                  </label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--hairline)] bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand)]"
                    max={customEnd || undefined}
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.18em] uppercase text-[var(--muted-ink)] mb-1">
                    End date
                  </label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-[var(--hairline)] bg-[var(--card)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand)]"
                    min={customStart || undefined}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCustomRange}
                  disabled={!customStart || !customEnd}
                  className="btn-editorial btn-editorial-primary w-full justify-center"
                >
                  Apply range
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimestampFilter;