#!/usr/bin/env node
/**
 * Repeatable Lighthouse audit runner.
 *
 * - Starts a PRODUCTION server (`next start`) on port 3000 if one isn't
 *   already running, so audits always run against the compiled build, never
 *   `next dev`.
 * - Requires a production build to exist (run `pnpm build` first, or use the
 *   `audit:lighthouse:prod` script which builds then audits).
 * - Writes a machine-readable JSON report to `lighthouse-report.json`.
 *
 * Usage:
 *   node scripts/lighthouse-audit.mjs                     # audits /
 *   node scripts/lighthouse-audit.mjs <url>               # audits a specific URL
 *   node scripts/lighthouse-audit.mjs --desktop           # desktop form factor (default: mobile)
 *   node scripts/lighthouse-audit.mjs --only perf,seo     # only these categories
 *
 * Environment overrides:
 *   LIGHTHOUSE_URL      target URL (default: http://localhost:3000)
 *   PORT / HOST         server host/port (default: 3000 / localhost)
 *   LIGHTHOUSE_REPORT   report output path (default: ./lighthouse-report.json)
 */
import { spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "localhost";
const DEFAULT_URL = process.env.LIGHTHOUSE_URL ?? `http://${HOST}:${PORT}`;
const REPORT_PATH = path.resolve(process.env.LIGHTHOUSE_REPORT ?? path.join(ROOT, "lighthouse-report.json"));

const CLI_ARGS = process.argv.slice(2);
const CATEGORY_ALIASES = {
  perf: "performance",
  a11y: "accessibility",
  "best-practices": "best-practices",
  seo: "seo",
};

function parseArgs() {
  const opts = { url: DEFAULT_URL, formFactor: "mobile", only: null };
  for (const arg of CLI_ARGS) {
    if (/^https?:\/\//.test(arg)) {
      opts.url = arg;
    } else if (arg === "--desktop") {
      opts.formFactor = "desktop";
    } else if (arg === "--mobile") {
      opts.formFactor = "mobile";
    } else if (arg.startsWith("--only=")) {
      const raw = arg.slice("--only=".length);
      opts.only = raw
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => CATEGORY_ALIASES[c] ?? c);
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node scripts/lighthouse-audit.mjs [url] [--desktop|--mobile] [--only=perf,seo]
Env:
  LIGHTHOUSE_URL, PORT, HOST, LIGHTHOUSE_REPORT`);
      process.exit(0);
    }
  }
  return opts;
}

function isPortOpen(port, host) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, timeout: 1500 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port, host, timeoutMs = 90_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isPortOpen(port, host)) {
      return;
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`Timed out waiting for server at http://${host}:${port}`);
}

async function main() {
  const opts = parseArgs();
  let serverProcess = null;
  let spawnedServer = false;
  let chrome = null;

  const running = await isPortOpen(PORT, HOST);
  if (!running) {
    const buildId = path.join(ROOT, ".next", "BUILD_ID");
    if (!existsSync(buildId)) {
      console.error(
        "No production build found in .next. Run `pnpm build` first, or use `pnpm audit:lighthouse:prod` which builds then audits.",
      );
      process.exit(1);
    }
    console.log(`No server on http://${HOST}:${PORT} — starting \`next start\` (production)...`);
    const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
    serverProcess = spawn(process.execPath, [nextBin, "start", "-p", String(PORT), "-H", HOST], {
      stdio: "inherit",
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: "production" },
    });
    spawnedServer = true;
    await waitForServer(PORT, HOST);
  } else {
    console.log(`Reusing already-running server at http://${HOST}:${PORT}`);
  }

  const onlyCategories = opts.only ?? ["performance", "accessibility", "best-practices", "seo"];

  try {
    chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
    });

    const config = {
      extends: "lighthouse:default",
      settings: {
        onlyCategories,
        formFactor: opts.formFactor,
        screenEmulation:
          opts.formFactor === "mobile"
            ? { mobile: true, width: 412, height: 915, deviceScaleFactor: 2.625, disabled: false }
            : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
        throttlingMethod: "simulate",
        output: "json",
        maxWaitForFcp: 60_000,
        maxWaitForLoad: 90_000,
      },
    };

    console.log(`\nRunning Lighthouse (${opts.formFactor}) on ${opts.url}...`);
    const result = await lighthouse(opts.url, { port: chrome.port, output: "json", logLevel: "error" }, config);

    if (!result?.report) {
      throw new Error("Lighthouse produced no report — check the target URL is reachable.");
    }

    writeFileSync(REPORT_PATH, result.report, "utf8");
    const report = JSON.parse(result.report);

    console.log("\n=== Lighthouse Audit ===");
    console.log(`URL:      ${opts.url}`);
    console.log(`Factor:   ${opts.formFactor}`);
    console.log(`Report:   ${REPORT_PATH}`);
    console.log("--- Scores ---");
    for (const category of Object.values(report.categories)) {
      const score = category.score === null ? "n/a" : `${Math.round(category.score * 100)}`;
      console.log(`${category.title.padEnd(20)} ${score}`);
    }

    const metricNames = [
      "first-contentful-paint",
      "largest-contentful-paint",
      "speed-index",
      "total-blocking-time",
      "cumulative-layout-shift",
      "interactive",
    ];
    console.log("--- Core Web Vitals / Lab metrics ---");
    for (const key of metricNames) {
      const audit = report.audits[key];
      if (audit) {
        console.log(`${(audit.title || key).padEnd(30)} ${audit.displayValue ?? audit.score ?? "n/a"}`);
      }
    }

    console.log("\n--- Failed / informative audits ---");
    const perfAudits = report.categories.performance?.auditRefs ?? [];
    for (const ref of perfAudits) {
      const audit = report.audits[ref.id];
      if (audit && typeof audit.score === "number" && audit.score < 0.9) {
        console.log(`[${audit.score < 0.5 ? "FAIL" : "warn"}] ${audit.title}: ${audit.displayValue ?? audit.score}`);
      }
    }
  } finally {
    if (chrome) {
      try {
        await chrome.kill();
      } catch (err) {
        // Windows can hold a transient lock on Chrome's temp profile dir;
        // this is cosmetic and must not fail the audit.
        console.warn(`(cleanup) chrome.kill: ${err.code ?? err.message}`);
      }
    }
    if (spawnedServer && serverProcess) {
      console.log("\nStopping production server...");
      serverProcess.kill();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
