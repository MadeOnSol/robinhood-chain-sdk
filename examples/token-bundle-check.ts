/**
 * Robinhood Chain — launch-bundle + buyer-quality gate for one token.
 *
 * Detects a same-block early-buyer bundle and reads the first-20 buyer cohort
 * quality — a "should I touch this" gate before buying.
 *
 * Run:
 *   MADEONSOL_API_KEY=msk_... npx tsx examples/token-bundle-check.ts 0xTOKEN
 *
 * Free key at https://madeonsol.com/pricing.
 */
import { RobinhoodClient } from "robinhood-chain-sdk";

const apiKey = process.env.MADEONSOL_API_KEY;
if (!apiKey) {
  console.error("Set MADEONSOL_API_KEY — get a free one at https://madeonsol.com/pricing");
  process.exit(1);
}

const token = process.argv[2];
if (!token || !/^0x[0-9a-fA-F]{40}$/.test(token)) {
  console.error("Usage: token-bundle-check.ts <0x token address (40 hex)>");
  process.exit(1);
}

const client = new RobinhoodClient({ apiKey });

const [{ bundle }, quality] = await Promise.all([
  client.tokens.bundle(token),
  client.tokens.buyerQuality(token),
]);

console.log(`Token ${token}\n`);
console.log(`  Bundle: ${bundle.bundle_kind} · ${bundle.wallet_count} wallets`);
if (bundle.held_pct_of_supply != null) {
  console.log(`  Cohort still holds ${(bundle.held_pct_of_supply * 100).toFixed(1)}% of supply` +
    (bundle.fully_exited ? " (fully exited)" : ""));
}
console.log(`\n  Buyer quality: ${quality.quality.score}/100 · ${quality.quality.signal} (${quality.quality.confidence})`);
const b = quality.quality.breakdown;
console.log(`  alpha=${b.alpha_wallet_count} kol=${b.kol_count} bundle=${b.bundle_buyer_count} dump-cluster=${b.dump_cluster_count}`);

const bundled = bundle.bundle_kind === "same_block" && (bundle.held_pct_of_supply ?? 0) > 0.2 && !bundle.fully_exited;
if (bundled || quality.quality.signal === "negative") {
  console.log("\n  ⚠️  Elevated risk — bundle still sitting on supply and/or negative buyer signal.");
} else {
  console.log("\n  ✅  No obvious bundle/quality red flag.");
}
