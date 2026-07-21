"use client";

import { DataProvider } from "./DataContext";

export const DataProviderWrapper = ({ children }: { children: React.ReactNode }) => {
  return <DataProvider>{children}</DataProvider>;
};

