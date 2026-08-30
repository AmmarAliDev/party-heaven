import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect,it } from "vitest";

describe("global placeholder styles", () => {
  const cssPath = resolve(process.cwd(), "src/app/globals.css");
  const css = readFileSync(cssPath, "utf8");

  it("defines --placeholder token with the specified color", () => {
    expect(css).toMatch(/--placeholder:\s*#17171769/);
  });

  it("contains placeholder pseudo-element rules", () => {
    expect(css).toMatch(/::placeholder/);
  });
});
