import { describe, expect, it } from "vitest";

import {
  getReviewStatusLabel,
  isReviewModerationStatus,
  isReviewVisibleOnStorefront,
  reviewModerationStatuses,
} from "@/lib/reviews/moderation";

describe("reviewModerationStatuses", () => {
  it("contains all four statuses", () => {
    expect(reviewModerationStatuses).toEqual(
      expect.arrayContaining(["PENDING", "APPROVED", "REJECTED", "HIDDEN"]),
    );
    expect(reviewModerationStatuses).toHaveLength(4);
  });
});

describe("isReviewModerationStatus", () => {
  it("returns true for each valid status", () => {
    for (const status of reviewModerationStatuses) {
      expect(isReviewModerationStatus(status)).toBe(true);
    }
  });

  it("returns false for unknown strings", () => {
    expect(isReviewModerationStatus("UNKNOWN")).toBe(false);
    expect(isReviewModerationStatus("approved")).toBe(false); // case-sensitive
  });

  it("returns false for non-string values", () => {
    expect(isReviewModerationStatus(null)).toBe(false);
    expect(isReviewModerationStatus(undefined)).toBe(false);
    expect(isReviewModerationStatus(1)).toBe(false);
    expect(isReviewModerationStatus({})).toBe(false);
  });
});

describe("isReviewVisibleOnStorefront", () => {
  it("returns true only for APPROVED", () => {
    expect(isReviewVisibleOnStorefront("APPROVED")).toBe(true);
  });

  it("returns false for all other statuses", () => {
    expect(isReviewVisibleOnStorefront("PENDING")).toBe(false);
    expect(isReviewVisibleOnStorefront("REJECTED")).toBe(false);
    expect(isReviewVisibleOnStorefront("HIDDEN")).toBe(false);
  });

  it("returns false for null and undefined", () => {
    expect(isReviewVisibleOnStorefront(null)).toBe(false);
    expect(isReviewVisibleOnStorefront(undefined)).toBe(false);
  });
});

describe("getReviewStatusLabel", () => {
  it("returns human-readable label for each status", () => {
    expect(getReviewStatusLabel("APPROVED")).toBe("Approved");
    expect(getReviewStatusLabel("REJECTED")).toBe("Rejected");
    expect(getReviewStatusLabel("HIDDEN")).toBe("Hidden");
    expect(getReviewStatusLabel("PENDING")).toBe("Pending");
  });
});
