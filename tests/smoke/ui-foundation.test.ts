import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";
import { Table } from "@/components/ui/table";
import { loadSiteConfig } from "@/config/site";
import { formatPrice } from "@/lib/currency";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const globalsCssPath = path.resolve(currentDir, "../../src/app/globals.css");
const globalsCss = readFileSync(globalsCssPath, "utf8");

describe("ui foundation", () => {
  it("exposes reusable storefront and admin navigation structures", () => {
    const site = loadSiteConfig();

    expect(site.storefrontNav.length).toBeGreaterThan(0);
    expect(site.adminNav.length).toBeGreaterThan(0);
  });

  it("formats Rs. values for reusable price display components", () => {
    expect(formatPrice(1299)).toBe("Rs. 1,299");
  });

  it("returns a detectable placeholder for invalid amounts", () => {
    expect(formatPrice("not-a-number")).toBe("--");
  });

  it("uses the current light palette tokens in globals", () => {
    expect(globalsCss).toContain("--background: #ffffff;");
    expect(globalsCss).toContain("--primary: #b88a24;");
    expect(globalsCss).not.toContain(".dark");
  });

  it("keeps shared form and table primitives bound to semantic design tokens", () => {
    const inputMarkup = renderToStaticMarkup(createElement(Input, { placeholder: "Email" }));
    const tableMarkup = renderToStaticMarkup(createElement(Table, null));

    expect(inputMarkup).toContain("border-input");
    expect(inputMarkup).toContain("bg-background");
    expect(inputMarkup).toContain("text-foreground");
    expect(tableMarkup).toContain("bg-card");
    expect(tableMarkup).toContain("text-card-foreground");
  });

  it("applies mobile zoom safeguards without disabling page zoom", () => {
    expect(globalsCss).toContain("touch-action: manipulation;");
    expect(globalsCss).toContain("@supports (-webkit-touch-callout: none)");
    expect(globalsCss).toContain("font-size: 16px;");
  });
});
