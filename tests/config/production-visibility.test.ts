import { describe, expect, it } from "vitest";

import { isProductionRuntime, type ProductionGuardSurface,shouldRenderGuardedSurface } from "@/config/production-visibility";

const allGuardedSurfaces: ProductionGuardSurface[] = [
  "homepageFallbackIndicator",
  "storefrontPreviewRoute",
  "footerPreviewLink",
  "footerNewsletterPlaceholder",
  "returnPolicyPlaceholderPage",
  "aboutInterimNarrativeNote",
  "notFoundAdminPlaceholderAction",
];

const baseRuntimeEnv = {
  appUrl: "http://localhost:3000",
  defaultCity: "Karachi",
  enableAdminPreview: true,
  enableAuthPreview: true,
  gaId: undefined,
  metaPixelId: undefined,
} as const;

describe("production visibility guards", () => {
  it("detects production runtime correctly", () => {
    expect(isProductionRuntime({ ...baseRuntimeEnv, nodeEnv: "production" })).toBe(true);
    expect(isProductionRuntime({ ...baseRuntimeEnv, nodeEnv: "development" })).toBe(false);
    expect(isProductionRuntime({ ...baseRuntimeEnv, nodeEnv: "test" })).toBe(false);
  });

  it("hides guarded surfaces in production", () => {
    for (const surface of allGuardedSurfaces) {
      expect(shouldRenderGuardedSurface(surface, { ...baseRuntimeEnv, nodeEnv: "production" })).toBe(false);
    }
  });

  it("keeps guarded surfaces visible in development and test", () => {
    for (const surface of allGuardedSurfaces) {
      expect(shouldRenderGuardedSurface(surface, { ...baseRuntimeEnv, nodeEnv: "development" })).toBe(true);
      expect(shouldRenderGuardedSurface(surface, { ...baseRuntimeEnv, nodeEnv: "test" })).toBe(true);
    }
  });
});
