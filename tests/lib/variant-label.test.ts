import { describe, expect, it } from "vitest";

import { DEFAULT_VARIANT_TITLE, getDisplayVariantLabel } from "@/lib/variant-label";

describe("getDisplayVariantLabel", () => {
  it("returns the label for meaningful variant titles", () => {
    expect(getDisplayVariantLabel("1 kg")).toBe("1 kg");
    expect(getDisplayVariantLabel("Citrus")).toBe("Citrus");
  });

  it("returns null for the internal Default placeholder", () => {
    expect(getDisplayVariantLabel(DEFAULT_VARIANT_TITLE)).toBeNull();
    expect(getDisplayVariantLabel("default")).toBeNull();
    expect(getDisplayVariantLabel("  DEFAULT  ")).toBeNull();
  });

  it("returns null for missing or empty titles", () => {
    expect(getDisplayVariantLabel(null)).toBeNull();
    expect(getDisplayVariantLabel(undefined)).toBeNull();
    expect(getDisplayVariantLabel("")).toBeNull();
    expect(getDisplayVariantLabel("   ")).toBeNull();
  });
});
