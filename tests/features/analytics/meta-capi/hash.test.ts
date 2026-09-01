import { describe, expect, it } from "vitest";

import {
  hashUserData,
  hashValue,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  splitFullName,
} from "@/features/analytics/meta-capi";

describe("meta-capi hash helpers", () => {
  describe("normalizeEmail", () => {
    it("trims and lowercases", () => {
      expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com");
    });
  });

  describe("normalizePhone", () => {
    it("strips spaces, dashes, parens, dots and leading plus", () => {
      expect(normalizePhone("+92 (300) 111-22.33")).toBe("923001112233");
    });
  });

  describe("normalizeName", () => {
    it("trims, lowercases and collapses whitespace", () => {
      expect(normalizeName("  Ammar   Ali ")).toBe("ammar ali");
    });
  });

  describe("hashValue", () => {
    it("returns a deterministic 64-char hex digest", () => {
      const digest = hashValue("ammar@example.com");
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
      expect(hashValue("ammar@example.com")).toBe(digest);
      expect(hashValue("ammar@example.com")).not.toBe(hashValue("ali@example.com"));
    });
  });

  describe("splitFullName", () => {
    it("splits first and last name", () => {
      expect(splitFullName("Ammar Ali")).toEqual({ firstName: "Ammar", lastName: "Ali" });
    });

    it("keeps multi-word last names together", () => {
      expect(splitFullName("Ayesha Khan Tareen")).toEqual({
        firstName: "Ayesha",
        lastName: "Khan Tareen",
      });
    });

    it("returns only firstName for a single token", () => {
      expect(splitFullName("Ammar")).toEqual({ firstName: "Ammar" });
    });

    it("returns empty object for blank input", () => {
      expect(splitFullName("   ")).toEqual({});
    });
  });

  describe("hashUserData", () => {
    it("hashes email, phone, names and external id", () => {
      const result = hashUserData({
        email: "User@Example.com",
        phone: "+92 300 1112233",
        fullName: "Ammar Ali",
        externalId: "user-123",
      });

      expect(result.em).toEqual([hashValue("user@example.com")]);
      expect(result.ph).toEqual([hashValue("923001112233")]);
      expect(result.fn).toEqual([hashValue("ammar")]);
      expect(result.ln).toEqual([hashValue("ali")]);
      expect(result.external_id).toEqual([hashValue("user-123")]);
    });

    it("omits empty and null values", () => {
      const result = hashUserData({
        email: null,
        phone: "   ",
        fullName: null,
        externalId: null,
      });

      expect(result).toEqual({});
    });
  });
});
