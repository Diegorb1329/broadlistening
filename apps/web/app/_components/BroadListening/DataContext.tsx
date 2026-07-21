"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { TTopic } from "./TopicItem";
import { TDemographics } from "./utils/fetch-demographics";
import { TSpeaker } from "./utils/aggregate-speakers";
import { aggregateSpeakers } from "./utils/aggregate-speakers";
import parseTopics from "./utils/parse-topics";

type ParsedData = ReturnType<typeof parseTopics>;

type DataCache = {
  topics: TTopic[];
  demographics: TDemographics;
  speakers: TSpeaker[];
  parsedData: ParsedData | null;
  reportUrl: string | null;
  loading: boolean;
  error: string | null;
};

type DataContextType = {
  data: DataCache;
  loadData: (reportUrl: string) => Promise<void>;
  clearData: () => void;
};

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider = ({ children }: { children: React.ReactNode }) => {
  const [data, setData] = useState<DataCache>({
    topics: [],
    demographics: {},
    speakers: [],
    parsedData: null,
    reportUrl: null,
    loading: false,
    error: null,
  });

  const loadData = useCallback(async (reportUrl: string) => {
    // If data is already loaded for this report URL, don't fetch again
    if (data.reportUrl === reportUrl && data.topics.length > 0) {
      return;
    }

    // If already loading, wait for it
    if (data.loading) {
      return;
    }

    setData((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Fetch data on the client side
      const response = await fetch(`/api/report?url=${encodeURIComponent(reportUrl)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch report: ${response.status}`);
      }

      const topicsData = await response.json();
      
      const parsedData = parseTopics(topicsData);
      
      // Fetch demographics (with error handling)
      let demographics = {};
      try {
        const { default: fetchDemographics } = await import("./utils/fetch-demographics");
        demographics = await fetchDemographics();
      } catch (error) {
        console.warn("Failed to fetch demographics, continuing without demographics data:", error);
      }
      const speakers = aggregateSpeakers(parsedData.topics, demographics);

      setData({
        topics: parsedData.topics,
        demographics,
        speakers,
        parsedData,
        reportUrl,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error loading data:", error);
      setData((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load data",
      }));
    }
  }, [data.reportUrl, data.topics.length, data.loading]);

  const clearData = useCallback(() => {
    setData({
      topics: [],
      demographics: {},
      speakers: [],
      parsedData: null,
      reportUrl: null,
      loading: false,
      error: null,
    });
  }, []);

  return (
    <DataContext.Provider value={{ data, loadData, clearData }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};

