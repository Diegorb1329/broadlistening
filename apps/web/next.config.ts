import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@broadlistening/schema",
    "@broadlistening/llm",
    "@broadlistening/pipeline",
  ],
  // Workspace packages use NodeNext ".js" specifiers in .ts sources (they also
  // run under plain Node via tsx); teach webpack to resolve them.
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts", ".tsx"],
      ".mjs": [".mjs", ".mts"],
    };
    return config;
  },
};

export default withWorkflow(nextConfig);
