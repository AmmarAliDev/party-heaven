import { describe, expect, it } from "vitest";

import {
  getMetaCapiConfig,
  isMetaCapiEnabled,
  META_CAPI_DEFAULT_GRAPH_VERSION,
} from "@/features/analytics/meta-capi";

const enabledEnv = {
  META_PIXEL_ID: "123456789",
  META_CAPI_ACCESS_TOKEN: "EAAG-test-token",
};

describe("meta-capi config", () => {
  it("is disabled when both variables are missing", () => {
    expect(getMetaCapiConfig({})).toBeNull();
    expect(isMetaCapiEnabled({})).toBe(false);
  });

  it("is disabled when only the pixel id is present", () => {
    expect(getMetaCapiConfig({ META_PIXEL_ID: "123456789" })).toBeNull();
    expect(isMetaCapiEnabled({ META_PIXEL_ID: "123456789" })).toBe(false);
  });

  it("is disabled when only the access token is present", () => {
    expect(getMetaCapiConfig({ META_CAPI_ACCESS_TOKEN: "EAAG-test-token" })).toBeNull();
  });

  it("resolves a config when both are set", () => {
    expect(getMetaCapiConfig(enabledEnv)).toEqual({
      pixelId: "123456789",
      accessToken: "EAAG-test-token",
      graphVersion: META_CAPI_DEFAULT_GRAPH_VERSION,
    });
    expect(isMetaCapiEnabled(enabledEnv)).toBe(true);
  });

  it("honours the test event code and graph version overrides", () => {
    const config = getMetaCapiConfig({
      ...enabledEnv,
      META_CAPI_TEST_EVENT_CODE: "TESTCODE123",
      META_CAPI_GRAPH_VERSION: "v22.0",
    });

    expect(config?.testEventCode).toBe("TESTCODE123");
    expect(config?.graphVersion).toBe("v22.0");
  });
});
