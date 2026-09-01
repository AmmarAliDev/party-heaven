import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, getSecurityHeaders } from "@/config/security";

function getDirectiveValue(policy: string, directiveName: string): string {
  const directive = policy
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${directiveName} `));

  return directive ?? "";
}

describe("security config CSP", () => {
  it("keeps tracking script sources disabled when GTM env is not configured", () => {
    const policy = buildContentSecurityPolicy({ NODE_ENV: "production" });
    const scriptSrc = getDirectiveValue(policy, "script-src");

    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
    expect(scriptSrc).not.toContain("https://www.googletagmanager.com");
    expect(scriptSrc).not.toContain("https://connect.facebook.net");
  });

  it("allows Google Tag Manager + Meta Pixel script origins when GTM is configured", () => {
    const policy = buildContentSecurityPolicy({
      NODE_ENV: "production",
      NEXT_PUBLIC_GTM_ID: "GTM-TEST1234",
    });
    const scriptSrc = getDirectiveValue(policy, "script-src");

    expect(scriptSrc).toContain("https://www.googletagmanager.com");
    expect(scriptSrc).toContain("https://connect.facebook.net");
  });

  it("does not allow tracking script origins for blank GTM env values", () => {
    const policy = buildContentSecurityPolicy({
      NODE_ENV: "production",
      NEXT_PUBLIC_GTM_ID: "   ",
    });
    const scriptSrc = getDirectiveValue(policy, "script-src");

    expect(scriptSrc).not.toContain("https://www.googletagmanager.com");
    expect(scriptSrc).not.toContain("https://connect.facebook.net");
  });

  it("exposes CSP header with tracking script sources when GTM enabled", () => {
    const cspHeader = getSecurityHeaders({
      NODE_ENV: "production",
      NEXT_PUBLIC_GTM_ID: "GTM-TEST1234",
    }).find((header) => header.key === "Content-Security-Policy");

    expect(cspHeader?.value).toContain("script-src");
    expect(cspHeader?.value).toContain("https://www.googletagmanager.com");
    expect(cspHeader?.value).toContain("https://connect.facebook.net");
  });
});
