"use client";

import React, { createContext, useContext, useState } from "react";
import { TimestampFilterType } from "./BroadListening/TimestampFilter";

interface SearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  timestampFilter: TimestampFilterType;
  setTimestampFilter: (filter: TimestampFilterType) => void;
  showSearchControls: boolean;
  setShowSearchControls: (show: boolean) => void;
  hasTimestampData: boolean;
  setHasTimestampData: (hasData: boolean) => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    // Return default values when SearchProvider is not available
    return {
      searchQuery: "",
      setSearchQuery: () => {},
      timestampFilter: "all" as TimestampFilterType,
      setTimestampFilter: () => {},
      showSearchControls: false,
      setShowSearchControls: () => {},
      hasTimestampData: false,
      setHasTimestampData: () => {},
    };
  }
  return context;
};

export const SearchProvider = ({ children }: { children: React.ReactNode }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [timestampFilter, setTimestampFilter] = useState<TimestampFilterType>("all");
  const [showSearchControls, setShowSearchControls] = useState(false);
  const [hasTimestampData, setHasTimestampData] = useState(false);

  return (
    <SearchContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        timestampFilter,
        setTimestampFilter,
        showSearchControls,
        setShowSearchControls,
        hasTimestampData,
        setHasTimestampData,
      }}
    >
      {children}
    </SearchContext.Provider>
  );
};