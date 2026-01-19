import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * SECURITY: Production hardening
   *
   * - Disable source maps in production to prevent reverse engineering
   * - This prevents exposure of reasoning logic, weights, and scoring functions
   * - Source maps are still available in development for debugging
   */
  productionBrowserSourceMaps: false,
};

export default nextConfig;
