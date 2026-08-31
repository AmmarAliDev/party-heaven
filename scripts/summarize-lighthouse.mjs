#!/usr/bin/env node
/**
 * Summarizes Lighthouse JSON reports in ./lighthouse-reports (or a dir passed
 * as argv[2]). Prints the requested category score and any failing audits.
 * Usage: node scripts/summarize-lighthouse.mjs [category=seo] [reportsDir]
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const category = process.argv[2] ?? "seo";
const dir = process.argv[3] ?? path.join(ROOT, "lighthouse-reports");

const files = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort();

const lines = [];
for (const file of files) {
  const report = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  const cat = report.categories[category];
  if (!cat) continue;
  const score = cat.score === null ? "n/a" : Math.round(cat.score * 100);
  lines.push(`===== ${file}  |  ${category.toUpperCase()}: ${score} =====`);
  for (const ref of cat.auditRefs ?? []) {
    const audit = report.audits[ref.id];
    if (!audit) continue;
    if (typeof audit.score === "number" && audit.score < 1 && audit.scoreDisplayMode !== "notApplicable") {
      lines.push(`  [${Math.round(audit.score * 100)}] ${audit.title} :: ${audit.displayValue ?? ""}`);
    }
  }
}

console.log(lines.join("\n"));
