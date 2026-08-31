import { describe, expect, it } from "vitest";

import { loadAppConfig } from "../../src/config/app-config";
import { getRequiredServerEnv, loadRuntimeEnv } from "../../src/config/env";
import { featureFlags } from "../../src/config/feature-flags";
import { buildMetadata } from "../../src/config/metadata";
import { routes } from "../../src/config/routes";
import { appViewport } from "../../src/config/viewport";

describe("architecture scaffold", () => {
  it("builds consistent metadata for top-level pages", () => {
    const metadata = buildMetadata({ title: "Admin" });

    expect(metadata.title).toBe("Admin | PARTY HEAVEN");
    expect(metadata.applicationName).toBe("PARTY HEAVEN");
  });

  it("omits keywords metadata when none are provided", () => {
    const metadata = buildMetadata({ title: "Admin" });

    expect(metadata.keywords).toBeUndefined();
  });

  it("includes keywords metadata when provided", () => {
    const metadata = buildMetadata({
      title: "Daily Face Wash",
      keywords: "face wash, skincare, daily cleanser",
    });

    expect(metadata.keywords).toBe("face wash, skincare, daily cleanser");
  });

  it("exposes shared placeholder routes", () => {
    expect(routes.storefront.home).toBe("/");
    expect(routes.admin.dashboard).toBe("/admin");
    expect(routes.auth.signIn).toBe("/auth/sign-in");
  });

  it("keeps unfinished commerce features off by default", () => {
    expect(featureFlags.checkout).toBe(false);
    expect(featureFlags.payments).toBe(false);
  });
});

describe("engineering quality config", () => {
  it("keeps a standards-compliant base viewport without disabling zoom", () => {
    expect(appViewport.width).toBe("device-width");
    expect(appViewport.initialScale).toBe(1);
    expect(appViewport.interactiveWidget).toBe("resizes-visual");
    expect(appViewport.maximumScale).toBeUndefined();
    expect(appViewport.userScalable).toBeUndefined();
  });

  it("loads safe shared config from a validated env snapshot", () => {
    const config = loadAppConfig({
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3100",
      NEXT_PUBLIC_DEFAULT_CITY: "Lahore",
      NEXT_PUBLIC_ENABLE_ADMIN: "false",
      NEXT_PUBLIC_ENABLE_AUTH: "true",
    });

    expect(config.env.appUrl).toBe("http://localhost:3100");
    expect(config.site.defaultCity).toBe("Lahore");
    expect(config.featureFlags.adminPreview).toBe(false);
    expect(config.featureFlags.authPreview).toBe(true);
  });

  it("shows a readable error for invalid public env values", () => {
    expect(() =>
      loadRuntimeEnv({
        NEXT_PUBLIC_APP_URL: "not-a-valid-url",
        NEXT_PUBLIC_DEFAULT_CITY: "",
      }),
    ).toThrow(/Invalid public environment configuration:/);
  });

  it("shows a readable error when a required server env value is missing", () => {
    expect(() => getRequiredServerEnv("APP_SECRET", {})).toThrow(
      /Missing required environment variable: APP_SECRET/,
    );
  });
});
