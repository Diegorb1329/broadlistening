export type TDemographics = Record<
  string,
  {
    ageGroup?: "<18" | "18-25" | "25-35" | "35-55" | "55+";
    gender?: "male" | "female";
    location?: string;
  }
>;

// Stub implementation: the original fetched demographics from an external
// deployment-specific API. This port has no demographics backend, so we
// return empty data with the same signature so all callers keep working.
const fetchDemographics = async (): Promise<TDemographics> => {
  return {};
};

export default fetchDemographics;
