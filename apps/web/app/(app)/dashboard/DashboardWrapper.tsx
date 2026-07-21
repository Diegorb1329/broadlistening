"use client";

import { useEffect } from "react";
import Bhutan2035 from "../../_components/BroadListening";
import { useSearch } from "../../_components/SearchContext";

interface DashboardWrapperProps {
  reportUrl: string;
}

const DashboardWrapper = ({ reportUrl }: DashboardWrapperProps) => {
  const { searchQuery, timestampFilter, setShowSearchControls } = useSearch();

  // Enable search controls when this component mounts
  useEffect(() => {
    setShowSearchControls(true);
    
    // Cleanup: disable search controls when component unmounts
    return () => {
      setShowSearchControls(false);
    };
  }, [setShowSearchControls]);

  return (
    <Bhutan2035 
      reportUrl={reportUrl} 
      searchQuery={searchQuery}
      timestampFilter={timestampFilter}
    />
  );
};

export default DashboardWrapper;