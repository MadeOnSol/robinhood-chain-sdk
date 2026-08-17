#!/usr/bin/env node
/**
 * route-parity-check.mjs — fails CI if this SDK references an `/rhc/*` API path
 * that is not one of the 54 published Robinhood Chain route patterns (rename
 * drift). 54 patterns, 54 operations — the rule-engine collection and item paths
 * each serve several methods (GET/POST, GET/PATCH/DELETE).
 *
 * This standalone repo is NOT scanned by the monorepo's sdk-route-parity guard,
 * so it ships its own. The 54 patterns are pinned below (the authoritative RHC
 * surface, chain id 4663). Set OPENAPI_URL to instead validate against the live
 * spec's `/rhc/*` paths.
 *
 *   node scripts/route-parity-check.mjs
 *   OPENAPI_URL=https://madeonsol.com/api/v1/openapi.json node scripts/route-parity-check.mjs
 *
 * Exit 0 = all paths resolve · 1 = a path has no route · 2 = setup/extractor error.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "src");

// The 54 authoritative Robinhood Chain route patterns (relative to /api/v1), normalized.
const RHC_ROUTES = [
  "/rhc/alpha-wallets",
  "/rhc/alpha/leaderboard",
  "/rhc/copytrade/signals",
  "/rhc/copytrade/subscriptions",
  "/rhc/copytrade/subscriptions/:p",
  "/rhc/deployer-hunter/:p",
  "/rhc/deployer-hunter/:p/history",
  "/rhc/deployer-hunter/:p/tokens",
  "/rhc/deployer-hunter/:p/trajectory",
  "/rhc/deployer-hunter/alerts",
  "/rhc/deployer-hunter/best-tokens",
  "/rhc/deployer-hunter/leaderboard",
  "/rhc/deployer-hunter/recent-bonds",
  "/rhc/deployer-hunter/stats",
  "/rhc/equities",
  "/rhc/kol/:p",
  "/rhc/kol/coordination",
  "/rhc/kol/coordination/alerts",
  "/rhc/kol/coordination/alerts/:p",
  "/rhc/kol/feed",
  "/rhc/kol/first-touches",
  "/rhc/kol/first-touches/subscriptions",
  "/rhc/kol/first-touches/subscriptions/:p",
  "/rhc/kol/hot-tokens",
  "/rhc/kol/leaderboard",
  "/rhc/kol/tokens/hot",
  "/rhc/lp-events",
  "/rhc/price-alerts",
  "/rhc/price-alerts/:p",
  "/rhc/price-alerts/events",
  "/rhc/token/:p",
  "/rhc/token/batch",
  "/rhc/tokens",
  "/rhc/tokens/:p",
  "/rhc/tokens/:p/bundle",
  "/rhc/tokens/:p/buyer-quality",
  "/rhc/tokens/:p/candles",
  "/rhc/tokens/:p/flow",
  "/rhc/tokens/:p/holders",
  "/rhc/tokens/:p/kol-consensus",
  "/rhc/tokens/:p/peak-history",
  "/rhc/tokens/:p/risk",
  "/rhc/tokens/:p/top-traders",
  "/rhc/tokens/:p/trades",
  "/rhc/tokens/batch/buyer-quality",
  "/rhc/trades",
  "/rhc/wallet-tracker/summary",
  "/rhc/wallet-tracker/trades",
  "/rhc/wallet-tracker/watchlist",
  "/rhc/wallet-tracker/watchlist/:p",
  "/rhc/wallet/:p",
  "/rhc/wallet/:p/pnl",
  "/rhc/wallet/:p/positions",
  "/rhc/wallet/:p/trades",
];

function normalize(p) {
  let s = p.split(/[?#]/)[0];
  s = s.replace(/\$\{[^}]*\}/g, ":p").replace(/\{[^}]*\}/g, ":p"); // ${x}, {x} -> :p
  s = s.replace(/\/+$/, "");
  return s;
}

const ALLOW = new Set((process.env.ALLOW || "").split(",").map((s) => s.trim()).filter(Boolean));

let ROUTES;
if (process.env.OPENAPI_URL) {
  const spec = await (await fetch(process.env.OPENAPI_URL)).json().catch(() => null);
  if (!spec || !spec.paths) {
    console.error(`route-parity: could not load OpenAPI spec from ${process.env.OPENAPI_URL}`);
    process.exit(2);
  }
  ROUTES = new Set(
    Object.keys(spec.paths)
      .map(normalize)
      .filter((r) => r.startsWith("/rhc/")),
  );
} else {
  ROUTES = new Set(RHC_ROUTES.map(normalize));
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    if (["node_modules", "dist", "build", "examples", "tests", "test"].includes(e)) continue;
    const f = path.join(dir, e);
    if (statSync(f).isDirectory()) out.push(...walk(f));
    else if (f.endsWith(".ts") && !f.endsWith(".d.ts")) out.push(f);
  }
  return out;
}

const STR = /"([^"]*)"|`([^`]*)`/g;
const problems = [];
let count = 0;
for (const file of walk(SRC)) {
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      for (const m of line.matchAll(STR)) {
        const raw = m[1] ?? m[2] ?? "";
        const c = raw.replace(/^\/api\/v1/, ""); // strip base prefix if present
        if (!/^\/rhc\//.test(c)) continue; // only Robinhood Chain path literals
        count++;
        const norm = normalize(c);
        if (!norm || ALLOW.has(raw) || ALLOW.has(norm)) continue;
        if (!ROUTES.has(norm)) problems.push(`${path.relative(process.cwd(), file)}:${i + 1}  "${raw}"  ->  ${norm}`);
      }
    });
}

if (count < RHC_ROUTES.length) {
  console.error(`route-parity: only ${count} /rhc/ path literals found in src/ — expected ≥ ${RHC_ROUTES.length}. Extractor may be broken or a route is missing.`);
  process.exit(2);
}
const uniq = [...new Set(problems)];
if (uniq.length) {
  console.error(`\n❌ route-parity: ${uniq.length} SDK path(s) with no matching RHC route (rename drift?):\n  ${uniq.join("\n  ")}\n`);
  process.exit(1);
}
console.log(`✅ route-parity: all ${count} /rhc/ path literals resolve to one of the ${ROUTES.size} Robinhood Chain routes`);
