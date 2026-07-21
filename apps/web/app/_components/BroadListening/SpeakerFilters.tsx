"use client";

import { Search } from "lucide-react";
import { TTopic } from "./TopicItem";
import { useState, useMemo } from "react";

export type SpeakerFilters = {
  topics: string[];
  subtopics: string[];
  locations: string[];
  search: string;
};

interface SpeakerFiltersProps {
  topics: TTopic[];
  availableLocations: string[];
  filters: SpeakerFilters;
  onFiltersChange: (filters: SpeakerFilters) => void;
}

const SpeakerFiltersComponent = ({
  topics,
  availableLocations,
  filters,
  onFiltersChange,
}: SpeakerFiltersProps) => {
  const [searchInput, setSearchInput] = useState(filters.search);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownTimeout, setDropdownTimeout] = useState<NodeJS.Timeout | null>(null);

  // Get available subtopics based on selected topics
  const availableSubtopics = useMemo(() => {
    if (filters.topics.length === 0) {
      return topics.flatMap((topic) => topic.subtopics);
    }
    return topics
      .filter((topic) => filters.topics.includes(topic.id))
      .flatMap((topic) => topic.subtopics);
  }, [topics, filters.topics]);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    onFiltersChange({ ...filters, search: value });
  };

  const handleDropdownEnter = (dropdownName: string) => {
    if (dropdownTimeout) {
      clearTimeout(dropdownTimeout);
      setDropdownTimeout(null);
    }
    setOpenDropdown(dropdownName);
  };

  const handleDropdownLeave = () => {
    const timeout = setTimeout(() => {
      setOpenDropdown(null);
    }, 150); // Small delay to allow moving between button and dropdown
    setDropdownTimeout(timeout);
  };

  const toggleFilter = (
    filterType: keyof Omit<SpeakerFilters, "search">,
    value: string
  ) => {
    const currentValues = filters[filterType];
    const newValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value];

    onFiltersChange({ ...filters, [filterType]: newValues });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      topics: [],
      subtopics: [],
      locations: [],
      search: "",
    });
    setSearchInput("");
  };

  const hasActiveFilters =
    filters.topics.length > 0 ||
    filters.subtopics.length > 0 ||
    filters.locations.length > 0 ||
    filters.search.length > 0;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-[var(--faint-ink)]" />
        <input
          type="text"
          placeholder="Search speakers…"
          value={searchInput}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-[var(--hairline)] bg-[var(--card)] text-[var(--ink)] placeholder:text-[var(--faint-ink)] focus:outline-none focus:border-[var(--brand)] transition-colors"
        />
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Topics */}
        <div className="relative">
          <button
            className="btn-editorial"
            data-active={filters.topics.length > 0 ? "true" : undefined}
            onMouseEnter={() => handleDropdownEnter("topics")}
            onMouseLeave={handleDropdownLeave}
          >
            <span>Topics</span>
            {filters.topics.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 bg-[var(--paper)] text-[var(--ink)] text-[10px] tabular-nums">
                {filters.topics.length}
              </span>
            )}
          </button>
          {openDropdown === "topics" && (
            <div
              className="absolute mt-2 p-2 bg-[var(--card)] border border-[var(--hairline)] shadow-lg z-50 max-h-60 overflow-auto min-w-max"
              onMouseEnter={() => handleDropdownEnter("topics")}
              onMouseLeave={handleDropdownLeave}
            >
              {topics.map((topic) => (
                <label
                  key={topic.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--paper-alt)] cursor-pointer whitespace-nowrap"
                >
                  <input
                    type="checkbox"
                    checked={filters.topics.includes(topic.id)}
                    onChange={() => toggleFilter("topics", topic.id)}
                    className="border-[var(--hairline)] accent-[var(--brand)]"
                  />
                  <span className="text-sm text-[var(--ink)]">{topic.title}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Subtopics */}
        {availableSubtopics.length > 0 && (
          <div className="relative">
            <button
              className="btn-editorial"
              data-active={filters.subtopics.length > 0 ? "true" : undefined}
              onMouseEnter={() => handleDropdownEnter("subtopics")}
              onMouseLeave={handleDropdownLeave}
            >
              <span>Subtopics</span>
              {filters.subtopics.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 bg-[var(--paper)] text-[var(--ink)] text-[10px] tabular-nums">
                  {filters.subtopics.length}
                </span>
              )}
            </button>
            {openDropdown === "subtopics" && (
              <div
                className="absolute mt-2 p-2 bg-[var(--card)] border border-[var(--hairline)] shadow-lg z-50 max-h-60 overflow-auto min-w-max"
                onMouseEnter={() => handleDropdownEnter("subtopics")}
                onMouseLeave={handleDropdownLeave}
              >
                {availableSubtopics.map((subtopic) => (
                  <label
                    key={subtopic.id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--paper-alt)] cursor-pointer whitespace-nowrap"
                  >
                    <input
                      type="checkbox"
                      checked={filters.subtopics.includes(subtopic.id)}
                      onChange={() => toggleFilter("subtopics", subtopic.id)}
                      className="border-[var(--hairline)] accent-[var(--brand)]"
                    />
                    <span className="text-sm text-[var(--ink)]">{subtopic.title}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}


        {/* Locations */}
        {availableLocations.length > 0 && (
          <div className="relative">
            <button
              className="btn-editorial"
              data-active={filters.locations.length > 0 ? "true" : undefined}
              onMouseEnter={() => handleDropdownEnter("locations")}
              onMouseLeave={handleDropdownLeave}
            >
              <span>Location</span>
              {filters.locations.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 bg-[var(--paper)] text-[var(--ink)] text-[10px] tabular-nums">
                  {filters.locations.length}
                </span>
              )}
            </button>
            {openDropdown === "locations" && (
              <div
                className="absolute mt-2 p-2 bg-[var(--card)] border border-[var(--hairline)] shadow-lg z-50 max-h-60 overflow-auto min-w-max"
                onMouseEnter={() => handleDropdownEnter("locations")}
                onMouseLeave={handleDropdownLeave}
              >
                {availableLocations.map((location) => (
                  <label
                    key={location}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-[var(--paper-alt)] cursor-pointer whitespace-nowrap"
                  >
                    <input
                      type="checkbox"
                      checked={filters.locations.includes(location)}
                      onChange={() => toggleFilter("locations", location)}
                      className="border-[var(--hairline)] accent-[var(--brand)]"
                    />
                    <span className="text-sm text-[var(--ink)]">{location}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-[11px] font-mono tracking-[0.2em] uppercase px-3 py-2 text-[var(--muted-ink)] hover:text-[var(--brand)] transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
    </div>
  );
};

export default SpeakerFiltersComponent;

